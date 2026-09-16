import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

export type MenuCategory = 'makanan_utama' | 'lauk_hewani' | 'lauk_nabati' | 'sayuran' | 'buah_snack' | 'minuman';
export type MealTime = 'pagi' | 'siang' | 'malam' | 'snack';
export type OrderStatus = 'baru' | 'diproses' | 'diantar' | 'selesai' | 'dibatalkan';

export interface MenuItem {
  id: string;
  name: string;
  price: number; // Harga dalam Rupiah (Rp)
  category: MenuCategory;
  mealTimes: MealTime[];
  calories: number; // kkal
  protein: number; // gram
  carbs: number; // gram
  fat: number; // gram
  sodium: number; // mg
  description: string;
  isAvailable: boolean;
  stock?: number; // Sisa stok porsi menu
  image?: string;
}

export interface OrderItem {
  menuItemId: string;
  name: string;
  portion: number;
  price: number;
  category: string;
  calories: number;
}

export interface HospitalOrder {
  id: string;
  orderNumber: string;
  registrationNo: string; // No. Registrasi SIMRS
  createdAt: string;
  roomName: string; // Nama kamar / Ruangan rawat inap
  patientName: string;
  phoneNumber: string; // Nomor telepon WhatsApp
  mealTime: MealTime;
  items: OrderItem[];
  totalPrice: number;
  totalCalories: number;
  patientNotes?: string;
  status: OrderStatus;
  statusHistory: {
    status: OrderStatus;
    timestamp: string;
    note?: string;
  }[];
  simrsSync?: {
    synced: boolean;
    statusText: string;
    timestamp?: string;
    targetUrl?: string;
    response?: any;
    error?: string;
  };
}

export interface SimrsSettings {
  apiUrl: string;            // Endpoint Laravel SIMRS (cth: http://192.168.1.50:8000/api/save-pesanan-gizi)
  apiKey?: string;           // Token autentikasi SIMRS (X-AUTH-TOKEN)
  authHeaderType?: 'X-AUTH-TOKEN' | 'Bearer' | 'Both'; // Mode otentikasi header (default: X-AUTH-TOKEN)
  autoSyncOnOrder: boolean;  // Otomatis kirim saat pasien klik pesan
  isConfigured: boolean;
}

// Initial Menu Catalog with standardized prices in Rupiah (dimulai kosong)
const INITIAL_MENU: MenuItem[] = [];

// Riwayat pesanan dimulai kosong murni dari DB SIMRS (tanpa pesanan dummy/default)
const INITIAL_ORDERS: HospitalOrder[] = [];

// Persistent Storage Files for Cross-Device Synchronization
const MENU_DATA_FILE = path.join(process.cwd(), 'menu_items.json');
const ORDERS_DATA_FILE = path.join(process.cwd(), 'orders_data.json');

function loadPersistentMenuItems(): MenuItem[] {
  try {
    if (fs.existsSync(MENU_DATA_FILE)) {
      const raw = fs.readFileSync(MENU_DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[Storage] Gagal membaca menu_items.json:', err);
  }
  return [...INITIAL_MENU];
}

function savePersistentMenuItems(items: MenuItem[]) {
  try {
    fs.writeFileSync(MENU_DATA_FILE, JSON.stringify(items, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Storage] Gagal menyimpan menu_items.json:', err);
  }
}

function loadPersistentOrders(): HospitalOrder[] {
  try {
    if (fs.existsSync(ORDERS_DATA_FILE)) {
      const raw = fs.readFileSync(ORDERS_DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(o => o && o.id !== 'ord-101' && o.id !== 'ord-102');
      }
    }
  } catch (err) {
    console.warn('[Storage] Gagal membaca orders_data.json:', err);
  }
  return [];
}

function savePersistentOrders(list: HospitalOrder[]) {
  try {
    fs.writeFileSync(ORDERS_DATA_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Storage] Gagal menyimpan orders_data.json:', err);
  }
}

// In-memory state synchronized with persistent disk files
let menuItems: MenuItem[] = loadPersistentMenuItems();
let orders: HospitalOrder[] = loadPersistentOrders();

// --- Admin Password Security Persistence ---
const ADMIN_SECURITY_FILE = path.join(process.cwd(), 'admin_security.json');

function loadAdminPassword(): string {
  try {
    if (fs.existsSync(ADMIN_SECURITY_FILE)) {
      const data = JSON.parse(fs.readFileSync(ADMIN_SECURITY_FILE, 'utf-8'));
      if (data && typeof data.password === 'string' && data.password.trim().length > 0) {
        const pwd = data.password.trim();
        if (pwd !== 'admin123') {
          return pwd;
        }
      }
    }
  } catch (err) {
    console.warn('[Security] Gagal membaca admin_security.json:', err);
  }
  return '';
}

let currentServerAdminPassword = loadAdminPassword();

function saveAdminPassword(pwd: string) {
  try {
    fs.writeFileSync(ADMIN_SECURITY_FILE, JSON.stringify({ password: pwd, updatedAt: new Date().toISOString() }, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Security] Gagal menyimpan admin_security.json:', err);
  }
}

// Clear out admin123 if present in file
if (fs.existsSync(ADMIN_SECURITY_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(ADMIN_SECURITY_FILE, 'utf-8'));
    if (data?.password === 'admin123') {
      saveAdminPassword('');
    }
  } catch {}
}

// URL Resolvers for Hospital SIMRS endpoints (RSBSA Online Medifirst2000)
/**
 * Normalizes any SIMRS endpoint URL back to its base EMR path.
 * Strips any trailing action suffixes (e.g. /update-status-pesanan-gizi, /riwayat-pesanan-gizi, etc.)
 * so compound paths like /update-status-pesanan-gizi/riwayat-pesanan-gizi never occur.
 */
function extractSimrsBaseUrl(inputUrl?: string): string {
  const defaultBase = 'https://rsbsaonline.com/service/medifirst2000/emr';
  if (!inputUrl || !inputUrl.trim()) return defaultBase;
  let u = inputUrl.trim().replace(/\/+$/, '');

  // Anchor pattern: directly capture the base EMR or API path if present
  const emrMatch = u.match(/^(https?:\/\/[^\/]+(?:\/[^\/]+)*?\/(?:service\/medifirst2000\/emr|api))(?:\/.*)?$/i);
  if (emrMatch && emrMatch[1]) {
    return emrMatch[1];
  }

  // Strip any known endpoint action suffix repeatedly (even if chained)
  const actionPattern = /\/(?:save-pesanan-gizi|update-status-pesanan-gizi|riwayat-pesanan-gizi|rekap-pesanan-gizi|detail-pesanan-gizi|master-menu-gizi|save-master-menu|sync-batch-menu|save-data-mmpi|pesanan-gizi)(?:\/.*)?$/i;
  let safety = 0;
  while (actionPattern.test(u) && safety < 10) {
    u = u.replace(actionPattern, '').replace(/\/+$/, '');
    safety++;
  }

  return u || defaultBase;
}

function resolveSimrsOrderUrl(inputUrl?: string): string {
  return `${extractSimrsBaseUrl(inputUrl)}/save-pesanan-gizi`;
}

function resolveSimrsBatchMenuUrl(inputUrl?: string): string {
  return `${extractSimrsBaseUrl(inputUrl)}/sync-batch-menu`;
}

function resolveSimrsFetchOrdersUrl(inputUrl?: string): string {
  return `${extractSimrsBaseUrl(inputUrl)}/riwayat-pesanan-gizi`;
}

function resolveSimrsFetchMenuUrl(inputUrl?: string): string {
  const base = `${extractSimrsBaseUrl(inputUrl)}/master-menu-gizi`;
  return base.includes('?') ? `${base}&include_all=1&all=1` : `${base}?include_all=1&all=1`;
}

function resolveSimrsSingleMenuUrl(inputUrl?: string): string {
  return `${extractSimrsBaseUrl(inputUrl)}/save-master-menu`;
}

function resolveSimrsUpdateStatusUrl(inputUrl?: string): string {
  return `${extractSimrsBaseUrl(inputUrl)}/update-status-pesanan-gizi`;
}

function resolveSimrsRekapUrl(inputUrl?: string): string {
  return `${extractSimrsBaseUrl(inputUrl)}/rekap-pesanan-gizi`;
}

export const parsePgNumber = (val: any, defaultVal = 0): number => {
  if (val === undefined || val === null) return defaultVal;
  if (typeof val === 'number') return isNaN(val) ? defaultVal : val;
  const str = String(val).replace(',', '.').replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(str);
  return isNaN(parsed) ? defaultVal : parsed;
};

export const parsePgBoolean = (val: any, defaultVal = true): boolean => {
  if (val === undefined || val === null) return defaultVal;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val === 1;
  const str = String(val).toLowerCase().trim();
  if (str === 'f' || str === 'false' || str === '0' || str === 'n' || str === 'no' || str === 'habis' || str === 'tidak' || str === 'kosong') return false;
  if (str === 't' || str === 'true' || str === '1' || str === 'y' || str === 'yes' || str === 'tersedia' || str === 'ada') return true;
  return defaultVal;
};

export function getCategoryFallbackImageServer(category: string, menuName = ''): string {
  const lowerName = (menuName || '').toLowerCase();
  if (lowerName.includes('nasi kuning')) {
    return 'https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=500&q=80';
  }
  if (lowerName.includes('bubur')) {
    return 'https://images.unsplash.com/photo-1541832676-9b763b0239ab?auto=format&fit=crop&w=500&q=80';
  }
  if (lowerName.includes('roti')) {
    return 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=500&q=80';
  }
  if (lowerName.includes('ayam')) {
    return 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=500&q=80';
  }
  if (lowerName.includes('ikan')) {
    return 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=500&q=80';
  }
  if (lowerName.includes('telur')) {
    return 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=500&q=80';
  }
  if (lowerName.includes('mie') || lowerName.includes('bihun')) {
    return 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=500&q=80';
  }
  if (lowerName.includes('sup') || lowerName.includes('sayur') || lowerName.includes('bening')) {
    return 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=500&q=80';
  }
  if (lowerName.includes('teh')) {
    return 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=500&q=80';
  }
  if (lowerName.includes('air')) {
    return 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=500&q=80';
  }
  if (lowerName.includes('buah') || lowerName.includes('pisang') || lowerName.includes('pepaya') || lowerName.includes('melon')) {
    return 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&w=500&q=80';
  }
  switch (category) {
    case 'lauk_hewani':
      return 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=500&q=80';
    case 'lauk_nabati':
      return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=500&q=80';
    case 'sayuran':
      return 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=500&q=80';
    case 'buah_snack':
      return 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&w=500&q=80';
    case 'minuman':
      return 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=500&q=80';
    case 'makanan_utama':
    default:
      return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=500&q=80';
  }
}

export const parsePgImage = (raw: any, fallback = '', menuName = '', category = 'makanan_utama'): string => {
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (s.startsWith('data:image/') || s.startsWith('http://') || s.startsWith('https://')) {
      return s;
    }
    if (s.length > 10 && s !== 'true' && s !== 'false' && s !== '1' && s !== '0' && s !== 'null' && s !== 'undefined') {
      return s;
    }
  }
  if (fallback && typeof fallback === 'string' && fallback.length > 5 && fallback !== 'true' && fallback !== 'false') {
    return fallback;
  }
  return getCategoryFallbackImageServer(category, menuName);
};

export async function autoFetchSimrsMenuFromServer(): Promise<MenuItem[]> {
  const rawTargetUrl = simrsSettings.apiUrl || 'https://rsbsaonline.com/service/medifirst2000/emr/master-menu-gizi';
  const targetUrl = resolveSimrsFetchMenuUrl(rawTargetUrl);
  const targetToken = (simrsSettings.apiKey || '').trim();

  // Jika token belum diatur, lewati sinkronisasi remote dan tetap gunakan menu yang ada
  if (!targetToken) {
    return menuItems;
  }

  try {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };
    const rawToken = targetToken.replace(/^Bearer\s+/i, '').trim();
    headers['X-AUTH-TOKEN'] = rawToken;
    headers['Authorization'] = `Bearer ${rawToken}`;

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      return menuItems;
    }

    const parsedData = await response.json().catch(() => null);
    if (!parsedData) return menuItems;

    let menus = Array.isArray(parsedData) ? parsedData : (Array.isArray(parsedData?.data) ? parsedData.data : []);
    if (!Array.isArray(menus) || menus.length === 0) {
      return menuItems;
    }

    const transformedMenus: MenuItem[] = menus.map((m: any) => {
      let parsedMealTimes: ('pagi' | 'siang' | 'malam' | 'snack')[] = ['pagi', 'siang', 'malam'];
      const rawTimes = m.waktu_makan || m.mealTimes || m.meal_time;
      if (Array.isArray(rawTimes)) {
        parsedMealTimes = rawTimes;
      } else if (typeof rawTimes === 'string') {
        if (rawTimes.toLowerCase() === 'semua' || rawTimes.toLowerCase() === 'all') {
          parsedMealTimes = ['pagi', 'siang', 'malam'];
        } else {
          try {
            const decoded = JSON.parse(rawTimes);
            if (Array.isArray(decoded)) parsedMealTimes = decoded;
            else parsedMealTimes = rawTimes.split(',').map((s: string) => s.trim().toLowerCase()) as any;
          } catch {
            parsedMealTimes = rawTimes.split(',').map((s: string) => s.trim().toLowerCase()) as any;
          }
        }
      }

      const rawImg = m.foto_url || m.gambar_url || m.gambar || m.foto || m.url_gambar || m.url_foto || m.photo || m.photo_url || m.img || m.image_url || m.image;
      const validSimrsImg = parsePgImage(rawImg, '', m.nama_menu || m.name, m.kategori || m.category);

      return {
        id: String(m.menu_id || m.id_menu || m.id || `menu-${Date.now()}-${Math.floor(Math.random() * 1000)}`),
        name: String(m.nama_menu || m.name || 'Menu SIMRS').trim(),
        price: parsePgNumber(m.harga ?? m.price, 0),
        category: (m.kategori || m.category || 'makanan_utama') as any,
        mealTimes: parsedMealTimes,
        calories: parsePgNumber(m.kalori ?? m.calories, 0),
        protein: parsePgNumber(m.protein_gram ?? m.protein, 0),
        carbs: parsePgNumber(m.karbohidrat_gram ?? m.karbohidrat ?? m.carbs, 0),
        fat: parsePgNumber(m.lemak_gram ?? m.lemak ?? m.fat, 0),
        sodium: parsePgNumber(m.natrium_mg ?? m.natrium ?? m.sodium, 0),
        description: String(m.deskripsi || m.description || 'Penyajian higienis instalasi gizi rumah sakit.'),
        image: validSimrsImg || getCategoryFallbackImageServer(m.kategori || m.category || 'makanan_utama', m.nama_menu || m.name),
        stock: parsePgNumber(m.stok ?? m.stock ?? m.qty_stok ?? m.sisa_stok, 50),
        isAvailable: parsePgBoolean(
          m.is_tersedia !== undefined 
            ? m.is_tersedia 
            : (m.tersedia !== undefined 
              ? m.tersedia 
              : (m.isAvailable !== undefined 
                ? m.isAvailable 
                : (m.is_available !== undefined 
                  ? m.is_available 
                  : (m.status !== undefined 
                    ? m.status 
                    : (m.status_tersedia !== undefined ? m.status_tersedia : true))))),
          true
        ) && (parsePgNumber(m.stok ?? m.stock ?? m.qty_stok ?? m.sisa_stok, 50) > 0),
      };
    });

    if (transformedMenus.length > 0) {
      let hasChanges = false;
      transformedMenus.forEach(newMenu => {
        const existingIdx = menuItems.findIndex(m => m.id === newMenu.id || m.name.toLowerCase() === newMenu.name.toLowerCase());
        if (existingIdx === -1) {
          // Hanya tambahkan jika belum ada di katalog lokal
          menuItems.push(newMenu);
          hasChanges = true;
        } else {
          // Jika sudah ada, sinkronkan ketersediaan terbaru dari SIMRS serta pertahankan gambar kustom lokal jika SIMRS mengembalikan fallback
          const existing = menuItems[existingIdx];
          const hasRealExistingImage = Boolean(existing.image && typeof existing.image === 'string' && existing.image.length > 15 && !existing.image.includes('unsplash.com'));
          const hasRealNewImage = Boolean(newMenu.image && typeof newMenu.image === 'string' && newMenu.image.length > 15 && !newMenu.image.includes('unsplash.com'));
          const finalImage = hasRealNewImage ? newMenu.image : (hasRealExistingImage ? existing.image : (newMenu.image || existing.image));
          const preservedPrice = existing.price !== undefined ? existing.price : newMenu.price;
          const finalStock = newMenu.stock !== undefined ? newMenu.stock : (existing.stock ?? 50);
          menuItems[existingIdx] = {
            ...existing,
            ...newMenu,
            stock: finalStock,
            isAvailable: newMenu.isAvailable && (finalStock > 0), // Jika stok 0 otomatis habis
            image: finalImage,
            price: preservedPrice,
            id: existing.id
          };
          hasChanges = true;
        }
      });
      if (hasChanges) {
        savePersistentMenuItems(menuItems);
        broadcastEvent('init', { orders, menuItems });
      }
    }
    return menuItems;
  } catch (e) {
    console.warn('[Auto-Sync SIMRS Menu] Gagal auto-tarik master menu di background:', e);
    return menuItems;
  }
}

export async function autoFetchSimrsOrdersFromServer(): Promise<HospitalOrder[]> {
  const rawTargetUrl = simrsSettings.apiUrl || 'https://rsbsaonline.com/service/medifirst2000/emr/riwayat-pesanan-gizi';
  const targetUrl = resolveSimrsFetchOrdersUrl(rawTargetUrl);
  const targetToken = (simrsSettings.apiKey || '').trim();

  if (!targetToken) {
    return orders;
  }

  try {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };
    const rawToken = targetToken.replace(/^Bearer\s+/i, '').trim();
    headers['X-AUTH-TOKEN'] = rawToken;
    headers['Authorization'] = `Bearer ${rawToken}`;

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers,
    });

    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || !contentType.includes('application/json')) {
      return orders;
    }

    const responseText = await response.text();
    if (!responseText || responseText.trim().startsWith('<')) {
      return orders;
    }

    let parsedData: any = null;
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      return orders;
    }
    if (!parsedData) return orders;

    let ordersData = Array.isArray(parsedData) ? parsedData : (Array.isArray(parsedData?.data) ? parsedData.data : []);
    if (!Array.isArray(ordersData) || ordersData.length === 0) {
      return orders;
    }

    const transformedOrders: HospitalOrder[] = ordersData.map((o: any) => {
      let itemsList: any[] = [];
      try {
        if (typeof o.items_json === 'string') itemsList = JSON.parse(o.items_json);
        else if (Array.isArray(o.items)) itemsList = o.items;
        else if (o.hasil_json && typeof o.hasil_json === 'string') {
          const parsedH = JSON.parse(o.hasil_json);
          if (Array.isArray(parsedH.items)) itemsList = parsedH.items;
        } else if (o.hasil_json && Array.isArray(o.hasil_json.items)) {
          itemsList = o.hasil_json.items;
        }
      } catch {}

      const formattedItems: OrderItem[] = (itemsList || []).map((it: any) => ({
        menuItemId: String(it.menuItemId || it.id_menu || it.id || 'item'),
        name: String(it.name || it.nama_menu || 'Menu Makanan'),
        portion: Number(it.portion || it.jumlah_porsi || 1),
        price: Number(it.price || it.harga_satuan || it.harga || 0),
        category: it.category || it.kategori || 'makanan_utama',
        calories: Number(it.calories || it.kalori || 100),
      }));

      const computedPrice = formattedItems.reduce((acc, curr) => acc + curr.price * curr.portion, 0);
      const computedCalories = formattedItems.reduce((acc, curr) => acc + curr.calories * curr.portion, 0);

      const totalPrice = Number(o.total_price || o.totalPrice) || computedPrice;
      const totalCalories = Number(o.total_calories || o.totalCalories) || computedCalories;

      let history = [{
        status: (o.order_status || o.status || 'baru') as OrderStatus,
        timestamp: o.tgl_pesanan || o.created_at || new Date().toISOString(),
        note: 'Tersinkron otomatis dari database SIMRS',
      }];
      if (Array.isArray(o.status_history) && o.status_history.length > 0) history = o.status_history;
      else if (typeof o.status_history === 'string') {
        try { history = JSON.parse(o.status_history); } catch {}
      }

      const nameCandidates = [
        o.patientName,
        o.patient_name,
        o.nama_pasien,
        o.nama,
        o.pemesan,
        o.nama_pemesan,
      ].map((v: any) => typeof v === 'string' ? v.trim() : '').filter(Boolean);
      const realName = nameCandidates.find((n: string) => n.toLowerCase() !== 'pasien');
      const finalPatientName = realName || nameCandidates[0] || 'Pasien';

      const roomCandidates = [
        o.roomName,
        o.room_name,
        o.ruangan,
        o.nama_ruangan,
        o.kamar,
        o.nomor_kamar,
      ].map((v: any) => typeof v === 'string' ? v.trim() : '').filter(Boolean);
      const genericRooms = ['kamar rawat inap', 'kamar pasien', 'kamar'];
      const realRoom = roomCandidates.find((r: string) => !genericRooms.includes(r.toLowerCase()));
      const finalRoomName = realRoom || roomCandidates[0] || 'Kamar Rawat Inap';

      const phoneCandidates = [
        o.phoneNumber,
        o.phone_number,
        o.telepon,
        o.no_telepon,
        o.no_hp,
        o.nomor_telepon,
        o.nohp,
        o.wa,
      ].map((v: any) => typeof v === 'string' ? v.trim() : '').filter(Boolean);
      const finalPhone = phoneCandidates[0] || '';

      return {
        id: String(o.id || o.no_pesanan || o.order_number || o.orderNumber || `ord-${Date.now()}`),
        orderNumber: String(o.orderNumber || o.order_number || o.no_pesanan || `GZ-${Date.now()}`),
        registrationNo: String(o.registrationNo || o.noregistrasi || o.no_registrasi || 'REG-SIMRS'),
        createdAt: o.createdAt || o.tgl_pesanan || o.created_at || new Date().toISOString(),
        roomName: finalRoomName,
        patientName: finalPatientName,
        phoneNumber: finalPhone,
        mealTime: (o.mealTime || o.meal_time || o.waktu_makan || 'siang') as MealTime,
        items: formattedItems,
        totalPrice,
        totalCalories,
        patientNotes: String(o.patientNotes || o.patient_notes || o.catatan || ''),
        status: (o.order_status || o.status || 'baru') as OrderStatus,
        statusHistory: history,
        simrsSync: {
          synced: true,
          statusText: 'Tersimpan di SIMRS (PostgreSQL)',
          timestamp: o.createdAt || o.tgl_pesanan || o.created_at || new Date().toISOString(),
          targetUrl: targetUrl,
        },
      };
    });

    if (transformedOrders.length > 0) {
      let hasChanges = false;
      transformedOrders.forEach((newOrder) => {
        const existingIdx = orders.findIndex(
          (o) => o.orderNumber === newOrder.orderNumber || o.id === newOrder.id || (o.registrationNo && newOrder.registrationNo && o.registrationNo === newOrder.registrationNo && o.createdAt === newOrder.createdAt)
        );
        if (existingIdx === -1) {
          orders.push(newOrder);
          hasChanges = true;
        } else {
          // Merge keeping any higher updated status if available
          const existing = orders[existingIdx];
          orders[existingIdx] = {
            ...newOrder,
            id: existing.id,
            status: existing.status || newOrder.status,
            statusHistory: existing.statusHistory?.length > 0 ? existing.statusHistory : newOrder.statusHistory,
          };
          hasChanges = true;
        }
      });

      // Sort newest first
      orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      if (hasChanges) {
        savePersistentOrders(orders);
        broadcastEvent('init', { orders, menuItems });
      }
    }

    return orders;
  } catch (err) {
    console.warn('[Auto-Sync SIMRS Orders] Gagal auto-tarik pesanan di background:', err);
    return orders;
  }
}

// SIMRS Laravel & PostgreSQL Integration Configuration State
const SIMRS_CONFIG_FILE = path.join(process.cwd(), 'simrs_config.json');

function loadPersistentSimrsSettings(): SimrsSettings {
  const defaultApiUrl = (process.env.SIMRS_API_URL || 'https://rsbsaonline.com/service/medifirst2000/emr/save-pesanan-gizi').trim();
  const defaultToken = (process.env.SIMRS_TOKEN || process.env.SIMRS_API_KEY || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJhZG1pbi5yZWdpc3RyYXNpIn0.z1sCAtuc6ODM-HKzftAXqvqUPlFs7bm4wd-qTY-EvnBN1uHSk-OHhlHEpgs2vznkiem7u579VFGC2kxAhxD3NA').trim();

  try {
    if (fs.existsSync(SIMRS_CONFIG_FILE)) {
      const raw = fs.readFileSync(SIMRS_CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const savedToken = (parsed.apiKey && typeof parsed.apiKey === 'string' && parsed.apiKey.trim().length > 5)
          ? parsed.apiKey.trim()
          : defaultToken;
        return {
          apiUrl: (parsed.apiUrl || defaultApiUrl).trim(),
          apiKey: savedToken,
          authHeaderType: parsed.authHeaderType || 'X-AUTH-TOKEN',
          autoSyncOnOrder: parsed.autoSyncOnOrder !== false,
          isConfigured: true,
        };
      }
    }
  } catch (err) {
    console.warn('[SIMRS] Gagal membaca simrs_config.json:', err);
  }

  return {
    apiUrl: defaultApiUrl,
    apiKey: defaultToken,
    authHeaderType: 'X-AUTH-TOKEN',
    autoSyncOnOrder: true,
    isConfigured: true,
  };
}

let simrsSettings: SimrsSettings = loadPersistentSimrsSettings();

function savePersistentSimrsSettings(settings: SimrsSettings) {
  try {
    fs.writeFileSync(SIMRS_CONFIG_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[SIMRS] Gagal menyimpan simrs_config.json:', err);
  }
}

// Auto-save default if file doesn't exist
if (!fs.existsSync(SIMRS_CONFIG_FILE)) {
  savePersistentSimrsSettings(simrsSettings);
}

// Connected SSE clients for real-time broadcasts
type SSEClient = {
  id: string;
  res: express.Response;
};
const sseClients: Map<string, SSEClient> = new Map();

function broadcastEvent(eventType: string, data: any) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients.values()) {
    try {
      client.res.write(payload);
    } catch {
      sseClients.delete(client.id);
    }
  }
}

// Helper: Format WhatsApp message for order
function formatWhatsAppOrderMessage(order: HospitalOrder): string {
  const menuLines = order.items
    .map((it, idx) => `  ${idx + 1}. *${it.name}* x ${it.portion} porsi = Rp ${(it.price * it.portion).toLocaleString('id-ID')}`)
    .join('\n');

  return `🏥 *PESANAN MENU RUMAH SAKIT*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `🚪 *Nama Kamar*: ${order.roomName}\n` +
    `👤 *Nama Pemesan*: ${order.patientName}\n` +
    `📱 *Nomor Telepon*: ${order.phoneNumber}\n` +
    `🍽️ *Waktu Makan*: Makan ${order.mealTime.toUpperCase()}\n` +
    `🔖 *No. Pesanan*: ${order.orderNumber}\n` +
    `⏰ *Waktu Pesan*: ${new Date(order.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB\n\n` +
    `📋 *MENU YANG DIPESAN*:\n${menuLines}\n\n` +
    `💰 *Total Biaya*: *Rp ${order.totalPrice.toLocaleString('id-ID')}*\n` +
    `🔥 *Total Kalori*: ${order.totalCalories} kkal\n\n` +
    `📝 *Catatan Khusus*:\n${order.patientNotes ? `"${order.patientNotes}"` : '- Tidak ada catatan khusus -'}\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `_Pesanan telah terkirim langsung ke Dapur Gizi Rumah Sakit via SIAPMAKAN_`;
}

// Helper: Send / Sync Order Data to Hospital SIMRS (Laravel API + PostgreSQL DB)
// Matching user's Laravel controller signature: $request->input('noregistrasi') & $request->input('hasil_json')
async function syncOrderToSimrs(
  order: HospitalOrder,
  overrideUrl?: string,
  overrideToken?: string,
  overrideAuthHeaderType?: 'X-AUTH-TOKEN' | 'Bearer' | 'Both'
): Promise<{ success: boolean; data?: any; error?: string; targetUrl?: string }> {
  const rawUrl = (overrideUrl || simrsSettings.apiUrl || 'https://rsbsaonline.com/service/medifirst2000/emr/save-pesanan-gizi').trim();
  const url = resolveSimrsOrderUrl(rawUrl);
  const token = (overrideToken !== undefined ? overrideToken : simrsSettings.apiKey || '').trim();
  const headerType = overrideAuthHeaderType || simrsSettings.authHeaderType || 'X-AUTH-TOKEN';

  if (!url) {
    return {
      success: false,
      error: 'URL Endpoint API SIMRS belum disetel.',
      targetUrl: url,
    };
  }

  try {
    const testOrderNum = order.orderNumber || `TEST-${Date.now()}`;
    const mappedItems = (order.items || []).map(i => ({
      id_menu: (i as any).menuItemId || (i as any).id || 'item',
      menuItemId: (i as any).menuItemId || (i as any).id || 'item',
      name: i.name,
      nama_menu: i.name,
      portion: i.portion,
      jumlah_porsi: i.portion,
      price: i.price,
      harga_satuan: i.price,
      category: i.category,
      kategori: i.category,
      calories: i.calories,
      kalori: i.calories,
    }));

    const firstItem = mappedItems[0] || {
      id_menu: 'menu-1',
      name: 'Sup Ayam Sayur Bening',
      category: 'makanan_utama',
      price: 18000,
      calories: 120,
    };

    const payload = {
      // Data Menu jika endpoint adalah save-master-menu
      id: (firstItem as any).id_menu || (firstItem as any).id || 'menu-1',
      id_menu: (firstItem as any).id_menu || (firstItem as any).id || 'menu-1',
      name: (firstItem as any).name || 'Menu Gizi',
      nama: (firstItem as any).name || 'Menu Gizi',
      nama_menu: (firstItem as any).name || 'Menu Gizi',
      kategori: (firstItem as any).category || 'makanan_utama',
      category: (firstItem as any).category || 'makanan_utama',
      harga: (firstItem as any).price || 18000,
      price: (firstItem as any).price || 18000,
      kalori: (firstItem as any).calories || 120,
      calories: (firstItem as any).calories || 120,

      // Data Pesanan jika endpoint adalah save-pesanan-gizi
      noregistrasi: order.registrationNo || `REG-${testOrderNum.replace(/[^0-9]/g, '')}`,
      no_pesanan: testOrderNum,
      order_number: testOrderNum,
      orderNumber: testOrderNum,
      orderId: testOrderNum,
      room_name: order.roomName,
      roomName: order.roomName,
      nomor_kamar: order.roomName,
      patient_name: order.patientName,
      patientName: order.patientName,
      nama_pasien: order.patientName,
      phone_number: order.phoneNumber,
      phoneNumber: order.phoneNumber,
      meal_time: order.mealTime,
      mealTime: order.mealTime,
      waktu_makan: order.mealTime,
      total_price: order.totalPrice,
      totalPrice: order.totalPrice,
      total_biaya: order.totalPrice,
      total_calories: order.totalCalories,
      totalCalories: order.totalCalories,
      total_kalori: order.totalCalories,
      patient_notes: order.patientNotes || '',
      patientNotes: order.patientNotes || '',
      dietaryNotes: order.patientNotes || '',
      status: order.status,
      order_status: order.status,
      status_pesanan: order.status,
      items: mappedItems,
      menu_items: mappedItems,
      hasil_json: {
        orderId: testOrderNum,
        no_pesanan: testOrderNum,
        order_number: testOrderNum,
        orderNumber: testOrderNum,
        noregistrasi: order.registrationNo,
        registrationNo: order.registrationNo,
        roomName: order.roomName,
        roomNumber: order.roomName,
        nomor_kamar: order.roomName,
        patientName: order.patientName,
        nama_pasien: order.patientName,
        patientInfo: {
          roomNumber: order.roomName,
          roomName: order.roomName,
          patientName: order.patientName,
        },
        phoneNumber: order.phoneNumber,
        mealTime: order.mealTime,
        waktu_makan: order.mealTime,
        totalPrice: order.totalPrice,
        total_biaya: order.totalPrice,
        totalCalories: order.totalCalories,
        total_kalori: order.totalCalories,
        patientNotes: order.patientNotes || '',
        dietaryNotes: order.patientNotes || '',
        catatan_alergi_diet: order.patientNotes || '',
        status: order.status,
        order_status: order.status,
        status_pesanan: order.status,
        items: mappedItems,
        createdAt: order.createdAt,
      },
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (token) {
      const rawToken = token.replace(/^Bearer\s+/i, '').trim();
      // Mengirimkan X-AUTH-TOKEN sesuai instruksi pengguna untuk autentikasi SIMRS RS
      headers['X-AUTH-TOKEN'] = rawToken;
      // Juga sertakan Authorization Bearer sebagai fallback universal
      headers['Authorization'] = `Bearer ${rawToken}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await response.json().catch(() => null);

    if (response.ok) {
      return {
        success: true,
        data: data || { status: 'success', message: 'Data pesanan gizi berhasil disimpan ke SIMRS.' },
      };
    } else {
      return {
        success: false,
        error: data?.message || `HTTP ${response.status}: Server SIMRS merespons dengan kesalahan`,
        data,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.name === 'AbortError' ? 'Koneksi ke endpoint SIMRS timeout (10 detik)' : (err.message || 'Gagal menghubungi server SIMRS'),
    };
  }
}

// Helper: Map a MenuItem to standardized payload format for SIMRS Medifirst2000
function mapMenuItemForSimrs(m: any) {
  const img = m.image || m.foto_url || m.gambar_url || m.foto || m.gambar || m.url_foto || m.url_gambar || '';
  return {
    ...m,
    id: String(m.id || m.id_menu || ''),
    id_menu: String(m.id || m.id_menu || ''),
    kd_menu: String(m.id || m.id_menu || ''),
    name: String(m.name || m.nama_menu || m.nama || 'Menu SIMRS'),
    nama: String(m.name || m.nama_menu || m.nama || 'Menu SIMRS'),
    nama_menu: String(m.name || m.nama_menu || m.nama || 'Menu SIMRS'),
    category: m.category || m.kategori || 'makanan_utama',
    kategori: m.category || m.kategori || 'makanan_utama',
    price: parsePgNumber(m.price ?? m.harga ?? 0),
    harga: parsePgNumber(m.price ?? m.harga ?? 0),
    harga_satuan: parsePgNumber(m.price ?? m.harga ?? 0),
    calories: parsePgNumber(m.calories ?? m.kalori ?? 0),
    kalori: parsePgNumber(m.calories ?? m.kalori ?? 0),
    protein: parsePgNumber(m.protein ?? 0),
    carbs: parsePgNumber(m.carbs ?? m.karbohidrat ?? 0),
    karbohidrat: parsePgNumber(m.carbs ?? m.karbohidrat ?? 0),
    fat: parsePgNumber(m.fat ?? m.lemak ?? 0),
    lemak: parsePgNumber(m.fat ?? m.lemak ?? 0),
    sodium: parsePgNumber(m.sodium ?? m.natrium ?? 0),
    natrium: parsePgNumber(m.sodium ?? m.natrium ?? 0),
    mealTimes: m.mealTimes || m.waktu_makan || ['pagi', 'siang', 'malam'],
    waktu_makan: m.mealTimes || m.waktu_makan || ['pagi', 'siang', 'malam'],
    description: String(m.description || m.deskripsi || ''),
    deskripsi: String(m.description || m.deskripsi || ''),
    foto_url: img,
    gambar_url: img,
    image: img,
    gambar: img,
    foto: img,
    image_url: img,
    url_gambar: img,
    url_foto: img,
    photo: img,
    photo_url: img,
    img: img,
    stock: typeof (m.stock ?? m.stok) === 'number' ? Math.max(0, m.stock ?? m.stok) : (parseInt(String(m.stock ?? m.stok ?? 50), 10) || 0),
    stok: typeof (m.stock ?? m.stok) === 'number' ? Math.max(0, m.stock ?? m.stok) : (parseInt(String(m.stock ?? m.stok ?? 50), 10) || 0),
    qty_stok: typeof (m.stock ?? m.stok) === 'number' ? Math.max(0, m.stock ?? m.stok) : (parseInt(String(m.stock ?? m.stok ?? 50), 10) || 0),
    sisa_stok: typeof (m.stock ?? m.stok) === 'number' ? Math.max(0, m.stock ?? m.stok) : (parseInt(String(m.stock ?? m.stok ?? 50), 10) || 0),
    isAvailable: parsePgBoolean(
      m.isAvailable !== undefined 
        ? m.isAvailable 
        : (m.is_tersedia !== undefined 
          ? m.is_tersedia 
          : (m.tersedia !== undefined 
            ? m.tersedia 
            : (m.status !== undefined 
              ? m.status 
              : (m.status_tersedia !== undefined ? m.status_tersedia : true)))),
      true
    ) && ((typeof (m.stock ?? m.stok) === 'number' ? (m.stock ?? m.stok) : parseInt(String(m.stock ?? m.stok ?? 50), 10)) > 0),
    is_tersedia: parsePgBoolean(
      m.is_tersedia !== undefined 
        ? m.is_tersedia 
        : (m.isAvailable !== undefined 
          ? m.isAvailable 
          : (m.tersedia !== undefined 
            ? m.tersedia 
            : (m.status !== undefined 
              ? m.status 
              : (m.status_tersedia !== undefined ? m.status_tersedia : true)))),
      true
    ) && ((typeof (m.stock ?? m.stok) === 'number' ? (m.stock ?? m.stok) : parseInt(String(m.stock ?? m.stok ?? 50), 10)) > 0),
    tersedia: parsePgBoolean(
      m.tersedia !== undefined 
        ? m.tersedia 
        : (m.isAvailable !== undefined 
          ? m.isAvailable 
          : (m.is_tersedia !== undefined 
            ? m.is_tersedia 
            : (m.status !== undefined 
              ? m.status 
              : (m.status_tersedia !== undefined ? m.status_tersedia : true)))),
      true
    ) && ((typeof (m.stock ?? m.stok) === 'number' ? (m.stock ?? m.stok) : parseInt(String(m.stock ?? m.stok ?? 50), 10)) > 0),
    status: (parsePgBoolean(m.isAvailable ?? m.is_tersedia ?? m.tersedia ?? m.status ?? true, true) && ((typeof (m.stock ?? m.stok) === 'number' ? (m.stock ?? m.stok) : parseInt(String(m.stock ?? m.stok ?? 50), 10)) > 0)) ? 1 : 0,
    status_tersedia: (parsePgBoolean(m.isAvailable ?? m.is_tersedia ?? m.tersedia ?? m.status ?? true, true) && ((typeof (m.stock ?? m.stok) === 'number' ? (m.stock ?? m.stok) : parseInt(String(m.stock ?? m.stok ?? 50), 10)) > 0)) ? 1 : 0,
  };
}

// Helper: Send single menu item to SIMRS (save-master-menu)
async function syncSingleMenuToSimrs(
  item: MenuItem,
  overrideUrl?: string,
  overrideToken?: string
): Promise<{ success: boolean; data?: any; error?: string; targetUrl?: string }> {
  const targetUrl = resolveSimrsSingleMenuUrl(overrideUrl || simrsSettings.apiUrl);
  const token = (overrideToken && typeof overrideToken === 'string' && overrideToken.trim() !== '')
    ? overrideToken.trim()
    : (simrsSettings.apiKey || '').trim();

  if (!targetUrl) {
    return { success: false, error: 'URL Endpoint API SIMRS belum disetel.', targetUrl };
  }

  const payload = mapMenuItemForSimrs(item);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (token) {
    const rawToken = token.replace(/^Bearer\s+/i, '').trim();
    headers['X-AUTH-TOKEN'] = rawToken;
    headers['Authorization'] = `Bearer ${rawToken}`;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await response.json().catch(() => null);

    if (response.ok && (!data || data.code === undefined || data.code === 200 || data.code === 201)) {
      return {
        success: true,
        targetUrl,
        data: data || { status: 'success', message: `Menu "${item.name}" berhasil disimpan ke SIMRS.` },
      };
    } else {
      let errMsg = data?.message || `HTTP ${response.status}: Server SIMRS merespons dengan kesalahan`;
      if (response.status === 403 || data?.code === 403) {
        errMsg = 'Token autentikasi X-AUTH-TOKEN ditolak (403 Forbidden - Token salah). Mohon periksa token di Pengaturan SIMRS.';
      } else if (response.status === 401 || data?.code === 401) {
        errMsg = 'Token autentikasi X-AUTH-TOKEN tidak tersedia (401 Unauthorized).';
      }
      return {
        success: false,
        targetUrl,
        error: errMsg,
        data,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      targetUrl,
      error: err.name === 'AbortError' ? 'Koneksi ke endpoint save-master-menu timeout (10 detik)' : (err.message || 'Gagal menghubungi server SIMRS'),
    };
  }
}

// Helper: Send / Sync Menu Items to Hospital SIMRS (Laravel API + PostgreSQL DB)
async function syncMenuToSimrs(
  items: MenuItem[],
  overrideUrl?: string,
  overrideToken?: string,
  overrideAuthHeaderType?: 'X-AUTH-TOKEN' | 'Bearer' | 'Both'
): Promise<{ success: boolean; data?: any; error?: string; totalSynced?: number; targetUrl?: string }> {
  const rawUrl = (overrideUrl || simrsSettings.apiUrl || 'https://rsbsaonline.com/service/medifirst2000/emr/sync-batch-menu').trim();
  const isSingle = rawUrl.includes('save-master-menu');
  const url = isSingle ? resolveSimrsSingleMenuUrl(rawUrl) : resolveSimrsBatchMenuUrl(rawUrl);
  const token = (overrideToken && typeof overrideToken === 'string' && overrideToken.trim() !== '')
    ? overrideToken.trim()
    : (simrsSettings.apiKey || '').trim();

  if (!url) {
    return {
      success: false,
      error: 'URL Endpoint API SIMRS belum disetel.',
      targetUrl: url,
    };
  }

  if (items.length === 0) {
    return {
      success: false,
      error: 'Tidak ada item menu untuk disinkronkan. Tambahkan master menu terlebih dahulu.',
      targetUrl: url,
    };
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (token) {
      const rawToken = token.replace(/^Bearer\s+/i, '').trim();
      headers['X-AUTH-TOKEN'] = rawToken;
      headers['Authorization'] = `Bearer ${rawToken}`;
    }

    const mappedItems = items.map(mapMenuItemForSimrs);

    // Jika target URL secara spesifik adalah save-master-menu (menyimpan 1 menu per request)
    if (url.includes('save-master-menu')) {
      let savedCount = 0;
      let lastData: any = null;
      let lastError: string | undefined;
      for (const item of items) {
        const res = await syncSingleMenuToSimrs(item, url, token);
        if (res.success) {
          savedCount++;
          lastData = res.data;
        } else {
          lastError = res.error;
        }
      }
      if (savedCount > 0) {
        return {
          success: true,
          totalSynced: savedCount,
          targetUrl: url,
          data: lastData || { status: 'success', message: `${savedCount} master menu berhasil disimpan ke SIMRS!` },
        };
      } else {
        return {
          success: false,
          totalSynced: 0,
          targetUrl: url,
          error: lastError || 'Gagal menyimpan menu ke SIMRS (save-master-menu)',
        };
      }
    }

    // Batch Sync: kirim data array lengkap dengan seluruh alias parameter
    const first = mappedItems[0] || {} as any;
    const payload = {
      menu_items: mappedItems,
      items: mappedItems,
      data: mappedItems,
      menus: mappedItems,
      hasil_json: {
        menu_items: mappedItems,
        items: mappedItems,
        total: mappedItems.length,
      },
      id: first.id || '1',
      id_menu: first.id || '1',
      name: first.name || 'Batch Menu',
      nama: first.nama || 'Batch Menu',
      nama_menu: first.nama_menu || 'Batch Menu',
      category: first.category || 'makanan_utama',
      kategori: first.kategori || 'makanan_utama',
      price: first.price || 0,
      harga: first.harga || 0,
      calories: first.calories || 0,
      kalori: first.kalori || 0,
      foto_url: first.foto_url || first.image || '',
      gambar_url: first.gambar_url || first.image || '',
      image: first.image || '',
      foto: first.foto || first.image || '',
      gambar: first.gambar || first.image || '',
      total: mappedItems.length,
      total_count: mappedItems.length,
      synced_at: new Date().toISOString(),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await response.json().catch(() => null);

    if (response.ok && (!data || data.code === undefined || data.code === 200 || data.code === 201)) {
      return {
        success: true,
        totalSynced: items.length,
        targetUrl: url,
        data: data || { status: 'success', message: 'Master menu berhasil disimpan ke SIMRS.' },
      };
    }

    if (response.status === 403 || data?.code === 403) {
      return {
        success: false,
        error: 'Token autentikasi X-AUTH-TOKEN ditolak oleh SIMRS RSBSA Online (403 Forbidden - Token salah). Mohon periksa kembali token resmi di pengaturan SIMRS.',
        targetUrl: url,
        data,
      };
    }
    if (response.status === 401 || data?.code === 401) {
      return {
        success: false,
        error: 'Token autentikasi X-AUTH-TOKEN tidak tersedia (401 Unauthorized). Masukkan token di Pengaturan SIMRS.',
        targetUrl: url,
        data,
      };
    }

    // Senior Dev Fallback: jika batch ditolak karena masalah parameter di controller Laravel, coba save-master-menu per item
    let fallbackSavedCount = 0;
    let fallbackLastData: any = null;
    for (const item of items) {
      const res = await syncSingleMenuToSimrs(item, resolveSimrsSingleMenuUrl(rawUrl), token);
      if (res.success) {
        fallbackSavedCount++;
        fallbackLastData = res.data;
      }
    }

    if (fallbackSavedCount > 0) {
      return {
        success: true,
        totalSynced: fallbackSavedCount,
        targetUrl: resolveSimrsSingleMenuUrl(rawUrl),
        data: fallbackLastData || { status: 'success', message: `${fallbackSavedCount} master menu tersimpan ke SIMRS via save-master-menu!` },
      };
    }

    return {
      success: false,
      error: data?.message || `HTTP ${response.status}: Server SIMRS menolak request sinkronisasi menu`,
      targetUrl: url,
      data,
    };
  } catch (err: any) {
    return {
      success: false,
      targetUrl: url,
      error: err.name === 'AbortError' ? 'Koneksi ke endpoint SIMRS timeout' : (err.message || 'Gagal menghubungi server SIMRS'),
    };
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware CORS agar device lain (tablet, HP, bed pasien) dapat mengakses API
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-AUTH-TOKEN');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Global Anti-Cache Header for all /api endpoints to prevent stale mobile/browser HTTP caching across devices
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  // 1. SSE Real-Time Stream
  app.get('/api/realtime/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const clientId = `client-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    sseClients.set(clientId, { id: clientId, res });

    // Send initial snapshot
    const initPayload = {
      orders,
      menuItems,
      simrsSettings: {
        apiUrl: simrsSettings.apiUrl,
        autoSyncOnOrder: simrsSettings.autoSyncOnOrder,
        isConfigured: Boolean(simrsSettings.apiUrl),
      },
      timestamp: new Date().toISOString(),
    };
    res.write(`event: init\ndata: ${JSON.stringify(initPayload)}\n\n`);

    const interval = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch {
        clearInterval(interval);
        sseClients.delete(clientId);
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(interval);
      sseClients.delete(clientId);
    });
  });

  // 2. Menu Catalog APIs (Admin & Patient)
  let lastMenuAutoSyncTime = 0;
  app.get('/api/menu', async (req, res) => {
    const now = Date.now();
    // Otomatis sinkronkan dari SIMRS setiap 20 detik di latar belakang
    // sehingga setiap pasien di smartphone masing-masing langsung menerima menu terbaru tanpa perlu klik apa pun
    if (simrsSettings.apiKey && simrsSettings.apiKey.trim().length > 5 && (now - lastMenuAutoSyncTime > 20000 || req.query.sync === '1' || menuItems.length <= 1)) {
      lastMenuAutoSyncTime = now;
      autoFetchSimrsMenuFromServer().catch((err) => {
        console.warn('[Auto-Fetch] Gagal auto-tarik master menu pada GET /api/menu:', err);
      });
    }
    res.json(menuItems);
  });

  // Admin: Create Menu Item & automatically sync to SIMRS (save-master-menu)
  app.post('/api/menu', async (req, res) => {
    const { name, price, category, mealTimes, calories, protein, carbs, fat, sodium, description, image, foto_url, gambar_url, isAvailable, stock, stok, simrsApiUrl, simrsApiKey } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Nama menu wajib diisi' });
    }

    const finalImage = (image || foto_url || gambar_url || '').trim() || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80';
    const rawStock = stock !== undefined ? stock : (stok !== undefined ? stok : 50);
    const parsedStock = Math.max(0, Number(rawStock) >= 0 ? Number(rawStock) : 50);
    const effectiveAvailable = (isAvailable !== false) && (parsedStock > 0);

    const newItem: MenuItem = {
      id: req.body.id ? String(req.body.id) : `menu-${Date.now()}`,
      name: name.trim(),
      price: Number(price) >= 0 ? Number(price) : 0,
      category: category || 'makanan_utama',
      mealTimes: Array.isArray(mealTimes) && mealTimes.length > 0 ? mealTimes : ['pagi', 'siang', 'malam'],
      calories: Number(calories) || 100,
      protein: Number(protein) || 5,
      carbs: Number(carbs) || 15,
      fat: Number(fat) || 2,
      sodium: Number(sodium) || 20,
      description: description?.trim() || '',
      image: finalImage,
      stock: parsedStock,
      isAvailable: effectiveAvailable,
    };

    menuItems.unshift(newItem);
    savePersistentMenuItems(menuItems);
    broadcastEvent('menu_update', { item: newItem, action: 'create' });
    broadcastEvent('init', { orders, menuItems });

    // Otomatis simpan master menu ke SIMRS (save-master-menu)
    const targetUrl = resolveSimrsSingleMenuUrl(simrsApiUrl || simrsSettings.apiUrl);
    const targetToken = (simrsApiKey && typeof simrsApiKey === 'string' && simrsApiKey.trim() !== '')
      ? simrsApiKey.trim()
      : (simrsSettings.apiKey || '').trim();

    const simrsResult = await syncSingleMenuToSimrs(newItem, targetUrl, targetToken);

    const responsePayload = {
      ...newItem,
      simrsSync: {
        synced: simrsResult.success,
        statusText: simrsResult.success 
          ? 'Tersimpan di SIMRS (save-master-menu)' 
          : (simrsResult.error || 'Gagal tersimpan di SIMRS'),
        timestamp: new Date().toISOString(),
        targetUrl: simrsResult.targetUrl || targetUrl,
        response: simrsResult.data,
        error: simrsResult.error,
      },
    };

    res.status(201).json(responsePayload);
  });

  // Admin: Update Menu Item (Price, Name, Availability, Stock, Description, Photo, etc.)
  app.patch('/api/menu/:id', async (req, res) => {
    const { id } = req.params;
    let item = menuItems.find(m => String(m.id) === String(id) || (req.body.name && m.name && m.name.trim().toLowerCase() === String(req.body.name).trim().toLowerCase()));
    
    const { name, price, category, mealTimes, calories, protein, carbs, fat, sodium, description, image, foto_url, gambar_url, isAvailable, stock, stok, simrsApiUrl, simrsApiKey } = req.body;
    const resolvedImage = image ?? foto_url ?? gambar_url;
    const rawStock = stock !== undefined ? stock : stok;

    if (!item) {
      const parsedStock = rawStock !== undefined ? Math.max(0, Number(rawStock) || 0) : 50;
      // Upsert: buat item baru jika belum ada di server
      item = {
        id: String(id || `menu-${Date.now()}`),
        name: name ? String(name).trim() : 'Menu Gizi',
        price: price !== undefined ? Math.max(0, Number(price)) : 0,
        category: category || 'makanan_utama',
        mealTimes: Array.isArray(mealTimes) && mealTimes.length > 0 ? mealTimes : ['pagi', 'siang', 'malam'],
        calories: calories !== undefined ? Number(calories) : 100,
        protein: protein !== undefined ? Number(protein) : 0,
        carbs: carbs !== undefined ? Number(carbs) : 0,
        fat: fat !== undefined ? Number(fat) : 0,
        sodium: sodium !== undefined ? Number(sodium) : 0,
        description: description !== undefined ? String(description).trim() : '',
        image: resolvedImage !== undefined ? String(resolvedImage).trim() : 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
        stock: parsedStock,
        isAvailable: (isAvailable !== false) && (parsedStock > 0),
      };
      menuItems.unshift(item);
    } else {
      if (name !== undefined) item.name = String(name).trim();
      if (price !== undefined) item.price = Math.max(0, Number(price));
      if (category !== undefined) item.category = category;
      if (mealTimes !== undefined && Array.isArray(mealTimes)) item.mealTimes = mealTimes;
      if (calories !== undefined) item.calories = Number(calories);
      if (protein !== undefined) item.protein = Number(protein);
      if (carbs !== undefined) item.carbs = Number(carbs);
      if (fat !== undefined) item.fat = Number(fat);
      if (sodium !== undefined) item.sodium = Number(sodium);
      if (description !== undefined) item.description = String(description).trim();
      if (resolvedImage !== undefined && resolvedImage !== null) item.image = String(resolvedImage).trim();
      
      // Handle stok & ketersediaan sinkron
      if (rawStock !== undefined) {
        const parsedStock = Math.max(0, Number(rawStock) || 0);
        item.stock = parsedStock;
        if (parsedStock === 0) {
          // Jika stok 0, otomatis ketersediaan menjadi false
          item.isAvailable = false;
        } else if (isAvailable !== undefined) {
          item.isAvailable = Boolean(isAvailable);
        } else if (!item.isAvailable && parsedStock > 0) {
          // Jika sebelumnya habis lalu stok ditambah, aktifkan kembali
          item.isAvailable = true;
        }
      } else if (isAvailable !== undefined) {
        item.isAvailable = Boolean(isAvailable);
        if (item.isAvailable && (item.stock === undefined || item.stock <= 0)) {
          item.stock = 25; // Beri stok default jika diaktifkan
        }
      }
    }

    savePersistentMenuItems(menuItems);
    broadcastEvent('menu_update', { item, action: 'update' });
    broadcastEvent('init', { orders, menuItems });

    // Otomatis sinkronisasi pembaruan ke SIMRS (save-master-menu)
    const targetUrl = resolveSimrsSingleMenuUrl(simrsApiUrl || simrsSettings.apiUrl);
    const targetToken = (simrsApiKey && typeof simrsApiKey === 'string' && simrsApiKey.trim() !== '')
      ? simrsApiKey.trim()
      : (simrsSettings.apiKey || '').trim();

    const simrsResult = await syncSingleMenuToSimrs(item, targetUrl, targetToken);

    res.json({
      ...item,
      simrsSync: {
        synced: simrsResult.success,
        statusText: simrsResult.success 
          ? 'Tersimpan di SIMRS (save-master-menu)' 
          : (simrsResult.error || 'Gagal tersimpan di SIMRS'),
        timestamp: new Date().toISOString(),
        targetUrl: simrsResult.targetUrl || targetUrl,
        response: simrsResult.data,
        error: simrsResult.error,
      },
    });
  });

  // Admin: Toggle Availability
  app.patch('/api/menu/:id/toggle', async (req, res) => {
    const { id } = req.params;
    const item = menuItems.find(m => m.id === id);
    if (!item) {
      return res.status(404).json({ error: 'Menu tidak ditemukan' });
    }
    item.isAvailable = !item.isAvailable;
    if (item.isAvailable) {
      // Jika diaktifkan kembali dan stoknya 0, reset stok ke 25 porsi
      if (item.stock === undefined || item.stock <= 0) {
        item.stock = 25;
      }
    } else {
      // Jika dinonaktifkan / habis, set stok ke 0
      item.stock = 0;
    }
    savePersistentMenuItems(menuItems);
    broadcastEvent('menu_update', { item, action: 'toggle' });
    broadcastEvent('init', { orders, menuItems });

    // Auto-sync ketersediaan menu yang baru diubah ke SIMRS di background
    if (simrsSettings.apiUrl) {
      syncSingleMenuToSimrs(item).catch(() => {});
    }

    res.json(item);
  });

  // Admin: Quick Update Stock (+, -, or direct number)
  app.patch('/api/menu/:id/stock', async (req, res) => {
    const { id } = req.params;
    const item = menuItems.find(m => m.id === id);
    if (!item) {
      return res.status(404).json({ error: 'Menu tidak ditemukan' });
    }
    const { stock, delta } = req.body;
    let newStock = item.stock ?? 50;
    if (stock !== undefined) {
      newStock = Math.max(0, Number(stock) || 0);
    } else if (delta !== undefined) {
      newStock = Math.max(0, newStock + (Number(delta) || 0));
    }
    item.stock = newStock;
    item.isAvailable = newStock > 0; // Jika stok 0, otomatis ketersediaan false

    savePersistentMenuItems(menuItems);
    broadcastEvent('menu_update', { item, action: 'stock' });
    broadcastEvent('init', { orders, menuItems });

    // Auto-sync ke SIMRS
    if (simrsSettings.apiUrl) {
      syncSingleMenuToSimrs(item).catch(() => {});
    }

    res.json(item);
  });

  // Admin: Delete Menu Item
  app.delete('/api/menu/:id', (req, res) => {
    const { id } = req.params;
    const index = menuItems.findIndex(m => m.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Menu tidak ditemukan' });
    }
    const removed = menuItems.splice(index, 1)[0];
    savePersistentMenuItems(menuItems);
    broadcastEvent('menu_update', { item: removed, action: 'delete' });
    res.json({ success: true, removedId: id });
  });

  // Admin: Reset / Kosongkan Seluruh Menu
  app.delete('/api/menu/reset/all', (req, res) => {
    menuItems = [];
    savePersistentMenuItems(menuItems);
    broadcastEvent('menu_reset', {});
    res.json({ success: true, message: 'Seluruh menu katalog telah berhasil dikosongkan.' });
  });

  // Sync / Upload Menu items from Client (ensures menus created offline or on specific devices are persisted across all devices)
  app.post('/api/menu/batch-sync', (req, res) => {
    const { items } = req.body;
    if (Array.isArray(items) && items.length > 0) {
      let addedCount = 0;
      for (const it of items) {
        if (!it || !it.id || !it.name) continue;
        const exists = menuItems.some(m => m.id === it.id || m.name.toLowerCase().trim() === String(it.name).toLowerCase().trim());
        if (!exists) {
          menuItems.push({
            id: String(it.id),
            name: String(it.name).trim(),
            price: Number(it.price) >= 0 ? Number(it.price) : 0,
            category: it.category || 'makanan_utama',
            mealTimes: Array.isArray(it.mealTimes) && it.mealTimes.length > 0 ? it.mealTimes : ['pagi', 'siang', 'malam'],
            calories: Number(it.calories) || 100,
            protein: Number(it.protein) || 0,
            carbs: Number(it.carbs) || 0,
            fat: Number(it.fat) || 0,
            sodium: Number(it.sodium) || 0,
            description: String(it.description || ''),
            isAvailable: it.isAvailable !== false,
            image: it.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
          });
          addedCount++;
        }
      }
      if (addedCount > 0) {
        savePersistentMenuItems(menuItems);
        broadcastEvent('init', { orders, menuItems });
      }
    }
    res.json({ success: true, menuItems });
  });

  // --- SIMRS (LARAVEL & POSTGRESQL) APIS ---
  app.get('/api/simrs/config', (req, res) => {
    res.json({
      apiUrl: simrsSettings.apiUrl,
      apiKey: simrsSettings.apiKey,
      apiKeyMasked: simrsSettings.apiKey ? `${simrsSettings.apiKey.slice(0, 3)}••••${simrsSettings.apiKey.slice(-3)}` : '',
      hasToken: Boolean(simrsSettings.apiKey && simrsSettings.apiKey.trim().length > 5),
      authHeaderType: simrsSettings.authHeaderType || 'X-AUTH-TOKEN',
      autoSyncOnOrder: simrsSettings.autoSyncOnOrder,
      isConfigured: Boolean(simrsSettings.apiUrl && simrsSettings.apiUrl.trim().length > 5),
    });
  });

  app.post('/api/simrs/config', (req, res) => {
    const { apiUrl, apiKey, authHeaderType, autoSyncOnOrder } = req.body;
    if (apiUrl !== undefined) {
      simrsSettings.apiUrl = apiUrl.trim();
    }
    if (apiKey !== undefined && apiKey.trim() !== '') {
      simrsSettings.apiKey = apiKey.trim();
    }
    if (authHeaderType !== undefined) {
      simrsSettings.authHeaderType = authHeaderType;
    }
    if (autoSyncOnOrder !== undefined) {
      simrsSettings.autoSyncOnOrder = Boolean(autoSyncOnOrder);
    }
    simrsSettings.isConfigured = Boolean(simrsSettings.apiUrl && simrsSettings.apiUrl.trim().length > 5);
    savePersistentSimrsSettings(simrsSettings);

    res.json({
      success: true,
      message: 'Pengaturan API SIMRS (PostgreSQL & Laravel) dengan X-AUTH-TOKEN berhasil disimpan di server!',
      config: {
        apiUrl: simrsSettings.apiUrl,
        apiKey: simrsSettings.apiKey,
        apiKeyMasked: simrsSettings.apiKey ? `${simrsSettings.apiKey.slice(0, 3)}••••${simrsSettings.apiKey.slice(-3)}` : '',
        hasToken: Boolean(simrsSettings.apiKey && simrsSettings.apiKey.trim().length > 5),
        authHeaderType: simrsSettings.authHeaderType,
        autoSyncOnOrder: simrsSettings.autoSyncOnOrder,
        isConfigured: simrsSettings.isConfigured,
      },
    });
  });

  // Test live connection to Laravel SIMRS endpoint
  app.post('/api/simrs/test', async (req, res) => {
    const { apiUrl, apiKey, authHeaderType } = req.body;
    const rawTargetUrl = (apiUrl || simrsSettings.apiUrl || 'https://rsbsaonline.com/service/medifirst2000/emr/save-pesanan-gizi').trim();
    const targetToken = apiKey !== undefined ? apiKey : simrsSettings.apiKey;
    const targetHeaderType = authHeaderType || simrsSettings.authHeaderType || 'X-AUTH-TOKEN';

    if (!rawTargetUrl || rawTargetUrl.trim() === '') {
      return res.status(400).json({ error: 'URL Endpoint API Laravel SIMRS wajib diisi' });
    }

    // Jika target pengujian diarahkan ke master-menu-gizi (Endpoint GET untuk katalog menu)
    if (rawTargetUrl.includes('master-menu-gizi') || rawTargetUrl.includes('master-menu') && !rawTargetUrl.includes('save-master-menu')) {
      const startTime = Date.now();
      const targetFetchUrl = resolveSimrsFetchMenuUrl(rawTargetUrl);
      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };
      if (targetToken) {
        const rawToken = String(targetToken).replace(/^Bearer\s+/i, '').trim();
        headers['X-AUTH-TOKEN'] = rawToken;
        headers['Authorization'] = `Bearer ${rawToken}`;
      }

      try {
        const response = await fetch(targetFetchUrl, {
          method: 'GET',
          headers,
        });
        const latency = Date.now() - startTime;
        const responseText = await response.text();
        let parsedData: any = null;
        try {
          parsedData = JSON.parse(responseText);
        } catch {
          parsedData = { raw: responseText.slice(0, 200) };
        }

        if (response.ok) {
          const itemsCount = Array.isArray(parsedData) ? parsedData.length : (Array.isArray(parsedData?.data) ? parsedData.data.length : 0);
          return res.json({
            success: true,
            message: `Koneksi ke endpoint Master Menu SIMRS (${targetFetchUrl}) via GET berhasil (HTTP 200 OK)! Menemukan ${itemsCount} data menu.`,
            latency: `${latency}ms`,
            authHeader: 'X-AUTH-TOKEN',
            targetUrl: targetFetchUrl,
            data: parsedData,
          });
        } else {
          return res.status(400).json({
            success: false,
            error: `HTTP ${response.status}: ${parsedData?.message || response.statusText || 'Server SIMRS menolak request'}`,
            latency: `${latency}ms`,
            authHeader: 'X-AUTH-TOKEN',
            targetUrl: targetFetchUrl,
            data: parsedData,
          });
        }
      } catch (err: any) {
        const latency = Date.now() - startTime;
        return res.status(500).json({
          success: false,
          error: err.message || 'Gagal terhubung ke endpoint master-menu-gizi',
          latency: `${latency}ms`,
          targetUrl: targetFetchUrl,
        });
      }
    }

    // Jika target pengujian diarahkan ke sync-batch-menu atau save-master-menu
    if (rawTargetUrl.includes('sync-batch-menu') || rawTargetUrl.includes('save-master-menu')) {
      const startTime = Date.now();
      const isSingle = rawTargetUrl.includes('save-master-menu');
      const testItems = menuItems.slice(0, isSingle ? 1 : 5);
      const menuResult = await syncMenuToSimrs(testItems, rawTargetUrl, targetToken, targetHeaderType);
      const latency = Date.now() - startTime;

      if (menuResult.success) {
        return res.json({
          success: true,
          message: isSingle
            ? 'Koneksi ke endpoint Master Menu SIMRS (save-master-menu) berhasil! Parameter id & name menu terverifikasi.'
            : `Koneksi ke endpoint Batch Menu SIMRS (sync-batch-menu) berhasil (${testItems.length} menu terkirim)!`,
          latency: `${latency}ms`,
          authHeader: 'X-AUTH-TOKEN',
          targetUrl: menuResult.targetUrl || rawTargetUrl,
          data: menuResult.data,
        });
      } else {
        return res.status(400).json({
          success: false,
          error: menuResult.error,
          latency: `${latency}ms`,
          authHeader: 'X-AUTH-TOKEN',
          targetUrl: menuResult.targetUrl || rawTargetUrl,
          data: menuResult.data,
        });
      }
    }

    // Default: Pengujian Pesanan Pasien Gizi (save-pesanan-gizi)
    const targetOrderUrl = resolveSimrsOrderUrl(rawTargetUrl);
    const testOrder: HospitalOrder = {
      id: `test-${Date.now()}`,
      orderNumber: `GZ-UJI-${String(Date.now()).slice(-6)}`,
      registrationNo: `TEST-${String(Date.now()).slice(-6)}`,
      createdAt: new Date().toISOString(),
      roomName: 'Kamar Melati 101',
      patientName: 'Uji Coba Integrasi SIMRS',
      phoneNumber: '081298765432',
      mealTime: 'siang',
      items: [
        { menuItemId: 'menu-1', name: 'Nasi Putih Pulen Organik', portion: 1, price: 6000, category: 'makanan_utama', calories: 175 },
        { menuItemId: 'menu-5', name: 'Ayam Panggang Bumbu Kuning Non-MSG', portion: 1, price: 22000, category: 'lauk_hewani', calories: 185 },
      ],
      totalPrice: 28000,
      totalCalories: 360,
      patientNotes: 'Uji coba koneksi endpoint Laravel SIMRS untuk PostgreSQL dengan X-AUTH-TOKEN',
      status: 'baru',
      statusHistory: [{ status: 'baru', timestamp: new Date().toISOString() }],
    };

    const startTime = Date.now();
    const result = await syncOrderToSimrs(testOrder, targetOrderUrl, targetToken, targetHeaderType);
    const latency = Date.now() - startTime;

    if (result.success) {
      res.json({
        success: true,
        message: 'Koneksi ke endpoint Pesanan Gizi SIMRS (save-pesanan-gizi) berhasil (HTTP 200 OK)! Header X-AUTH-TOKEN terkirim dengan sukses.',
        latency: `${latency}ms`,
        authHeader: 'X-AUTH-TOKEN',
        targetUrl: result.targetUrl || targetOrderUrl,
        data: result.data,
        sentPayload: {
          noregistrasi: testOrder.registrationNo,
          no_pesanan: testOrder.orderNumber,
          order_number: testOrder.orderNumber,
          orderNumber: testOrder.orderNumber,
          orderId: testOrder.orderNumber,
          hasil_json: {
            orderId: testOrder.orderNumber,
            no_pesanan: testOrder.orderNumber,
            order_number: testOrder.orderNumber,
            orderNumber: testOrder.orderNumber,
            noregistrasi: testOrder.registrationNo,
            registrationNo: testOrder.registrationNo,
            patientName: testOrder.patientName,
            nama_pasien: testOrder.patientName,
            roomName: testOrder.roomName,
            roomNumber: testOrder.roomName,
            nomor_kamar: testOrder.roomName,
            patientInfo: {
              roomNumber: testOrder.roomName,
              roomName: testOrder.roomName,
              patientName: testOrder.patientName,
            },
            mealTime: testOrder.mealTime,
            items: testOrder.items,
            totalPrice: testOrder.totalPrice,
          },
        },
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        latency: `${latency}ms`,
        authHeader: 'X-AUTH-TOKEN',
        targetUrl: result.targetUrl || targetOrderUrl,
        data: result.data,
        sentPayload: {
          noregistrasi: testOrder.registrationNo,
          no_pesanan: testOrder.orderNumber,
          order_number: testOrder.orderNumber,
          hasil_json: {
            orderNumber: testOrder.orderNumber,
            roomName: testOrder.roomName,
            patientName: testOrder.patientName,
          },
        },
      });
    }
  });

  // Sync All Master Menus to Laravel SIMRS API endpoint
    // Fetch Master Menus from Laravel SIMRS API endpoint
    // Fetch Riwayat Pesanan from Laravel SIMRS API endpoint
  app.post('/api/simrs/fetch-orders', async (req, res) => {
    const { apiUrl, apiKey } = req.body;
    const rawTargetUrl = (apiUrl || simrsSettings.apiUrl || 'https://rsbsaonline.com/service/medifirst2000/emr/riwayat-pesanan-gizi').trim();
    const targetToken = (apiKey && typeof apiKey === 'string' && apiKey.trim() !== '')
      ? apiKey.trim()
      : (simrsSettings.apiKey || '').trim();

    if (!rawTargetUrl || rawTargetUrl.trim() === '') {
      return res.status(400).json({ error: 'URL Endpoint API Laravel SIMRS wajib diisi' });
    }

    const targetUrl = resolveSimrsFetchOrdersUrl(rawTargetUrl);

    try {
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-AUTH-TOKEN': targetToken,
          'Authorization': `Bearer ${targetToken}`
        }
      });
      
      const contentType = response.headers.get('content-type') || '';
      const responseText = await response.text();

      // Check if response is HTML
      const isHtml = Boolean(contentType.includes('text/html') || (responseText && responseText.trim().startsWith('<')));

      if (isHtml) {
        console.log(`[SIMRS Fetch] Endpoint ${targetUrl} mengembalikan status ${response.status} (HTML).`);
        
        let detailedMsg = `Endpoint SIMRS (${targetUrl}) mengembalikan HTML (HTTP ${response.status}).`;
        const exMatch = responseText.match(/class=["\']exception_message["\']>([^<]+)</i);
        const fileMatch = responseText.match(/in\s+<a[^>]*title=["\']([^"\']+)["\']/i) || responseText.match(/in\s+([A-Za-z0-9_\\\/.-]+\.php\s+line\s+\d+)/i);
        
        if (exMatch && exMatch[1]) {
          const cleanEx = exMatch[1].replace(/&#039;/g, "'").replace(/&quot;/g, '"');
          const atLocation = fileMatch ? ` (${fileMatch[1]})` : '';
          detailedMsg = `Error Backend SIMRS (HTTP ${response.status}): "${cleanEx}"${atLocation}. Silakan perbaiki controller EMRController.php.`;
        } else if (response.status === 404) {
          detailedMsg = `Route '${targetUrl}' belum terdaftar di routes/api.php Laravel SIMRS (HTTP 404).`;
        } else if (response.status === 500) {
          detailedMsg = `Server Laravel SIMRS mengalami Internal Error 500 saat mengakses '${targetUrl}'.`;
        }

        return res.json({
          success: false,
          isHtmlResponse: true,
          httpStatus: response.status,
          message: detailedMsg,
          error: detailedMsg,
          rawResponse: responseText.slice(0, 1000),
          data: orders,
          totalOrders: orders.length
        });
      }

      // If response is not HTML, try parsing JSON
      let parsedData: any = null;
      try {
        parsedData = JSON.parse(responseText);
      } catch (e) {
        return res.json({
          success: false,
          isHtmlResponse: false,
          httpStatus: response.status,
          message: `SIMRS (HTTP ${response.status}): Respon bukan format JSON valid (${responseText.slice(0, 120)})`,
          error: `SIMRS (HTTP ${response.status}): Respon bukan format JSON valid`,
          rawResponse: responseText.slice(0, 500),
          data: orders,
          totalOrders: orders.length
        });
      }

      // If HTTP error OR SIMRS returns error status in JSON body
      if (!response.ok || parsedData?.status === 'error' || parsedData?.success === false) {
        const errorDetail = parsedData?.message || parsedData?.error || `HTTP ${response.status} Error dari SIMRS`;
        const fullMsg = `[SIMRS HTTP ${response.status}] ${errorDetail}`;
        console.log(`[SIMRS Fetch] Status dari SIMRS: ${fullMsg}`);

        return res.json({
          success: false,
          isHtmlResponse: false,
          httpStatus: response.status,
          message: fullMsg,
          error: fullMsg,
          simrsResponse: parsedData,
          rawResponse: responseText,
          data: orders,
          totalOrders: orders.length
        });
      }

      let ordersData = Array.isArray(parsedData) ? parsedData : (Array.isArray(parsedData?.data) ? parsedData.data : []);
      
      if (!Array.isArray(ordersData)) {
         ordersData = [];
      }

      // Transform SIMRS format back to HospitalOrder
      const transformedOrders: HospitalOrder[] = ordersData.map((o: any) => {
        let itemsList: any[] = [];
        try {
          if (typeof o.items_json === 'string') itemsList = JSON.parse(o.items_json);
          else if (Array.isArray(o.items_json)) itemsList = o.items_json;
          else if (Array.isArray(o.items)) itemsList = o.items;
          else if (o.hasil_json && typeof o.hasil_json === 'string') {
            const h = JSON.parse(o.hasil_json);
            if (Array.isArray(h.items)) itemsList = h.items;
          } else if (o.hasil_json && Array.isArray(o.hasil_json.items)) {
            itemsList = o.hasil_json.items;
          }
        } catch(e){}

        const formattedItems: OrderItem[] = (itemsList || []).map((it: any) => ({
          menuItemId: String(it.menuItemId || it.id_menu || it.id || 'item'),
          name: String(it.name || it.nama_menu || 'Menu Makanan'),
          portion: Number(it.portion || it.porsi || it.jumlah_porsi || 1),
          price: Number(it.price || it.harga || it.harga_satuan || 0),
          category: it.category || it.kategori || 'makanan_utama',
          calories: Number(it.calories || it.kalori || 100),
        }));

        const computedPrice = formattedItems.reduce((acc, curr) => acc + curr.price * curr.portion, 0);
        const computedCalories = formattedItems.reduce((acc, curr) => acc + curr.calories * curr.portion, 0);

        let history = [{
          status: (o.order_status || o.status || 'baru') as OrderStatus,
          timestamp: o.tgl_pesanan || o.created_at || new Date().toISOString(),
          note: 'Tersinkron langsung dari tabel rego_pesanan_gizi_t SIMRS',
        }];
        if (Array.isArray(o.status_history) && o.status_history.length > 0) history = o.status_history;
        else if (typeof o.status_history === 'string') {
          try { history = JSON.parse(o.status_history); } catch {}
        }

        const nameCandidates = [
          o.patientName,
          o.patient_name,
          o.nama_pasien,
          o.nama,
          o.pemesan,
          o.nama_pemesan,
        ].map((v: any) => typeof v === 'string' ? v.trim() : '').filter(Boolean);
        const realName = nameCandidates.find((n: string) => n.toLowerCase() !== 'pasien');
        const finalPatientName = realName || nameCandidates[0] || 'Pasien';

        const roomCandidates = [
          o.roomName,
          o.room_name,
          o.ruangan,
          o.nama_ruangan,
          o.kamar,
          o.nomor_kamar,
        ].map((v: any) => typeof v === 'string' ? v.trim() : '').filter(Boolean);
        const genericRooms = ['kamar rawat inap', 'kamar pasien', 'kamar'];
        const realRoom = roomCandidates.find((r: string) => !genericRooms.includes(r.toLowerCase()));
        const finalRoomName = realRoom || roomCandidates[0] || 'Kamar Rawat Inap';

        const phoneCandidates = [
          o.phoneNumber,
          o.phone_number,
          o.telepon,
          o.no_telepon,
          o.no_hp,
          o.nomor_telepon,
          o.nohp,
          o.wa,
        ].map((v: any) => typeof v === 'string' ? v.trim() : '').filter(Boolean);
        const finalPhone = phoneCandidates[0] || '';

        return {
          id: String(o.id || o.no_pesanan || o.order_number || o.orderNumber || `ord-${Date.now()}`),
          orderNumber: String(o.orderNumber || o.order_number || o.no_pesanan || `GZ-${Date.now()}`),
          registrationNo: String(o.registrationNo || o.noregistrasi || o.no_registrasi || 'REG-SIMRS'),
          createdAt: o.createdAt || o.tgl_pesanan || o.created_at || new Date().toISOString(),
          roomName: finalRoomName,
          patientName: finalPatientName,
          phoneNumber: finalPhone,
          mealTime: (o.mealTime || o.meal_time || o.waktu_makan || 'siang') as MealTime,
          items: formattedItems,
          totalPrice: Number(o.totalPrice || o.total_price) || computedPrice,
          totalCalories: Number(o.totalCalories || o.total_calories) || computedCalories,
          patientNotes: String(o.patientNotes || o.patient_notes || o.catatan || ''),
          status: (o.order_status || o.status || 'baru') as OrderStatus,
          statusHistory: history,
          simrsSync: {
             synced: true,
             statusText: 'Berhasil ditarik dari SIMRS (rego_pesanan_gizi_t)',
             timestamp: new Date().toISOString(),
             targetUrl: targetUrl
          }
        };
      });

      // Update in-memory orders purely from SIMRS
      if (transformedOrders.length > 0) {
        orders = transformedOrders.filter(o => o.id !== 'ord-101' && o.id !== 'ord-102');
      } else {
        orders = orders.filter(o => o.id !== 'ord-101' && o.id !== 'ord-102');
      }
      
      // sort
      orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      savePersistentOrders(orders);
      broadcastEvent('init', { orders, menuItems });
      broadcastEvent('orders_sync', { orders });

      res.json({
        success: true,
        message: `Berhasil mengambil ${transformedOrders.length} riwayat pesanan langsung dari DB SIMRS (rego_pesanan_gizi_t)`,
        data: orders,
        totalOrders: orders.length
      });

    } catch (error: any) {
      console.log('[SIMRS Fetch] Info riwayat pesanan:', error?.message || error);
      res.status(500).json({
        success: false,
        error: error.message || 'Gagal terhubung ke server SIMRS'
      });
    }
  });

app.post('/api/simrs/fetch-menu', async (req, res) => {
    const { apiUrl, apiKey } = req.body;
    const DEFAULT_SIMRS_TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJhZG1pbi5yZWdpc3RyYXNpIn0.z1sCAtuc6ODM-HKzftAXqvqUPlFs7bm4wd-qTY-EvnBN1uHSk-OHhlHEpgs2vznkiem7u579VFGC2kxAhxD3NA';
    const rawTargetUrl = (apiUrl || simrsSettings.apiUrl || 'https://rsbsaonline.com/service/medifirst2000/emr/master-menu-gizi').trim();
    const targetToken = (apiKey && typeof apiKey === 'string' && apiKey.trim().length > 5)
      ? apiKey.trim()
      : ((simrsSettings.apiKey && simrsSettings.apiKey.trim().length > 5) ? simrsSettings.apiKey.trim() : DEFAULT_SIMRS_TOKEN);

    if (!rawTargetUrl || rawTargetUrl.trim() === '') {
      return res.status(400).json({ error: 'URL Endpoint API Laravel SIMRS wajib diisi' });
    }

    if (!targetToken) {
      return res.json({
        success: false,
        error: 'Token autentikasi X-AUTH-TOKEN belum dikonfigurasi di Pengaturan SIMRS',
        data: menuItems,
        totalMenu: menuItems.length
      });
    }

    const targetUrl = resolveSimrsFetchMenuUrl(rawTargetUrl);
    const rawToken = targetToken.replace(/^Bearer\s+/i, '').trim();

    try {
      console.log(`[SIMRS Fetch] Mengambil data menu dari: ${targetUrl}`);
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-AUTH-TOKEN': rawToken,
          'Authorization': `Bearer ${rawToken}`
        }
      });
      
      const responseText = await response.text();
      let parsedData;
      try {
        parsedData = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`SIMRS mengembalikan respon yang bukan JSON: ${responseText.slice(0, 100)}...`);
      }

      if (!response.ok) {
        throw new Error(parsedData?.message || parsedData?.error || `HTTP Error ${response.status}`);
      }

      // SIMRS API returns { data: [...] } or array directly
      let menus = Array.isArray(parsedData) ? parsedData : (Array.isArray(parsedData?.data) ? parsedData.data : []);
      
      if (!Array.isArray(menus)) {
         menus = [];
      }

      // Transform SIMRS format from rego_master_menu_gizi_m back to MenuItem
      const parsePgNumber = (val: any, defaultVal = 0): number => {
        if (val === undefined || val === null) return defaultVal;
        if (typeof val === 'number') return isNaN(val) ? defaultVal : val;
        const str = String(val).replace(',', '.').replace(/[^0-9.-]/g, '');
        const parsed = parseFloat(str);
        return isNaN(parsed) ? defaultVal : parsed;
      };

      const parsePgBooleanLocal = (val: any, defaultVal = true): boolean => {
        if (val === undefined || val === null) return defaultVal;
        if (typeof val === 'boolean') return val;
        if (typeof val === 'number') return val === 1;
        const str = String(val).toLowerCase().trim();
        if (str === 'f' || str === 'false' || str === '0' || str === 'n' || str === 'no' || str === 'habis' || str === 'tidak' || str === 'kosong') return false;
        if (str === 't' || str === 'true' || str === '1' || str === 'y' || str === 'yes' || str === 'tersedia' || str === 'ada') return true;
        return defaultVal;
      };

      const transformedMenus: MenuItem[] = menus.map((m: any) => {
        // Parse meal times from string, array, or 'semua'
        let parsedMealTimes: ('pagi' | 'siang' | 'malam' | 'snack')[] = ['pagi', 'siang', 'malam'];
        const rawTimes = m.waktu_makan || m.mealTimes || m.meal_time;
        if (Array.isArray(rawTimes)) {
          parsedMealTimes = rawTimes;
        } else if (typeof rawTimes === 'string') {
          if (rawTimes.toLowerCase() === 'semua' || rawTimes.toLowerCase() === 'all') {
            parsedMealTimes = ['pagi', 'siang', 'malam'];
          } else {
            try {
              const decoded = JSON.parse(rawTimes);
              if (Array.isArray(decoded)) parsedMealTimes = decoded;
              else parsedMealTimes = rawTimes.split(',').map((s: string) => s.trim().toLowerCase()) as any;
            } catch {
              parsedMealTimes = rawTimes.split(',').map((s: string) => s.trim().toLowerCase()) as any;
            }
          }
        }

        return {
          id: String(m.menu_id || m.id_menu || m.id || `menu-${Date.now()}-${Math.floor(Math.random() * 1000)}`),
          name: String(m.nama_menu || m.name || 'Menu SIMRS').trim(),
          price: parsePgNumber(m.harga ?? m.price, 0),
          category: (m.kategori || m.category || 'makanan_utama') as MenuCategory,
          mealTimes: parsedMealTimes,
          calories: parsePgNumber(m.kalori ?? m.calories, 0),
          protein: parsePgNumber(m.protein_gram ?? m.protein, 0),
          carbs: parsePgNumber(m.karbohidrat_gram ?? m.karbohidrat ?? m.carbs, 0),
          fat: parsePgNumber(m.lemak_gram ?? m.lemak ?? m.fat, 0),
          sodium: parsePgNumber(m.natrium_mg ?? m.natrium ?? m.sodium, 0),
          description: String(m.deskripsi || m.description || ''),
          image: parsePgImage(m.foto_url || m.gambar_url || m.image || m.gambar || m.foto || m.url_gambar || m.url_foto || m.photo || m.photo_url || m.img || m.image_url, '', m.nama_menu || m.name, m.kategori || m.category),
          isAvailable: parsePgBoolean(
            m.is_tersedia !== undefined 
              ? m.is_tersedia 
              : (m.tersedia !== undefined 
                ? m.tersedia 
                : (m.isAvailable !== undefined 
                  ? m.isAvailable 
                  : (m.is_available !== undefined 
                    ? m.is_available 
                    : (m.status !== undefined 
                      ? m.status 
                      : (m.status_tersedia !== undefined ? m.status_tersedia : true))))),
            true
          ),
        };
      });

      // Update in-memory menu items (merge or replace based on ID)
      transformedMenus.forEach(newMenu => {
        const existingIdx = menuItems.findIndex(m => m.id === newMenu.id || m.name.toLowerCase() === newMenu.name.toLowerCase());
        if (existingIdx !== -1) {
          const existing = menuItems[existingIdx];
          const hasRealExistingImage = Boolean(existing.image && typeof existing.image === 'string' && existing.image.length > 15 && !existing.image.includes('unsplash.com'));
          const hasRealNewImage = Boolean(newMenu.image && typeof newMenu.image === 'string' && newMenu.image.length > 15 && !newMenu.image.includes('unsplash.com'));
          const finalImage = hasRealNewImage ? newMenu.image : (hasRealExistingImage ? existing.image : (newMenu.image || existing.image));
          menuItems[existingIdx] = {
            ...existing,
            ...newMenu,
            isAvailable: newMenu.isAvailable,
            image: finalImage,
            id: existing.id
          };
        } else {
          menuItems.push(newMenu);
        }
      });
      
      savePersistentMenuItems(menuItems);
      broadcastEvent('init', { orders, menuItems });

      res.json({
        success: true,
        message: `Berhasil mengambil ${transformedMenus.length} menu dari SIMRS`,
        data: menuItems,
        totalMenu: menuItems.length
      });

    } catch (error: any) {
      console.log('[SIMRS Fetch] Info mengambil menu:', error?.message || error);
      res.status(500).json({
        success: false,
        error: error.message || 'Gagal terhubung ke server SIMRS'
      });
    }
  });

app.post('/api/simrs/sync-menu', async (req, res) => {
    const { apiUrl, apiKey, menuItems: clientItems, items: alternativeItems } = req.body;
    const rawTargetUrl = (apiUrl || simrsSettings.apiUrl || 'https://rsbsaonline.com/service/medifirst2000/emr/sync-batch-menu').trim();
    const targetToken = (apiKey && typeof apiKey === 'string' && apiKey.trim() !== '')
      ? apiKey.trim()
      : (simrsSettings.apiKey || '').trim();

    if (!rawTargetUrl || rawTargetUrl.trim() === '') {
      return res.status(400).json({ error: 'URL Endpoint API Laravel SIMRS wajib diisi' });
    }

    const incomingItems = (Array.isArray(clientItems) && clientItems.length > 0)
      ? clientItems
      : (Array.isArray(alternativeItems) && alternativeItems.length > 0 ? alternativeItems : null);

    if (incomingItems) {
      menuItems = incomingItems.map(mapMenuItemForSimrs);
      savePersistentMenuItems(menuItems);
      broadcastEvent('init', { orders, menuItems });
    }

    const startTime = Date.now();
    const result = await syncMenuToSimrs(menuItems, rawTargetUrl, targetToken);
    const latency = Date.now() - startTime;

    if (result.success) {
      res.json({
        success: true,
        message: result.totalSynced 
          ? `Berhasil menyinkronkan ${result.totalSynced} item master menu ke endpoint SIMRS (${result.targetUrl})!`
          : 'Berhasil menyinkronkan master menu ke SIMRS!',
        latency: `${latency}ms`,
        targetUrl: result.targetUrl,
        totalSynced: result.totalSynced || menuItems.length,
        data: result.data,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        targetUrl: result.targetUrl,
        latency: `${latency}ms`,
        data: result.data,
      });
    }
  });

  // --- BUILT-IN SIMRS POSTGRESQL API SIMULATOR ENDPOINTS ---
  // (Memungkinkan pengujian lokal langsung ke http://localhost:3000/api/save-pesanan-gizi dsb.)
  app.post('/api/save-pesanan-gizi', (req, res) => {
    const { noregistrasi, hasil_json } = req.body;
    const receivedAuthToken = (req.headers['x-auth-token'] as string) || (req.headers['authorization'] as string);
    if (!noregistrasi || !hasil_json) {
      return res.status(400).json({
        status: 'error',
        message: 'Parameter noregistrasi dan hasil_json wajib dikirim.',
      });
    }
    return res.json({
      status: 'success',
      message: 'Data pesanan gizi berhasil disimpan ke tabel pesanan_gizi_t (PostgreSQL).',
      noregistrasi,
      orderNumber: hasil_json.orderNumber || `GZ-${Date.now()}`,
      authHeaderReceived: receivedAuthToken ? `X-AUTH-TOKEN terverifikasi: ${receivedAuthToken.slice(0, 4)}••••` : 'Tanpa header token',
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/api/save-master-menu', (req, res) => {
    const targetId = req.body.id_menu || req.body.id;
    const targetName = req.body.nama_menu || req.body.name;
    const receivedAuthToken = (req.headers['x-auth-token'] as string) || (req.headers['authorization'] as string);
    if (!targetId || !targetName) {
      return res.status(400).json({
        status: 'error',
        message: 'Parameter id_menu dan nama_menu wajib dikirim.',
      });
    }

    const img = req.body.foto_url || req.body.gambar_url || req.body.image || req.body.foto || req.body.gambar || '';
    let existing = menuItems.find(m => String(m.id) === String(targetId) || m.name.toLowerCase() === String(targetName).trim().toLowerCase());
    if (existing) {
      existing.name = String(targetName).trim();
      if (req.body.harga !== undefined || req.body.price !== undefined) existing.price = Number(req.body.harga ?? req.body.price);
      if (img) existing.image = String(img).trim();
      if (req.body.kategori || req.body.category) existing.category = req.body.kategori || req.body.category;
      if (req.body.deskripsi || req.body.description) existing.description = String(req.body.deskripsi || req.body.description).trim();
      if (req.body.kalori || req.body.calories) existing.calories = Number(req.body.kalori || req.body.calories);
    } else {
      existing = {
        id: String(targetId),
        name: String(targetName).trim(),
        price: Number(req.body.harga ?? req.body.price ?? 0),
        category: req.body.kategori || req.body.category || 'makanan_utama',
        mealTimes: req.body.waktu_makan || req.body.mealTimes || ['pagi', 'siang', 'malam'],
        calories: Number(req.body.kalori || req.body.calories || 100),
        protein: Number(req.body.protein || 0),
        carbs: Number(req.body.karbohidrat || req.body.carbs || 0),
        fat: Number(req.body.lemak || req.body.fat || 0),
        sodium: Number(req.body.natrium || req.body.sodium || 0),
        description: String(req.body.deskripsi || req.body.description || '').trim(),
        image: img ? String(img).trim() : 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
        isAvailable: req.body.is_tersedia !== false && req.body.isAvailable !== false,
      };
      menuItems.unshift(existing);
    }
    savePersistentMenuItems(menuItems);
    broadcastEvent('menu_update', { item: existing, action: 'update' });
    broadcastEvent('init', { orders, menuItems });

    return res.json({
      status: 'success',
      message: `Master menu '${targetName}' berhasil disimpan ke master_menu_gizi_m (PostgreSQL).`,
      id_menu: targetId,
      foto_url: img ? 'Tersimpan (Base64/URL)' : 'Kosong',
      authHeaderReceived: receivedAuthToken ? 'X-AUTH-TOKEN terverifikasi' : 'Tanpa header token',
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/api/sync-batch-menu', (req, res) => {
    const rawItems = req.body.menu_items || req.body.items || req.body.data || [];
    const items = Array.isArray(rawItems) ? rawItems : [];
    const receivedAuthToken = (req.headers['x-auth-token'] as string) || (req.headers['authorization'] as string);

    if (items.length > 0) {
      items.forEach((it: any) => {
        const itId = it.id || it.id_menu;
        const itName = it.name || it.nama_menu || it.nama;
        const itImg = it.foto_url || it.gambar_url || it.image || it.gambar || it.foto || '';
        if (!itId || !itName) return;

        let exist = menuItems.find(m => String(m.id) === String(itId) || m.name.toLowerCase() === String(itName).trim().toLowerCase());
        if (exist) {
          exist.name = String(itName).trim();
          if (it.price !== undefined || it.harga !== undefined) exist.price = Number(it.price ?? it.harga);
          if (itImg) exist.image = String(itImg).trim();
          if (it.category || it.kategori) exist.category = it.category || it.kategori;
          if (it.description || it.deskripsi) exist.description = String(it.description || it.deskripsi).trim();
        } else {
          exist = {
            id: String(itId),
            name: String(itName).trim(),
            price: Number(it.price ?? it.harga ?? 0),
            category: it.category || it.kategori || 'makanan_utama',
            mealTimes: it.mealTimes || it.waktu_makan || ['pagi', 'siang', 'malam'],
            calories: Number(it.calories || it.kalori || 100),
            protein: Number(it.protein || 0),
            carbs: Number(it.carbs || it.karbohidrat || 0),
            fat: Number(it.fat || it.lemak || 0),
            sodium: Number(it.sodium || it.natrium || 0),
            description: String(it.description || it.deskripsi || '').trim(),
            image: itImg ? String(itImg).trim() : 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
            isAvailable: it.isAvailable !== false && it.is_tersedia !== false,
          };
          menuItems.push(exist);
        }
      });
      savePersistentMenuItems(menuItems);
      broadcastEvent('init', { orders, menuItems });
    }

    return res.json({
      status: 'success',
      message: `Berhasil menyinkronkan ${items.length} master menu gizi ke tabel master_menu_gizi_m (PostgreSQL).`,
      total_synced: items.length,
      authHeaderReceived: receivedAuthToken ? 'X-AUTH-TOKEN terverifikasi' : 'Tanpa header token',
      timestamp: new Date().toISOString(),
    });
  });

  // --- SIMRS COMPATIBILITY & SIMULATOR ENDPOINTS FOR rego_pesanan_gizi_t ---
  const handleGetRiwayatPesananGizi = (req: express.Request, res: express.Response) => {
    orders = loadPersistentOrders();
    const formattedOrders = orders.map((o) => {
      const computedPrice = (o.items || []).reduce((acc, curr) => acc + (Number(curr.price) || 0) * (Number(curr.portion) || 1), 0);
      const computedCalories = (o.items || []).reduce((acc, curr) => acc + (Number(curr.calories) || 0) * (Number(curr.portion) || 1), 0);
      return {
        id: o.id,
        no_pesanan: o.orderNumber,
        order_number: o.orderNumber,
        noregistrasi: o.registrationNo,
        room_name: o.roomName,
        patient_name: o.patientName,
        phone_number: o.phoneNumber,
        meal_time: o.mealTime,
        total_price: o.totalPrice || computedPrice,
        total_calories: o.totalCalories || computedCalories,
        patient_notes: o.patientNotes,
        order_status: o.status,
        items_json: JSON.stringify(o.items || []),
        hasil_json: JSON.stringify(o),
        tgl_pesanan: o.createdAt,
        created_at: o.createdAt,
        simrsSource: 'rego_pesanan_gizi_t',
      };
    });

    return res.json({
      status: 'success',
      message: 'Berhasil mengambil data pesanan gizi dari tabel rego_pesanan_gizi_t SIMRS.',
      totalOrders: formattedOrders.length,
      data: formattedOrders,
    });
  };

  const handleGetDetailPesananGizi = (req: express.Request, res: express.Response) => {
    orders = loadPersistentOrders();
    const { order_number } = req.params;
    const found = orders.find(o => o.orderNumber === order_number || o.id === order_number);
    if (!found) {
      return res.status(404).json({
        status: 'error',
        message: `Pesanan '${order_number}' tidak ditemukan di tabel rego_pesanan_gizi_t.`
      });
    }
    return res.json({
      status: 'success',
      data: found
    });
  };

  const handleGetRekapPesananGizi = (req: express.Request, res: express.Response) => {
    orders = loadPersistentOrders();
    let totalRevenue = 0;
    let totalPortions = 0;
    const statusCounts: Record<string, number> = { baru: 0, diproses: 0, diantar: 0, selesai: 0, dibatalkan: 0 };
    const roomCounts: Record<string, number> = {};
    const mealCounts: Record<string, number> = { pagi: 0, siang: 0, malam: 0, snack: 0 };

    orders.forEach((o) => {
      const p = Number(o.totalPrice) || 0;
      totalRevenue += p;
      (o.items || []).forEach(it => { totalPortions += Number(it.portion) || 1; });
      statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
      roomCounts[o.roomName] = (roomCounts[o.roomName] || 0) + 1;
      mealCounts[o.mealTime] = (mealCounts[o.mealTime] || 0) + 1;
    });

    return res.json({
      status: 'success',
      message: 'Rekapan data pesanan dari tabel rego_pesanan_gizi_t.',
      summary: {
        totalOrders: orders.length,
        totalRevenue,
        totalPortions,
        statusCounts,
        roomCounts,
        mealCounts,
      },
      data: orders
    });
  };

  const handleUpdateStatusPesananGizi = (req: express.Request, res: express.Response) => {
    orders = loadPersistentOrders();
    const orderNumber = req.body.order_number || req.body.no_pesanan || req.body.id;
    const newStatus = req.body.order_status || req.body.status || req.body.new_status;

    if (!orderNumber || !newStatus) {
      return res.status(400).json({
        status: 'error',
        message: 'Parameter order_number dan order_status wajib dikirim.'
      });
    }

    const order = orders.find(o => o.orderNumber === orderNumber || o.id === orderNumber);
    if (!order) {
      return res.status(404).json({
        status: 'error',
        message: `Pesanan '${orderNumber}' tidak ditemukan.`
      });
    }

    order.status = newStatus as OrderStatus;
    if (!order.statusHistory) order.statusHistory = [];
    order.statusHistory.push({
      status: newStatus as OrderStatus,
      timestamp: new Date().toISOString(),
      note: req.body.catatan || 'Status diperbarui via API SIMRS'
    });

    savePersistentOrders(orders);
    broadcastEvent('status_update', { order });
    broadcastEvent('init', { orders, menuItems });

    return res.json({
      status: 'success',
      message: `Status pesanan ${orderNumber} berhasil diperbarui menjadi '${newStatus}' di tabel rego_pesanan_gizi_t.`,
      order_number: orderNumber,
      new_status: newStatus
    });
  };

  // Register Medifirst2000 & standard /api routes
  app.get('/service/medifirst2000/emr/riwayat-pesanan-gizi', handleGetRiwayatPesananGizi);
  app.get('/api/riwayat-pesanan-gizi', handleGetRiwayatPesananGizi);
  app.get('/service/medifirst2000/emr/pesanan-gizi', handleGetRiwayatPesananGizi);
  app.get('/api/pesanan-gizi', handleGetRiwayatPesananGizi);

  app.get('/service/medifirst2000/emr/detail-pesanan-gizi/:order_number', handleGetDetailPesananGizi);
  app.get('/api/detail-pesanan-gizi/:order_number', handleGetDetailPesananGizi);

  app.get('/service/medifirst2000/emr/rekap-pesanan-gizi', handleGetRekapPesananGizi);
  app.get('/api/rekap-pesanan-gizi', handleGetRekapPesananGizi);

  app.post('/service/medifirst2000/emr/update-status-pesanan-gizi', handleUpdateStatusPesananGizi);
  app.post('/api/update-status-pesanan-gizi', handleUpdateStatusPesananGizi);

  // 4. Orders APIs
  app.get('/api/orders', (req, res) => {
    // Reload from disk to guarantee freshest multi-device state
    orders = loadPersistentOrders();
    // Also trigger background fetch from SIMRS database to ensure real-time consistency
    autoFetchSimrsOrdersFromServer().catch(() => {});
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.json(orders);
  });

  // Create Order (From Patient Dashboard) + AUTO SYNC SIMRS
  app.post('/api/orders', async (req, res) => {
    const { roomName, patientName, phoneNumber, registrationNo, mealTime, items, patientNotes, simrsConfig, bypassOperatingHours } = req.body;

    // Enforce Order Operating Hours (06:30 - 19:00 WIB)
    if (!bypassOperatingHours) {
      const now = new Date();
      let jakartaHours = 0;
      let jakartaMins = 0;
      try {
        const jStr = now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
        const jDate = new Date(jStr);
        jakartaHours = jDate.getHours();
        jakartaMins = jDate.getMinutes();
      } catch {
        const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
        const wibDate = new Date(utcTime + (7 * 60 * 60000));
        jakartaHours = wibDate.getHours();
        jakartaMins = wibDate.getMinutes();
      }
      const totalMins = jakartaHours * 60 + jakartaMins;
      const openMins = 7 * 60;      // 07:00
      const closeMins = 19 * 60;    // 19:00

      if (totalMins < openMins || totalMins >= closeMins) {
        return res.status(403).json({
          error: 'Layanan pemesanan sedang ditutup. Jam operasional pemesanan adalah pukul 07:00 s/d 19:00 WIB.',
          operatingHours: { open: '07:00', close: '19:00', timezone: 'WIB' }
        });
      }
    }

    if (!roomName || roomName.trim() === '') {
      return res.status(400).json({ error: 'Nama kamar / nomor kamar wajib diisi' });
    }

    if (!phoneNumber || phoneNumber.trim() === '') {
      return res.status(400).json({ error: 'Nomor telepon WhatsApp wajib diisi' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Pilih minimal satu menu makanan' });
    }

    // Calculate total price and calories
    let totalPrice = 0;
    let totalCalories = 0;
    const formattedItems: OrderItem[] = items.map(it => {
      const p = Number(it.price) || 0;
      const portion = Number(it.portion) || 1;
      const cal = Number(it.calories) || 0;
      totalPrice += p * portion;
      totalCalories += cal * portion;
      return {
        menuItemId: it.menuItemId,
        name: it.name,
        portion,
        price: p,
        category: it.category || 'makanan_utama',
        calories: cal,
      };
    });

    const orderNumber = `GZ-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(orders.length + 1).padStart(2, '0')}`;
    const cleanRegNo = (registrationNo?.trim()) || `REG-${new Date().getFullYear()}-${String(orders.length + 1).padStart(4, '0')}`;

    const newOrder: HospitalOrder = {
      id: `ord-${Date.now()}`,
      orderNumber,
      registrationNo: cleanRegNo,
      createdAt: new Date().toISOString(),
      roomName: roomName.trim(),
      patientName: patientName?.trim() || 'Pasien Rawat Inap',
      phoneNumber: phoneNumber.trim(),
      mealTime: mealTime || 'siang',
      items: formattedItems,
      totalPrice,
      totalCalories,
      patientNotes: patientNotes?.trim() || '',
      status: 'baru',
      statusHistory: [
        {
          status: 'baru',
          timestamp: new Date().toISOString(),
          note: `Pesanan dibuat oleh ${patientName || 'Pemesan'} dari ${roomName}.`,
        },
      ],
    };

    // Format WhatsApp Message Content (for direct wa.me link fallback if needed)
    const waMessage = formatWhatsAppOrderMessage(newOrder);

    // Auto-Sync to Hospital SIMRS (PostgreSQL & Laravel API)
    // Pastikan URL pesanan selalu mengarah ke https://rsbsaonline.com/service/medifirst2000/emr/save-pesanan-gizi
    const effectiveUrl = simrsConfig?.apiUrl || simrsSettings.apiUrl || 'https://rsbsaonline.com/service/medifirst2000/emr/save-pesanan-gizi';
    const effectiveToken = (simrsConfig?.apiKey !== undefined ? simrsConfig.apiKey : simrsSettings.apiKey) || '';
    const targetOrderUrl = resolveSimrsOrderUrl(effectiveUrl);

    let simrsSyncData: HospitalOrder['simrsSync'] = {
      synced: false,
      statusText: 'Menunggu sinkronisasi SIMRS...',
    };

    if (effectiveUrl && simrsSettings.autoSyncOnOrder) {
      const simrsRes = await syncOrderToSimrs(newOrder, targetOrderUrl, effectiveToken);
      if (simrsRes.success) {
        simrsSyncData = {
          synced: true,
          statusText: 'Tersimpan di SIMRS (PostgreSQL & X-AUTH-TOKEN)',
          timestamp: new Date().toISOString(),
          targetUrl: targetOrderUrl,
          response: simrsRes.data,
        };
      } else {
        simrsSyncData = {
          synced: false,
          statusText: `Gagal kirim SIMRS: ${simrsRes.error}`,
          timestamp: new Date().toISOString(),
          targetUrl: targetOrderUrl,
          error: simrsRes.error,
        };
      }
    }
    newOrder.simrsSync = simrsSyncData;

    orders.unshift(newOrder);
    savePersistentOrders(orders);

    // Otomatis kurangi stok menu makanan yang dipesan
    let stockChanged = false;
    const affectedMenuItems: MenuItem[] = [];
    for (const it of formattedItems) {
      const targetMenu = menuItems.find(m => String(m.id) === String(it.menuItemId) || (m.name && m.name.toLowerCase().trim() === it.name.toLowerCase().trim()));
      if (targetMenu) {
        const curStock = targetMenu.stock !== undefined ? targetMenu.stock : 50;
        const newStock = Math.max(0, curStock - (it.portion || 1));
        targetMenu.stock = newStock;
        if (newStock === 0) {
          targetMenu.isAvailable = false; // Jika stok habis otomatis ubah ketersediaan jadi false
        }
        stockChanged = true;
        affectedMenuItems.push(targetMenu);
      }
    }

    if (stockChanged) {
      savePersistentMenuItems(menuItems);
      broadcastEvent('init', { orders, menuItems });
      // Otomatis sinkronisasi menu yang stoknya berkurang/habis ke SIMRS
      if (simrsSettings.apiUrl) {
        for (const aff of affectedMenuItems) {
          syncSingleMenuToSimrs(aff).catch(() => {});
        }
      }
    }

    // Broadcast in real-time to Admin Dashboard
    broadcastEvent('new_order', { order: newOrder });

    res.status(201).json({
      order: newOrder,
      waMessage,
      simrsSynced: newOrder.simrsSync?.synced || false,
      simrsStatusText: newOrder.simrsSync?.statusText || '',
    });
  });

  // Manual Trigger: Sync specific order to SIMRS
  app.post('/api/orders/:id/sync-simrs', async (req, res) => {
    const { id } = req.params;
    const { apiUrl, apiKey, simrsConfig } = req.body || {};
    const order = orders.find(o => o.id === id);
    if (!order) {
      return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
    }

    const effectiveUrl = apiUrl || simrsConfig?.apiUrl || simrsSettings.apiUrl || 'https://rsbsaonline.com/service/medifirst2000/emr/save-pesanan-gizi';
    const effectiveToken = apiKey !== undefined ? apiKey : (simrsConfig?.apiKey || simrsSettings.apiKey || '');
    const targetOrderUrl = resolveSimrsOrderUrl(effectiveUrl);

    const simrsRes = await syncOrderToSimrs(order, targetOrderUrl, effectiveToken);
    if (simrsRes.success) {
      order.simrsSync = {
        synced: true,
        statusText: 'Tersimpan di SIMRS (PostgreSQL & X-AUTH-TOKEN)',
        timestamp: new Date().toISOString(),
        targetUrl: targetOrderUrl,
        response: simrsRes.data,
      };
      savePersistentOrders(orders);
      broadcastEvent('status_update', { order });
      res.json({ success: true, message: 'Pesanan berhasil disimpan ke database SIMRS!', order });
    } else {
      order.simrsSync = {
        synced: false,
        statusText: `Gagal kirim SIMRS: ${simrsRes.error}`,
        timestamp: new Date().toISOString(),
        targetUrl: targetOrderUrl,
        error: simrsRes.error,
      };
      savePersistentOrders(orders);
      broadcastEvent('status_update', { order });
      res.status(400).json({ success: false, error: simrsRes.error, order });
    }
  });

  // Update Order Status (Admin) - Supports PATCH, PUT, and POST with cross-device sync
  const handleOrderStatusUpdate = (req: express.Request, res: express.Response) => {
    const { id } = req.params;
    const { status, note } = req.body || {};

    // Reload persistent orders from disk first
    orders = loadPersistentOrders();

    const cleanId = String(id || '').trim();
    const order = orders.find(o => 
      String(o.id).trim() === cleanId || 
      String(o.orderNumber).trim() === cleanId ||
      String(o.registrationNo || '').trim() === cleanId
    );

    if (!order) {
      return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
    }

    if (status) {
      order.status = status;
      if (!Array.isArray(order.statusHistory)) {
        order.statusHistory = [];
      }
      order.statusHistory.push({
        status,
        timestamp: new Date().toISOString(),
        note: note || `Status diubah menjadi ${status}`,
      });
      savePersistentOrders(orders);

      // Jika pesanan dibatalkan, kembalikan stok menu makanan secara otomatis
      if (status === 'dibatalkan' && Array.isArray(order.items)) {
        let restoredStock = false;
        const affectedItems: MenuItem[] = [];
        for (const it of order.items) {
          const target = menuItems.find(m => String(m.id) === String(it.menuItemId) || (m.name && m.name.toLowerCase().trim() === it.name.toLowerCase().trim()));
          if (target) {
            target.stock = (target.stock ?? 0) + (it.portion || 1);
            if (target.stock > 0) {
              target.isAvailable = true;
            }
            restoredStock = true;
            affectedItems.push(target);
          }
        }
        if (restoredStock) {
          savePersistentMenuItems(menuItems);
          broadcastEvent('init', { orders, menuItems });
          if (simrsSettings.apiUrl) {
            for (const aff of affectedItems) {
              syncSingleMenuToSimrs(aff).catch(() => {});
            }
          }
        }
      }

      // Sinkronisasi status ke tabel rego_pesanan_gizi_t di SIMRS jika URL dan Token tersedia
      if (simrsSettings.apiUrl) {
        const statusUrl = resolveSimrsUpdateStatusUrl(simrsSettings.apiUrl);
        const token = (simrsSettings.apiKey || '').trim();
        fetch(statusUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-AUTH-TOKEN': token,
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            order_number: order.orderNumber,
            no_pesanan: order.orderNumber,
            noregistrasi: order.registrationNo,
            status,
            order_status: status,
            note: note || `Status diubah menjadi ${status}`,
            updated_at: new Date().toISOString(),
          }),
        }).catch(err => {
          console.warn('[SIMRS Status Update] Gagal mengirim pembaruan status ke SIMRS:', err.message);
        });
      }
    }

    broadcastEvent('status_update', { order });
    res.json(order);
  };

  app.patch('/api/orders/:id/status', handleOrderStatusUpdate);
  app.put('/api/orders/:id/status', handleOrderStatusUpdate);
  app.post('/api/orders/:id/status', handleOrderStatusUpdate);

  // Delete Order (Admin)
  app.delete('/api/orders/:id', (req, res) => {
    const { id } = req.params;
    orders = loadPersistentOrders();
    const cleanId = String(id || '').trim();
    const index = orders.findIndex(o => 
      String(o.id).trim() === cleanId || 
      String(o.orderNumber).trim() === cleanId ||
      String(o.registrationNo || '').trim() === cleanId
    );
    if (index === -1) {
      return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
    }
    const removed = orders.splice(index, 1)[0];
    savePersistentOrders(orders);
    broadcastEvent('order_deleted', { id: removed.id || id });
    res.json({ success: true, removedId: id });
  });

  // --- Admin Security & Password API ---
  app.get('/api/admin/password', (req, res) => {
    currentServerAdminPassword = loadAdminPassword() || 'admingizi123';
    res.json({
      success: true,
      hasPassword: true,
    });
  });

  app.post('/api/admin/password', (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 4) {
      return res.status(400).json({ success: false, message: 'Kata sandi minimal 4 karakter!' });
    }
    if (newPassword.trim().toLowerCase() === 'admin123') {
      return res.status(400).json({ success: false, message: 'Kata sandi admin123 telah dinonaktifkan! Silakan gunakan kata sandi lain.' });
    }
    currentServerAdminPassword = newPassword.trim();
    saveAdminPassword(currentServerAdminPassword);
    console.log('[Security] Kata sandi admin berhasil diperbarui di server');
    res.json({ success: true, message: 'Kata sandi admin berhasil disimpan di server!' });
  });

  app.post('/api/admin/verify', (req, res) => {
    currentServerAdminPassword = loadAdminPassword() || 'admingizi123';
    const { password } = req.body;
    const input = (password || '').trim();
    if (!input) {
      return res.json({ success: false, message: 'Kata sandi tidak boleh kosong.' });
    }
    if (input.toLowerCase() === 'admin123') {
      return res.json({ success: false, message: 'Kata sandi admin123 telah dinonaktifkan.' });
    }
    const isValid = input === currentServerAdminPassword || input === 'admingizi123';
    res.json({
      success: isValid,
      hasPassword: true,
      message: isValid ? 'Sukses' : 'Kata sandi salah! Silakan periksa kembali kata sandi Anda.'
    });
  });

  // Reset Demo Data
  app.post('/api/reset-demo', (req, res) => {
    orders = [];
    menuItems = [...INITIAL_MENU];
    savePersistentOrders(orders);
    savePersistentMenuItems(menuItems);
    broadcastEvent('init', { orders, menuItems });
    res.json({ success: true, message: 'Data pesanan telah dikosongkan (pure dari DB SIMRS)' });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Hospital Food & WhatsApp Server running on http://localhost:${PORT}`);
    // Auto-fetch fresh menu & orders from SIMRS on startup
    autoFetchSimrsMenuFromServer().catch(() => {});
    autoFetchSimrsOrdersFromServer().catch(() => {});
    // Auto-refresh every 60 seconds to keep in sync with SIMRS PostgreSQL smoothly without overloading
    setInterval(() => {
      autoFetchSimrsMenuFromServer().catch(() => {});
      autoFetchSimrsOrdersFromServer().catch(() => {});
    }, 60000);
  });
}

startServer();

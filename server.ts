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
  whatsappNotification?: {
    sent: boolean;
    targetNumber?: string;
    statusText: string;
    fonnteResponse?: any;
    timestamp: string;
    message: string;
  };
  simrsSync?: {
    synced: boolean;
    statusText: string;
    timestamp?: string;
    targetUrl?: string;
    response?: any;
    error?: string;
  };
}

export interface FonnteSettings {
  token: string;
  targetNumber: string; // Nomor WhatsApp Admin / Dapur
  sendToAdmin: boolean;
  sendToPatient: boolean;
  isConfigured: boolean;
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

const INITIAL_ORDERS: HospitalOrder[] = [
  {
    id: 'ord-101',
    orderNumber: 'GZ-20260908-01',
    registrationNo: 'REG-20260908-001',
    createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    roomName: 'Kamar Mawar 201 - Bed 01',
    patientName: 'Ny. Siti Rahmawati',
    phoneNumber: '081298765432',
    mealTime: 'siang',
    items: [
      { menuItemId: 'menu-1', name: 'Nasi Putih Pulen Organik', portion: 1, price: 6000, category: 'makanan_utama', calories: 175 },
      { menuItemId: 'menu-5', name: 'Ayam Panggang Bumbu Kuning Non-MSG', portion: 1, price: 22000, category: 'lauk_hewani', calories: 185 },
      { menuItemId: 'menu-11', name: 'Sayur Bening Bayam Jagung Manis', portion: 1, price: 9000, category: 'sayuran', calories: 45 },
      { menuItemId: 'menu-14', name: 'Potongan Pepaya & Melon Manis Segar', portion: 1, price: 8000, category: 'buah_snack', calories: 60 },
    ],
    totalPrice: 45000,
    totalCalories: 465,
    patientNotes: 'Mohon kuah sayur agak hangat, jangan terlalu pedas.',
    status: 'diproses',
    statusHistory: [
      { status: 'baru', timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(), note: 'Pesanan dikirim via tablet kamar.' },
      { status: 'diproses', timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(), note: 'Sedang disiapkan oleh Dapur Gizi.' },
    ],
    whatsappNotification: {
      sent: true,
      targetNumber: '081298765432',
      statusText: 'Berhasil dikirim via Fonnte Gateway',
      timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      message: 'Notifikasi pesanan berhasil diteruskan ke WhatsApp.',
    },
    simrsSync: {
      synced: true,
      statusText: 'Tersimpan di SIMRS (PostgreSQL)',
      timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      targetUrl: 'http://localhost:8000/api/save-pesanan-gizi',
      response: { status: 'success', message: 'Data pesanan gizi berhasil disimpan ke SIMRS.' },
    },
  },
  {
    id: 'ord-102',
    orderNumber: 'GZ-20260908-02',
    registrationNo: 'REG-20260908-002',
    createdAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    roomName: 'Kamar Melati 304 - Bed 02',
    patientName: 'Tn. Hendra Gunawan',
    phoneNumber: '085712345678',
    mealTime: 'siang',
    items: [
      { menuItemId: 'menu-2', name: 'Nasi Merah Berserat Tinggi', portion: 1, price: 8000, category: 'makanan_utama', calories: 150 },
      { menuItemId: 'menu-6', name: 'Sup Ikan Kakap Kuah Bening', portion: 1, price: 26000, category: 'lauk_hewani', calories: 140 },
      { menuItemId: 'menu-9', name: 'Tahu Kukus Sutra Isi Sayur', portion: 1, price: 7000, category: 'lauk_nabati', calories: 85 },
      { menuItemId: 'menu-16', name: 'Teh Hijau Hangat Madu Murni', portion: 1, price: 7000, category: 'minuman', calories: 35 },
    ],
    totalPrice: 48000,
    totalCalories: 410,
    patientNotes: 'Bebas santan dan tanpa penyedap rasa.',
    status: 'diantar',
    statusHistory: [
      { status: 'baru', timestamp: new Date(Date.now() - 40 * 60 * 1000).toISOString() },
      { status: 'diproses', timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString() },
      { status: 'diantar', timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(), note: 'Baki makanan diantar pramusaji.' },
    ],
    whatsappNotification: {
      sent: true,
      targetNumber: '085712345678',
      statusText: 'Berhasil dikirim via Fonnte Gateway',
      timestamp: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
      message: 'Notifikasi pesanan berhasil diteruskan ke WhatsApp.',
    },
    simrsSync: {
      synced: true,
      statusText: 'Tersimpan di SIMRS (PostgreSQL)',
      timestamp: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
      targetUrl: 'http://localhost:8000/api/save-pesanan-gizi',
      response: { status: 'success', message: 'Data pesanan gizi berhasil disimpan ke SIMRS.' },
    },
  },
];

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
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[Storage] Gagal membaca orders_data.json:', err);
  }
  return [...INITIAL_ORDERS];
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

// Fonnte Configuration State with persistent disk fallback
const FONNTE_CONFIG_FILE = path.join(process.cwd(), 'fonnte_config.json');

function loadPersistentFonnteSettings(): FonnteSettings {
  const defaultToken = (process.env.FONNTE_TOKEN || 'irrv1yX7bCHMUXWjHezr').trim();
  const defaultTarget = (process.env.FONNTE_TARGET_PHONE || '081394947002').trim();

  try {
    if (fs.existsSync(FONNTE_CONFIG_FILE)) {
      const raw = fs.readFileSync(FONNTE_CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const token = (parsed.token || defaultToken).trim();
        const targetNumber = (parsed.targetNumber || defaultTarget).trim();
        return {
          token,
          targetNumber,
          sendToAdmin: parsed.sendToAdmin !== false,
          sendToPatient: parsed.sendToPatient !== false,
          isConfigured: Boolean(token && token.length > 5),
        };
      }
    }
  } catch (err) {
    console.warn('[Fonnte] Gagal membaca fonnte_config.json:', err);
  }

  return {
    token: defaultToken,
    targetNumber: defaultTarget,
    sendToAdmin: true,
    sendToPatient: true,
    isConfigured: Boolean(defaultToken && defaultToken.length > 5),
  };
}

let fonnteSettings: FonnteSettings = loadPersistentFonnteSettings();

function savePersistentFonnteSettings(settings: FonnteSettings) {
  try {
    fs.writeFileSync(FONNTE_CONFIG_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Fonnte] Gagal menyimpan fonnte_config.json:', err);
  }
}

// Auto-save default if file doesn't exist
if (!fs.existsSync(FONNTE_CONFIG_FILE)) {
  savePersistentFonnteSettings(fonnteSettings);
}

// URL Resolvers for Hospital SIMRS endpoints (RSBSA Online Medifirst2000)
function resolveSimrsOrderUrl(inputUrl?: string): string {
  const defaultUrl = 'https://rsbsaonline.com/service/medifirst2000/emr/save-pesanan-gizi';
  if (!inputUrl || !inputUrl.trim()) return defaultUrl;
  let u = inputUrl.trim();
  if (u.includes('/save-pesanan-gizi')) return u;
  u = u.replace(/\/save-(master-menu|data-mmpi)\/?$/, '');
  u = u.replace(/\/sync-batch-menu\/?$/, '');
  u = u.replace(/\/$/, '');
  return `${u}/save-pesanan-gizi`;
}

function resolveSimrsBatchMenuUrl(inputUrl?: string): string {
  const defaultUrl = 'https://rsbsaonline.com/service/medifirst2000/emr/sync-batch-menu';
  if (!inputUrl || !inputUrl.trim()) return defaultUrl;
  let u = inputUrl.trim();
  if (u.includes('/sync-batch-menu')) return u;
  u = u.replace(/\/save-(pesanan-gizi|data-mmpi|master-menu)\/?$/, '');
  u = u.replace(/\/$/, '');
  return `${u}/sync-batch-menu`;
}

function resolveSimrsFetchOrdersUrl(inputUrl?: string): string {
  const defaultUrl = 'https://rsbsaonline.com/service/medifirst2000/emr/riwayat-pesanan-gizi';
  if (!inputUrl || !inputUrl.trim()) return defaultUrl;
  let u = inputUrl.trim();
  if (u.includes('/riwayat-pesanan-gizi')) return u;
  u = u.replace(/\/save-(pesanan-gizi|data-mmpi|master-menu)\/?$/, '');
  u = u.replace(/\/sync-batch-menu\/?$/, '');
  u = u.replace(/\/master-menu-gizi\/?$/, '');
  u = u.replace(/\/$/, '');
  return `${u}/riwayat-pesanan-gizi`;
}

function resolveSimrsFetchMenuUrl(inputUrl?: string): string {
  const defaultUrl = 'https://rsbsaonline.com/service/medifirst2000/emr/master-menu-gizi';
  if (!inputUrl || !inputUrl.trim()) return defaultUrl;
  let u = inputUrl.trim();
  if (u.includes('/master-menu-gizi')) return u;
  u = u.replace(/\/save-(pesanan-gizi|data-mmpi|master-menu)\/?$/, '');
  u = u.replace(/\/sync-batch-menu\/?$/, '');
  u = u.replace(/\/$/, '');
  return `${u}/master-menu-gizi`;
}

export const parsePgNumber = (val: any, defaultVal = 0): number => {
  if (val === undefined || val === null) return defaultVal;
  if (typeof val === 'number') return isNaN(val) ? defaultVal : val;
  const str = String(val).replace(',', '.').replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(str);
  return isNaN(parsed) ? defaultVal : parsed;
};

export const parsePgBoolean = (val: any): boolean => {
  if (val === undefined || val === null) return true;
  if (typeof val === 'boolean') return val;
  const str = String(val).toLowerCase().trim();
  return str === 't' || str === 'true' || str === '1' || str === 'y';
};

export const parsePgImage = (raw: any, fallback = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80'): string => {
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (s.length > 5 && s !== 'true' && s !== 'false' && s !== '1' && s !== '0' && s !== 'null' && s !== 'undefined') {
      return s;
    }
  }
  return fallback;
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
      const validSimrsImg = parsePgImage(rawImg, '');

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
        image: validSimrsImg || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
        isAvailable: parsePgBoolean(m.tersedia ?? m.isAvailable ?? true),
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
          // Jika sudah ada, utamakan gambar asli (Base64 atau URL valid) yang sudah ada di lokal jika SIMRS hanya mengembalikan default
          const existing = menuItems[existingIdx];
          const hasRealExistingImage = Boolean(existing.image && typeof existing.image === 'string' && existing.image.length > 15 && !existing.image.includes('unsplash.com'));
          const hasRealNewImage = Boolean(newMenu.image && typeof newMenu.image === 'string' && newMenu.image.length > 15 && !newMenu.image.includes('unsplash.com'));
          const finalImage = hasRealNewImage ? newMenu.image : (hasRealExistingImage ? existing.image : (newMenu.image || existing.image));
          const preservedPrice = existing.price !== undefined ? existing.price : newMenu.price;
          menuItems[existingIdx] = { ...newMenu, ...existing, image: finalImage, price: preservedPrice, id: existing.id };
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
    console.warn('[Auto-Sync SIMRS] Gagal auto-tarik master menu di background:', e);
    return menuItems;
  }
}

function resolveSimrsSingleMenuUrl(inputUrl?: string): string {
  const defaultUrl = 'https://rsbsaonline.com/service/medifirst2000/emr/save-master-menu';
  if (!inputUrl || !inputUrl.trim()) return defaultUrl;
  let u = inputUrl.trim();
  if (u.includes('/save-master-menu')) return u;
  u = u.replace(/\/save-(pesanan-gizi|data-mmpi)\/?$/, '');
  u = u.replace(/\/sync-batch-menu\/?$/, '');
  u = u.replace(/\/$/, '');
  return `${u}/save-master-menu`;
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
    `👤 *Nama Pasien*: ${order.patientName}\n` +
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

// Helper: Send message using Fonnte API (https://api.fonnte.com/send)
async function sendFonnteMessage(
  targetPhone: string,
  message: string,
  overrideToken?: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  const token = (overrideToken || fonnteSettings.token || '').trim();

  if (!token) {
    return {
      success: false,
      error: 'Token Fonnte belum diatur. Masukkan token Fonnte di menu Pengaturan Admin atau file .env.',
    };
  }

  // Format clean phone numbers (support comma-separated multi recipients)
  const targets = targetPhone
    .split(',')
    .map((p) => p.replace(/[^0-9]/g, ''))
    .filter((p) => p.length >= 6);

  if (targets.length === 0) {
    return {
      success: false,
      error: 'Nomor telepon tujuan tidak valid.',
    };
  }

  const cleanTarget = targets.join(',');

  try {
    const formData = new URLSearchParams();
    formData.append('target', cleanTarget);
    formData.append('message', message);
    formData.append('countryCode', '62');

    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        Authorization: token,
      },
      body: formData,
    });

    const data = await response.json();
    if (data.status === true || data.status === 'true') {
      return { success: true, data };
    } else {
      let friendlyError = data.reason || data.detail || 'Fonnte menolak pengiriman pesan (cek device status/token).';
      if (data.reason === 'request invalid on disconnected device' || String(data.reason).includes('disconnected device')) {
        friendlyError = 'Perangkat WhatsApp di Fonnte berstatus DISCONNECT (belum scan QR code atau sesi WhatsApp di HP terputus). Silakan buka https://md.fonnte.com > menu Device > klik Connect / Scan QR Code untuk menghubungkan WhatsApp.';
      }
      return {
        success: false,
        error: friendlyError,
        data,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Gagal menghubungi server Fonnte (network error).',
    };
  }
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
    isAvailable: m.isAvailable !== false,
    is_tersedia: m.isAvailable !== false,
    status: m.isAvailable !== false ? 1 : 0,
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
      fonnteSettings: {
        targetNumber: fonnteSettings.targetNumber,
        sendToAdmin: fonnteSettings.sendToAdmin,
        sendToPatient: fonnteSettings.sendToPatient,
        isConfigured: Boolean(fonnteSettings.token),
      },
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
  app.get('/api/menu', async (req, res) => {
    // Jika katalog di memori server belum terisi atau hanya sedikit, auto-tarik dari SIMRS jika token aktif
    if (menuItems.length <= 1 && simrsSettings.apiKey && simrsSettings.apiKey.trim().length > 5) {
      try {
        await autoFetchSimrsMenuFromServer();
      } catch (err) {
        console.warn('[Auto-Fetch] Gagal auto-tarik master menu pada GET /api/menu:', err);
      }
    }
    res.json(menuItems);
  });

  // Admin: Create Menu Item & automatically sync to SIMRS (save-master-menu)
  app.post('/api/menu', async (req, res) => {
    const { name, price, category, mealTimes, calories, protein, carbs, fat, sodium, description, image, foto_url, gambar_url, isAvailable, simrsApiUrl, simrsApiKey } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Nama menu wajib diisi' });
    }

    const finalImage = (image || foto_url || gambar_url || '').trim() || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80';

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
      isAvailable: isAvailable !== false,
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

  // Admin: Update Menu Item (Price, Name, Availability, Description, Photo, etc.)
  app.patch('/api/menu/:id', async (req, res) => {
    const { id } = req.params;
    let item = menuItems.find(m => String(m.id) === String(id) || (req.body.name && m.name && m.name.trim().toLowerCase() === String(req.body.name).trim().toLowerCase()));
    
    const { name, price, category, mealTimes, calories, protein, carbs, fat, sodium, description, image, foto_url, gambar_url, isAvailable, simrsApiUrl, simrsApiKey } = req.body;
    const resolvedImage = image ?? foto_url ?? gambar_url;

    if (!item) {
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
        isAvailable: isAvailable !== false,
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
      if (isAvailable !== undefined) item.isAvailable = Boolean(isAvailable);
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
  app.patch('/api/menu/:id/toggle', (req, res) => {
    const { id } = req.params;
    const item = menuItems.find(m => m.id === id);
    if (!item) {
      return res.status(404).json({ error: 'Menu tidak ditemukan' });
    }
    item.isAvailable = !item.isAvailable;
    savePersistentMenuItems(menuItems);
    broadcastEvent('menu_update', { item, action: 'toggle' });
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

  // 3. Fonnte Configuration & WhatsApp Gateway APIs
  app.get('/api/fonnte/config', (req, res) => {
    res.json({
      tokenMasked: fonnteSettings.token ? `${fonnteSettings.token.slice(0, 4)}••••••••${fonnteSettings.token.slice(-4)}` : '',
      targetNumber: fonnteSettings.targetNumber,
      sendToAdmin: fonnteSettings.sendToAdmin,
      sendToPatient: fonnteSettings.sendToPatient,
      isConfigured: Boolean(fonnteSettings.token && fonnteSettings.token.trim().length > 5),
    });
  });

  app.post('/api/fonnte/config', (req, res) => {
    const { token, targetNumber, sendToAdmin, sendToPatient } = req.body;
    if (token !== undefined) {
      fonnteSettings.token = token.trim();
    }
    if (targetNumber !== undefined) {
      fonnteSettings.targetNumber = targetNumber.trim();
    }
    if (sendToAdmin !== undefined) {
      fonnteSettings.sendToAdmin = Boolean(sendToAdmin);
    }
    if (sendToPatient !== undefined) {
      fonnteSettings.sendToPatient = Boolean(sendToPatient);
    }
    fonnteSettings.isConfigured = Boolean(fonnteSettings.token && fonnteSettings.token.trim().length > 5);

    savePersistentFonnteSettings(fonnteSettings);

    res.json({
      success: true,
      message: 'Pengaturan WhatsApp Fonnte berhasil disimpan!',
      config: {
        tokenMasked: fonnteSettings.token ? `${fonnteSettings.token.slice(0, 4)}••••••••${fonnteSettings.token.slice(-4)}` : '',
        targetNumber: fonnteSettings.targetNumber,
        sendToAdmin: fonnteSettings.sendToAdmin,
        sendToPatient: fonnteSettings.sendToPatient,
        isConfigured: fonnteSettings.isConfigured,
      },
    });
  });

  // Test WhatsApp message sending via Fonnte
  app.post('/api/fonnte/test', async (req, res) => {
    const { targetPhone, testToken } = req.body;
    const phone = targetPhone || fonnteSettings.targetNumber;

    if (!phone) {
      return res.status(400).json({ error: 'Nomor telepon tujuan wajib diisi' });
    }

    const testMessage = `🏥 *TES KONEKSI WHATSAPP FONNTE - NUTRIHOSPITAL*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `Halo! Integrasi WhatsApp Gateway Fonnte dengan aplikasi NutriHospital berhasil terhubung dengan sukses.\n\n` +
      `⏰ Waktu Uji Coba: ${new Date().toLocaleString('id-ID')}\n` +
      `Status: ✅ Ready untuk menerima notifikasi pesanan menu kamar pasien!`;

    const result = await sendFonnteMessage(phone, testMessage, testToken);

    if (result.success) {
      res.json({
        success: true,
        message: `Pesan WhatsApp uji coba berhasil dikirim ke nomor ${phone} via Fonnte!`,
        data: result.data,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        data: result.data,
      });
    }
  });

  // Check Fonnte Device Status
  app.post('/api/fonnte/device', async (req, res) => {
    const { token } = req.body;
    const targetToken = (token || fonnteSettings.token || '').trim();
    if (!targetToken) {
      return res.status(400).json({ success: false, error: 'Token Fonnte belum diatur' });
    }
    try {
      const response = await fetch('https://api.fonnte.com/device', {
        method: 'POST',
        headers: { Authorization: targetToken },
      });
      const data = await response.json();
      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message || 'Gagal menghubungi server Fonnte' });
    }
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
      console.log(`[SIMRS Fetch] Mengambil data riwayat pesanan dari: ${targetUrl}`);
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-AUTH-TOKEN': targetToken,
          'Authorization': `Bearer ${targetToken}`
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

      let ordersData = Array.isArray(parsedData) ? parsedData : (Array.isArray(parsedData?.data) ? parsedData.data : []);
      
      if (!Array.isArray(ordersData)) {
         ordersData = [];
      }

      // Transform SIMRS format back to HospitalOrder
      const transformedOrders: HospitalOrder[] = ordersData.map((o: any) => ({
        id: String(o.id || o.no_pesanan || o.order_number || `ord-${Date.now()}`),
        orderNumber: String(o.order_number || o.no_pesanan || `GZ-${Date.now()}`),
        registrationNo: String(o.noregistrasi || o.registrationNo || 'REG-Unknown'),
        createdAt: o.tgl_pesanan || o.created_at || new Date().toISOString(),
        roomName: String(o.room_name || o.kamar || 'Kamar Rawat Inap'),
        patientName: String(o.patient_name || o.nama_pasien || 'Pasien'),
        phoneNumber: o.phone_number || o.telepon || '',
        mealTime: (o.meal_time || o.waktu_makan || 'siang') as MealTime,
        items: (function() {
           try {
             if (typeof o.items_json === 'string') return JSON.parse(o.items_json);
             if (Array.isArray(o.items)) return o.items;
           } catch(e){}
           return [];
        })(),
        patientNotes: o.patient_notes || o.catatan || '',
        status: (o.order_status || o.status || 'baru') as OrderStatus,
        statusHistory: [], // can reconstruct if SIMRS has it
        simrsSync: {
           synced: true,
           statusText: 'Berhasil ditarik dari SIMRS',
           timestamp: new Date().toISOString(),
           targetUrl: targetUrl
        }
      }));

      // Update in-memory orders (merge based on orderNumber)
      transformedOrders.forEach(newOrder => {
        const existingIdx = orders.findIndex(o => o.orderNumber === newOrder.orderNumber);
        if (existingIdx !== -1) {
          orders[existingIdx] = { ...orders[existingIdx], ...newOrder, id: orders[existingIdx].id }; // preserve our ID
        } else {
          orders.push(newOrder);
        }
      });
      
      // sort
      orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      savePersistentOrders(orders);
      broadcastEvent('init', { orders, menuItems });

      res.json({
        success: true,
        message: `Berhasil mengambil ${transformedOrders.length} riwayat pesanan dari SIMRS`,
        data: transformedOrders,
        totalOrders: orders.length
      });

    } catch (error: any) {
      console.error('[SIMRS Fetch] Gagal mengambil riwayat pesanan:', error);
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

      const parsePgBoolean = (val: any): boolean => {
        if (val === undefined || val === null) return true;
        if (typeof val === 'boolean') return val;
        const str = String(val).toLowerCase().trim();
        return str === 't' || str === 'true' || str === '1' || str === 'y';
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
          image: parsePgImage(m.foto_url || m.gambar_url || m.image || m.gambar || m.foto || m.url_gambar || m.url_foto || m.photo || m.photo_url || m.img || m.image_url, 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80'),
          isAvailable: parsePgBoolean(m.tersedia ?? m.isAvailable ?? true),
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
          menuItems[existingIdx] = { ...existing, ...newMenu, image: finalImage, id: existing.id };
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
      console.error('[SIMRS Fetch] Gagal mengambil menu:', error);
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

  // 4. Orders APIs
  app.get('/api/orders', (req, res) => {
    res.json(orders);
  });

  // Create Order (From Patient Dashboard) + AUTOMATIC WHATSAPP NOTIFICATION VIA FONNTE + AUTO SYNC SIMRS
  app.post('/api/orders', async (req, res) => {
    const { roomName, patientName, phoneNumber, registrationNo, mealTime, items, patientNotes, simrsConfig, fonnteConfig } = req.body;

    if (!roomName || roomName.trim() === '') {
      return res.status(400).json({ error: 'Nama kamar / nomor kamar wajib diisi' });
    }

    if (!phoneNumber || phoneNumber.trim() === '') {
      return res.status(400).json({ error: 'Nomor telepon WhatsApp wajib diisi' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Pilih minimal satu menu makanan' });
    }

    // Sync in-memory fonnteSettings if client passed configured fonnteConfig
    if (fonnteConfig && typeof fonnteConfig === 'object') {
      if (fonnteConfig.token && (!fonnteSettings.token || fonnteSettings.token.length < 5)) {
        fonnteSettings.token = fonnteConfig.token.trim();
        savePersistentFonnteSettings(fonnteSettings);
      }
      if (fonnteConfig.targetNumber && (!fonnteSettings.targetNumber || fonnteSettings.targetNumber === '081234567890')) {
        fonnteSettings.targetNumber = fonnteConfig.targetNumber.trim();
        savePersistentFonnteSettings(fonnteSettings);
      }
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
          note: `Pesanan dibuat oleh ${patientName || 'Pasien'} dari ${roomName}.`,
        },
      ],
    };

    // Format WhatsApp Message Content
    const waMessage = formatWhatsAppOrderMessage(newOrder);

    // Send WhatsApp notification via Fonnte Gateway directly to Admin Gizi
    let waSent = false;
    let waStatusText = 'Belum terkirim (Token Fonnte belum disetting)';
    let fonnteResponse: any = null;

    const effectiveFonnteToken = (fonnteConfig?.token || fonnteSettings.token || 'irrv1yX7bCHMUXWjHezr').trim();
    const adminTargetPhone = (fonnteConfig?.targetNumber || fonnteSettings.targetNumber || '081394947002').trim();

    if (effectiveFonnteToken) {
      // Determine recipient list:
      // 1. Admin Gizi ALWAYS receives the order notification
      const targetList: string[] = [];
      if (adminTargetPhone && fonnteSettings.sendToAdmin !== false) {
        targetList.push(adminTargetPhone);
      }

      // 2. Patient phone gets a copy if configured and different from admin
      const cleanPatientPhone = (newOrder.phoneNumber || '').replace(/[^0-9]/g, '');
      const cleanAdminPhone = adminTargetPhone.replace(/[^0-9]/g, '');
      if (fonnteSettings.sendToPatient && cleanPatientPhone && cleanPatientPhone !== cleanAdminPhone) {
        targetList.push(newOrder.phoneNumber);
      }

      // Failsafe: if empty, always send to admin target
      if (targetList.length === 0 && adminTargetPhone) {
        targetList.push(adminTargetPhone);
      }

      const combinedTargets = targetList.join(',');
      console.log(`[Fonnte Auto-Send] Mengirim notifikasi pesanan ${orderNumber} ke WhatsApp: ${combinedTargets}`);

      const fonnteResult = await sendFonnteMessage(combinedTargets, waMessage, effectiveFonnteToken);
      fonnteResponse = fonnteResult.data;

      if (fonnteResult.success) {
        waSent = true;
        waStatusText = `Terkirim langsung ke WhatsApp Admin Gizi (${adminTargetPhone}) via Fonnte Gateway`;
        console.log(`[Fonnte Auto-Send] Berhasil terkirim ke WhatsApp Admin Gizi (${adminTargetPhone})!`);
      } else {
        waStatusText = `Gagal kirim otomatis via Fonnte: ${fonnteResult.error}`;
        console.warn(`[Fonnte Auto-Send] Gagal kirim ke ${combinedTargets}:`, fonnteResult.error);
      }
    }

    newOrder.whatsappNotification = {
      sent: waSent,
      targetNumber: adminTargetPhone || fonnteSettings.targetNumber || newOrder.phoneNumber,
      statusText: waStatusText,
      fonnteResponse,
      timestamp: new Date().toISOString(),
      message: waMessage,
    };

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

    // Broadcast in real-time to Admin Dashboard
    broadcastEvent('new_order', { order: newOrder });

    res.status(201).json({
      order: newOrder,
      waMessage, // Send formatted message back so client can open wa.me link directly as fallback
      waSent,
      waStatusText,
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

  // Update Order Status (Admin)
  app.patch('/api/orders/:id/status', (req, res) => {
    const { id } = req.params;
    const { status, note } = req.body;

    const order = orders.find(o => o.id === id);
    if (!order) {
      return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
    }

    if (status) {
      order.status = status;
      order.statusHistory.push({
        status,
        timestamp: new Date().toISOString(),
        note: note || `Status diubah menjadi ${status}`,
      });
      savePersistentOrders(orders);
    }

    broadcastEvent('status_update', { order });
    res.json(order);
  });

  // Delete Order (Admin)
  app.delete('/api/orders/:id', (req, res) => {
    const { id } = req.params;
    const index = orders.findIndex(o => o.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
    }
    const removed = orders.splice(index, 1)[0];
    savePersistentOrders(orders);
    broadcastEvent('order_deleted', { id });
    res.json({ success: true, removedId: id });
  });

  // Reset Demo Data
  app.post('/api/reset-demo', (req, res) => {
    orders = [...INITIAL_ORDERS];
    menuItems = [...INITIAL_MENU];
    savePersistentOrders(orders);
    savePersistentMenuItems(menuItems);
    broadcastEvent('init', { orders, menuItems });
    res.json({ success: true, message: 'Data demo menu & pesanan telah direset' });
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
    // Auto-fetch fresh menu from SIMRS on startup
    autoFetchSimrsMenuFromServer().catch(() => {});
    // Auto-refresh every 5 seconds to keep in sync with SIMRS PostgreSQL
    setInterval(() => {
      autoFetchSimrsMenuFromServer().catch(() => {});
    }, 5000);
  });
}

startServer();

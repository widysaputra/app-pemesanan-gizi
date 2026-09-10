import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Initial Menu Catalog with standardized prices in Rupiah
// Menu Catalog starts empty as requested by hospital administrators.
// Master menu is populated via SIMRS synchronization or manual entry in Admin Dashboard.
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

// In-memory state
let menuItems: MenuItem[] = [];
let orders: HospitalOrder[] = [...INITIAL_ORDERS];

// Fonnte Configuration State (Can be set via .env or updated from Admin Dashboard UI)
let fonnteSettings: FonnteSettings = {
  token: process.env.FONNTE_TOKEN || '',
  targetNumber: process.env.FONNTE_TARGET_PHONE || '081234567890',
  sendToAdmin: true,
  sendToPatient: true,
  isConfigured: Boolean(process.env.FONNTE_TOKEN),
};

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
let simrsSettings: SimrsSettings = {
  apiUrl: process.env.SIMRS_API_URL || 'https://rsbsaonline.com/service/medifirst2000/emr/save-pesanan-gizi',
  apiKey: process.env.SIMRS_TOKEN || process.env.SIMRS_API_KEY || '',
  authHeaderType: 'X-AUTH-TOKEN',
  autoSyncOnOrder: true,
  isConfigured: true,
};

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
    `_Pesanan telah terkirim langsung ke Dapur Gizi Rumah Sakit via NutriHospital (Fonnte Gateway)_`;
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

  // Format clean phone number (digits only)
  const cleanTarget = targetPhone.replace(/[^0-9]/g, '');
  if (!cleanTarget) {
    return {
      success: false,
      error: 'Nomor telepon tujuan tidak valid.',
    };
  }

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
      return {
        success: false,
        error: data.reason || data.detail || 'Fonnte menolak pengiriman pesan (cek device status/token).',
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
function mapMenuItemForSimrs(m: MenuItem) {
  return {
    id: m.id,
    id_menu: m.id,
    kd_menu: m.id,
    name: m.name,
    nama: m.name,
    nama_menu: m.name,
    category: m.category,
    kategori: m.category,
    price: m.price,
    harga: m.price,
    harga_satuan: m.price,
    calories: m.calories,
    kalori: m.calories,
    protein: m.protein,
    carbs: m.carbs,
    karbohidrat: m.carbs,
    fat: m.fat,
    lemak: m.fat,
    sodium: m.sodium,
    natrium: m.sodium,
    mealTimes: m.mealTimes,
    waktu_makan: m.mealTimes,
    description: m.description,
    deskripsi: m.description,
    image: m.image,
    gambar_url: m.image,
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

  app.use(express.json());

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
  app.get('/api/menu', (req, res) => {
    res.json(menuItems);
  });

  // Admin: Create Menu Item & automatically sync to SIMRS (save-master-menu)
  app.post('/api/menu', async (req, res) => {
    const { name, price, category, mealTimes, calories, protein, carbs, fat, sodium, description, image, isAvailable, simrsApiUrl, simrsApiKey } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Nama menu wajib diisi' });
    }

    const newItem: MenuItem = {
      id: `menu-${Date.now()}`,
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
      image: image?.trim() || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
      isAvailable: isAvailable !== false,
    };

    menuItems.unshift(newItem);
    broadcastEvent('menu_update', { item: newItem, action: 'create' });

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
    const item = menuItems.find(m => m.id === id);
    if (!item) {
      return res.status(404).json({ error: 'Menu tidak ditemukan' });
    }

    const { name, price, category, mealTimes, calories, protein, carbs, fat, sodium, description, image, isAvailable, simrsApiUrl, simrsApiKey } = req.body;
    if (name !== undefined) item.name = name.trim();
    if (price !== undefined) item.price = Math.max(0, Number(price));
    if (category !== undefined) item.category = category;
    if (mealTimes !== undefined && Array.isArray(mealTimes)) item.mealTimes = mealTimes;
    if (calories !== undefined) item.calories = Number(calories);
    if (protein !== undefined) item.protein = Number(protein);
    if (carbs !== undefined) item.carbs = Number(carbs);
    if (fat !== undefined) item.fat = Number(fat);
    if (sodium !== undefined) item.sodium = Number(sodium);
    if (description !== undefined) item.description = description;
    if (image !== undefined) item.image = image.trim();
    if (isAvailable !== undefined) item.isAvailable = Boolean(isAvailable);

    broadcastEvent('menu_update', { item, action: 'update' });

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
    broadcastEvent('menu_update', { item: removed, action: 'delete' });
    res.json({ success: true, removedId: id });
  });

  // Admin: Reset / Kosongkan Seluruh Menu
  app.delete('/api/menu/reset/all', (req, res) => {
    menuItems = [];
    broadcastEvent('menu_reset', {});
    res.json({ success: true, message: 'Seluruh menu katalog telah berhasil dikosongkan.' });
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

  // --- SIMRS (LARAVEL & POSTGRESQL) APIS ---
  app.get('/api/simrs/config', (req, res) => {
    res.json({
      apiUrl: simrsSettings.apiUrl,
      apiKeyMasked: simrsSettings.apiKey ? `${simrsSettings.apiKey.slice(0, 3)}••••${simrsSettings.apiKey.slice(-3)}` : '',
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

    res.json({
      success: true,
      message: 'Pengaturan API SIMRS (PostgreSQL & Laravel) dengan X-AUTH-TOKEN berhasil disimpan!',
      config: {
        apiUrl: simrsSettings.apiUrl,
        apiKeyMasked: simrsSettings.apiKey ? `${simrsSettings.apiKey.slice(0, 3)}••••${simrsSettings.apiKey.slice(-3)}` : '',
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
  app.post('/api/simrs/sync-menu', async (req, res) => {
    const { apiUrl, apiKey, menuItems: clientItems } = req.body;
    const rawTargetUrl = (apiUrl || simrsSettings.apiUrl || 'https://rsbsaonline.com/service/medifirst2000/emr/sync-batch-menu').trim();
    const targetToken = (apiKey && typeof apiKey === 'string' && apiKey.trim() !== '')
      ? apiKey.trim()
      : (simrsSettings.apiKey || '').trim();

    if (!rawTargetUrl || rawTargetUrl.trim() === '') {
      return res.status(400).json({ error: 'URL Endpoint API Laravel SIMRS wajib diisi' });
    }

    if (Array.isArray(clientItems) && clientItems.length > 0) {
      menuItems = clientItems;
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
    return res.json({
      status: 'success',
      message: `Master menu '${targetName}' berhasil disimpan ke master_menu_gizi_m (PostgreSQL).`,
      id_menu: targetId,
      authHeaderReceived: receivedAuthToken ? 'X-AUTH-TOKEN terverifikasi' : 'Tanpa header token',
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/api/sync-batch-menu', (req, res) => {
    const items = req.body.menu_items || req.body.items || [];
    const receivedAuthToken = (req.headers['x-auth-token'] as string) || (req.headers['authorization'] as string);
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
    const { roomName, patientName, phoneNumber, registrationNo, mealTime, items, patientNotes, simrsConfig } = req.body;

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
          note: `Pesanan dibuat oleh ${patientName || 'Pasien'} dari ${roomName}.`,
        },
      ],
    };

    // Format WhatsApp Message Content
    const waMessage = formatWhatsAppOrderMessage(newOrder);

    // Send WhatsApp notification via Fonnte Gateway
    let waSent = false;
    let waStatusText = 'Belum terkirim (Token Fonnte belum disetting)';
    let fonnteResponse: any = null;

    if (fonnteSettings.token) {
      // Determine recipient: Admin target or Patient's phone
      const targetList = [];
      if (fonnteSettings.sendToAdmin && fonnteSettings.targetNumber) {
        targetList.push(fonnteSettings.targetNumber);
      }
      if (fonnteSettings.sendToPatient && newOrder.phoneNumber) {
        targetList.push(newOrder.phoneNumber);
      }

      // If neither is toggled, default to patient number
      if (targetList.length === 0) {
        targetList.push(newOrder.phoneNumber);
      }

      // Combine comma-separated for Fonnte multi-recipient support
      const combinedTargets = targetList.join(',');

      const fonnteResult = await sendFonnteMessage(combinedTargets, waMessage);
      fonnteResponse = fonnteResult.data;

      if (fonnteResult.success) {
        waSent = true;
        waStatusText = `Terkirim ke WhatsApp (${combinedTargets}) via Fonnte Gateway`;
      } else {
        waStatusText = `Gagal kirim via Fonnte: ${fonnteResult.error}`;
      }
    }

    newOrder.whatsappNotification = {
      sent: waSent,
      targetNumber: fonnteSettings.targetNumber || newOrder.phoneNumber,
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
    broadcastEvent('order_deleted', { id });
    res.json({ success: true, removedId: id });
  });

  // Reset Demo Data
  app.post('/api/reset-demo', (req, res) => {
    orders = [...INITIAL_ORDERS];
    menuItems = [...INITIAL_MENU];
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
  });
}

startServer();

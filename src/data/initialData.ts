import { MenuItem, HospitalOrder } from '../types';

// Master menu katalog gizi standar rumah sakit (dimulai kosong sesuai permintaan)
export const INITIAL_MENU: MenuItem[] = [];

export const INITIAL_ORDERS: HospitalOrder[] = [
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
      targetUrl: 'https://rsbsaonline.com/service/medifirst2000/emr/save-pesanan-gizi',
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
      targetUrl: 'https://rsbsaonline.com/service/medifirst2000/emr/save-pesanan-gizi',
      response: { status: 'success', message: 'Data pesanan gizi berhasil disimpan ke SIMRS.' },
    },
  },
];

const LOCAL_STORAGE_MENU_KEY = 'nutrihospital_menu_cache';
const LOCAL_STORAGE_ORDERS_KEY = 'nutrihospital_orders_cache';

export function getLocalCachedMenu(): MenuItem[] {
  if (typeof window === 'undefined') return INITIAL_MENU;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_MENU_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .filter((item) => item && typeof item === 'object' && item.id && item.name)
          .map((item) => ({
            id: String(item.id),
            name: String(item.name || 'Menu Makanan'),
            price: Number(item.price) >= 0 ? Number(item.price) : 0,
            category: item.category || 'makanan_utama',
            mealTimes: Array.isArray(item.mealTimes) && item.mealTimes.length > 0 ? item.mealTimes : ['pagi', 'siang', 'malam'],
            calories: Number(item.calories) || 100,
            protein: Number(item.protein) || 0,
            carbs: Number(item.carbs) || 0,
            fat: Number(item.fat) || 0,
            sodium: Number(item.sodium) || 0,
            description: String(item.description || ''),
            isAvailable: item.isAvailable !== false,
            image: item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
          }));
      }
    }
  } catch {
    // Ignore storage parse error
  }
  return INITIAL_MENU;
}

export function saveLocalCachedMenu(menu: MenuItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    const valid = (menu || [])
      .filter((m) => m && typeof m === 'object' && m.id && m.name)
      .map((m) => ({
        id: String(m.id),
        name: String(m.name),
        price: Number(m.price) >= 0 ? Number(m.price) : 0,
        category: m.category || 'makanan_utama',
        mealTimes: Array.isArray(m.mealTimes) && m.mealTimes.length > 0 ? m.mealTimes : ['pagi', 'siang', 'malam'],
        calories: Number(m.calories) || 100,
        protein: Number(m.protein) || 0,
        carbs: Number(m.carbs) || 0,
        fat: Number(m.fat) || 0,
        sodium: Number(m.sodium) || 0,
        description: String(m.description || ''),
        isAvailable: m.isAvailable !== false,
        image: m.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
      }));
    try {
      localStorage.setItem(LOCAL_STORAGE_MENU_KEY, JSON.stringify(valid));
    } catch (storageErr) {
      console.warn('[LocalStorage] Kuota penuh saat menyimpan menu, membersihkan galeri kustom...', storageErr);
      // Bersihkan galeri gambar kustom non-esensial untuk membebaskan ruang penyimpanan
      localStorage.removeItem('nutri_hospital_custom_gallery');
      // Coba simpan kembali
      localStorage.setItem(LOCAL_STORAGE_MENU_KEY, JSON.stringify(valid));
    }
  } catch (err) {
    console.error('[LocalStorage] Gagal menyimpan menu ke cache lokal:', err);
  }
}

export function clearAllLocalMenus(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_MENU_KEY, JSON.stringify([]));
  } catch {
    // Ignore
  }
}

export function getLocalCachedOrders(): HospitalOrder[] {
  if (typeof window === 'undefined') return INITIAL_ORDERS;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ORDERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Ignore
  }
  return INITIAL_ORDERS;
}

export function saveLocalCachedOrders(orders: HospitalOrder[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_ORDERS_KEY, JSON.stringify(orders));
  } catch {
    // Ignore
  }
}

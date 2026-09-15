import { MenuItem, HospitalOrder } from '../types';

// Master menu katalog gizi standar rumah sakit (dimulai kosong sesuai permintaan)
export const INITIAL_MENU: MenuItem[] = [];

// Riwayat pesanan dimulai kosong murni dari DB SIMRS (tanpa pesanan dummy/default)
export const INITIAL_ORDERS: HospitalOrder[] = [];

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

export function normalizeHospitalOrder(rawOrder: any): HospitalOrder {
  const items: any[] = Array.isArray(rawOrder?.items)
    ? rawOrder.items
    : (typeof rawOrder?.items_json === 'string'
        ? (() => { try { return JSON.parse(rawOrder.items_json); } catch { return []; } })()
        : []);

  const normalizedItems = items.map((it: any) => ({
    menuItemId: String(it?.menuItemId || it?.id_menu || it?.id || 'item'),
    name: String(it?.name || it?.nama_menu || 'Menu Makanan'),
    portion: Math.max(1, Number(it?.portion || it?.porsi || it?.jumlah_porsi || 1)),
    price: Math.max(0, Number(it?.price || it?.harga || it?.harga_satuan || 0)),
    category: String(it?.category || it?.kategori || 'makanan_utama'),
    calories: Math.max(0, Number(it?.calories || it?.kalori || 100)),
  }));

  const computedPrice = normalizedItems.reduce((acc, it) => acc + it.price * it.portion, 0);
  const computedCalories = normalizedItems.reduce((acc, it) => acc + it.calories * it.portion, 0);

  const orderNum = String(rawOrder?.orderNumber || rawOrder?.no_pesanan || `GZ-${rawOrder?.id || Date.now()}`);

  return {
    id: String(rawOrder?.id || orderNum),
    orderNumber: orderNum,
    registrationNo: String(rawOrder?.registrationNo || rawOrder?.noregistrasi || ''),
    createdAt: String(rawOrder?.createdAt || rawOrder?.tgl_pesanan || new Date().toISOString()),
    roomName: String(rawOrder?.roomName || rawOrder?.nomor_kamar || rawOrder?.kamar || 'Kamar Pasien'),
    patientName: String(rawOrder?.patientName || rawOrder?.nama_pasien || 'Pasien'),
    phoneNumber: String(rawOrder?.phoneNumber || rawOrder?.telepon || ''),
    mealTime: (rawOrder?.mealTime || rawOrder?.waktu_makan || 'siang') as any,
    items: normalizedItems,
    totalPrice: Number(rawOrder?.totalPrice ?? rawOrder?.total_price ?? rawOrder?.total_biaya ?? computedPrice) || 0,
    totalCalories: Number(rawOrder?.totalCalories ?? rawOrder?.total_calories ?? rawOrder?.total_kalori ?? computedCalories) || 0,
    patientNotes: String(rawOrder?.patientNotes || rawOrder?.catatan || ''),
    status: (rawOrder?.status || rawOrder?.order_status || 'baru') as any,
    statusHistory: Array.isArray(rawOrder?.statusHistory)
      ? rawOrder.statusHistory
      : [{
          status: (rawOrder?.status || rawOrder?.order_status || 'baru') as any,
          timestamp: String(rawOrder?.createdAt || rawOrder?.tgl_pesanan || new Date().toISOString()),
        }],
    simrsSync: rawOrder?.simrsSync,
  };
}

export function getLocalCachedOrders(): HospitalOrder[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ORDERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((o: any) => o && o.id !== 'ord-101' && o.id !== 'ord-102')
          .map(normalizeHospitalOrder);
      }
    }
  } catch {
    // Ignore
  }
  return [];
}

export function saveLocalCachedOrders(orders: HospitalOrder[]): void {
  if (typeof window === 'undefined') return;
  try {
    const cleanOrders = (orders || [])
      .filter((o: any) => o && o.id !== 'ord-101' && o.id !== 'ord-102')
      .map(normalizeHospitalOrder);
    localStorage.setItem(LOCAL_STORAGE_ORDERS_KEY, JSON.stringify(cleanOrders));
  } catch {
    // Ignore
  }
}

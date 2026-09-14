export type MealTime = 'pagi' | 'siang' | 'malam' | 'snack';

export type OrderStatus = 'baru' | 'diproses' | 'diantar' | 'selesai' | 'dibatalkan';

export type MenuCategory = 'makanan_utama' | 'lauk_hewani' | 'lauk_nabati' | 'sayuran' | 'buah_snack' | 'minuman';

export interface MenuItem {
  id: string;
  name: string;
  price: number; // Harga dalam Rupiah (Rp)
  category: MenuCategory;
  mealTimes: MealTime[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sodium: number;
  description: string;
  isAvailable: boolean;
  image?: string;
  simrsSync?: {
    synced: boolean;
    statusText: string;
    timestamp?: string;
    targetUrl?: string;
    response?: any;
    error?: string;
  };
}

export interface OrderItem {
  menuItemId: string;
  name: string;
  portion: number;
  price: number;
  category: string;
  calories: number;
}

export interface StatusHistoryEntry {
  status: OrderStatus;
  timestamp: string;
  note?: string;
}

export interface HospitalOrder {
  id: string;
  orderNumber: string;
  registrationNo: string; // No. Registrasi / No. RM Pasien di SIMRS (cth: REG-20260909-001)
  createdAt: string;
  roomName: string; // Nama / Nomor Kamar & Bed
  patientName: string;
  phoneNumber: string; // Nomor Telepon WhatsApp Pasien / Keluarga
  mealTime: MealTime;
  items: OrderItem[];
  totalPrice: number;
  totalCalories: number;
  patientNotes?: string;
  status: OrderStatus;
  statusHistory: StatusHistoryEntry[];
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
  apiKey?: string;           // Token autentikasi SIMRS (dikirimkan via header X-AUTH-TOKEN)
  authHeaderType?: 'X-AUTH-TOKEN' | 'Bearer' | 'Both'; // Mode otentikasi header
  autoSyncOnOrder: boolean;  // Otomatis kirim saat pasien klik pesan
  isConfigured: boolean;
}

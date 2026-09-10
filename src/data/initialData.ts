import { MenuItem, HospitalOrder } from '../types';

export const INITIAL_MENU: MenuItem[] = [
  {
    id: 'menu-1',
    name: 'Nasi Putih Pulen Organik',
    price: 6000,
    category: 'makanan_utama',
    mealTimes: ['pagi', 'siang', 'malam'],
    calories: 175,
    protein: 3.5,
    carbs: 40,
    fat: 0.3,
    sodium: 5,
    description: 'Nasi putih pulen kukus matang sempurna dari beras organik pilihan.',
    image: 'https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=400&q=80',
    isAvailable: true,
  },
  {
    id: 'menu-2',
    name: 'Nasi Merah Berserat Tinggi',
    price: 8000,
    category: 'makanan_utama',
    mealTimes: ['pagi', 'siang', 'malam'],
    calories: 150,
    protein: 3.8,
    carbs: 33,
    fat: 1.2,
    sodium: 4,
    description: 'Beras merah rendah indeks glikemik, ideal untuk pasien diabetes dan jantung.',
    image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=400&q=80',
    isAvailable: true,
  },
  {
    id: 'menu-3',
    name: 'Bubur Saring Lembut Halus',
    price: 6000,
    category: 'makanan_utama',
    mealTimes: ['pagi', 'siang', 'malam'],
    calories: 120,
    protein: 2.2,
    carbs: 26,
    fat: 0.2,
    sodium: 3,
    description: 'Bubur beras disaring lembut, mudah dicerna untuk lambung sensitif & pemulihan bedah.',
    image: 'https://images.unsplash.com/photo-1541832676-9b763b0239ab?auto=format&fit=crop&w=400&q=80',
    isAvailable: true,
  },
  {
    id: 'menu-4',
    name: 'Mashed Potato Gurih Rendah Garam',
    price: 10000,
    category: 'makanan_utama',
    mealTimes: ['siang', 'malam'],
    calories: 140,
    protein: 2.8,
    carbs: 30,
    fat: 1.5,
    sodium: 15,
    description: 'Kentang tumbuk lembut dengan susu rendah lemak tanpa garam berlebih.',
    image: 'https://images.unsplash.com/photo-1633436375795-12b3b339712f?auto=format&fit=crop&w=400&q=80',
    isAvailable: true,
  },
  {
    id: 'menu-5',
    name: 'Ayam Panggang Bumbu Kuning Non-MSG',
    price: 22000,
    category: 'lauk_hewani',
    mealTimes: ['siang', 'malam'],
    calories: 185,
    protein: 24,
    carbs: 2,
    fat: 6,
    sodium: 85,
    description: 'Dada ayam fillet panggang rempah kunyit, jahe, sereh tanpa santan sintetis.',
    image: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=400&q=80',
    isAvailable: true,
  },
  {
    id: 'menu-6',
    name: 'Sup Ikan Kakap Kuah Bening',
    price: 26000,
    category: 'lauk_hewani',
    mealTimes: ['siang', 'malam'],
    calories: 140,
    protein: 22,
    carbs: 3,
    fat: 3,
    sodium: 70,
    description: 'Fillet ikan kakap segar dengan kuah kaldu rempah bening, tomat hijau segar.',
    image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=400&q=80',
    isAvailable: true,
  },
  {
    id: 'menu-7',
    name: 'Rolade Daging Cincang Kukus',
    price: 24000,
    category: 'lauk_hewani',
    mealTimes: ['pagi', 'siang', 'malam'],
    calories: 165,
    protein: 18,
    carbs: 4,
    fat: 7,
    sodium: 80,
    description: 'Daging sapi cincang segar digulung telur kukus, saus tomat asli tanpa pengawet.',
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80',
    isAvailable: true,
  },
  {
    id: 'menu-8',
    name: 'Telur Orak-Arik Herbal Rebus',
    price: 9000,
    category: 'lauk_hewani',
    mealTimes: ['pagi', 'snack'],
    calories: 110,
    protein: 11,
    carbs: 1,
    fat: 6,
    sodium: 65,
    description: 'Telur ayam negeri orak-arik matang dengan daun bawang cincang tanpa minyak berlebih.',
    image: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=400&q=80',
    isAvailable: true,
  },
  {
    id: 'menu-9',
    name: 'Tahu Kukus Sutra Isi Sayur',
    price: 7000,
    category: 'lauk_nabati',
    mealTimes: ['pagi', 'siang', 'malam'],
    calories: 85,
    protein: 8,
    carbs: 5,
    fat: 3.5,
    sodium: 30,
    description: 'Tahu sutra lembut diisi cincangan wortel dan jamur tiram, dikukus hangat.',
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
    isAvailable: true,
  },
  {
    id: 'menu-10',
    name: 'Tempe Bacem Rempah Rendah Gula',
    price: 6000,
    category: 'lauk_nabati',
    mealTimes: ['siang', 'malam'],
    calories: 95,
    protein: 9,
    carbs: 8,
    fat: 3,
    sodium: 40,
    description: 'Tempe kedelai murni diungkep air kelapa dan ketumbar, rasa gurih legit alami.',
    image: 'https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?auto=format&fit=crop&w=400&q=80',
    isAvailable: true,
  },
  {
    id: 'menu-11',
    name: 'Sayur Bening Bayam Jagung Manis',
    price: 9000,
    category: 'sayuran',
    mealTimes: ['siang', 'malam'],
    calories: 45,
    protein: 2.5,
    carbs: 8,
    fat: 0.4,
    sodium: 35,
    description: 'Daun bayam hijau segar dan jagung pipil manis dengan kuah temu kunci segar.',
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=400&q=80',
    isAvailable: true,
  },
  {
    id: 'menu-12',
    name: 'Tumis Labu Siam & Wortel Sehat',
    price: 9000,
    category: 'sayuran',
    mealTimes: ['siang', 'malam'],
    calories: 55,
    protein: 1.8,
    carbs: 9,
    fat: 1.2,
    sodium: 40,
    description: 'Irisan labu siam muda dan wortel manis ditumis minyak zaitun rendah kolesterol.',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=400&q=80',
    isAvailable: true,
  },
  {
    id: 'menu-13',
    name: 'Sup Krim Labu Kuning Lembut',
    price: 12000,
    category: 'sayuran',
    mealTimes: ['pagi', 'malam', 'snack'],
    calories: 75,
    protein: 2,
    carbs: 14,
    fat: 1.5,
    sodium: 25,
    description: 'Puree labu kuning kukus kaya vitamin A dan serat, tekstur creamy lembut.',
    image: 'https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?auto=format&fit=crop&w=400&q=80',
    isAvailable: true,
  },
  {
    id: 'menu-14',
    name: 'Potongan Pepaya & Melon Manis Segar',
    price: 8000,
    category: 'buah_snack',
    mealTimes: ['pagi', 'siang', 'malam', 'snack'],
    calories: 60,
    protein: 1,
    carbs: 14,
    fat: 0.1,
    sodium: 2,
    description: 'Potongan pepaya California matang dan melon segar dipotong higienis.',
    image: 'https://images.unsplash.com/photo-1519996529931-28324d5a630e?auto=format&fit=crop&w=400&q=80',
    isAvailable: true,
  },
  {
    id: 'menu-15',
    name: 'Puding Cokelat Susu Skim Rendah Kalori',
    price: 11000,
    category: 'buah_snack',
    mealTimes: ['snack'],
    calories: 90,
    protein: 3.5,
    carbs: 15,
    fat: 1,
    sodium: 20,
    description: 'Puding agar-agar serat tinggi dengan cokelat murni dan pemanis alami.',
    image: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=400&q=80',
    isAvailable: true,
  },
  {
    id: 'menu-16',
    name: 'Teh Hijau Hangat Madu Murni',
    price: 7000,
    category: 'minuman',
    mealTimes: ['pagi', 'snack', 'malam'],
    calories: 35,
    protein: 0.2,
    carbs: 8,
    fat: 0,
    sodium: 1,
    description: 'Seduhan daun teh hijau organik dengan sentuhan madu randu asli penyegar tubuh.',
    image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=400&q=80',
    isAvailable: true,
  },
  {
    id: 'menu-17',
    name: 'Susu Kedelai Murni Tanpa Gula Tambahan',
    price: 8000,
    category: 'minuman',
    mealTimes: ['pagi', 'snack'],
    calories: 80,
    protein: 7,
    carbs: 4,
    fat: 4,
    sodium: 10,
    description: 'Susu sari kedelai segar tinggi protein nabati dan kalsium alami.',
    image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=400&q=80',
    isAvailable: true,
  },
];

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

const LOCAL_STORAGE_MENU_KEY = 'nutrihospital_menu_cache';
const LOCAL_STORAGE_ORDERS_KEY = 'nutrihospital_orders_cache';

export function getLocalCachedMenu(): MenuItem[] {
  if (typeof window === 'undefined') return INITIAL_MENU;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_MENU_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // Ignore storage parse error
  }
  return INITIAL_MENU;
}

export function saveLocalCachedMenu(menu: MenuItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_MENU_KEY, JSON.stringify(menu));
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

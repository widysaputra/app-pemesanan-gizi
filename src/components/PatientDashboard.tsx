import React, { useState, useMemo } from 'react';
import { 
  MenuItem, 
  HospitalOrder, 
  MealTime, 
  MenuCategory 
} from '../types';
import { 
  Utensils, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  MessageCircle, 
  Bed, 
  User, 
  Phone, 
  Clock, 
  CheckCircle2, 
  Flame, 
  Sparkles, 
  AlertCircle,
  ShoppingBag,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { OrderSuccessModal } from './OrderSuccessModal';

interface PatientDashboardProps {
  menuItems: MenuItem[];
  orders: HospitalOrder[];
  onSubmitOrder: (orderPayload: {
    roomName: string;
    patientName: string;
    phoneNumber: string;
    registrationNo?: string;
    mealTime: MealTime;
    items: { menuItemId: string; name: string; portion: number; price: number; category: string; calories: number }[];
    patientNotes?: string;
  }) => Promise<{ order: HospitalOrder; waMessage: string; waSent: boolean; waStatusText: string; simrsSynced?: boolean; simrsStatusText?: string }>;
}

const CATEGORY_TABS: { key: string; label: string }[] = [
  { key: 'all', label: 'Semua Menu' },
  { key: 'makanan_utama', label: 'Makanan Pokok' },
  { key: 'lauk_hewani', label: 'Lauk Hewani' },
  { key: 'lauk_nabati', label: 'Lauk Nabati' },
  { key: 'sayuran', label: 'Sayuran' },
  { key: 'buah_snack', label: 'Buah & Snack' },
  { key: 'minuman', label: 'Minuman' },
];

const ROOM_PRESETS = [
  'Kamar Mawar 101 - Bed A',
  'Kamar Mawar 201 - Bed 01',
  'Kamar Melati 304 - Bed 02',
  'Kamar Anggrek 102 - Bed 01',
  'Paviliun VIP 05',
];

export const PatientDashboard: React.FC<PatientDashboardProps> = ({
  menuItems,
  orders,
  onSubmitOrder,
}) => {
  // Order Identity States
  const [roomName, setRoomName] = useState<string>('Kamar Mawar 201 - Bed 01');
  const [patientName, setPatientName] = useState<string>('Ny. Siti Rahmawati');
  const [phoneNumber, setPhoneNumber] = useState<string>('081298765432');
  const [registrationNo, setRegistrationNo] = useState<string>('REG-20260908-001');
  const [mealTime, setMealTime] = useState<MealTime>('siang');
  const [patientNotes, setPatientNotes] = useState<string>('');

  // Menu Browsing States
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Cart / Tray State
  const [tray, setTray] = useState<Record<string, number>>({
    'menu-1': 1, // Nasi Putih Pulen
    'menu-5': 1, // Ayam Panggang
    'menu-11': 1, // Sayur Bayam
  });

  // Submission States
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successModalData, setSuccessModalData] = useState<{
    order: HospitalOrder;
    waMessage: string;
    waSent: boolean;
    waStatusText: string;
  } | null>(null);

  // Filtered Menu Items
  const filteredMenu = useMemo(() => {
    return menuItems.filter((item) => {
      // Must match meal time if specified
      const matchMealTime = item.mealTimes.includes(mealTime);
      const matchCat = selectedCategory === 'all' || item.category === selectedCategory;
      const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchMealTime && matchCat && matchSearch;
    });
  }, [menuItems, mealTime, selectedCategory, searchQuery]);

  // Cart calculation
  const trayItems = useMemo(() => {
    return Object.entries(tray)
      .map(([menuId, qtyVal]) => {
        const qty = Number(qtyVal) || 0;
        const item = menuItems.find((m) => m.id === menuId);
        if (!item || qty <= 0) return null;
        return { item, qty, subtotal: (item.price || 0) * qty };
      })
      .filter(Boolean) as { item: MenuItem; qty: number; subtotal: number }[];
  }, [tray, menuItems]);

  const totalPrice = useMemo(() => {
    return trayItems.reduce((acc, curr) => acc + curr.subtotal, 0);
  }, [trayItems]);

  const totalCalories = useMemo(() => {
    return trayItems.reduce((acc, curr) => acc + (curr.item.calories || 0) * curr.qty, 0);
  }, [trayItems]);

  // Tray operations
  const handleAddItem = (menuId: string) => {
    setTray((prev) => ({
      ...prev,
      [menuId]: (Number(prev[menuId]) || 0) + 1,
    }));
  };

  const handleDecreaseItem = (menuId: string) => {
    setTray((prev) => {
      const current = Number(prev[menuId]) || 0;
      if (current <= 1) {
        const next = { ...prev };
        delete next[menuId];
        return next;
      }
      return { ...prev, [menuId]: current - 1 };
    });
  };

  const handleClearTray = () => {
    setTray({});
  };

  // Submit Order
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!roomName.trim()) {
      setFormError('Nama kamar / nomor kamar wajib diisi.');
      return;
    }

    if (!phoneNumber.trim()) {
      setFormError('Nomor WhatsApp wajib diisi agar notifikasi dapat dikirim.');
      return;
    }

    if (trayItems.length === 0) {
      setFormError('Pilih minimal satu menu makanan untuk dipesan.');
      return;
    }

    try {
      setIsSubmitting(true);

      const itemsPayload = trayItems.map(({ item, qty }) => ({
        menuItemId: item.id,
        name: item.name,
        portion: qty,
        price: item.price || 0,
        category: item.category,
        calories: item.calories || 0,
      }));

      const res = await onSubmitOrder({
        roomName: roomName.trim(),
        patientName: patientName.trim() || 'Pasien Rawat Inap',
        phoneNumber: phoneNumber.trim(),
        registrationNo: registrationNo.trim(),
        mealTime,
        items: itemsPayload,
        patientNotes: patientNotes.trim(),
      });

      // Show success modal with WhatsApp details
      setSuccessModalData(res);
      setTray({});
      setPatientNotes('');
    } catch (err: any) {
      setFormError(err.message || 'Gagal mengirim pesanan');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Patient Header Greeting */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 text-white rounded-3xl p-6 shadow-md relative overflow-hidden">
        <div className="absolute -right-6 -bottom-6 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/20 backdrop-blur-md mb-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
            <span>Pemesanan Makanan Pasien &bull; Terhubung WhatsApp</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
            Pesan Menu Makanan Pasien
          </h2>
          <p className="text-xs sm:text-sm text-emerald-100 mt-1 leading-relaxed">
            Pilih menu makanan sehat sesuai selera dan kebutuhan kamar Anda. Pesanan otomatis diteruskan ke Dapur Gizi melalui WhatsApp Fonnte.
          </p>
        </div>
      </div>

      {/* Main Grid: Left Catalog, Right Room Form & Order Tray */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* ========================================================
            LEFT 2 COLUMNS: CATALOG & MENU SELECTION
            ======================================================== */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Meal Time Selector & Search */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              
              {/* Meal Time Selector */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 w-full sm:w-auto">
                {(['pagi', 'siang', 'malam', 'snack'] as MealTime[]).map((time) => (
                  <button
                    key={time}
                    type="button"
                    onClick={() => setMealTime(time)}
                    className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                      mealTime === time
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Makan {time}
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari lauk, sayur, buah..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {CATEGORY_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setSelectedCategory(tab.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                    selectedCategory === tab.key
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Menu Catalog Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredMenu.map((item) => {
              const inTrayQty = tray[item.id] || 0;

              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-2xl border transition-all overflow-hidden flex flex-col justify-between ${
                    inTrayQty > 0
                      ? 'border-emerald-500 ring-2 ring-emerald-100 shadow-md'
                      : 'border-slate-200 hover:border-slate-300 shadow-xs'
                  }`}
                >
                  <div>
                    {/* Image */}
                    <div className="relative h-36 w-full bg-slate-100 overflow-hidden">
                      <img
                        src={item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80'}
                        alt={item.name}
                        className={`w-full h-full object-cover transition-transform duration-300 hover:scale-105 ${
                          !item.isAvailable ? 'grayscale opacity-60' : ''
                        }`}
                      />
                      
                      {!item.isAvailable && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <span className="px-3 py-1 bg-rose-600 text-white font-bold text-xs rounded-full shadow-md">
                            Habis / Tidak Tersedia
                          </span>
                        </div>
                      )}

                      <div className="absolute bottom-2 left-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-black/60 text-white backdrop-blur-xs flex items-center gap-1">
                          <Flame className="w-3 h-3 text-amber-400" />
                          <span>{item.calories} kkal</span>
                        </span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-3.5 space-y-1.5">
                      <h4 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2">
                        {item.name}
                      </h4>
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {item.description || 'Penyajian higienis instalasi gizi rumah sakit.'}
                      </p>
                    </div>
                  </div>

                  {/* Pricing & Add to Cart */}
                  <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Harga Satuan</div>
                      <div className="text-sm font-black text-emerald-700">
                        {item.price > 0 ? `Rp ${item.price.toLocaleString('id-ID')}` : 'Gratis / Pasien'}
                      </div>
                    </div>

                    {item.isAvailable ? (
                      inTrayQty > 0 ? (
                        <div className="flex items-center bg-white border border-emerald-500 rounded-xl p-0.5 shadow-xs">
                          <button
                            type="button"
                            onClick={() => handleDecreaseItem(item.id)}
                            className="w-7 h-7 flex items-center justify-center text-emerald-700 hover:bg-emerald-50 rounded-lg cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-7 text-center font-bold text-xs text-slate-900">
                            {inTrayQty}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAddItem(item.id)}
                            className="w-7 h-7 flex items-center justify-center bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAddItem(item.id)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Pilih Menu</span>
                        </button>
                      )
                    ) : (
                      <span className="text-xs text-slate-400 font-semibold italic">
                        Habis
                      </span>
                    )}
                  </div>

                </div>
              );
            })}
          </div>

          {filteredMenu.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2">
              <Utensils className="w-8 h-8 text-slate-300 mx-auto" />
              <h4 className="font-bold text-slate-700 text-sm">Tidak ada menu untuk waktu makan ini</h4>
              <p className="text-xs text-slate-500">Coba pilih waktu makan lain (Pagi, Siang, Malam, Snack) atau ganti kata kunci.</p>
            </div>
          )}

        </div>

        {/* ========================================================
            RIGHT COLUMN: ROOM INFO & ORDER TRAY (CART)
            ======================================================== */}
        <div className="space-y-4">
          
          <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-5 sticky top-20">
            
            {/* Form Section: Room & Contact Info */}
            <div className="space-y-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
                  <Bed className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Informasi Kamar &amp; Pemesan</h3>
                  <p className="text-[11px] text-slate-400">Diperlukan untuk pengantaran baki makanan</p>
                </div>
              </div>

              {formError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Room Name Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama / Nomor Kamar &amp; Bed <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="Contoh: Kamar Mawar 201 - Bed 01"
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
                  required
                />
                
                {/* Room Quick Suggestions */}
                <div className="mt-1 flex flex-wrap gap-1">
                  {ROOM_PRESETS.slice(0, 3).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setRoomName(preset)}
                      className="text-[10px] text-slate-500 hover:text-emerald-700 bg-slate-100 hover:bg-emerald-50 px-2 py-0.5 rounded cursor-pointer transition-colors"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Patient Name Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Pasien / Pemesan
                </label>
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Nama lengkap pasien..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Patient Registration Number (SIMRS DB) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    No. Registrasi Pasien (SIMRS)
                  </label>
                  <span className="text-[10px] text-slate-400 font-normal">Opsional</span>
                </div>
                <input
                  type="text"
                  value={registrationNo}
                  onChange={(e) => setRegistrationNo(e.target.value)}
                  placeholder="Contoh: REG-20260908-001"
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/60"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Digunakan untuk sinkronisasi otomatis ke database PostgreSQL SIMRS.
                </p>
              </div>

              {/* Phone / WhatsApp Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor WhatsApp Pemesan <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Contoh: 081234567890"
                    className="w-full pl-8 pr-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Pesan rincian pesanan akan dicantumkan dengan nomor WhatsApp ini.
                </p>
              </div>

              {/* Patient Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan Khusus (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={patientNotes}
                  onChange={(e) => setPatientNotes(e.target.value)}
                  placeholder="Contoh: Kuah sayur hangat, tanpa pedas, sendok tambahan..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Form Section: Order Tray (Baki Makanan) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4 text-emerald-600" />
                  <h4 className="font-bold text-slate-900 text-sm">Baki Pesanan</h4>
                  <span className="text-xs px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                    {trayItems.length} menu
                  </span>
                </div>
                {trayItems.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearTray}
                    className="text-[11px] text-rose-500 hover:text-rose-700 font-semibold cursor-pointer"
                  >
                    Kosongkan
                  </button>
                )}
              </div>

              {/* List of chosen items */}
              {trayItems.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {trayItems.map(({ item, qty, subtotal }) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="font-bold text-slate-900 truncate">{item.name}</div>
                        <div className="text-[11px] text-slate-500">
                          {qty} x Rp {item.price.toLocaleString('id-ID')}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-800">
                          Rp {subtotal.toLocaleString('id-ID')}
                        </span>
                        <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() => handleDecreaseItem(item.id)}
                            className="w-5 h-5 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-4 text-center font-bold text-[11px]">
                            {qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAddItem(item.id)}
                            className="w-5 h-5 flex items-center justify-center text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                  Belum ada menu yang dipilih. Pilih menu di sebelah kiri untuk menambahkannya ke baki.
                </div>
              )}

              {/* Total Summary */}
              <div className="pt-2 border-t border-slate-100 space-y-1 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Total Kalori:</span>
                  <span className="font-bold text-amber-600">{totalCalories} kkal</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                  <span className="font-bold text-slate-900 text-sm">Total Pembayaran:</span>
                  <span className="font-black text-emerald-700 text-lg">
                    Rp {totalPrice.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              {/* Primary Submit Button: Pesan via WhatsApp */}
              <button
                type="submit"
                disabled={isSubmitting || trayItems.length === 0}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl shadow-lg shadow-emerald-600/20 text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <MessageCircle className="w-5 h-5 fill-white text-transparent" />
                <span>{isSubmitting ? 'Memproses Pesanan...' : 'Pesan & Kirim ke WhatsApp'}</span>
                <ChevronRight className="w-4 h-4 opacity-70" />
              </button>

              <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400 text-center">
                <span>Notifikasi otomatis dikirim via Fonnte Gateway</span>
              </div>
            </div>

          </form>

        </div>

      </div>

      {/* Success Modal */}
      <OrderSuccessModal
        order={successModalData?.order || null}
        waMessage={successModalData?.waMessage || ''}
        waSent={successModalData?.waSent || false}
        waStatusText={successModalData?.waStatusText || ''}
        isOpen={Boolean(successModalData)}
        onClose={() => setSuccessModalData(null)}
      />

    </div>
  );
};

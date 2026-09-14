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
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { realtimeService } from '../services/api';
import { OrderSuccessModal } from './OrderSuccessModal';
import { getValidMenuImage, getCategoryFallbackImage } from '../utils/imageHelper';

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
  const [mealTimeFilter, setMealTimeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSyncingMenu, setIsSyncingMenu] = useState<boolean>(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  // Cart / Tray State - Starts clean so patient chooses their actual desired menu
  const [tray, setTray] = useState<Record<string, number>>({});

  // Active View Tab: Catalog Menu vs Order History
  const [activeTab, setActiveTab] = useState<'catalog' | 'history'>('catalog');

  // Submission States
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successModalData, setSuccessModalData] = useState<{
    order: HospitalOrder;
    waMessage: string;
    waSent: boolean;
    waStatusText: string;
  } | null>(null);

  // Filtered orders relevant for this patient/room or general recent
  const myOrders = useMemo(() => {
    if (!orders || !Array.isArray(orders)) return [];
    return [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders]);

  // Filtered Menu Items
  const filteredMenu = useMemo(() => {
    return (menuItems || [])
      .filter((item): item is MenuItem => Boolean(item && item.id && item.name))
      .filter((item) => {
        // Must match meal time filter if active
        const times = Array.isArray(item.mealTimes) && item.mealTimes.length > 0 ? item.mealTimes : ['pagi', 'siang', 'malam', 'snack'];
        const matchMealTime = mealTimeFilter === 'all' || times.includes(mealTimeFilter as MealTime) || times.includes(mealTime);
        const matchCat = selectedCategory === 'all' || item.category === selectedCategory;
        const itemName = (item.name || '').toLowerCase();
        const itemDesc = (item.description || '').toLowerCase();
        const query = (searchQuery || '').toLowerCase();
        const matchSearch = !query || itemName.includes(query) || itemDesc.includes(query);
        return matchMealTime && matchCat && matchSearch;
      });
  }, [menuItems, mealTime, mealTimeFilter, selectedCategory, searchQuery]);

  // Handle manual sync from server / SIMRS
  const handleSyncMenu = async () => {
    try {
      setIsSyncingMenu(true);
      setSyncStatusMsg('Menghubungi server & SIMRS...');
      await realtimeService.syncWithServer();
      const updated = await realtimeService.getMenu();
      setSyncStatusMsg(`Berhasil! ${updated.length} menu termuat.`);
      setTimeout(() => setSyncStatusMsg(null), 3500);
    } catch (err: any) {
      setSyncStatusMsg('Gagal menyinkronkan: ' + (err.message || 'Koneksi terputus'));
      setTimeout(() => setSyncStatusMsg(null), 4000);
    } finally {
      setIsSyncingMenu(false);
    }
  };

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
      
      {/* Patient Header Greeting & Tab Switcher */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 text-white rounded-3xl p-6 shadow-md relative overflow-hidden">
        <div className="absolute -right-6 -bottom-6 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
        <div className="relative z-10 max-w-3xl">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/20 backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
              <span>Pemesanan Makanan Pasien &bull; Dapur Gizi RS</span>
            </div>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
            Layanan Gizi Rawat Inap
          </h2>
          <p className="text-xs sm:text-sm text-emerald-100 mt-1 leading-relaxed max-w-2xl">
            Pesan makanan bergizi sesuai selera &amp; pantau status pesanan secara langsung dari HP atau perangkat Anda.
          </p>

          {/* Navigation Tabs & Live Sync Action */}
          <div className="flex flex-wrap items-center justify-between gap-2 mt-5">
            <div className="flex items-center gap-2 bg-black/20 backdrop-blur-md p-1.5 rounded-2xl w-fit border border-white/15">
              <button
                type="button"
                onClick={() => setActiveTab('catalog')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'catalog'
                    ? 'bg-white text-emerald-900 shadow-md'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                <Utensils className="w-4 h-4" />
                <span>Pesan Menu Makanan</span>
                {trayItems.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                    {trayItems.reduce((acc, curr) => acc + curr.qty, 0)}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'history'
                    ? 'bg-white text-emerald-900 shadow-md'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>Riwayat &amp; Status Pesanan</span>
                {myOrders.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                    {myOrders.length}
                  </span>
                )}
              </button>
            </div>

            {/* Quick Sync Button */}
          </div>

          {syncStatusMsg && (
            <div className="mt-3 px-3 py-1.5 bg-emerald-950/60 border border-emerald-400/40 text-emerald-200 text-xs rounded-xl inline-flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{syncStatusMsg}</span>
            </div>
          )}
        </div>
      </div>

      {activeTab === 'history' ? (
        /* ========================================================
           TAB: RIWAYAT & STATUS PESANAN PASIEN (REAL-TIME TRACKING)
           ======================================================== */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <span>Daftar Pesanan Pasien Terkini</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                  {myOrders.length} Pesanan
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Status pesanan diperbarui secara otomatis secara real-time saat diproses oleh Petugas Gizi.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('catalog')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Pesanan Baru</span>
            </button>
          </div>

          {myOrders.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center mb-3">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <h4 className="text-base font-black text-slate-900">Belum Ada Pesanan Makanan</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                Anda belum melakukan pemesanan makanan. Silakan pilih menu bergizi yang tersedia di katalog.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('catalog')}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black inline-flex items-center gap-2 shadow-md cursor-pointer transition-all"
              >
                <Utensils className="w-4 h-4" />
                <span>Buka Menu Makanan</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myOrders.map((ord) => {
                const statusBadgeConfig: Record<string, { bg: string; label: string; dot: string }> = {
                  baru: { bg: 'bg-blue-50 border-blue-200 text-blue-800', dot: 'bg-blue-500', label: 'Pesanan Diterima' },
                  diproses: { bg: 'bg-amber-50 border-amber-200 text-amber-800', dot: 'bg-amber-500', label: 'Sedang Disiapkan di Dapur' },
                  diantar: { bg: 'bg-purple-50 border-purple-200 text-purple-800', dot: 'bg-purple-500', label: 'Sedang Diantar ke Kamar' },
                  selesai: { bg: 'bg-emerald-50 border-emerald-200 text-emerald-800', dot: 'bg-emerald-500', label: 'Pesanan Selesai / Disajikan' },
                  dibatalkan: { bg: 'bg-rose-50 border-rose-200 text-rose-800', dot: 'bg-rose-500', label: 'Dibatalkan' },
                };

                const currentBadge = statusBadgeConfig[ord.status] || statusBadgeConfig.baru;
                const statusSteps = ['baru', 'diproses', 'diantar', 'selesai'];
                const currentStepIdx = statusSteps.indexOf(ord.status);

                return (
                  <div 
                    key={ord.id} 
                    className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden"
                  >
                    <div className="space-y-3">
                      {/* Top Header */}
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                              {ord.orderNumber}
                            </span>
                            <span className="text-[11px] font-bold text-slate-500 uppercase">
                              Makan {ord.mealTime}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(ord.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB &bull; {new Date(ord.createdAt).toLocaleDateString('id-ID')}</span>
                          </div>
                        </div>

                        <div className={`px-3 py-1 rounded-full border text-xs font-black flex items-center gap-1.5 ${currentBadge.bg}`}>
                          <span className={`w-2 h-2 rounded-full ${currentBadge.dot} animate-pulse`}></span>
                          <span>{currentBadge.label}</span>
                        </div>
                      </div>

                      {/* Status Progress Stepper */}
                      {ord.status !== 'dibatalkan' && (
                        <div className="py-2">
                          <div className="grid grid-cols-4 gap-1 relative">
                            {statusSteps.map((st, idx) => {
                              const isCompleted = currentStepIdx >= idx;
                              const isCurrent = currentStepIdx === idx;
                              const labels = ['Diterima', 'Disiapkan', 'Diantar', 'Selesai'];

                              return (
                                <div key={st} className="text-center">
                                  <div 
                                    className={`h-1.5 rounded-full mb-1 transition-all ${
                                      isCompleted 
                                        ? (isCurrent ? 'bg-emerald-500' : 'bg-emerald-400') 
                                        : 'bg-slate-200'
                                    }`}
                                  />
                                  <span className={`text-[10px] font-bold block truncate ${
                                    isCurrent ? 'text-emerald-700 font-black' : isCompleted ? 'text-slate-700' : 'text-slate-400'
                                  }`}>
                                    {labels[idx]}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Patient & Room Details */}
                      <div className="bg-slate-50 rounded-2xl p-3 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">Kamar / Bed</span>
                          <span className="font-extrabold text-slate-800">{ord.roomName}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">Nama Pasien</span>
                          <span className="font-extrabold text-slate-800">{ord.patientName}</span>
                        </div>
                      </div>

                      {/* Item Details */}
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Menu yang Dipesan</span>
                        <div className="space-y-1">
                          {ord.items.map((it, i) => (
                            <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-slate-50 last:border-0">
                              <span className="text-slate-700 font-medium">
                                <strong className="text-slate-900">{it.name}</strong> &times; {it.portion} porsi
                              </span>
                              <span className="font-bold text-slate-900">
                                Rp {((it.price || 0) * it.portion).toLocaleString('id-ID')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Patient Notes */}
                      {ord.patientNotes && (
                        <div className="text-xs bg-amber-50/70 border border-amber-200/60 text-amber-900 p-2.5 rounded-xl">
                          <strong className="font-black">Catatan Diet/Khusus:</strong> {ord.patientNotes}
                        </div>
                      )}
                    </div>

                    {/* Footer Summary */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold">Total Pembayaran</span>
                        <span className="text-sm font-black text-emerald-700">
                          Rp {(ord.totalPrice || 0).toLocaleString('id-ID')}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {ord.simrsSync?.synced ? (
                          <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 text-[10px] font-bold">
                            SIMRS Synced
                          </span>
                        ) : null}
                        {ord.whatsappNotification?.sent ? (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            WA Sent
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ========================================================
           TAB: KATALOG & PEMESANAN MENU
           ======================================================== */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* ========================================================
            LEFT 2 COLUMNS: CATALOG & MENU SELECTION
            ======================================================== */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Meal Time Selector & Search */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              
              {/* Meal Time Selector */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 w-full sm:w-auto overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setMealTimeFilter('all')}
                  className={`flex-1 sm:flex-none px-2 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    mealTimeFilter === 'all'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Semua Waktu
                </button>
                {(['pagi', 'siang', 'malam', 'snack'] as MealTime[]).map((time) => (
                  <button
                    key={time}
                    type="button"
                    onClick={() => {
                      setMealTimeFilter(time);
                      setMealTime(time);
                    }}
                    className={`flex-1 sm:flex-none px-2 sm:px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer whitespace-nowrap ${
                      mealTimeFilter === time
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span className="hidden sm:inline">Makan </span>
                    <span>{time}</span>
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

          {/* Menu Catalog Grid - Responsive: 2 Kolom di HP / Layar Kecil agar tidak terlalu ke bawah */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
            {filteredMenu.map((item) => {
              const inTrayQty = tray[item.id] || 0;

              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-xl sm:rounded-2xl border transition-all overflow-hidden flex flex-col justify-between ${
                    inTrayQty > 0
                      ? 'border-emerald-500 ring-2 ring-emerald-100 shadow-md'
                      : 'border-slate-200 hover:border-slate-300 shadow-xs'
                  }`}
                >
                  <div>
                    {/* Image */}
                    <div className="relative h-28 sm:h-36 w-full bg-slate-100 overflow-hidden">
                      <img
                        src={getValidMenuImage(item.image, item.name, item.category)}
                        alt={item.name}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const target = e.currentTarget;
                          target.onerror = null;
                          target.src = getCategoryFallbackImage(item.category, item.name);
                        }}
                        className={`w-full h-full object-cover transition-transform duration-300 hover:scale-105 ${
                          !item.isAvailable ? 'grayscale opacity-60' : ''
                        }`}
                      />
                      
                      {!item.isAvailable && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-1">
                          <span className="px-2 py-0.5 sm:px-3 sm:py-1 bg-rose-600 text-white font-bold text-[10px] sm:text-xs rounded-full shadow-md text-center">
                            Habis
                          </span>
                        </div>
                      )}

                      <div className="absolute bottom-1.5 left-1.5 sm:bottom-2 sm:left-2">
                        <span className="px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded text-[9px] sm:text-[10px] font-bold bg-black/60 text-white backdrop-blur-xs flex items-center gap-0.5 sm:gap-1">
                          <Flame className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400" />
                          <span>{item.calories} kkal</span>
                        </span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-2.5 sm:p-3.5 space-y-1 sm:space-y-1.5">
                      <h4 className="font-bold text-slate-900 text-xs sm:text-sm leading-snug line-clamp-2 min-h-[2rem] sm:min-h-0" title={item.name}>
                        {item.name}
                      </h4>
                      <p className="text-[10px] sm:text-xs text-slate-500 line-clamp-1 sm:line-clamp-2 leading-relaxed">
                        {item.description || 'Penyajian higienis instalasi gizi rumah sakit.'}
                      </p>
                    </div>
                  </div>

                  {/* Pricing & Add to Cart */}
                  <div className="p-2 sm:p-3.5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-2">
                    <div className="min-w-0">
                      <div className="text-[9px] sm:text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Harga</div>
                      <div className="text-xs sm:text-sm font-black text-emerald-700 truncate">
                        {item.price > 0 ? `Rp ${item.price.toLocaleString('id-ID')}` : 'Gratis'}
                      </div>
                    </div>

                    {item.isAvailable ? (
                      inTrayQty > 0 ? (
                        <div className="flex items-center justify-between sm:justify-center bg-white border border-emerald-500 rounded-lg sm:rounded-xl p-0.5 shadow-xs w-full sm:w-auto">
                          <button
                            type="button"
                            onClick={() => handleDecreaseItem(item.id)}
                            className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center text-emerald-700 hover:bg-emerald-50 rounded-md sm:rounded-lg cursor-pointer transition-colors"
                            title="Kurangi porsi"
                          >
                            <Minus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          </button>
                          <span className="w-6 sm:w-7 text-center font-bold text-xs text-slate-900">
                            {inTrayQty}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAddItem(item.id)}
                            className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center bg-emerald-600 text-white hover:bg-emerald-700 rounded-md sm:rounded-lg cursor-pointer transition-colors"
                            title="Tambah porsi"
                          >
                            <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAddItem(item.id)}
                          className="w-full sm:w-auto px-2 py-1.5 sm:px-3 sm:py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold shadow-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          <span className="hidden sm:inline">Pilih Menu</span>
                          <span className="sm:hidden">+ Pilih</span>
                        </button>
                      )
                    ) : (
                      <span className="text-[11px] sm:text-xs text-slate-400 font-semibold italic text-center sm:text-left">
                        Habis
                      </span>
                    )}
                  </div>

                </div>
              );
            })}
          </div>

          {filteredMenu.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                <Utensils className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-sm">Tidak ada menu yang sesuai kriteria</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Menu mungkin diatur untuk waktu makan lain, atau perlu disinkronkan dari SIMRS / Server.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setMealTimeFilter('all');
                    setSelectedCategory('all');
                    setSearchQuery('');
                  }}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
                >
                  Tampilkan Semua Menu ({menuItems.length})
                </button>
                <button
                  type="button"
                  onClick={handleSyncMenu}
                  disabled={isSyncingMenu}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingMenu ? 'animate-spin' : ''}`} />
                  <span>{isSyncingMenu ? 'Menyinkronkan...' : 'Sinkronkan SIMRS'}</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* ========================================================
            RIGHT COLUMN: ROOM INFO & ORDER TRAY (CART)
            ======================================================== */}
        <div className="space-y-4" id="order-form-container">
          
          <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-5 sticky top-20">
            
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

              {/* Primary Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || trayItems.length === 0}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl shadow-lg shadow-emerald-600/20 text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>{isSubmitting ? 'Memproses Pesanan...' : 'Kirim Pesanan Sekarang'}</span>
                <ChevronRight className="w-4 h-4 opacity-70" />
              </button>

              <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400 text-center">
                <span>Pesanan otomatis tercatat &amp; diteruskan ke Dapur Gizi</span>
              </div>
            </div>

          </form>

        </div>

      </div>
      )}

      {/* Floating Mobile Cart / Tray Bar (Muncul di layar HP saat ada menu yang dipilih) */}
      {activeTab === 'catalog' && trayItems.length > 0 && (
        <div 
          id="floating-mobile-cart"
          className="lg:hidden fixed bottom-3 left-3 right-3 z-50 bg-slate-950/95 text-white backdrop-blur-md px-3 py-2.5 rounded-2xl shadow-2xl flex items-center justify-between gap-2 border border-slate-700/80 max-w-sm mx-auto box-border"
        >
          <div 
            className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
            onClick={() => {
              const formEl = document.getElementById('order-form-container');
              if (formEl) {
                formEl.scrollIntoView({ behavior: 'smooth' });
              }
            }}
          >
            <div className="w-7 h-7 rounded-xl bg-emerald-600 flex items-center justify-center font-black text-xs text-white shrink-0 shadow-xs">
              {trayItems.reduce((acc, curr) => acc + curr.qty, 0)}
            </div>
            <div className="min-w-0 truncate">
              <div className="text-xs font-black text-emerald-400 whitespace-nowrap leading-tight">
                Rp {totalPrice.toLocaleString('id-ID')}
              </div>
              <div className="text-[10px] text-slate-300 font-medium leading-tight truncate">
                {trayItems.length} menu dipilih
              </div>
            </div>
          </div>

          <button
            type="button"
            id="btn-floating-order-checkout"
            onClick={() => {
              const formEl = document.getElementById('order-form-container');
              if (formEl) {
                formEl.scrollIntoView({ behavior: 'smooth' });
                setTimeout(() => {
                  const roomInput = document.getElementById('roomName');
                  if (roomInput && !roomName) {
                    roomInput.focus();
                  }
                }, 300);
              }
            }}
            className="shrink-0 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1 cursor-pointer shadow-md transition-all whitespace-nowrap"
          >
            <span>Pesan</span>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          </button>
        </div>
      )}

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

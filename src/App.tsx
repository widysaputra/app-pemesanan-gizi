import React, { useState, useEffect, useCallback } from 'react';
import { 
  HospitalOrder, 
  MenuItem, 
  MealTime, 
  OrderStatus 
} from './types';
import { realtimeService } from './services/api';
import { playHospitalChime } from './utils/audio';
import { PatientDashboard } from './components/PatientDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { SplitViewMode } from './components/SplitViewMode';
import { 
  HeartPulse, 
  User, 
  Split, 
  ShieldCheck, 
  Volume2, 
  VolumeX, 
  HelpCircle, 
  X, 
  Sparkles,
  MessageCircle
} from 'lucide-react';

type AppView = 'patient' | 'admin' | 'split';

export default function App() {
  const [activeView, setActiveView] = useState<AppView>('split'); // Default to split for instant preview of both
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<HospitalOrder[]>([]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ title: string; desc: string } | null>(null);

  // Fetch initial data with safe fallback and guaranteed loading unlock
  const loadData = useCallback(async () => {
    try {
      const [fetchedMenu, fetchedOrders] = await Promise.all([
        realtimeService.getMenu().catch(() => realtimeService.getLocalMenu()),
        realtimeService.getOrders().catch(() => realtimeService.getLocalOrders()),
      ]);

      const validMenu = fetchedMenu && fetchedMenu.length > 0 ? fetchedMenu : realtimeService.getLocalMenu();
      const validOrders = fetchedOrders && Array.isArray(fetchedOrders) ? fetchedOrders : realtimeService.getLocalOrders();

      setMenuItems(validMenu);
      setOrders(validOrders);
    } catch (err) {
      console.warn('Network load fallback triggered:', err);
      setMenuItems(realtimeService.getLocalMenu());
      setOrders(realtimeService.getLocalOrders());
    } finally {
      setIsLoaded(true); // Guaranteed to unlock loading screen!
    }
  }, []);

  useEffect(() => {
    loadData();

    // Failsafe timer: after 2000ms, guarantee loading screen dismissal
    const failsafeTimer = setTimeout(() => {
      setIsLoaded((current) => {
        if (!current) {
          setMenuItems((m) => (m.length > 0 ? m : realtimeService.getLocalMenu()));
          setOrders((o) => (o.length > 0 ? o : realtimeService.getLocalOrders()));
          return true;
        }
        return current;
      });
    }, 2000);

    return () => clearTimeout(failsafeTimer);
  }, [loadData]);

  // Subscribe to real-time events (SSE & BroadcastChannel)
  useEffect(() => {
    const unsubscribe = realtimeService.subscribe((event) => {
      if (event.type === 'init') {
        if (event.data?.orders) setOrders(event.data.orders);
        if (event.data?.menuItems) setMenuItems(event.data.menuItems);
      } else if (event.type === 'new_order') {
        const newOrder: HospitalOrder = event.data.order;
        if (!newOrder) return;

        // Add to orders list without duplicates
        setOrders((prev) => {
          if (prev.some((o) => o.id === newOrder.id)) return prev;
          return [newOrder, ...prev];
        });

        // Trigger chime
        if (soundEnabled) {
          playHospitalChime();
        }

        // Floating toast alert
        setToastMessage({
          title: 'Pesanan Pasien Masuk!',
          desc: `${newOrder.patientName} (${newOrder.roomName}) memesan menu. WhatsApp Fonnte diteruskan.`,
        });
        setTimeout(() => {
          setToastMessage(null);
        }, 5000);

      } else if (event.type === 'status_update') {
        const updatedOrder: HospitalOrder = event.data.order;
        if (!updatedOrder) return;
        setOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)));

      } else if (event.type === 'menu_update') {
        const item: MenuItem = event.data.item;
        const action: string = event.data.action;
        
        if (action === 'delete') {
          setMenuItems((prev) => prev.filter((m) => m.id !== item.id));
        } else if (action === 'create') {
          setMenuItems((prev) => {
            if (prev.some((m) => m.id === item.id)) return prev;
            return [item, ...prev];
          });
        } else {
          // update or toggle
          setMenuItems((prev) => prev.map((m) => (m.id === item.id ? item : m)));
        }
      } else if (event.type === 'order_deleted') {
        const deletedId = event.data.id;
        setOrders((prev) => prev.filter((o) => o.id !== deletedId));
      }
    });

    return () => {
      unsubscribe();
    };
  }, [soundEnabled]);

  // Order submission handler
  const handleSubmitOrder = async (orderPayload: {
    roomName: string;
    patientName: string;
    phoneNumber: string;
    registrationNo?: string;
    mealTime: MealTime;
    items: { menuItemId: string; name: string; portion: number; price: number; category: string; calories: number }[];
    patientNotes?: string;
  }) => {
    return await realtimeService.createOrder(orderPayload);
  };

  // Status update handler
  const handleUpdateStatus = async (orderId: string, status: OrderStatus, note?: string) => {
    await realtimeService.updateOrderStatus(orderId, status, note);
  };

  // Toggle menu item availability
  const handleToggleMenuItem = async (menuId: string) => {
    await realtimeService.toggleMenuItem(menuId);
  };

  // Reset demo
  const handleResetDemo = async () => {
    if (confirm('Kembalikan semua menu dan pesanan ke data awal demo?')) {
      await realtimeService.resetDemo();
      await loadData();
    }
  };

  const newOrdersCount = orders.filter((o) => o.status === 'baru').length;

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-semibold text-slate-700">
            Memuat Sistem NutriHospital &amp; Gateway WhatsApp...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 font-sans">
      
      {/* Top Navigation Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/90 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <HeartPulse className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-slate-900 tracking-tight text-base">
                  NutriHospital
                </span>
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded uppercase flex items-center gap-1">
                  <MessageCircle className="w-3 h-3" />
                  <span>Fonnte WA Ready</span>
                </span>
              </div>
              <div className="text-[11px] text-slate-500 font-medium hidden sm:block">
                Pemesanan Makanan Pasien &bull; Admin Menu &bull; WhatsApp Gateway
              </div>
            </div>
          </div>

          {/* View Switcher Tabs: Pasien, Admin, Split View */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveView('split')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeView === 'split'
                  ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Split className="w-3.5 h-3.5 text-emerald-600" />
              <span>Layar Ganda</span>
            </button>

            <button
              onClick={() => setActiveView('patient')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeView === 'patient'
                  ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-3.5 h-3.5 text-blue-600" />
              <span>Dashboard Pasien</span>
            </button>

            <button
              onClick={() => setActiveView('admin')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer relative ${
                activeView === 'admin'
                  ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Dashboard Admin</span>
              {newOrdersCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
              )}
            </button>
          </div>

          {/* Utilities (Audio & Help) */}
          <div className="flex items-center gap-2">
            
            {/* Audio Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              title={soundEnabled ? 'Notifikasi Suara: Menyala' : 'Notifikasi Suara: Mati'}
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {/* Help Guidance Modal */}
            <button
              onClick={() => setShowHelpModal(true)}
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Informasi & Cara Kerja WhatsApp Fonnte"
            >
              <HelpCircle className="w-4 h-4 text-slate-500" />
            </button>

          </div>

        </div>
      </header>

      {/* Real-time Floating Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm bg-slate-900 text-white p-4 rounded-2xl shadow-xl border border-slate-700 animate-in slide-in-from-bottom-5 duration-200 flex items-start gap-3">
          <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0 mt-0.5">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-emerald-400 uppercase tracking-wide">
              {toastMessage.title}
            </div>
            <div className="text-xs text-slate-200 mt-0.5 leading-relaxed">
              {toastMessage.desc}
            </div>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="p-1 text-slate-400 hover:text-white rounded-lg"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeView === 'split' && (
          <SplitViewMode
            menuItems={menuItems}
            orders={orders}
            onSubmitOrder={handleSubmitOrder}
            onUpdateStatus={handleUpdateStatus}
            onToggleMenuItem={handleToggleMenuItem}
            onResetDemo={handleResetDemo}
          />
        )}

        {activeView === 'patient' && (
          <PatientDashboard
            menuItems={menuItems}
            orders={orders}
            onSubmitOrder={handleSubmitOrder}
          />
        )}

        {activeView === 'admin' && (
          <AdminDashboard
            orders={orders}
            menuItems={menuItems}
            onUpdateStatus={handleUpdateStatus}
            onToggleMenuItem={handleToggleMenuItem}
            onResetDemo={handleResetDemo}
          />
        )}
      </main>

      {/* Help / Guidance Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-base">Panduan Sistem &amp; WhatsApp Fonnte</h3>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 text-xs text-slate-600 space-y-3 leading-relaxed">
              <p>
                Konsep aplikasi telah diperbarui khusus sesuai kebutuhan Anda dengan <strong>2 Dashboard Utama</strong>:
              </p>
              
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-slate-800">
                <div>
                  <strong className="text-emerald-700">1. Dashboard Admin:</strong>
                  <ul className="list-disc pl-4 mt-0.5 space-y-0.5 text-[11px] text-slate-600">
                    <li>Ubah &amp; atur harga satuan makanan (Rp) secara langsung.</li>
                    <li>Atur ketersediaan menu (Tersedia / Habis) atau tambah menu baru.</li>
                    <li>Integrasi Token Fonnte WhatsApp &amp; uji coba kirim pesan tes live.</li>
                    <li>Pantau pesanan masuk dan update status pesanan.</li>
                  </ul>
                </div>
                <div>
                  <strong className="text-blue-700">2. Dashboard Pasien:</strong>
                  <ul className="list-disc pl-4 mt-0.5 space-y-0.5 text-[11px] text-slate-600">
                    <li>Isi nama kamar, nama pasien, dan nomor WhatsApp.</li>
                    <li>Pilih menu makanan beserta porsi yang diinginkan.</li>
                    <li>Klik "Pesan &amp; Kirim ke WhatsApp" untuk mengirim notifikasi via Fonnte.</li>
                    <li>Tersedia fallback tombol <em>wa.me</em> untuk kirim manual seketika.</li>
                  </ul>
                </div>
              </div>

              <p className="text-[11px] text-slate-500">
                Pesan WhatsApp otomatis berisi: <strong>Nama Kamar</strong>, <strong>Daftar Menu yang Dipesan</strong>, <strong>Nomor Telepon</strong>, dan <strong>Total Biaya</strong>.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs cursor-pointer transition-colors"
              >
                Tutup Panduan
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

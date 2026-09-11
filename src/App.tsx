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
import { 
  HeartPulse, 
  User, 
  ShieldCheck, 
  Volume2, 
  VolumeX, 
  HelpCircle, 
  X, 
  Sparkles,
  MessageCircle,
  Lock,
  Unlock,
  KeyRound,
  LogOut,
  Eye,
  EyeOff
} from 'lucide-react';

type AppView = 'patient' | 'admin';

export default function App() {
  const [activeView, setActiveView] = useState<AppView>('patient');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return typeof window !== 'undefined' && sessionStorage.getItem('nutrihospital_admin_auth') === 'true';
  });
  const [showAdminLoginModal, setShowAdminLoginModal] = useState<boolean>(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState<string>('');
  const [showPasswordText, setShowPasswordText] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');
  const [adminPassword, setAdminPassword] = useState<string>(() => {
    return (typeof window !== 'undefined' && localStorage.getItem('nutrihospital_admin_pwd')) || 'admin123';
  });
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<HospitalOrder[]>([]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ title: string; desc: string } | null>(null);

  // Fetch initial data with safe fallback and guaranteed loading unlock
  const loadData = useCallback(async () => {
    try {
      // 1. Tampilkan cache lokal segera agar UI langsung muncul tanpa jeda
      const localMenu = realtimeService.getLocalMenu();
      const localOrders = realtimeService.getLocalOrders();
      if (localMenu.length > 0) setMenuItems(localMenu);
      if (localOrders.length > 0) setOrders(localOrders);

      // 2. Tarik data realtime dari backend & otomatis sinkronkan dengan database SIMRS PostgreSQL
      const [fetchedMenu, fetchedOrders, simrsResult] = await Promise.all([
        realtimeService.getMenu().catch(() => realtimeService.getLocalMenu()),
        realtimeService.getOrders().catch(() => realtimeService.getLocalOrders()),
        realtimeService.fetchMenuFromSimrs().catch(() => null),
      ]);

      const validMenu = (simrsResult?.success && Array.isArray(simrsResult.data) && simrsResult.data.length > 0)
        ? realtimeService.getLocalMenu()
        : (Array.isArray(fetchedMenu) && fetchedMenu.length > 0 ? fetchedMenu : realtimeService.getLocalMenu());
      const validOrders = Array.isArray(fetchedOrders) ? fetchedOrders : realtimeService.getLocalOrders();

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

    // Auto-sync berkala setiap 30 detik untuk memastikan menu SIMRS selalu terupdate di layar pasien & admin
    const autoSyncInterval = setInterval(() => {
      realtimeService.fetchMenuFromSimrs().catch(() => {});
    }, 30000);

    // Failsafe timer: after 2000ms, guarantee loading screen dismissal
    const failsafeTimer = setTimeout(() => {
      setIsLoaded((current) => {
        if (!current) {
          setMenuItems(realtimeService.getLocalMenu());
          setOrders(realtimeService.getLocalOrders());
          return true;
        }
        return current;
      });
    }, 2000);

    return () => {
      clearInterval(autoSyncInterval);
      clearTimeout(failsafeTimer);
    };
  }, [loadData]);

  // Subscribe to real-time events (SSE & BroadcastChannel)
  useEffect(() => {
    const unsubscribe = realtimeService.subscribe((event) => {
      if (event.type === 'init') {
        if (Array.isArray(event.data?.orders) && event.data.orders.length > 0) {
          setOrders(event.data.orders);
        }
        if (Array.isArray(event.data?.menuItems) && event.data.menuItems.length > 0) {
          setMenuItems(event.data.menuItems);
        }
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
        const item: MenuItem = event.data?.item;
        const action: string = event.data?.action;
        
        if (!item || !item.id) return;

        if (action === 'delete') {
          setMenuItems((prev) => (prev || []).filter((m) => m && m.id !== item.id));
        } else if (action === 'create') {
          setMenuItems((prev) => {
            const list = (prev || []).filter(Boolean);
            if (list.some((m) => m.id === item.id)) return list;
            return [item, ...list];
          });
        } else {
          // update or toggle
          setMenuItems((prev) => (prev || []).map((m) => (m && m.id === item.id ? { ...m, ...item } : m)).filter(Boolean));
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

  // Admin access handlers
  const handleSelectAdminView = () => {
    if (isAdminAuthenticated) {
      setActiveView('admin');
    } else {
      setAdminPasswordInput('');
      setLoginError('');
      setShowAdminLoginModal(true);
    }
  };

  const handleAdminLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!adminPasswordInput.trim()) {
      setLoginError('Silakan masukkan kata sandi admin.');
      return;
    }

    if (adminPasswordInput.trim() === adminPassword) {
      setIsAdminAuthenticated(true);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('nutrihospital_admin_auth', 'true');
      }
      setShowAdminLoginModal(false);
      setAdminPasswordInput('');
      setLoginError('');
      setActiveView('admin');
      setToastMessage({
        title: 'Akses Admin Berhasil',
        desc: 'Selamat datang di Dashboard Admin NutriHospital.',
      });
      setTimeout(() => setToastMessage(null), 3000);
    } else {
      setLoginError('Kata sandi salah! Coba lagi (Kata sandi default: admin123)');
    }
  };

  const handleAdminLogout = () => {
    setIsAdminAuthenticated(false);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('nutrihospital_admin_auth');
    }
    setActiveView('patient');
    setToastMessage({
      title: 'Sesi Admin Dikunci',
      desc: 'Berhasil keluar dari Dashboard Admin.',
    });
    setTimeout(() => setToastMessage(null), 3000);
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
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/90 shadow-xs w-full">
        <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
          
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <HeartPulse className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-black text-slate-900 tracking-tight text-sm sm:text-base">
                  SiapMakan
                </span>
              </div>
              <div className="text-[11px] text-slate-500 font-medium hidden md:block">
                Pemesanan Makanan Pasien
              </div>
            </div>
          </div>

          {/* View Switcher Tabs: Responsive for mobile */}
          <div className="flex items-center bg-slate-100 p-0.5 sm:p-1 rounded-xl border border-slate-200 shrink-0">
            <button
              onClick={() => setActiveView('patient')}
              className={`px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 sm:gap-1.5 transition-all cursor-pointer ${
                activeView === 'patient'
                  ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="hidden sm:inline">Dashboard </span>
              <span>Pasien</span>
            </button>

            <button
              onClick={handleSelectAdminView}
              className={`px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 sm:gap-1.5 transition-all cursor-pointer relative ${
                activeView === 'admin'
                  ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isAdminAuthenticated ? (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              ) : (
                <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              )}
              <span className="hidden sm:inline">Dashboard </span>
              <span>Admin</span>
              {!isAdminAuthenticated && (
                <span className="text-[9px] bg-amber-100 text-amber-800 px-1 py-0.2 rounded font-semibold hidden md:inline-block">
                  Terkunci
                </span>
              )}
              {newOrdersCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
              )}
            </button>
          </div>

          {/* Utilities (Logout Admin, Audio, Help) */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">

            {/* Logout Admin Button when in Admin View */}
            {isAdminAuthenticated && activeView === 'admin' && (
              <button
                onClick={handleAdminLogout}
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Kunci & Keluar dari Dashboard Admin"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Kunci Admin</span>
              </button>
            )}
            
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

      {/* Admin Password Verification Modal */}
      {showAdminLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Autentikasi Admin</h3>
                  <p className="text-[11px] text-slate-500">Akses terbatas petugas Dapur Gizi</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAdminLoginModal(false);
                  setLoginError('');
                }}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdminLogin} className="py-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Kata Sandi Admin
                </label>
                <div className="relative">
                  <input
                    type={showPasswordText ? 'text' : 'password'}
                    value={adminPasswordInput}
                    onChange={(e) => {
                      setAdminPasswordInput(e.target.value);
                      if (loginError) setLoginError('');
                    }}
                    placeholder="Masukkan password admin..."
                    autoFocus
                    className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordText(!showPasswordText)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showPasswordText ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {loginError && (
                  <p className="text-[11px] font-semibold text-rose-600 mt-1.5 flex items-center gap-1">
                    <span>&bull;</span> {loginError}
                  </p>
                )}
              </div>

              {/* Password Hint Box */}
              <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex items-start gap-2 text-emerald-900 text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  Kata sandi default: <code className="font-bold bg-white px-1.5 py-0.5 rounded border border-emerald-300 text-emerald-800">admin123</code>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdminLoginModal(false);
                    setLoginError('');
                  }}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Buka Admin</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                    <li>Klik "Kirim Pesanan Sekarang" untuk memesan menu.</li>
                    <li>Pesanan otomatis diteruskan langsung ke sistem Dapur Gizi.</li>
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

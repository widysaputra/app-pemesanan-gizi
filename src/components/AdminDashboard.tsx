import React, { useState, useMemo } from 'react';
import { 
  MenuItem, 
  HospitalOrder, 
  OrderStatus, 
  MenuCategory,
  FonnteSettings,
  SimrsSettings 
} from '../types';
import { realtimeService } from '../services/api';
import { MenuEditModal } from './MenuEditModal';
import { 
  Utensils, 
  Plus, 
  Edit3, 
  Trash2, 
  Search, 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  MessageCircle, 
  ExternalLink, 
  Settings, 
  Send, 
  ShieldCheck, 
  AlertCircle, 
  RefreshCw, 
  SlidersHorizontal,
  Flame,
  Phone,
  Bed,
  Layers,
  Sparkles,
  Check,
  XCircle,
  Eye,
  EyeOff,
  Database,
  Copy,
  CheckCheck,
  Server,
  Code,
  FileCode,
  Table,
  UploadCloud,
  CheckCircle,
  UtensilsCrossed,
  BookOpen,
  Lock,
  KeyRound
} from 'lucide-react';
import {
  SQL_PESANAN_GIZI_TABLE,
  SQL_MASTER_MENU_TABLE,
  SQL_MMPI_TABLE,
  LARAVEL_ROUTES_CODE,
  LARAVEL_GIZI_CONTROLLER_CODE,
  JSON_PAYLOAD_EXAMPLES
} from '../data/simrsSnippets';

interface AdminDashboardProps {
  orders: HospitalOrder[];
  menuItems: MenuItem[];
  onUpdateStatus: (orderId: string, status: OrderStatus, note?: string) => Promise<void>;
  onToggleMenuItem: (menuId: string) => Promise<void>;
  onResetDemo?: () => Promise<void>;
}

type AdminTab = 'menu' | 'orders' | 'fonnte' | 'simrs';

const CATEGORY_LABELS: Record<string, string> = {
  all: 'Semua Kategori',
  makanan_utama: 'Makanan Pokok',
  lauk_hewani: 'Lauk Hewani',
  lauk_nabati: 'Lauk Nabati',
  sayuran: 'Sayuran',
  buah_snack: 'Buah & Snack',
  minuman: 'Minuman',
};

const STATUS_BADGES: Record<OrderStatus, { bg: string; text: string; label: string }> = {
  baru: { bg: 'bg-rose-50 text-rose-700 border-rose-200', text: 'text-rose-700', label: 'Pesanan Baru' },
  diproses: { bg: 'bg-amber-50 text-amber-700 border-amber-200', text: 'text-amber-700', label: 'Sedang Disiapkan' },
  diantar: { bg: 'bg-blue-50 text-blue-700 border-blue-200', text: 'text-blue-700', label: 'Sedang Diantar' },
  selesai: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', text: 'text-emerald-700', label: 'Selesai' },
  dibatalkan: { bg: 'bg-slate-100 text-slate-500 border-slate-200', text: 'text-slate-500', label: 'Dibatalkan' },
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  orders,
  menuItems,
  onUpdateStatus,
  onToggleMenuItem,
  onResetDemo,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('menu');
  
  // Menu Management States
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchMenuQuery, setSearchMenuQuery] = useState<string>('');
  const [editingMenuItem, setEditingMenuItem] = useState<MenuItem | null>(null);
  const [isMenuModalOpen, setIsMenuModalOpen] = useState<boolean>(false);
  const [quickPriceEditId, setQuickPriceEditId] = useState<string | null>(null);
  const [quickPriceValue, setQuickPriceValue] = useState<number>(0);

  // Orders Management States
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [searchOrderQuery, setSearchOrderQuery] = useState<string>('');

  // Fonnte Settings States
  const [fonnteToken, setFonnteToken] = useState<string>('');
  const [fonnteTarget, setFonnteTarget] = useState<string>('081234567890');
  const [sendToAdmin, setSendToAdmin] = useState<boolean>(true);
  const [sendToPatient, setSendToPatient] = useState<boolean>(true);
  const [showToken, setShowToken] = useState<boolean>(false);
  const [isFonnteLoaded, setIsFonnteLoaded] = useState<boolean>(false);
  const [fonnteNotice, setFonnteNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSavingFonnte, setIsSavingFonnte] = useState<boolean>(false);

  // Fonnte Test Tool
  const [testPhone, setTestPhone] = useState<string>('');
  const [isTestingFonnte, setIsTestingFonnte] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<any | null>(null);

  // SIMRS (PostgreSQL & Laravel API) Integration States
  const [simrsApiUrl, setSimrsApiUrl] = useState<string>('http://localhost:8000/api/save-pesanan-gizi');
  const [simrsApiKey, setSimrsApiKey] = useState<string>('');
  const [simrsAutoSync, setSimrsAutoSync] = useState<boolean>(true);
  const [isSimrsConfigured, setIsSimrsConfigured] = useState<boolean>(false);
  const [isSavingSimrs, setIsSavingSimrs] = useState<boolean>(false);
  const [simrsNotice, setSimrsNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isTestingSimrs, setIsTestingSimrs] = useState<boolean>(false);
  const [simrsTestResult, setSimrsTestResult] = useState<any | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [syncingOrderId, setSyncingOrderId] = useState<string | null>(null);
  const [orderSyncNotice, setOrderSyncNotice] = useState<{ id: string; success: boolean; text: string } | null>(null);
  const [activeSqlTab, setActiveSqlTab] = useState<'pesanan_gizi' | 'master_menu' | 'routes' | 'controller' | 'json_payload' | 'mmpi'>('pesanan_gizi');
  const [isSyncingMenu, setIsSyncingMenu] = useState<boolean>(false);
  const [menuSyncNotice, setMenuSyncNotice] = useState<{ success: boolean; text: string; count?: number; latency?: string } | null>(null);

  // Admin Password Management State
  const [currentAdminPassword, setCurrentAdminPassword] = useState<string>(() => {
    return (typeof window !== 'undefined' && localStorage.getItem('nutrihospital_admin_pwd')) || 'admin123';
  });
  const [newPasswordVal, setNewPasswordVal] = useState<string>('');
  const [confirmPasswordVal, setConfirmPasswordVal] = useState<string>('');
  const [pwdNotice, setPwdNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleUpdateAdminPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPasswordVal.trim()) {
      setPwdNotice({ type: 'error', text: 'Password baru tidak boleh kosong!' });
      return;
    }
    if (newPasswordVal.length < 4) {
      setPwdNotice({ type: 'error', text: 'Password minimal 4 karakter!' });
      return;
    }
    if (newPasswordVal !== confirmPasswordVal) {
      setPwdNotice({ type: 'error', text: 'Konfirmasi password baru tidak cocok!' });
      return;
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('nutrihospital_admin_pwd', newPasswordVal.trim());
    }
    setCurrentAdminPassword(newPasswordVal.trim());
    setNewPasswordVal('');
    setConfirmPasswordVal('');
    setPwdNotice({ type: 'success', text: 'Kata sandi admin berhasil diperbarui!' });
    setTimeout(() => setPwdNotice(null), 4000);
  };

  // Load Fonnte & SIMRS Config on mount
  React.useEffect(() => {
    const fetchConfigs = async () => {
      try {
        const config = await realtimeService.getFonnteConfig();
        if (config) {
          setFonnteTarget(config.targetNumber || '081234567890');
          setSendToAdmin(config.sendToAdmin !== false);
          setSendToPatient(config.sendToPatient !== false);
          setIsFonnteLoaded(true);
        }
      } catch (err) {
        console.warn('Could not fetch Fonnte config', err);
      }

      try {
        const simrsConfig = await realtimeService.getSimrsConfig();
        if (simrsConfig) {
          if (simrsConfig.apiUrl) setSimrsApiUrl(simrsConfig.apiUrl);
          setSimrsAutoSync(simrsConfig.autoSyncOnOrder !== false);
          setIsSimrsConfigured(simrsConfig.isConfigured);
        }
      } catch (err) {
        console.warn('Could not fetch SIMRS config', err);
      }
    };
    fetchConfigs();
  }, []);

  // Filtered Menu Items
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchCat = selectedCategory === 'all' || item.category === selectedCategory;
      const matchQuery = item.name.toLowerCase().includes(searchMenuQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchMenuQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [menuItems, selectedCategory, searchMenuQuery]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchStatus = orderStatusFilter === 'all' || order.status === orderStatusFilter;
      const matchSearch = order.roomName.toLowerCase().includes(searchOrderQuery.toLowerCase()) ||
        order.patientName.toLowerCase().includes(searchOrderQuery.toLowerCase()) ||
        order.phoneNumber.includes(searchOrderQuery) ||
        order.orderNumber.toLowerCase().includes(searchOrderQuery.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [orders, orderStatusFilter, searchOrderQuery]);

  // Handlers for Menu Management
  const handleOpenAddMenu = () => {
    setEditingMenuItem(null);
    setIsMenuModalOpen(true);
  };

  const handleOpenEditMenu = (item: MenuItem) => {
    setEditingMenuItem(item);
    setIsMenuModalOpen(true);
  };

  const handleSaveMenuItem = async (itemData: Partial<MenuItem>) => {
    if (editingMenuItem) {
      await realtimeService.updateMenuItem(editingMenuItem.id, itemData);
    } else {
      await realtimeService.addMenuItem(itemData);
    }
  };

  const handleDeleteMenuItem = async (id: string, name: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus menu "${name}"?`)) {
      await realtimeService.deleteMenuItem(id);
    }
  };

  const handleStartQuickPrice = (item: MenuItem) => {
    setQuickPriceEditId(item.id);
    setQuickPriceValue(item.price || 0);
  };

  const handleSaveQuickPrice = async (id: string) => {
    await realtimeService.updateMenuItem(id, { price: quickPriceValue });
    setQuickPriceEditId(null);
  };

  // Handlers for Fonnte Settings
  const handleSaveFonnteSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingFonnte(true);
    setFonnteNotice(null);
    try {
      const payload: any = {
        targetNumber: fonnteTarget,
        sendToAdmin,
        sendToPatient,
      };
      if (fonnteToken.trim()) {
        payload.token = fonnteToken.trim();
      }
      await realtimeService.saveFonnteConfig(payload);
      setFonnteNotice({
        type: 'success',
        text: 'Pengaturan WhatsApp Fonnte berhasil disimpan & diaktifkan!',
      });
      setFonnteToken('');
    } catch (err: any) {
      setFonnteNotice({
        type: 'error',
        text: err.message || 'Gagal menyimpan konfigurasi Fonnte.',
      });
    } finally {
      setIsSavingFonnte(false);
    }
  };

  const handleTestFonnte = async () => {
    if (!testPhone.trim() && !fonnteTarget.trim()) {
      alert('Masukkan nomor WhatsApp tujuan uji coba');
      return;
    }
    setIsTestingFonnte(true);
    setTestResult(null);
    try {
      const phoneToTest = testPhone.trim() || fonnteTarget.trim();
      const res = await realtimeService.testFonnteWhatsApp(phoneToTest, fonnteToken.trim() || undefined);
      setTestResult({ success: true, message: res.message, data: res.data });
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setIsTestingFonnte(false);
    }
  };

  // Handlers for SIMRS Integration (PostgreSQL + Laravel)
  const handleSaveSimrsSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSimrs(true);
    setSimrsNotice(null);
    try {
      const payload: any = {
        apiUrl: simrsApiUrl.trim(),
        autoSyncOnOrder: simrsAutoSync,
      };
      if (simrsApiKey.trim()) {
        payload.apiKey = simrsApiKey.trim();
      }
      const res = await realtimeService.saveSimrsConfig(payload);
      setIsSimrsConfigured(res.config?.isConfigured || Boolean(simrsApiUrl.trim()));
      setSimrsNotice({
        type: 'success',
        text: 'Konfigurasi API SIMRS (PostgreSQL) berhasil disimpan & aktif!',
      });
      setSimrsApiKey('');
    } catch (err: any) {
      setSimrsNotice({
        type: 'error',
        text: err.message || 'Gagal menyimpan konfigurasi SIMRS.',
      });
    } finally {
      setIsSavingSimrs(false);
    }
  };

  const handleTestSimrs = async () => {
    if (!simrsApiUrl.trim()) {
      alert('Masukkan URL Endpoint API Laravel SIMRS Anda');
      return;
    }
    setIsTestingSimrs(true);
    setSimrsTestResult(null);
    try {
      const res = await realtimeService.testSimrsConnection(simrsApiUrl.trim(), simrsApiKey.trim() || undefined);
      setSimrsTestResult({
        success: true,
        message: res.message,
        latency: res.latency,
        data: res.data,
        sentPayload: res.sentPayload,
      });
    } catch (err: any) {
      setSimrsTestResult({
        success: false,
        message: err.message || 'Koneksi ke endpoint Laravel SIMRS gagal.',
      });
    } finally {
      setIsTestingSimrs(false);
    }
  };

  const handleSyncSingleOrder = async (orderId: string) => {
    setSyncingOrderId(orderId);
    setOrderSyncNotice(null);
    try {
      const res = await realtimeService.syncOrderToSimrs(orderId);
      setOrderSyncNotice({
        id: orderId,
        success: true,
        text: 'Pesanan berhasil disinkronkan ke SIMRS (PostgreSQL)!',
      });
    } catch (err: any) {
      setOrderSyncNotice({
        id: orderId,
        success: false,
        text: err.message || 'Gagal menyimpan ke SIMRS',
      });
    } finally {
      setSyncingOrderId(null);
    }
  };

  const handleSyncAllMenuToSimrs = async () => {
    setIsSyncingMenu(true);
    setMenuSyncNotice(null);
    try {
      // Determine menu sync URL
      let targetUrl = simrsApiUrl.trim();
      if (targetUrl.includes('save-pesanan-gizi') || targetUrl.includes('save-data-mmpi')) {
        targetUrl = targetUrl.replace(/save-(pesanan-gizi|data-mmpi)/, 'sync-batch-menu');
      }
      const res = await realtimeService.syncAllMenuToSimrs(targetUrl, simrsApiKey.trim() || undefined);
      setMenuSyncNotice({
        success: true,
        text: res.message || `Berhasil menyinkronkan ${menuItems.length} item master menu ke database SIMRS!`,
        count: res.totalSynced || menuItems.length,
        latency: res.latency,
      });
    } catch (err: any) {
      setMenuSyncNotice({
        success: false,
        text: err.message || 'Gagal menyinkronkan master menu ke SIMRS. Pastikan endpoint Laravel aktif.',
      });
    } finally {
      setIsSyncingMenu(false);
    }
  };

  const handleCopyText = (text: string, sectionId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionId);
    setTimeout(() => {
      setCopiedSection(null);
    }, 2500);
  };

  const newOrdersCount = orders.filter((o) => o.status === 'baru').length;

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Tab Navigation */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-900 text-white">
              ADMINISTRATOR
            </span>
            <span className="text-xs text-slate-500 font-medium">Instalasi Gizi RS</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 mt-1">
            Dashboard Manajemen Menu &amp; Integrasi WhatsApp
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Atur ketersediaan menu, ubah harga satuan (Rp), pantau pesanan kamar, dan hubungkan Fonnte WhatsApp Gateway.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center bg-slate-100 p-1.5 rounded-xl border border-slate-200 shrink-0">
          <button
            onClick={() => setActiveTab('menu')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'menu'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Utensils className="w-4 h-4 text-emerald-600" />
            <span>Kelola Menu &amp; Harga</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-mono">
              {menuItems.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer relative ${
              activeTab === 'orders'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-4 h-4 text-blue-600" />
            <span>Pesanan Masuk</span>
            {newOrdersCount > 0 ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500 text-white font-mono font-bold animate-pulse">
                {newOrdersCount} Baru
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-mono">
                {orders.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('fonnte')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'fonnte'
                ? 'bg-white text-emerald-700 shadow-xs ring-1 ring-emerald-300'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageCircle className="w-4 h-4 text-emerald-600" />
            <span>Integrasi Fonnte</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </button>

          <button
            onClick={() => setActiveTab('simrs')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'simrs'
                ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-indigo-300'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Database className="w-4 h-4 text-indigo-600" />
            <span>Database SIMRS (Postgre)</span>
            <span className={`w-2 h-2 rounded-full ${isSimrsConfigured ? 'bg-indigo-500' : 'bg-slate-300'}`}></span>
          </button>
        </div>
      </div>

      {/* ========================================================
          TAB 1: KELOLA MENU & ATUR HARGA
          ======================================================== */}
      {activeTab === 'menu' && (
        <div className="space-y-4">
          
          {/* Menu Action Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            
            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchMenuQuery}
                onChange={(e) => setSearchMenuQuery(e.target.value)}
                placeholder="Cari menu makanan..."
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
              {Object.entries(CATEGORY_LABELS).map(([catKey, label]) => (
                <button
                  key={catKey}
                  onClick={() => setSelectedCategory(catKey)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                    selectedCategory === catKey
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Add New Menu Button */}
            <button
              onClick={handleOpenAddMenu}
              className="w-full md:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Menu Baru</span>
            </button>
          </div>

          {/* Menu Cards Grid - 2 Kolom di HP agar tidak terlalu ke bawah */}
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
            {filteredMenuItems.map((item) => (
              <div
                key={item.id}
                className={`bg-white rounded-xl sm:rounded-2xl border transition-all overflow-hidden flex flex-col justify-between ${
                  item.isAvailable
                    ? 'border-slate-200 hover:shadow-md'
                    : 'border-rose-200 bg-rose-50/20 opacity-80'
                }`}
              >
                <div>
                  {/* Photo & Badge */}
                  <div className="relative h-28 sm:h-40 w-full bg-slate-100 overflow-hidden">
                    <img
                      src={item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80'}
                      alt={item.name}
                      className={`w-full h-full object-cover transition-transform duration-300 hover:scale-105 ${
                        !item.isAvailable ? 'grayscale' : ''
                      }`}
                    />
                    
                    {/* Availability Badge */}
                    <div className="absolute top-1.5 right-1.5 sm:top-2.5 sm:right-2.5">
                      <button
                        onClick={() => onToggleMenuItem(item.id)}
                        className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-bold shadow-xs cursor-pointer transition-colors flex items-center gap-1 ${
                          item.isAvailable
                            ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                            : 'bg-rose-500 text-white hover:bg-rose-600'
                        }`}
                        title="Klik untuk mengubah status ketersediaan"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                        <span>{item.isAvailable ? 'Tersedia' : 'Habis'}</span>
                      </button>
                    </div>

                    {/* Category Label */}
                    <div className="absolute bottom-1.5 left-1.5 sm:bottom-2.5 sm:left-2.5">
                      <span className="px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold bg-black/60 text-white backdrop-blur-xs">
                        {CATEGORY_LABELS[item.category] || item.category}
                      </span>
                    </div>
                  </div>

                  {/* Menu Information */}
                  <div className="p-2.5 sm:p-4 space-y-1 sm:space-y-2">
                    <div className="flex items-start justify-between gap-1">
                      <h4 className="font-bold text-slate-900 text-xs sm:text-sm leading-snug line-clamp-2 min-h-[2rem] sm:min-h-0" title={item.name}>
                        {item.name}
                      </h4>
                    </div>

                    <p className="text-[10px] sm:text-xs text-slate-500 line-clamp-1 sm:line-clamp-2 leading-relaxed">
                      {item.description || 'Tidak ada deskripsi khusus.'}
                    </p>

                    {/* Calories & Macro stats */}
                    <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-[10px] sm:text-[11px] text-slate-600 pt-0.5">
                      <span className="flex items-center gap-0.5 font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                        <Flame className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        {item.calories} kkal
                      </span>
                      <span className="text-slate-400 hidden sm:inline">&bull;</span>
                      <span className="text-[10px] sm:text-xs text-slate-500">P:{item.protein}g</span>
                      <span className="text-[10px] sm:text-xs text-slate-500">K:{item.carbs}g</span>
                    </div>
                  </div>
                </div>

                {/* Card Footer: Price & Actions */}
                <div className="p-2 sm:px-4 sm:py-3 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-2">
                  
                  {/* Price with Quick Edit */}
                  <div className="min-w-0 flex-1">
                    {quickPriceEditId === item.id ? (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] sm:text-xs font-bold text-slate-500">Rp</span>
                        <input
                          type="number"
                          value={quickPriceValue}
                          onChange={(e) => setQuickPriceValue(Number(e.target.value))}
                          className="w-16 sm:w-20 px-1 py-0.5 text-[11px] sm:text-xs font-bold border border-emerald-500 rounded bg-white"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveQuickPrice(item.id)}
                          className="p-1 text-emerald-600 hover:bg-emerald-100 rounded cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setQuickPriceEditId(null)}
                          className="p-1 text-slate-400 hover:bg-slate-200 rounded cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => handleStartQuickPrice(item)}
                        className="group cursor-pointer flex items-center gap-1"
                        title="Klik untuk ubah harga cepat"
                      >
                        <div className="text-[9px] sm:text-xs text-slate-400 font-medium">Harga:</div>
                        <div className="text-xs sm:text-sm font-black text-emerald-700 truncate">
                          {item.price > 0 ? `Rp ${item.price.toLocaleString('id-ID')}` : 'Gratis'}
                        </div>
                        <Edit3 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-300 group-hover:text-emerald-600 transition-colors shrink-0" />
                      </div>
                    )}
                  </div>

                  {/* Actions (Edit & Delete) */}
                  <div className="flex items-center justify-end gap-1 border-t sm:border-t-0 pt-1 sm:pt-0 border-slate-200/60">
                    <button
                      onClick={() => handleOpenEditMenu(item)}
                      className="p-1 sm:p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                      title="Edit Detail Menu & Foto"
                    >
                      <Edit3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteMenuItem(item.id, item.name)}
                      className="p-1 sm:p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                      title="Hapus Menu"
                    >
                      <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  </div>

                </div>

              </div>
            ))}
          </div>

          {filteredMenuItems.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2">
              <Utensils className="w-8 h-8 text-slate-300 mx-auto" />
              <h4 className="font-bold text-slate-700 text-sm">Tidak ada menu yang sesuai</h4>
              <p className="text-xs text-slate-500">Coba ubah kata kunci pencarian atau kategori filter.</p>
            </div>
          )}

        </div>
      )}

      {/* ========================================================
          TAB 2: PESANAN MASUK PASIEN
          ======================================================== */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          
          {/* Orders Filter Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchOrderQuery}
                onChange={(e) => setSearchOrderQuery(e.target.value)}
                placeholder="Cari kamar, pasien, atau no. pesanan..."
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
              {['all', 'baru', 'diproses', 'diantar', 'selesai', 'dibatalkan'].map((st) => (
                <button
                  key={st}
                  onClick={() => setOrderStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize whitespace-nowrap transition-colors cursor-pointer ${
                    orderStatusFilter === st
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st === 'all' ? 'Semua Status' : st}
                </button>
              ))}
            </div>
          </div>

          {/* Orders Cards List */}
          <div className="space-y-3">
            {filteredOrders.map((order) => {
              const statusInfo = STATUS_BADGES[order.status] || STATUS_BADGES.baru;
              
              // Clean phone for WhatsApp Web direct link
              const cleanPhone = order.phoneNumber.replace(/[^0-9]/g, '');
              const waTarget = cleanPhone.startsWith('0') ? `62${cleanPhone.slice(1)}` : cleanPhone;
              const waChatUrl = `https://wa.me/${waTarget}`;

              return (
                <div
                  key={order.id}
                  className={`bg-white rounded-2xl border transition-all p-5 shadow-xs ${
                    order.status === 'baru'
                      ? 'border-rose-300 ring-2 ring-rose-100'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-100">
                    
                    {/* Left: Room, Patient & Contact */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-slate-900 text-white flex items-center gap-1">
                          <Bed className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{order.roomName}</span>
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-500">
                          {order.orderNumber}
                        </span>
                        <span className="font-mono text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 flex items-center gap-1">
                          <Database className="w-3 h-3 text-indigo-500" />
                          <span>{order.registrationNo || 'No. Reg: -'}</span>
                        </span>
                        <span className="text-xs text-slate-400">&bull;</span>
                        <span className="text-xs text-slate-500">
                          {new Date(order.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                        </span>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          Makan {order.mealTime}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 pt-1">
                        <span className="font-bold text-slate-900 text-sm">
                          {order.patientName}
                        </span>
                        <a
                          href={waChatUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-lg transition-colors"
                          title="Klik untuk chat WhatsApp pasien langsung"
                        >
                          <Phone className="w-3 h-3" />
                          <span>{order.phoneNumber}</span>
                          <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                        </a>
                      </div>
                    </div>

                    {/* Right: Order Status Selector */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-medium">Status:</span>
                        <select
                          value={order.status}
                          onChange={(e) => onUpdateStatus(order.id, e.target.value as OrderStatus)}
                          className={`text-xs font-bold px-3 py-1.5 rounded-xl border cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 ${statusInfo.bg}`}
                        >
                          <option value="baru">Baru</option>
                          <option value="diproses">Sedang Disiapkan</option>
                          <option value="diantar">Sedang Diantar</option>
                          <option value="selesai">Selesai Diterima</option>
                          <option value="dibatalkan">Dibatalkan</option>
                        </select>
                      </div>
                    </div>

                  </div>

                  {/* Order Items Detail */}
                  <div className="py-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Daftar Menu Dipesan:
                      </div>
                      <div className="space-y-1.5">
                        {order.items.map((it, idx) => (
                          <div key={idx} className="text-xs text-slate-700 flex justify-between items-center bg-slate-50 px-2.5 py-1.5 rounded-lg">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900">{it.portion}x</span>
                              <span>{it.name}</span>
                            </div>
                            <span className="font-mono text-slate-600 font-medium">
                              Rp {(it.price * it.portion).toLocaleString('id-ID')}
                            </span>
                          </div>
                        ))}
                      </div>

                      {order.patientNotes && (
                        <div className="mt-2 text-xs text-amber-800 bg-amber-50/80 p-2 rounded-lg border border-amber-200/60">
                          <strong>Catatan Pasien:</strong> "{order.patientNotes}"
                        </div>
                      )}
                    </div>

                    {/* Total & WhatsApp Delivery Log */}
                    <div className="flex flex-col justify-between space-y-2 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                      <div>
                        <div className="flex justify-between items-center text-xs text-slate-600">
                          <span>Total Kalori:</span>
                          <span className="font-bold text-amber-600">{order.totalCalories} kkal</span>
                        </div>
                        <div className="flex justify-between items-center pt-1 mt-1 border-t border-slate-200">
                          <span className="text-xs font-bold text-slate-900">Total Biaya Menu:</span>
                          <span className="text-base font-black text-emerald-700">
                            Rp {order.totalPrice.toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>

                      {/* WhatsApp Delivery Status Badge */}
                      <div className="pt-2 border-t border-slate-200 text-xs flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-emerald-800">
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="text-[11px] font-semibold truncate">
                            {order.whatsappNotification?.statusText || 'Status WhatsApp: Disiapkan'}
                          </span>
                        </div>
                        <a
                          href={waChatUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-bold text-emerald-700 hover:underline shrink-0"
                        >
                          Kirim WA Ulang &rarr;
                        </a>
                      </div>

                      {/* SIMRS PostgreSQL Sync Status Badge */}
                      <div className="pt-1.5 border-t border-slate-200 text-xs flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-indigo-900">
                          <Database className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span className="text-[11px] font-semibold truncate">
                            {order.simrsSync?.synced ? 'Tersimpan di SIMRS (PostgreSQL)' : (order.simrsSync?.statusText || 'SIMRS: Belum disinkron')}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSyncSingleOrder(order.id)}
                          disabled={syncingOrderId === order.id}
                          className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 hover:underline shrink-0 cursor-pointer disabled:opacity-50"
                        >
                          {syncingOrderId === order.id ? 'Menyimpan...' : (order.simrsSync?.synced ? 'Sync Ulang' : 'Kirim ke SIMRS &rarr;')}
                        </button>
                      </div>

                      {orderSyncNotice?.id === order.id && (
                        <div className={`text-[10px] px-2 py-1 rounded font-semibold ${
                          orderSyncNotice.success ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {orderSyncNotice.text}
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              );
            })}
          </div>

          {filteredOrders.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2">
              <Clock className="w-8 h-8 text-slate-300 mx-auto" />
              <h4 className="font-bold text-slate-700 text-sm">Belum ada pesanan yang sesuai</h4>
              <p className="text-xs text-slate-500">Pesanan yang dikirim oleh pasien akan langsung muncul di sini secara real-time.</p>
            </div>
          )}

        </div>
      )}

      {/* ========================================================
          TAB 3: INTEGRASI WHATSAPP FONNTE
          ======================================================== */}
      {activeTab === 'fonnte' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left 2 Cols: Settings Form & Instructions */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* Guide Card */}
            <div className="bg-gradient-to-br from-emerald-900 to-teal-950 text-white rounded-2xl p-5 shadow-md space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-300">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Panduan Integrasi WhatsApp Fonnte</h3>
                  <p className="text-xs text-emerald-200">Gateway WhatsApp Resmi &amp; Otomatis untuk Notifikasi Pesanan Pasien</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 text-xs">
                <div className="bg-white/10 p-3 rounded-xl border border-white/10">
                  <div className="font-bold text-emerald-300 mb-1">1. Buat Akun Fonnte</div>
                  <p className="text-slate-200 text-[11px] leading-relaxed">
                    Kunjungi <a href="https://fonnte.com" target="_blank" rel="noreferrer" className="underline text-emerald-300 font-bold">fonnte.com</a> dan daftar akun gratis.
                  </p>
                </div>
                <div className="bg-white/10 p-3 rounded-xl border border-white/10">
                  <div className="font-bold text-emerald-300 mb-1">2. Scan WhatsApp</div>
                  <p className="text-slate-200 text-[11px] leading-relaxed">
                    Masuk ke menu <strong>Device</strong> di Fonnte lalu scan QR WhatsApp Rumah Sakit / Dapur.
                  </p>
                </div>
                <div className="bg-white/10 p-3 rounded-xl border border-white/10">
                  <div className="font-bold text-emerald-300 mb-1">3. Salin Token API</div>
                  <p className="text-slate-200 text-[11px] leading-relaxed">
                    Salin <strong>Token</strong> yang ada di dashboard Fonnte lalu tempelkan pada kolom formulir di bawah.
                  </p>
                </div>
              </div>
            </div>

            {/* Fonnte Configuration Form */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Konfigurasi Token Fonnte</h4>
                  <p className="text-xs text-slate-500">Kredensial disimpan aman di server backend untuk mengirim pesan WhatsApp.</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 font-bold">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Fonnte API v1</span>
                </div>
              </div>

              {fonnteNotice && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  fonnteNotice.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{fonnteNotice.text}</span>
                </div>
              )}

              <form onSubmit={handleSaveFonnteSettings} className="space-y-4">
                {/* Token Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Token API Fonnte
                  </label>
                  <div className="relative">
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={fonnteToken}
                      onChange={(e) => setFonnteToken(e.target.value)}
                      placeholder="Masukkan token Fonnte (contoh: aB12cDeF34gH56...)"
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    >
                      {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Token ini digunakan untuk mengirim pesan otomatis saat pasien menekan tombol pesan.
                  </p>
                </div>

                {/* Target Number */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nomor WhatsApp Tujuan Dapur / Staf Gizi RS
                  </label>
                  <input
                    type="text"
                    value={fonnteTarget}
                    onChange={(e) => setFonnteTarget(e.target.value)}
                    placeholder="Contoh: 08123456789 atau 628123456789"
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Setiap ada pasien memesan menu, pesan rincian pesanan akan langsung dikirimkan ke nomor WhatsApp ini.
                  </p>
                </div>

                {/* Options */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sendToAdmin}
                      onChange={(e) => setSendToAdmin(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="font-semibold">Kirim notifikasi otomatis ke WhatsApp Dapur / Petugas Gizi</span>
                  </label>
                  <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sendToPatient}
                      onChange={(e) => setSendToPatient(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="font-semibold">Kirim juga salinan konfirmasi ke WhatsApp Pasien Pemesan</span>
                  </label>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingFonnte}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>{isSavingFonnte ? 'Menyimpan...' : 'Simpan Pengaturan Fonnte'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Test WhatsApp Delivery Console */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-emerald-600" />
                <h4 className="font-bold text-slate-900 text-sm">Uji Coba Pengiriman Pesan WhatsApp (Live Test)</h4>
              </div>
              <p className="text-xs text-slate-500">
                Kirimkan pesan uji coba langsung ke nomor WhatsApp Anda untuk memverifikasi apakah akun Fonnte sudah aktif dan terhubung dengan benar.
              </p>

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <input
                  type="text"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder={`Nomor penerima (default: ${fonnteTarget})`}
                  className="flex-1 px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  onClick={handleTestFonnte}
                  disabled={isTestingFonnte}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0 flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isTestingFonnte ? 'Mengirim...' : 'Kirim Pesan Tes'}</span>
                </button>
              </div>

              {testResult && (
                <div className={`p-3 rounded-xl text-xs font-mono space-y-1 ${
                  testResult.success
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border border-rose-200 text-rose-800'
                }`}>
                  <div className="font-bold">
                    {testResult.success ? '✅ Berhasil!' : '❌ Gagal:'} {testResult.message}
                  </div>
                  {testResult.data && (
                    <pre className="text-[10px] overflow-x-auto pt-1 text-slate-700 bg-white/70 p-2 rounded">
                      {JSON.stringify(testResult.data, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>

            {/* Admin Password Management Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Keamanan &amp; Kata Sandi Akun Admin</h4>
                    <p className="text-xs text-slate-500">Atur kata sandi yang digunakan untuk membuka Dashboard Admin.</p>
                  </div>
                </div>
                <div className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 flex items-center gap-1.5">
                  <Lock className="w-3 h-3 text-emerald-600" />
                  <span>Proteksi Sandi Aktif</span>
                </div>
              </div>

              {pwdNotice && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  pwdNotice.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border border-rose-200 text-rose-800'
                }`}>
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>{pwdNotice.text}</span>
                </div>
              )}

              <form onSubmit={handleUpdateAdminPassword} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Kata Sandi Baru
                    </label>
                    <input
                      type="password"
                      value={newPasswordVal}
                      onChange={(e) => setNewPasswordVal(e.target.value)}
                      placeholder="Masukkan kata sandi baru..."
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Ulangi Kata Sandi Baru
                    </label>
                    <input
                      type="password"
                      value={confirmPasswordVal}
                      onChange={(e) => setConfirmPasswordVal(e.target.value)}
                      placeholder="Konfirmasi kata sandi baru..."
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] text-slate-500">
                    Kata sandi saat ini: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-700">{currentAdminPassword}</code>
                  </span>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Perbarui Kata Sandi</span>
                  </button>
                </div>
              </form>
            </div>

          </div>

          {/* Right Col: Live WhatsApp Message Template Preview */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                <h4 className="font-bold text-slate-900 text-sm">Pratinjau Format Pesan WhatsApp</h4>
              </div>
              <p className="text-xs text-slate-500">
                Pesan WhatsApp yang dikirimkan ke Fonnte otomatis memuat informasi lengkap: Nama Kamar, Menu yang Dipesan, No. Telepon, dan Total Biaya.
              </p>

              {/* Mock WhatsApp Chat Bubble */}
              <div className="bg-[#EFEAE2] p-4 rounded-2xl border border-slate-300 shadow-inner">
                <div className="bg-white p-3.5 rounded-2xl rounded-tl-xs shadow-xs text-xs space-y-2 text-slate-800 font-sans leading-relaxed">
                  <div className="font-bold text-emerald-700">🏥 PESANAN MENU RUMAH SAKIT</div>
                  <div className="border-b border-slate-200 pb-1 text-[11px] space-y-0.5">
                    <div>🚪 <strong>Nama Kamar:</strong> Kamar Mawar 201 - Bed 01</div>
                    <div>👤 <strong>Nama Pasien:</strong> Ny. Siti Rahmawati</div>
                    <div>📱 <strong>No. Telepon:</strong> 081298765432</div>
                    <div>🍽️ <strong>Waktu Makan:</strong> Makan SIANG</div>
                    <div>🔖 <strong>No. Pesanan:</strong> GZ-20260908-01</div>
                  </div>

                  <div className="text-[11px] space-y-1">
                    <div className="font-bold text-slate-900">📋 DAFTAR MENU YANG DIPESAN:</div>
                    <div className="pl-1 text-slate-700">1. Nasi Putih Pulen Organik x 1 porsi</div>
                    <div className="pl-1 text-slate-700">2. Ayam Panggang Bumbu Kuning x 1 porsi</div>
                    <div className="pl-1 text-slate-700">3. Sayur Bening Bayam Jagung x 1 porsi</div>
                  </div>

                  <div className="border-t border-slate-200 pt-1 text-[11px] space-y-0.5">
                    <div>💰 <strong>Total Tagihan:</strong> <span className="text-emerald-700 font-bold">Rp 37.000</span></div>
                    <div>🔥 <strong>Total Kalori:</strong> 405 kkal</div>
                    <div>📝 <strong>Catatan:</strong> "Kuah sayur hangat, tanpa pedas"</div>
                  </div>

                  <div className="text-[9px] text-slate-400 text-right pt-1">
                    12:30 WIB &bull; Terkirim via NutriHospital Fonnte
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl text-[11px] text-slate-600 border border-slate-200 space-y-1">
                <div className="font-bold text-slate-800">💡 Tips Implementasi Mudah:</div>
                <p>
                  Jika token Fonnte belum dimasukkan, sistem NutriHospital menyediakan tombol otomatis <em>"Kirim via WhatsApp (wa.me)"</em> di layar pasien sehingga pemesanan tetap berjalan mulus 100%!
                </p>
              </div>

              {onResetDemo && (
                <div className="pt-2">
                  <button
                    onClick={onResetDemo}
                    className="w-full py-2 px-3 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 font-semibold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reset Data Menu &amp; Pesanan Demo</span>
                  </button>
                </div>
              )}

            </div>
          </div>

        </div>
      )}

      {/* ========================================================
          TAB 4: INTEGRASI DATABASE SIMRS (POSTGRESQL & LARAVEL)
          ======================================================== */}
      {activeTab === 'simrs' && (
        <div className="space-y-6">

          {/* SIMRS Hero Info Card */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-indigo-900/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1.5 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Database &amp; EMR Integration
                </span>
                <span className="text-xs text-indigo-200">PostgreSQL + Laravel Controller</span>
              </div>
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-400" />
                <span>Integrasi Database SIMRS &amp; API Laravel Gizi</span>
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Tersedia 2 API utama untuk SIMRS: <strong className="text-indigo-200">1. API Simpan Pesanan Gizi Pasien</strong> (<code className="text-indigo-300 font-mono">/api/save-pesanan-gizi</code>) ke tabel <code className="text-indigo-300 font-mono">pesanan_gizi_t</code> dan <strong className="text-indigo-200">2. API Master Data Menu Gizi</strong> (<code className="text-indigo-300 font-mono">/api/save-master-menu</code> &amp; <code className="text-indigo-300 font-mono">/api/sync-batch-menu</code>) ke tabel <code className="text-indigo-300 font-mono">master_menu_gizi_m</code>.
              </p>
            </div>

            <div className="flex flex-wrap md:flex-col gap-2 shrink-0">
              <div className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-xs border border-white/10 text-xs flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isSimrsConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></div>
                <span className="text-slate-200 font-semibold">
                  {isSimrsConfigured ? 'Endpoint Terhubung' : 'Belum Dikonfigurasi'}
                </span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-xs border border-white/10 text-xs flex items-center gap-2 text-indigo-200">
                <Table className="w-3.5 h-3.5" />
                <span>PostgreSQL JSONB Ready</span>
              </div>
            </div>
          </div>

          {/* 2 Feature Cards: API Pesanan Gizi & API Master Menu */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Card 1: API Simpan Pesanan Gizi */}
            <div className="bg-white rounded-2xl border border-indigo-100 p-5 shadow-xs flex flex-col justify-between space-y-3 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-full -z-0"></div>
              <div className="relative z-10 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
                    <UtensilsCrossed className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Modul Pemesanan Pasien</span>
                    <h4 className="text-sm font-black text-slate-900">API Simpan Pesanan Gizi</h4>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Menyimpan nomor pesanan, nomor registrasi pasien, nomor kamar, waktu makan (pagi/siang/malam), serta rincian makanan dan kalori.
                </p>
                <div className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200 font-mono text-[11px]">
                  <div className="text-slate-500">Route Laravel: <span className="text-emerald-700 font-bold">POST /api/save-pesanan-gizi</span></div>
                  <div className="text-slate-500">Tabel DB: <span className="text-indigo-700 font-bold">pesanan_gizi_t (PostgreSQL)</span></div>
                  <div className="text-slate-500">Method: <span className="text-slate-800">GiziSIMRSController@simpanPesananGizi</span></div>
                </div>
              </div>

              <div className="relative z-10 pt-2 flex items-center justify-between border-t border-slate-100 text-xs">
                <span className="text-slate-500">Status Auto-Sync:</span>
                <span className={`font-bold px-2 py-0.5 rounded-md ${simrsAutoSync ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                  {simrsAutoSync ? 'Aktif Saat Pasien Pesan' : 'Manual Sync'}
                </span>
              </div>
            </div>

            {/* Card 2: API Simpan Master Data Menu */}
            <div className="bg-white rounded-2xl border border-emerald-100 p-5 shadow-xs flex flex-col justify-between space-y-3 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -z-0"></div>
              <div className="relative z-10 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Modul Master Data Dapur</span>
                    <h4 className="text-sm font-black text-slate-900">API Simpan Master Data Menu Gizi</h4>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Menyimpan katalog menu RS beserta harga, kalori, makronutrisi (protein, karbo, lemak, natrium), jadwal makan, dan status ketersediaan.
                </p>
                <div className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200 font-mono text-[11px]">
                  <div className="text-slate-500">Route Laravel: <span className="text-emerald-700 font-bold">POST /api/save-master-menu</span> / <span className="text-emerald-700 font-bold">/sync-batch-menu</span></div>
                  <div className="text-slate-500">Tabel DB: <span className="text-indigo-700 font-bold">master_menu_gizi_m (PostgreSQL)</span></div>
                  <div className="text-slate-500">Method: <span className="text-slate-800">GiziSIMRSController@syncBatchMenu</span></div>
                </div>
              </div>

              {/* Action Button: Sync All Master Menus to SIMRS */}
              <div className="relative z-10 pt-2 border-t border-slate-100 space-y-2">
                <button
                  type="button"
                  onClick={handleSyncAllMenuToSimrs}
                  disabled={isSyncingMenu}
                  className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingMenu ? 'animate-spin' : ''}`} />
                  <span>{isSyncingMenu ? 'Menyinkronkan Menu...' : `Kirim & Sinkronkan Seluruh ${menuItems.length} Master Menu ke SIMRS`}</span>
                </button>

                {menuSyncNotice && (
                  <div className={`p-2.5 rounded-xl text-xs flex items-start gap-2 ${
                    menuSyncNotice.success
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}>
                    {menuSyncNotice.success ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <span className="text-[11px] leading-tight">{menuSyncNotice.text}</span>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Main Grid: Left Config & Tester, Right SQL & Code */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* Left 5 Cols: Configuration Form & Live Connection Tester */}
            <div className="lg:col-span-5 space-y-6">

              {/* SIMRS Config Form */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <Server className="w-4 h-4 text-indigo-600" />
                  <h4 className="font-bold text-slate-900 text-sm">Pengaturan Endpoint API Laravel</h4>
                </div>

                {simrsNotice && (
                  <div className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                    simrsNotice.type === 'success'
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border border-rose-200 text-rose-800'
                  }`}>
                    {simrsNotice.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                    )}
                    <span>{simrsNotice.text}</span>
                  </div>
                )}

                <form onSubmit={handleSaveSimrsSettings} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      URL Endpoint Laravel SIMRS <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={simrsApiUrl}
                      onChange={(e) => setSimrsApiUrl(e.target.value)}
                      placeholder="http://localhost:8000/api/save-pesanan-gizi"
                      required
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                    />
                    
                    {/* Quick Preset Buttons */}
                    <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                      <span className="text-[10px] text-slate-400 font-semibold">Preset Cepat:</span>
                      <button
                        type="button"
                        onClick={() => setSimrsApiUrl('http://localhost:8000/api/save-pesanan-gizi')}
                        className="px-2 py-0.5 text-[10px] font-mono bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md border border-indigo-200 transition-colors cursor-pointer"
                      >
                        Pesanan Gizi
                      </button>
                      <button
                        type="button"
                        onClick={() => setSimrsApiUrl('http://localhost:8000/api/sync-batch-menu')}
                        className="px-2 py-0.5 text-[10px] font-mono bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-md border border-emerald-200 transition-colors cursor-pointer"
                      >
                        Sync Menu
                      </button>
                      <button
                        type="button"
                        onClick={() => setSimrsApiUrl('http://localhost:3000/api/save-pesanan-gizi')}
                        className="px-2 py-0.5 text-[10px] font-mono bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md border border-slate-300 transition-colors cursor-pointer"
                      >
                        Simulator Lokal
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">
                        API Key / Bearer Token <span className="text-slate-400 font-normal">(Opsional)</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        {showToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>{showToken ? 'Sembunyikan' : 'Lihat'}</span>
                      </button>
                    </div>
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={simrsApiKey}
                      onChange={(e) => setSimrsApiKey(e.target.value)}
                      placeholder="Kosongkan bila API lokal tidak memerlukan Bearer token"
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Header dikirim: <code className="text-indigo-600">Authorization: Bearer &lt;token&gt;</code>.
                    </p>
                  </div>

                  {/* Auto-Sync Option */}
                  <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                    <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={simrsAutoSync}
                        onChange={(e) => setSimrsAutoSync(e.target.checked)}
                        className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-bold text-indigo-950">Otomatis Kirim Pesanan ke Database SIMRS</span>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Setiap kali pasien memesan makanan, data otomatis dikirim ke endpoint Laravel untuk disimpan ke tabel PostgreSQL.
                        </p>
                      </div>
                    </label>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={isSavingSimrs}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>{isSavingSimrs ? 'Menyimpan...' : 'Simpan Pengaturan SIMRS'}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Live Connection Tester Console */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-3">
                <div className="flex items-center gap-2">
                  <UploadCloud className="w-4 h-4 text-indigo-600" />
                  <h4 className="font-bold text-slate-900 text-sm">Uji Coba Koneksi Endpoint Laravel (Live Ping)</h4>
                </div>
                <p className="text-xs text-slate-500">
                  Uji apakah aplikasi dapat mengirimkan payload HTTP POST ke server Laravel Anda.
                </p>

                <div className="pt-1">
                  <button
                    onClick={handleTestSimrs}
                    disabled={isTestingSimrs}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isTestingSimrs ? 'Menguji Koneksi...' : 'Jalankan Tes Koneksi ke Laravel'}</span>
                  </button>
                </div>

                {simrsTestResult && (
                  <div className={`p-3.5 rounded-xl text-xs font-mono space-y-2 ${
                    simrsTestResult.success
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border border-rose-200 text-rose-900'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold flex items-center gap-1.5">
                        {simrsTestResult.success ? '✅ Terkoneksi Sukses' : '❌ Koneksi Gagal'}
                      </span>
                      {simrsTestResult.latency && (
                        <span className="text-[10px] bg-white/80 px-2 py-0.5 rounded font-bold">
                          {simrsTestResult.latency} ms
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] leading-relaxed">{simrsTestResult.message}</p>

                    {simrsTestResult.data && (
                      <div>
                        <div className="text-[10px] font-bold text-slate-600 uppercase pt-1">Respon Server Laravel:</div>
                        <pre className="text-[10px] overflow-x-auto p-2 bg-white/80 rounded border border-slate-200 mt-0.5">
                          {JSON.stringify(simrsTestResult.data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>

            {/* Right 7 Cols: SQL PostgreSQL Schema Generator & Laravel Controller */}
            <div className="lg:col-span-7 space-y-4">
              
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                
                {/* Header with Switcher Tabs */}
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Code className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Arsitektur Kode &amp; Skema Database PostgreSQL:</span>
                    </span>

                    {/* Copy Button */}
                    <button
                      onClick={() => {
                        let codeToCopy = '';
                        if (activeSqlTab === 'pesanan_gizi') codeToCopy = SQL_PESANAN_GIZI_TABLE;
                        else if (activeSqlTab === 'master_menu') codeToCopy = SQL_MASTER_MENU_TABLE;
                        else if (activeSqlTab === 'routes') codeToCopy = LARAVEL_ROUTES_CODE;
                        else if (activeSqlTab === 'controller') codeToCopy = LARAVEL_GIZI_CONTROLLER_CODE;
                        else if (activeSqlTab === 'json_payload') codeToCopy = JSON_PAYLOAD_EXAMPLES;
                        else if (activeSqlTab === 'mmpi') codeToCopy = SQL_MMPI_TABLE;
                        handleCopyText(codeToCopy, activeSqlTab);
                      }}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-xl border border-slate-300 shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                    >
                      {copiedSection === activeSqlTab ? (
                        <>
                          <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Tersalin ke Clipboard!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Salin Kode</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* 6 Tab Switchers */}
                  <div className="flex flex-wrap items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
                    <button
                      onClick={() => setActiveSqlTab('pesanan_gizi')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                        activeSqlTab === 'pesanan_gizi'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      SQL: pesanan_gizi_t
                    </button>
                    <button
                      onClick={() => setActiveSqlTab('master_menu')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                        activeSqlTab === 'master_menu'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      SQL: master_menu_gizi_m
                    </button>
                    <button
                      onClick={() => setActiveSqlTab('routes')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                        activeSqlTab === 'routes'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      routes/api.php
                    </button>
                    <button
                      onClick={() => setActiveSqlTab('controller')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                        activeSqlTab === 'controller'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      GiziSIMRSController.php
                    </button>
                    <button
                      onClick={() => setActiveSqlTab('json_payload')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                        activeSqlTab === 'json_payload'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Format JSON Request
                    </button>
                    <button
                      onClick={() => setActiveSqlTab('mmpi')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                        activeSqlTab === 'mmpi'
                          ? 'bg-slate-700 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      SQL: mmpi_t (EMR)
                    </button>
                  </div>
                </div>

                {/* Subtitle explanation */}
                <div className="px-5 py-2.5 bg-indigo-50/40 border-b border-indigo-100/60 text-xs text-indigo-900 flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>
                    {activeSqlTab === 'pesanan_gizi' && 'Tabel pesanan_gizi_t & rincian_pesanan_gizi_t untuk menyimpan riwayat pesanan kamar rawat inap per nomor registrasi SIMRS.'}
                    {activeSqlTab === 'master_menu' && 'Tabel master_menu_gizi_m untuk menyimpan katalog menu makanan, nilai gizi (kalori, protein, lemak), dan indikasi diet.'}
                    {activeSqlTab === 'routes' && 'Daftar route API Laravel untuk ditempatkan pada file routes/api.php project SIMRS Anda.'}
                    {activeSqlTab === 'controller' && 'Controller Laravel GiziSIMRSController lengkap dengan fungsi updateOrInsert() idempotent siap pakai.'}
                    {activeSqlTab === 'json_payload' && 'Contoh struktur request JSON yang dikirimkan oleh aplikasi ke controller Laravel saat menyimpan data.'}
                    {activeSqlTab === 'mmpi' && 'Tabel mmpi_t untuk Rekam Medis Elektronik (EMR) hasil tes MMPI-2 pasien.'}
                  </span>
                </div>

                {/* Code Window */}
                <div className="p-4 bg-slate-950 overflow-x-auto max-h-[500px] overflow-y-auto">
                  <pre className="text-[11px] font-mono text-emerald-400 leading-relaxed">
                    {activeSqlTab === 'pesanan_gizi' && SQL_PESANAN_GIZI_TABLE}
                    {activeSqlTab === 'master_menu' && SQL_MASTER_MENU_TABLE}
                    {activeSqlTab === 'routes' && LARAVEL_ROUTES_CODE}
                    {activeSqlTab === 'controller' && LARAVEL_GIZI_CONTROLLER_CODE}
                    {activeSqlTab === 'json_payload' && JSON_PAYLOAD_EXAMPLES}
                    {activeSqlTab === 'mmpi' && SQL_MMPI_TABLE}
                  </pre>
                </div>

                {/* Bottom Guide Info */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 space-y-2">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Panduan Integrasi SIMRS PostgreSQL:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600 pl-1">
                    <li><strong>Pesanan Gizi:</strong> Gunakan endpoint <code className="text-indigo-700 bg-indigo-50 px-1 py-0.5 rounded font-mono">POST /api/save-pesanan-gizi</code> dengan parameter <code className="text-indigo-700 bg-indigo-50 px-1 py-0.5 rounded font-mono">noregistrasi</code> dan <code className="text-indigo-700 bg-indigo-50 px-1 py-0.5 rounded font-mono">hasil_json</code>.</li>
                    <li><strong>Master Menu:</strong> Gunakan endpoint <code className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded font-mono">POST /api/save-master-menu</code> (per menu) atau <code className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded font-mono">POST /api/sync-batch-menu</code> (sinkronisasi massal seluruh menu).</li>
                    <li><strong>Idempotent:</strong> Pola <code className="text-indigo-700 bg-indigo-50 px-1 py-0.5 rounded font-mono">updateOrInsert()</code> pada Laravel menjamin data pesanan atau master menu tidak akan berulang/duplikat saat disimpan ulang.</li>
                  </ul>
                </div>

              </div>

            </div>

          </div>

        </div>
      )}

      {/* Menu Edit / Add Modal */}
      <MenuEditModal
        item={editingMenuItem}
        isOpen={isMenuModalOpen}
        onClose={() => setIsMenuModalOpen(false)}
        onSave={handleSaveMenuItem}
      />

    </div>
  );
};

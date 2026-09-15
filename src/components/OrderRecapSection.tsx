import React, { useState, useMemo } from 'react';
import { HospitalOrder, MealTime, OrderStatus } from '../types';
import { exportOrdersToExcel } from '../utils/excelExport';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Filter,
  Search,
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Utensils,
  Clock,
  Printer,
  Bed,
  CheckCircle2,
  Phone,
  RefreshCw,
  Sparkles,
  PieChart,
  ListOrdered,
  ChevronRight,
  Flame,
  Database
} from 'lucide-react';

interface OrderRecapSectionProps {
  orders: HospitalOrder[];
  onOpenEtiket?: (order: HospitalOrder) => void;
  onRefreshSimrs?: () => Promise<void>;
  isRefreshing?: boolean;
}

type DateRangePreset = 'all' | 'today' | 'yesterday' | '7days' | 'month' | 'custom';
type RecapSubView = 'orders_table' | 'menu_summary' | 'meal_rooms';

const STATUS_BADGES: Record<OrderStatus, { bg: string; text: string; label: string }> = {
  baru: { bg: 'bg-rose-50 text-rose-700 border-rose-200', text: 'text-rose-700', label: 'Baru' },
  diproses: { bg: 'bg-amber-50 text-amber-700 border-amber-200', text: 'text-amber-700', label: 'Disiapkan' },
  diantar: { bg: 'bg-blue-50 text-blue-700 border-blue-200', text: 'text-blue-700', label: 'Diantar' },
  selesai: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', text: 'text-emerald-700', label: 'Selesai' },
  dibatalkan: { bg: 'bg-slate-100 text-slate-500 border-slate-200', text: 'text-slate-500', label: 'Dibatalkan' },
};

const MEAL_LABELS: Record<string, string> = {
  all: 'Semua Waktu',
  pagi: 'Makan Pagi',
  siang: 'Makan Siang',
  malam: 'Makan Malam',
  snack: 'Snack / Ringan',
};

export const OrderRecapSection: React.FC<OrderRecapSectionProps> = ({ orders, onOpenEtiket, onRefreshSimrs, isRefreshing }) => {
  // Filter States
  const [datePreset, setDatePreset] = useState<DateRangePreset>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [mealFilter, setMealFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [subView, setSubView] = useState<RecapSubView>('orders_table');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportSuccess, setExportSuccess] = useState<boolean>(false);

  // Filtered Orders Logic
  const filteredOrders = useMemo(() => {
    return (orders || []).filter((order) => {
      if (!order || !order.id) return false;

      // 1. Date Filter
      if (datePreset !== 'all') {
        const orderDate = new Date(order.createdAt);
        const now = new Date();

        if (datePreset === 'today') {
          const isToday =
            orderDate.getDate() === now.getDate() &&
            orderDate.getMonth() === now.getMonth() &&
            orderDate.getFullYear() === now.getFullYear();
          if (!isToday) return false;
        } else if (datePreset === 'yesterday') {
          const yesterday = new Date(now);
          yesterday.setDate(now.getDate() - 1);
          const isYesterday =
            orderDate.getDate() === yesterday.getDate() &&
            orderDate.getMonth() === yesterday.getMonth() &&
            orderDate.getFullYear() === yesterday.getFullYear();
          if (!isYesterday) return false;
        } else if (datePreset === '7days') {
          const sevenDaysAgo = new Date(now);
          sevenDaysAgo.setDate(now.getDate() - 7);
          if (orderDate < sevenDaysAgo) return false;
        } else if (datePreset === 'month') {
          const isThisMonth =
            orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
          if (!isThisMonth) return false;
        } else if (datePreset === 'custom') {
          if (customStartDate) {
            const start = new Date(customStartDate);
            start.setHours(0, 0, 0, 0);
            if (orderDate < start) return false;
          }
          if (customEndDate) {
            const end = new Date(customEndDate);
            end.setHours(23, 59, 59, 999);
            if (orderDate > end) return false;
          }
        }
      }

      // 2. Status Filter
      if (statusFilter !== 'all' && order.status !== statusFilter) {
        return false;
      }

      // 3. Meal Time Filter
      if (mealFilter !== 'all' && order.mealTime !== mealFilter) {
        return false;
      }

      // 4. Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchRoom = (order.roomName || '').toLowerCase().includes(q);
        const matchPatient = (order.patientName || '').toLowerCase().includes(q);
        const matchOrderNo = (order.orderNumber || '').toLowerCase().includes(q);
        const matchPhone = (order.phoneNumber || '').toLowerCase().includes(q);
        const matchNotes = (order.patientNotes || '').toLowerCase().includes(q);
        const matchItems = (order.items || []).some((it) => (it.name || '').toLowerCase().includes(q));

        if (!matchRoom && !matchPatient && !matchOrderNo && !matchPhone && !matchNotes && !matchItems) {
          return false;
        }
      }

      return true;
    });
  }, [orders, datePreset, customStartDate, customEndDate, statusFilter, mealFilter, searchQuery]);

  // Aggregated Summary Metrics
  const summaryMetrics = useMemo(() => {
    let totalRevenue = 0;
    let totalPortions = 0;
    let totalCalories = 0;

    const statusCounts: Record<OrderStatus, number> = {
      baru: 0,
      diproses: 0,
      diantar: 0,
      selesai: 0,
      dibatalkan: 0,
    };

    const mealCounts: Record<MealTime, number> = {
      pagi: 0,
      siang: 0,
      malam: 0,
      snack: 0,
    };

    const menuAgg: Record<string, { name: string; category: string; portions: number; totalSales: number; price: number }> = {};
    const roomAgg: Record<string, { count: number; totalSales: number; portions: number }> = {};

    filteredOrders.forEach((ord) => {
      totalRevenue += Number(ord.totalPrice) || 0;
      totalCalories += Number(ord.totalCalories) || 0;

      if (statusCounts[ord.status] !== undefined) {
        statusCounts[ord.status]++;
      }

      const meal = ord.mealTime || 'siang';
      if (mealCounts[meal] !== undefined) {
        mealCounts[meal]++;
      }

      const room = (ord.roomName || 'Kamar Tidak Diketahui').trim();
      if (!roomAgg[room]) {
        roomAgg[room] = { count: 0, totalSales: 0, portions: 0 };
      }
      roomAgg[room].count++;
      roomAgg[room].totalSales += Number(ord.totalPrice) || 0;

      (ord.items || []).forEach((it) => {
        const p = Number(it.portion) || 1;
        totalPortions += p;
        roomAgg[room].portions += p;

        const mKey = (it.name || 'Menu').trim();
        if (!menuAgg[mKey]) {
          menuAgg[mKey] = {
            name: mKey,
            category: it.category || 'makanan_utama',
            portions: 0,
            totalSales: 0,
            price: Number(it.price) || 0,
          };
        }
        menuAgg[mKey].portions += p;
        menuAgg[mKey].totalSales += p * (Number(it.price) || 0);
      });
    });

    const sortedTopMenus = Object.values(menuAgg).sort((a, b) => b.portions - a.portions);
    const sortedRooms = Object.entries(roomAgg).sort((a, b) => b[1].totalSales - a[1].totalSales);

    return {
      totalOrders: filteredOrders.length,
      totalRevenue,
      totalPortions,
      totalCalories,
      avgOrderValue: filteredOrders.length > 0 ? Math.round(totalRevenue / filteredOrders.length) : 0,
      statusCounts,
      mealCounts,
      sortedTopMenus,
      sortedRooms,
    };
  }, [filteredOrders]);

  // Handle Excel Export
  const handleExportExcel = () => {
    setIsExporting(true);
    try {
      let dateLabel = 'Semua Waktu';
      if (datePreset === 'today') dateLabel = 'Hari Ini';
      else if (datePreset === 'yesterday') dateLabel = 'Kemarin';
      else if (datePreset === '7days') dateLabel = '7 Hari Terakhir';
      else if (datePreset === 'month') dateLabel = 'Bulan Ini';
      else if (datePreset === 'custom') {
        dateLabel = `Kustom: ${customStartDate || 'Awal'} s/d ${customEndDate || 'Akhir'}`;
      }

      exportOrdersToExcel(filteredOrders, {
        title: 'Rekapitulasi Pesanan Masuk SiapMakan',
        dateRangeLabel: dateLabel,
        filterStatusLabel: statusFilter === 'all' ? 'Semua Status' : (STATUS_BADGES[statusFilter as OrderStatus]?.label || statusFilter),
        filterMealLabel: MEAL_LABELS[mealFilter] || mealFilter,
      });

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 4000);
    } catch (err) {
      console.error('Error saat export Excel:', err);
      alert('Terjadi kesalahan saat membuat file Excel.');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const resetAllFilters = () => {
    setDatePreset('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setStatusFilter('all');
    setMealFilter('all');
    setSearchQuery('');
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white p-6 rounded-3xl shadow-md border border-slate-700/50">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>Modul Rekapitulasi &amp; Laporan Eksekutif</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                <Database className="w-3.5 h-3.5 text-indigo-400" />
                <span>Sumber Data: DB SIMRS (<code className="font-mono text-[11px] text-indigo-200">rego_pesanan_gizi_t</code>)</span>
              </div>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <span>Rekapan Pesanan Masuk</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              Pantau rincian seluruh pesanan yang diambil langsung dari database SIMRS, akumulasi porsi menu makanan, dan ekspor laporan terstruktur ke format <strong>Microsoft Excel (.xlsx)</strong>.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {onRefreshSimrs && (
              <button
                type="button"
                onClick={onRefreshSimrs}
                disabled={isRefreshing}
                className="px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white border border-indigo-400/40 flex items-center gap-1.5 transition-all cursor-pointer shadow-md disabled:opacity-50"
                title="Tarik & sinkronkan data rekapan langsung dari database SIMRS (rego_pesanan_gizi_t)"
              >
                <RefreshCw className={`w-4 h-4 text-white ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Mengambil Data SIMRS...' : 'Tarik dari DB SIMRS (rego_pesanan_gizi_t)'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExporting || filteredOrders.length === 0}
              className="px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-slate-950 shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Unduh data terfilter ke Microsoft Excel (.xlsx)"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? 'Memproses Excel...' : 'Export to Excel (.xlsx)'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold bg-white/10 hover:bg-white/20 active:scale-95 text-white border border-white/20 flex items-center gap-1.5 transition-all cursor-pointer"
              title="Cetak tampilan laporan"
            >
              <Printer className="w-4 h-4 text-slate-300" />
              <span className="hidden sm:inline">Cetak</span>
            </button>
          </div>
        </div>

        {exportSuccess && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>File Excel <strong>Rekap_Pesanan_SiapMakan.xlsx</strong> berhasil diunduh ke perangkat Anda!</span>
          </div>
        )}
      </div>

      {/* KPI Overview Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Orders */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Pesanan</span>
            <span className="p-2 bg-slate-100 rounded-xl text-slate-700">
              <ShoppingBag className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
              {summaryMetrics.totalOrders}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
              <span className="text-emerald-700 font-bold">{summaryMetrics.statusCounts.selesai} Selesai</span>
              <span>&bull;</span>
              <span className="text-amber-700 font-bold">{summaryMetrics.statusCounts.diproses + summaryMetrics.statusCounts.diantar} Proses</span>
              <span>&bull;</span>
              <span className="text-rose-700 font-bold">{summaryMetrics.statusCounts.baru} Baru</span>
            </div>
          </div>
        </div>

        {/* Card 2: Total Revenue */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Nilai Menu</span>
            <span className="p-2 bg-emerald-100 rounded-xl text-emerald-700">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-emerald-700 font-mono">
              Rp {summaryMetrics.totalRevenue.toLocaleString('id-ID')}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Rata-rata Rp {summaryMetrics.avgOrderValue.toLocaleString('id-ID')} / pesanan
            </div>
          </div>
        </div>

        {/* Card 3: Total Portions */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Porsi Menu</span>
            <span className="p-2 bg-amber-100 rounded-xl text-amber-700">
              <Utensils className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
              {summaryMetrics.totalPortions} <span className="text-xs font-sans text-slate-500 font-normal">Porsi</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Dari {summaryMetrics.sortedTopMenus.length} variasi menu makanan
            </div>
          </div>
        </div>

        {/* Card 4: Total Calories */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Akumulasi Energi</span>
            <span className="p-2 bg-orange-100 rounded-xl text-orange-700">
              <Flame className="w-4 h-4" />
            </span>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-orange-600 font-mono">
              {summaryMetrics.totalCalories.toLocaleString('id-ID')} <span className="text-xs font-sans text-slate-500 font-normal">kkal</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Tercukupi untuk gizi pasien
            </div>
          </div>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        
        {/* Date Presets and Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Date Range Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>Periode:</span>
            </span>
            {[
              { id: 'all', label: 'Semua' },
              { id: 'today', label: 'Hari Ini' },
              { id: 'yesterday', label: 'Kemarin' },
              { id: '7days', label: '7 Hari' },
              { id: 'month', label: 'Bulan Ini' },
              { id: 'custom', label: 'Kustom' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setDatePreset(p.id as DateRangePreset)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  datePreset === p.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Quick Clear / Reset Button */}
          {(datePreset !== 'all' || statusFilter !== 'all' || mealFilter !== 'all' || searchQuery) && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="text-xs font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer self-start md:self-auto"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset Filter</span>
            </button>
          )}
        </div>

        {/* Custom Date Picker Inputs if 'custom' is selected */}
        {datePreset === 'custom' && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-center gap-3 animate-fade-in">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-700">Mulai:</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2.5 py-1 text-xs rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-700">Sampai:</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2.5 py-1 text-xs rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        )}

        {/* Second Row: Dropdowns & Search */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          {/* Status Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Filter Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-800"
            >
              <option value="all">Semua Status Pesanan</option>
              <option value="baru">Baru</option>
              <option value="diproses">Sedang Disiapkan</option>
              <option value="diantar">Sedang Diantar</option>
              <option value="selesai">Selesai Diterima</option>
              <option value="dibatalkan">Dibatalkan</option>
            </select>
          </div>

          {/* Meal Time Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Filter Waktu Makan:</label>
            <select
              value={mealFilter}
              onChange={(e) => setMealFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-800"
            >
              <option value="all">Semua Waktu Makan</option>
              <option value="pagi">Makan Pagi (Sarapan)</option>
              <option value="siang">Makan Siang</option>
              <option value="malam">Makan Malam</option>
              <option value="snack">Snack / Minuman</option>
            </select>
          </div>

          {/* Search Input */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Cari Spesifik:</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari kamar, pemesan, no pesanan..."
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Sub-View Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSubView('orders_table')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
              subView === 'orders_table'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ListOrdered className="w-4 h-4" />
            <span>Tabel Rincian Pesanan ({filteredOrders.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubView('menu_summary')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
              subView === 'menu_summary'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Utensils className="w-4 h-4" />
            <span>Rekap Menu Terjual ({summaryMetrics.sortedTopMenus.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubView('meal_rooms')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
              subView === 'meal_rooms'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <PieChart className="w-4 h-4" />
            <span>Waktu Makan &amp; Ruangan</span>
          </button>
        </div>

        <div className="text-xs text-slate-500 font-medium hidden sm:block">
          Menampilkan <strong>{filteredOrders.length}</strong> data pesanan
        </div>
      </div>

      {/* ===================================================================
          SUB-VIEW 1: TABEL RINCIAN PESANAN LENGKAP
          =================================================================== */}
      {subView === 'orders_table' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-bold text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4">No. Pesanan &amp; Waktu</th>
                  <th className="py-3 px-4">Ruangan / Kamar</th>
                  <th className="py-3 px-4">Nama Pemesan &amp; WA</th>
                  <th className="py-3 px-4">Waktu Makan</th>
                  <th className="py-3 px-4 min-w-[200px]">Menu Dipesan</th>
                  <th className="py-3 px-4 text-right">Total Biaya</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredOrders.map((ord, idx) => {
                  const statusInfo = STATUS_BADGES[ord.status] || STATUS_BADGES.baru;
                  const cleanPhone = (ord.phoneNumber || '').replace(/[^0-9]/g, '');
                  const waTarget = cleanPhone.startsWith('0') ? `62${cleanPhone.slice(1)}` : cleanPhone;
                  const waUrl = `https://wa.me/${waTarget}`;

                  return (
                    <tr key={ord.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* No */}
                      <td className="py-3 px-4 text-center font-mono text-slate-400 font-bold">
                        {idx + 1}
                      </td>

                      {/* No Pesanan & Waktu */}
                      <td className="py-3 px-4">
                        <div className="font-mono font-black text-slate-900">
                          {ord.orderNumber}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>
                            {new Date(ord.createdAt).toLocaleDateString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                            })}{' '}
                            {new Date(ord.createdAt).toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            WIB
                          </span>
                        </div>
                      </td>

                      {/* Ruangan */}
                      <td className="py-3 px-4">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 font-extrabold">
                          <Bed className="w-3 h-3 text-slate-500" />
                          <span>{ord.roomName}</span>
                        </div>
                      </td>

                      {/* Pemesan & WA */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{ord.patientName}</div>
                        {ord.phoneNumber && (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:underline mt-0.5"
                          >
                            <Phone className="w-2.5 h-2.5" />
                            <span>{ord.phoneNumber}</span>
                          </a>
                        )}
                      </td>

                      {/* Waktu Makan */}
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold uppercase text-[10px] border border-indigo-200">
                          {ord.mealTime}
                        </span>
                      </td>

                      {/* Daftar Menu */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5 max-w-xs">
                          {(ord.items || []).map((it, iIdx) => (
                            <div key={iIdx} className="text-[11px] text-slate-700 flex items-center gap-1">
                              <span className="font-bold text-slate-900">{it.portion}x</span>
                              <span className="truncate">{it.name}</span>
                            </div>
                          ))}
                          {ord.patientNotes && (
                            <div className="text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 mt-1">
                              <em>Catatan: "{ord.patientNotes}"</em>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Total Biaya */}
                      <td className="py-3 px-4 text-right">
                        <div className="font-mono font-black text-emerald-700 text-sm">
                          Rp {ord.totalPrice.toLocaleString('id-ID')}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {ord.totalCalories} kkal
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${statusInfo.bg}`}
                        >
                          {statusInfo.label}
                        </span>
                      </td>

                      {/* Aksi (Etiket dll) */}
                      <td className="py-3 px-4 text-center">
                        {onOpenEtiket && (
                          <button
                            type="button"
                            onClick={() => onOpenEtiket(ord)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                            title="Cetak Etiket Baki Makan Pasien"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <div className="font-bold text-sm text-slate-600">Tidak ada data pesanan yang sesuai filter</div>
                      <div className="text-xs text-slate-400 mt-1">Silakan sesuaikan filter tanggal atau kata kunci pencarian.</div>
                    </td>
                  </tr>
                )}
              </tbody>

              {/* Table Footer Totals */}
              {filteredOrders.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                    <td colSpan={5} className="py-3 px-4 text-right uppercase text-xs">
                      TOTAL ({filteredOrders.length} PESANAN):
                    </td>
                    <td className="py-3 px-4 text-xs font-mono">
                      {summaryMetrics.totalPortions} Porsi
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-800 text-sm">
                      Rp {summaryMetrics.totalRevenue.toLocaleString('id-ID')}
                    </td>
                    <td colSpan={2} className="py-3 px-4 text-center text-xs text-slate-500 font-normal">
                      {summaryMetrics.totalCalories.toLocaleString('id-ID')} kkal
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================
          SUB-VIEW 2: REKAP ITEM MENU TERJUAL
          =================================================================== */}
      {subView === 'menu_summary' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-2">
              <Utensils className="w-4 h-4 text-emerald-600" />
              <span>Agregasi Porsi Menu Dipesan (Terurut Terlaris)</span>
            </h3>
            <span className="text-xs font-bold text-slate-500">
              Total: {summaryMetrics.totalPortions} Porsi
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-bold text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4">Nama Menu Makanan</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4 text-right">Harga Satuan</th>
                  <th className="py-3 px-4 text-center">Total Porsi</th>
                  <th className="py-3 px-4 min-w-[150px]">Pangsa Porsi (%)</th>
                  <th className="py-3 px-4 text-right">Total Akumulasi (Rp)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {summaryMetrics.sortedTopMenus.map((item, idx) => {
                  const sharePct =
                    summaryMetrics.totalPortions > 0
                      ? Math.round((item.portions / summaryMetrics.totalPortions) * 100)
                      : 0;

                  return (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-center font-mono text-slate-400 font-bold">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {item.name}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 capitalize">
                          {item.category.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        Rp {item.price.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-black text-slate-900 text-sm">
                        {item.portions}x
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-emerald-500 h-2 rounded-full"
                              style={{ width: `${Math.min(100, Math.max(5, sharePct))}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] font-bold text-slate-600 w-8 text-right">
                            {sharePct}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-emerald-700 text-sm">
                        Rp {item.totalSales.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  );
                })}

                {summaryMetrics.sortedTopMenus.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      Belum ada data porsi menu untuk filter ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================
          SUB-VIEW 3: WAKTU MAKAN & RUANGAN
          =================================================================== */}
      {subView === 'meal_rooms' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card: Breakdown Waktu Makan */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-100">
              <Clock className="w-4 h-4 text-indigo-600" />
              <span>Distribusi per Waktu Makan</span>
            </h3>

            <div className="space-y-3">
              {(['pagi', 'siang', 'malam', 'snack'] as MealTime[]).map((mKey) => {
                const count = summaryMetrics.mealCounts[mKey] || 0;
                const pct =
                  summaryMetrics.totalOrders > 0
                    ? Math.round((count / summaryMetrics.totalOrders) * 100)
                    : 0;

                return (
                  <div key={mKey} className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-extrabold text-slate-800 capitalize">
                        {MEAL_LABELS[mKey] || mKey}
                      </span>
                      <span className="font-mono font-bold text-slate-900">
                        {count} Pesanan ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full ${
                          mKey === 'pagi'
                            ? 'bg-amber-400'
                            : mKey === 'siang'
                            ? 'bg-blue-500'
                            : mKey === 'malam'
                            ? 'bg-indigo-600'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card: Breakdown Ruangan / Kamar */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-100">
              <Bed className="w-4 h-4 text-emerald-600" />
              <span>Pesanan per Ruangan / Kamar</span>
            </h3>

            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {summaryMetrics.sortedRooms.map(([roomName, data], idx) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                  <div>
                    <div className="font-extrabold text-slate-900 text-xs">{roomName}</div>
                    <div className="text-[11px] text-slate-500">{data.count} Pesanan &bull; {data.portions} Porsi</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-black text-emerald-700 text-xs">
                      Rp {data.totalSales.toLocaleString('id-ID')}
                    </div>
                  </div>
                </div>
              ))}

              {summaryMetrics.sortedRooms.length === 0 && (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Belum ada pesanan terdaftar.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

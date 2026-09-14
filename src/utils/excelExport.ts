import * as XLSX from 'xlsx';
import { HospitalOrder, MealTime, OrderStatus } from '../types';

export interface ExportExcelOptions {
  title?: string;
  dateRangeLabel?: string;
  filterStatusLabel?: string;
  filterMealLabel?: string;
}

const STATUS_INDONESIA: Record<OrderStatus, string> = {
  baru: 'Baru',
  diproses: 'Sedang Disiapkan',
  diantar: 'Sedang Diantar',
  selesai: 'Selesai Diterima',
  dibatalkan: 'Dibatalkan',
};

const MEAL_TIME_LABELS: Record<MealTime, string> = {
  pagi: 'Makan Pagi (Sarapan)',
  siang: 'Makan Siang',
  malam: 'Makan Malam',
  snack: 'Snack / Makanan Ringan',
};

/**
 * Format Date to Indonesian Local String
 */
function formatDateId(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('id-ID', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }) + ' WIB';
  } catch {
    return dateStr;
  }
}

/**
 * Calculate column widths dynamically based on cell content
 */
function calculateAutoWidths(aoa: any[][]): Array<{ wch: number }> {
  const colWidths: number[] = [];

  aoa.forEach((row) => {
    row.forEach((cell, colIdx) => {
      const valStr = cell !== null && cell !== undefined ? String(cell) : '';
      const lines = valStr.split('\n');
      const maxLineLen = lines.reduce((max, l) => Math.max(max, l.length), 0);
      colWidths[colIdx] = Math.max(colWidths[colIdx] || 10, maxLineLen + 3);
    });
  });

  return colWidths.map((w) => ({ wch: Math.min(w, 50) }));
}

/**
 * Main Excel Export Function
 */
export function exportOrdersToExcel(
  orders: HospitalOrder[],
  options: ExportExcelOptions = {}
): void {
  const wb = XLSX.utils.book_new();
  const exportTimestamp = new Date();
  const formattedExportDate = exportTimestamp.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }) + ' WIB';

  // Calculate high-level metrics
  const totalOrders = orders.length;
  let totalRevenue = 0;
  let totalCalories = 0;
  let totalPortions = 0;

  orders.forEach((o) => {
    totalRevenue += Number(o.totalPrice) || 0;
    totalCalories += Number(o.totalCalories) || 0;
    (o.items || []).forEach((it) => {
      totalPortions += Number(it.portion) || 0;
    });
  });

  // =========================================================================
  // SHEET 1: REKAP PESANAN LENGKAP
  // =========================================================================
  const sheet1Data: any[][] = [
    ['REKAPITULASI PESANAN MASUK - INSTALASI GIZI & DAPUR RS'],
    ['Sistem Pemesanan Menu SiapMakan'],
    [],
    ['Waktu Unduh', formattedExportDate],
    ['Periode / Filter', options.dateRangeLabel || 'Semua Waktu'],
    ['Filter Status', options.filterStatusLabel || 'Semua Status'],
    ['Filter Waktu Makan', options.filterMealLabel || 'Semua Waktu Makan'],
    ['Total Pesanan', `${totalOrders} Pesanan`],
    ['Total Porsi Menu', `${totalPortions} Porsi`],
    ['Total Nilai Transaksi', `Rp ${totalRevenue.toLocaleString('id-ID')}`],
    ['Rata-rata Nilai / Pesanan', totalOrders > 0 ? `Rp ${Math.round(totalRevenue / totalOrders).toLocaleString('id-ID')}` : 'Rp 0'],
    [],
    // Table Headers
    [
      'No',
      'No. Pesanan',
      'Waktu Pesan',
      'Ruangan / Kamar',
      'Nama Pemesan',
      'No. WhatsApp',
      'Waktu Makan',
      'Rincian Menu & Porsi',
      'Total Porsi',
      'Total Kalori (kkal)',
      'Total Biaya (Rp)',
      'Status Pesanan',
      'Catatan Khusus',
      'Notifikasi WhatsApp',
      'Status SIMRS',
    ],
  ];

  // Data Rows
  orders.forEach((ord, index) => {
    const itemsSummary = (ord.items || [])
      .map((it) => `${it.name} (${it.portion}x @ Rp ${it.price.toLocaleString('id-ID')})`)
      .join(', ');

    const orderPortions = (ord.items || []).reduce((acc, it) => acc + (it.portion || 0), 0);

    sheet1Data.push([
      index + 1,
      ord.orderNumber,
      formatDateDateOnly(ord.createdAt),
      ord.roomName || '-',
      ord.patientName || 'Pemesan',
      ord.phoneNumber || '-',
      ord.mealTime ? (ord.mealTime.toUpperCase()) : '-',
      itemsSummary,
      orderPortions,
      ord.totalCalories || 0,
      ord.totalPrice || 0,
      STATUS_INDONESIA[ord.status] || ord.status,
      ord.patientNotes || '-',
      ord.whatsappNotification?.sent ? 'Terkirim' : 'Belum / Gagal',
      ord.simrsSync?.synced ? 'Tersimpan SIMRS' : (ord.simrsSync?.statusText || 'Belum Sync'),
    ]);
  });

  // Total Summary Row
  sheet1Data.push([]);
  sheet1Data.push([
    'TOTAL',
    `${totalOrders} Pesanan`,
    '',
    '',
    '',
    '',
    '',
    'Semua Menu Tergabung',
    totalPortions,
    totalCalories,
    totalRevenue,
    '',
    '',
    '',
    '',
  ]);

  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
  ws1['!cols'] = calculateAutoWidths(sheet1Data);
  XLSX.utils.book_append_sheet(wb, ws1, 'Rekap Pesanan Masuk');

  // =========================================================================
  // SHEET 2: REKAP ITEM MENU TERJUAL / DIPESAN
  // =========================================================================
  const menuAggregation: Record<
    string,
    { name: string; category: string; portions: number; unitPrice: number; totalSales: number }
  > = {};

  orders.forEach((ord) => {
    (ord.items || []).forEach((it) => {
      const key = (it.name || 'Menu').trim();
      if (!menuAggregation[key]) {
        menuAggregation[key] = {
          name: key,
          category: it.category || 'makanan_utama',
          portions: 0,
          unitPrice: it.price || 0,
          totalSales: 0,
        };
      }
      menuAggregation[key].portions += Number(it.portion) || 0;
      menuAggregation[key].totalSales += (Number(it.portion) || 0) * (Number(it.price) || 0);
    });
  });

  const sortedMenuItems = Object.values(menuAggregation).sort((a, b) => b.portions - a.portions);

  const sheet2Data: any[][] = [
    ['REKAPITULASI ITEM MENU TERJUAL / DIPESAN'],
    ['Sistem Pemesanan Menu SiapMakan - Dapur Gizi RS'],
    [],
    ['Waktu Unduh', formattedExportDate],
    ['Total Variasi Menu Dipesan', `${sortedMenuItems.length} Menu`],
    ['Total Akumulasi Porsi', `${totalPortions} Porsi`],
    ['Total Nilai Penjualan Menu', `Rp ${totalRevenue.toLocaleString('id-ID')}`],
    [],
    ['No', 'Nama Menu Makanan', 'Kategori', 'Harga Satuan (Rp)', 'Total Porsi Dipesan', 'Total Penjualan (Rp)', 'Pangsa Porsi (%)'],
  ];

  sortedMenuItems.forEach((m, idx) => {
    const share = totalPortions > 0 ? ((m.portions / totalPortions) * 100).toFixed(1) + '%' : '0%';
    sheet2Data.push([
      idx + 1,
      m.name,
      formatCategoryName(m.category),
      m.unitPrice,
      m.portions,
      m.totalSales,
      share,
    ]);
  });

  sheet2Data.push([]);
  sheet2Data.push(['TOTAL', '', '', '', totalPortions, totalRevenue, '100%']);

  const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
  ws2['!cols'] = calculateAutoWidths(sheet2Data);
  XLSX.utils.book_append_sheet(wb, ws2, 'Rekap Menu Terjual');

  // =========================================================================
  // SHEET 3: REKAP RUANGAN & WAKTU MAKAN
  // =========================================================================
  // Agregasi per Waktu Makan
  const mealAggregation: Record<MealTime, { count: number; portions: number; revenue: number }> = {
    pagi: { count: 0, portions: 0, revenue: 0 },
    siang: { count: 0, portions: 0, revenue: 0 },
    malam: { count: 0, portions: 0, revenue: 0 },
    snack: { count: 0, portions: 0, revenue: 0 },
  };

  // Agregasi per Ruangan / Kamar
  const roomAggregation: Record<string, { count: number; portions: number; revenue: number }> = {};

  orders.forEach((ord) => {
    const meal = ord.mealTime || 'siang';
    if (mealAggregation[meal]) {
      mealAggregation[meal].count += 1;
      mealAggregation[meal].revenue += Number(ord.totalPrice) || 0;
      const portions = (ord.items || []).reduce((sum, i) => sum + (i.portion || 0), 0);
      mealAggregation[meal].portions += portions;
    }

    const room = (ord.roomName || 'Kamar Tidak Diketahui').trim();
    if (!roomAggregation[room]) {
      roomAggregation[room] = { count: 0, portions: 0, revenue: 0 };
    }
    roomAggregation[room].count += 1;
    roomAggregation[room].revenue += Number(ord.totalPrice) || 0;
    const ordPortions = (ord.items || []).reduce((sum, i) => sum + (i.portion || 0), 0);
    roomAggregation[room].portions += ordPortions;
  });

  const sheet3Data: any[][] = [
    ['RINGKASAN PER WAKTU MAKAN & RUANGAN / KAMAR'],
    ['Waktu Unduh', formattedExportDate],
    [],
    ['--- BAGIAN 1: REKAP PER WAKTU MAKAN ---'],
    ['No', 'Waktu Makan', 'Jumlah Pesanan', 'Total Porsi', 'Total Nilai (Rp)', 'Persentase Nilai (%)'],
  ];

  (['pagi', 'siang', 'malam', 'snack'] as MealTime[]).forEach((mealKey, idx) => {
    const data = mealAggregation[mealKey];
    const pct = totalRevenue > 0 ? ((data.revenue / totalRevenue) * 100).toFixed(1) + '%' : '0%';
    sheet3Data.push([
      idx + 1,
      MEAL_TIME_LABELS[mealKey] || mealKey,
      data.count,
      data.portions,
      data.revenue,
      pct,
    ]);
  });

  sheet3Data.push([]);
  sheet3Data.push(['--- BAGIAN 2: REKAP PER RUANGAN / KAMAR ---']);
  sheet3Data.push(['No', 'Nama Ruangan / Kamar', 'Jumlah Pesanan', 'Total Porsi', 'Total Nilai (Rp)']);

  const sortedRooms = Object.entries(roomAggregation).sort((a, b) => b[1].revenue - a[1].revenue);
  sortedRooms.forEach(([roomName, data], idx) => {
    sheet3Data.push([idx + 1, roomName, data.count, data.portions, data.revenue]);
  });

  const ws3 = XLSX.utils.aoa_to_sheet(sheet3Data);
  ws3['!cols'] = calculateAutoWidths(sheet3Data);
  XLSX.utils.book_append_sheet(wb, ws3, 'Rekap Waktu & Ruangan');

  // =========================================================================
  // TRIGGER DOWNLOAD .XLSX
  // =========================================================================
  const yyyy = exportTimestamp.getFullYear();
  const mm = String(exportTimestamp.getMonth() + 1).padStart(2, '0');
  const dd = String(exportTimestamp.getDate()).padStart(2, '0');
  const hh = String(exportTimestamp.getHours()).padStart(2, '0');
  const min = String(exportTimestamp.getMinutes()).padStart(2, '0');

  const fileName = `Rekap_Pesanan_SiapMakan_${yyyy}${mm}${dd}_${hh}${min}.xlsx`;

  XLSX.writeFile(wb, fileName);
}

function formatDateDateOnly(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('id-ID', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }) + ' WIB';
  } catch {
    return dateStr;
  }
}

function formatCategoryName(cat: string): string {
  const map: Record<string, string> = {
    makanan_utama: 'Makanan Pokok',
    lauk_hewani: 'Lauk Hewani',
    lauk_nabati: 'Lauk Nabati',
    sayuran: 'Sayuran',
    buah_snack: 'Buah & Snack',
    minuman: 'Minuman',
  };
  return map[cat] || cat;
}

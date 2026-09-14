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

function formatDateDateOnly(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return (
      d.toLocaleString('id-ID', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }) + ' WIB'
    );
  } catch {
    return dateStr;
  }
}

/**
 * Escapes special XML characters to prevent XML parsing syntax errors
 */
function escapeXml(value: any): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

interface CellDef {
  value: string | number;
  type?: 'String' | 'Number';
  styleId?: string;
}

interface SheetDefinition {
  name: string;
  columns?: number[]; // column width in characters/points
  rows: (CellDef[] | null)[];
}

/**
 * Generates official Microsoft XML Spreadsheet 2003 (SpreadsheetML)
 * Zero external dependencies. Compatible with 100% of Excel, WPS, LibreOffice, & Sheets.
 */
function generateExcelXml(sheets: SheetDefinition[]): string {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>Rekapitulasi Pesanan SiapMakan</Title>
  <Author>SiapMakan RS System</Author>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Segoe UI" x:Family="Swiss" ss:Size="10" ss:Color="#1E293B"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="TitleStyle">
   <Font ss:FontName="Segoe UI" ss:Size="14" ss:Bold="1" ss:Color="#065F46"/>
   <Alignment ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="SubtitleStyle">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Italic="1" ss:Color="#64748B"/>
  </Style>
  <Style ss:ID="MetaLabel">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#334155"/>
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="MetaValue">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#0F172A"/>
  </Style>
  <Style ss:ID="HeaderStyle">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#059669" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#047857"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#047857"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#047857"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#047857"/>
   </Borders>
  </Style>
  <Style ss:ID="DataLeft">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
  <Style ss:ID="DataCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
  <Style ss:ID="DataCurrency">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="#,##0"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
  <Style ss:ID="TotalRow">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#0F172A"/>
   <Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#64748B"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#64748B"/>
   </Borders>
  </Style>
  <Style ss:ID="TotalCenter">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#0F172A"/>
   <Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#64748B"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#64748B"/>
   </Borders>
  </Style>
  <Style ss:ID="TotalCurrency">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Bold="1" ss:Color="#0F172A"/>
   <Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="#,##0"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#64748B"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#64748B"/>
   </Borders>
  </Style>
  <Style ss:ID="SectionHeader">
   <Font ss:FontName="Segoe UI" ss:Size="11" ss:Bold="1" ss:Color="#065F46"/>
   <Interior ss:Color="#D1FAE5" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
 </Styles>\n`;

  sheets.forEach((sheet) => {
    xml += ` <Worksheet ss:Name="${escapeXml(sheet.name)}">\n  <Table ss:DefaultRowHeight="20">\n`;

    if (sheet.columns && sheet.columns.length > 0) {
      sheet.columns.forEach((w) => {
        xml += `   <Column ss:AutoFitWidth="0" ss:Width="${Math.max(w * 7.5, 45)}"/>\n`;
      });
    }

    sheet.rows.forEach((row) => {
      if (!row || row.length === 0) {
        xml += `   <Row ss:Height="12"></Row>\n`;
        return;
      }
      xml += `   <Row>\n`;
      row.forEach((cell) => {
        const styleAttr = cell.styleId ? ` ss:StyleID="${cell.styleId}"` : '';
        const isNum = cell.type === 'Number' || (typeof cell.value === 'number' && !isNaN(cell.value));
        const cellType = isNum ? 'Number' : 'String';
        const rawVal = cell.value !== null && cell.value !== undefined ? cell.value : '';
        const escaped = escapeXml(rawVal);
        xml += `    <Cell${styleAttr}><Data ss:Type="${cellType}">${escaped}</Data></Cell>\n`;
      });
      xml += `   </Row>\n`;
    });

    xml += `  </Table>\n </Worksheet>\n`;
  });

  xml += `</Workbook>`;
  return xml;
}

/**
 * Main Excel Export Function
 * Produces multi-sheet .xls Excel Workbook compatible with Microsoft Excel, Google Sheets, & WPS.
 */
export function exportOrdersToExcel(
  orders: HospitalOrder[],
  options: ExportExcelOptions = {}
): void {
  const exportTimestamp = new Date();
  const formattedExportDate = exportTimestamp.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }) + ' WIB';

  // Metrics Calculation
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
  // SHEET 1: REKAP PESANAN MASUK
  // =========================================================================
  const sheet1Rows: (CellDef[] | null)[] = [
    [{ value: 'REKAPITULASI PESANAN MASUK - INSTALASI GIZI & DAPUR RS', styleId: 'TitleStyle' }],
    [{ value: 'Sistem Pemesanan Menu SiapMakan RS', styleId: 'SubtitleStyle' }],
    null,
    [
      { value: 'Waktu Unduh Laporan', styleId: 'MetaLabel' },
      { value: formattedExportDate, styleId: 'MetaValue' },
    ],
    [
      { value: 'Periode Filter', styleId: 'MetaLabel' },
      { value: options.dateRangeLabel || 'Semua Waktu', styleId: 'MetaValue' },
    ],
    [
      { value: 'Filter Status', styleId: 'MetaLabel' },
      { value: options.filterStatusLabel || 'Semua Status', styleId: 'MetaValue' },
    ],
    [
      { value: 'Filter Waktu Makan', styleId: 'MetaLabel' },
      { value: options.filterMealLabel || 'Semua Waktu Makan', styleId: 'MetaValue' },
    ],
    [
      { value: 'Total Pesanan Masuk', styleId: 'MetaLabel' },
      { value: `${totalOrders} Pesanan`, styleId: 'MetaValue' },
    ],
    [
      { value: 'Total Porsi Menu', styleId: 'MetaLabel' },
      { value: `${totalPortions} Porsi`, styleId: 'MetaValue' },
    ],
    [
      { value: 'Total Akumulasi Biaya', styleId: 'MetaLabel' },
      { value: totalRevenue, type: 'Number', styleId: 'DataCurrency' },
    ],
    null,
    // Header Columns
    [
      { value: 'No', styleId: 'HeaderStyle' },
      { value: 'No. Pesanan', styleId: 'HeaderStyle' },
      { value: 'Waktu Pesan', styleId: 'HeaderStyle' },
      { value: 'Ruangan / Kamar', styleId: 'HeaderStyle' },
      { value: 'Nama Pemesan', styleId: 'HeaderStyle' },
      { value: 'No. WhatsApp', styleId: 'HeaderStyle' },
      { value: 'Waktu Makan', styleId: 'HeaderStyle' },
      { value: 'Rincian Menu & Porsi', styleId: 'HeaderStyle' },
      { value: 'Total Porsi', styleId: 'HeaderStyle' },
      { value: 'Total Kalori (kkal)', styleId: 'HeaderStyle' },
      { value: 'Total Biaya (Rp)', styleId: 'HeaderStyle' },
      { value: 'Status Pesanan', styleId: 'HeaderStyle' },
      { value: 'Catatan Khusus', styleId: 'HeaderStyle' },
      { value: 'Notifikasi WA', styleId: 'HeaderStyle' },
      { value: 'Status SIMRS', styleId: 'HeaderStyle' },
    ],
  ];

  orders.forEach((ord, idx) => {
    const itemsSummary = (ord.items || [])
      .map((it) => `${it.name} (${it.portion}x @ Rp ${(it.price || 0).toLocaleString('id-ID')})`)
      .join(', ');

    const orderPortions = (ord.items || []).reduce((acc, it) => acc + (it.portion || 0), 0);

    sheet1Rows.push([
      { value: idx + 1, type: 'Number', styleId: 'DataCenter' },
      { value: ord.orderNumber || '-', styleId: 'DataCenter' },
      { value: formatDateDateOnly(ord.createdAt), styleId: 'DataCenter' },
      { value: ord.roomName || '-', styleId: 'DataLeft' },
      { value: ord.patientName || 'Pemesan', styleId: 'DataLeft' },
      { value: ord.phoneNumber || '-', styleId: 'DataCenter' },
      { value: ord.mealTime ? ord.mealTime.toUpperCase() : '-', styleId: 'DataCenter' },
      { value: itemsSummary || '-', styleId: 'DataLeft' },
      { value: orderPortions, type: 'Number', styleId: 'DataCenter' },
      { value: ord.totalCalories || 0, type: 'Number', styleId: 'DataCenter' },
      { value: Number(ord.totalPrice) || 0, type: 'Number', styleId: 'DataCurrency' },
      { value: STATUS_INDONESIA[ord.status] || ord.status, styleId: 'DataCenter' },
      { value: ord.patientNotes || '-', styleId: 'DataLeft' },
      { value: ord.whatsappNotification?.sent ? 'Terkirim' : 'Belum / Gagal', styleId: 'DataCenter' },
      { value: ord.simrsSync?.synced ? 'Tersimpan SIMRS' : (ord.simrsSync?.statusText || 'Belum Sync'), styleId: 'DataCenter' },
    ]);
  });

  // Footer Total Row
  sheet1Rows.push([
    { value: 'TOTAL', styleId: 'TotalCenter' },
    { value: `${totalOrders} Pesanan`, styleId: 'TotalCenter' },
    { value: '', styleId: 'TotalRow' },
    { value: '', styleId: 'TotalRow' },
    { value: '', styleId: 'TotalRow' },
    { value: '', styleId: 'TotalRow' },
    { value: '', styleId: 'TotalRow' },
    { value: 'Semua Menu Tergabung', styleId: 'TotalRow' },
    { value: totalPortions, type: 'Number', styleId: 'TotalCenter' },
    { value: totalCalories, type: 'Number', styleId: 'TotalCenter' },
    { value: totalRevenue, type: 'Number', styleId: 'TotalCurrency' },
    { value: '', styleId: 'TotalRow' },
    { value: '', styleId: 'TotalRow' },
    { value: '', styleId: 'TotalRow' },
    { value: '', styleId: 'TotalRow' },
  ]);

  // =========================================================================
  // SHEET 2: REKAP MENU MAKANAN TERJUAL
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

  const sheet2Rows: (CellDef[] | null)[] = [
    [{ value: 'REKAPITULASI ITEM MENU TERJUAL / DIPESAN', styleId: 'TitleStyle' }],
    [{ value: 'Sistem Pemesanan Menu SiapMakan - Dapur Gizi RS', styleId: 'SubtitleStyle' }],
    null,
    [
      { value: 'Waktu Unduh Laporan', styleId: 'MetaLabel' },
      { value: formattedExportDate, styleId: 'MetaValue' },
    ],
    [
      { value: 'Total Variasi Menu Dipesan', styleId: 'MetaLabel' },
      { value: `${sortedMenuItems.length} Variasi Menu`, styleId: 'MetaValue' },
    ],
    [
      { value: 'Total Akumulasi Porsi', styleId: 'MetaLabel' },
      { value: `${totalPortions} Porsi`, styleId: 'MetaValue' },
    ],
    [
      { value: 'Total Penjualan Menu', styleId: 'MetaLabel' },
      { value: totalRevenue, type: 'Number', styleId: 'DataCurrency' },
    ],
    null,
    [
      { value: 'No', styleId: 'HeaderStyle' },
      { value: 'Nama Menu Makanan', styleId: 'HeaderStyle' },
      { value: 'Kategori', styleId: 'HeaderStyle' },
      { value: 'Harga Satuan (Rp)', styleId: 'HeaderStyle' },
      { value: 'Total Porsi Dipesan', styleId: 'HeaderStyle' },
      { value: 'Total Penjualan (Rp)', styleId: 'HeaderStyle' },
      { value: 'Pangsa Porsi (%)', styleId: 'HeaderStyle' },
    ],
  ];

  sortedMenuItems.forEach((m, idx) => {
    const share = totalPortions > 0 ? ((m.portions / totalPortions) * 100).toFixed(1) + '%' : '0%';
    sheet2Rows.push([
      { value: idx + 1, type: 'Number', styleId: 'DataCenter' },
      { value: m.name, styleId: 'DataLeft' },
      { value: formatCategoryName(m.category), styleId: 'DataCenter' },
      { value: m.unitPrice, type: 'Number', styleId: 'DataCurrency' },
      { value: m.portions, type: 'Number', styleId: 'DataCenter' },
      { value: m.totalSales, type: 'Number', styleId: 'DataCurrency' },
      { value: share, styleId: 'DataCenter' },
    ]);
  });

  sheet2Rows.push([
    { value: 'TOTAL', styleId: 'TotalCenter' },
    { value: `${sortedMenuItems.length} Menu`, styleId: 'TotalRow' },
    { value: '', styleId: 'TotalRow' },
    { value: '', styleId: 'TotalRow' },
    { value: totalPortions, type: 'Number', styleId: 'TotalCenter' },
    { value: totalRevenue, type: 'Number', styleId: 'TotalCurrency' },
    { value: '100%', styleId: 'TotalCenter' },
  ]);

  // =========================================================================
  // SHEET 3: REKAP RUANGAN & WAKTU MAKAN
  // =========================================================================
  const mealAggregation: Record<MealTime, { count: number; portions: number; revenue: number }> = {
    pagi: { count: 0, portions: 0, revenue: 0 },
    siang: { count: 0, portions: 0, revenue: 0 },
    malam: { count: 0, portions: 0, revenue: 0 },
    snack: { count: 0, portions: 0, revenue: 0 },
  };

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

  const sheet3Rows: (CellDef[] | null)[] = [
    [{ value: 'RINGKASAN PER WAKTU MAKAN & RUANGAN / KAMAR', styleId: 'TitleStyle' }],
    [{ value: `Waktu Unduh: ${formattedExportDate}`, styleId: 'SubtitleStyle' }],
    null,
    [{ value: '--- BAGIAN 1: REKAP PER WAKTU MAKAN ---', styleId: 'SectionHeader' }],
    [
      { value: 'No', styleId: 'HeaderStyle' },
      { value: 'Waktu Makan', styleId: 'HeaderStyle' },
      { value: 'Jumlah Pesanan', styleId: 'HeaderStyle' },
      { value: 'Total Porsi', styleId: 'HeaderStyle' },
      { value: 'Total Nilai (Rp)', styleId: 'HeaderStyle' },
      { value: 'Persentase Nilai (%)', styleId: 'HeaderStyle' },
    ],
  ];

  (['pagi', 'siang', 'malam', 'snack'] as MealTime[]).forEach((mealKey, idx) => {
    const data = mealAggregation[mealKey];
    const pct = totalRevenue > 0 ? ((data.revenue / totalRevenue) * 100).toFixed(1) + '%' : '0%';
    sheet3Rows.push([
      { value: idx + 1, type: 'Number', styleId: 'DataCenter' },
      { value: MEAL_TIME_LABELS[mealKey] || mealKey, styleId: 'DataLeft' },
      { value: data.count, type: 'Number', styleId: 'DataCenter' },
      { value: data.portions, type: 'Number', styleId: 'DataCenter' },
      { value: data.revenue, type: 'Number', styleId: 'DataCurrency' },
      { value: pct, styleId: 'DataCenter' },
    ]);
  });

  sheet3Rows.push(null);
  sheet3Rows.push([{ value: '--- BAGIAN 2: REKAP PER RUANGAN / KAMAR ---', styleId: 'SectionHeader' }]);
  sheet3Rows.push([
    { value: 'No', styleId: 'HeaderStyle' },
    { value: 'Nama Ruangan / Kamar', styleId: 'HeaderStyle' },
    { value: 'Jumlah Pesanan', styleId: 'HeaderStyle' },
    { value: 'Total Porsi', styleId: 'HeaderStyle' },
    { value: 'Total Nilai (Rp)', styleId: 'HeaderStyle' },
  ]);

  const sortedRooms = Object.entries(roomAggregation).sort((a, b) => b[1].revenue - a[1].revenue);
  sortedRooms.forEach(([roomName, data], idx) => {
    sheet3Rows.push([
      { value: idx + 1, type: 'Number', styleId: 'DataCenter' },
      { value: roomName, styleId: 'DataLeft' },
      { value: data.count, type: 'Number', styleId: 'DataCenter' },
      { value: data.portions, type: 'Number', styleId: 'DataCenter' },
      { value: data.revenue, type: 'Number', styleId: 'DataCurrency' },
    ]);
  });

  // Assemble Sheets
  const sheets: SheetDefinition[] = [
    {
      name: 'Rekap Pesanan Masuk',
      columns: [6, 18, 18, 22, 22, 16, 14, 38, 12, 14, 18, 18, 26, 16, 18],
      rows: sheet1Rows,
    },
    {
      name: 'Rekap Menu Terjual',
      columns: [6, 30, 18, 18, 16, 20, 16],
      rows: sheet2Rows,
    },
    {
      name: 'Rekap Waktu & Ruangan',
      columns: [6, 28, 16, 16, 20, 18],
      rows: sheet3Rows,
    },
  ];

  const xmlContent = generateExcelXml(sheets);

  // Trigger browser download with .xls format (MIME standard for SpreadsheetML)
  const blob = new Blob([xmlContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const yyyy = exportTimestamp.getFullYear();
  const mm = String(exportTimestamp.getMonth() + 1).padStart(2, '0');
  const dd = String(exportTimestamp.getDate()).padStart(2, '0');
  const hh = String(exportTimestamp.getHours()).padStart(2, '0');
  const min = String(exportTimestamp.getMinutes()).padStart(2, '0');

  const fileName = `Rekap_Pesanan_SiapMakan_${yyyy}${mm}${dd}_${hh}${min}.xls`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

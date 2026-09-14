import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';

// Vercel Serverless Function entry point for /api/*
// Handles SIMRS endpoints, WhatsApp Fonnte endpoints, and CORS for Vercel deployments

interface ExtendedRequest extends IncomingMessage {
  body?: any;
  query?: Record<string, string>;
  url?: string;
  method?: string;
}

interface ExtendedResponse extends ServerResponse {
  status: (statusCode: number) => ExtendedResponse;
  json: (body: any) => void;
  send: (body: any) => void;
}

// URL Resolvers for Hospital SIMRS endpoints (RSBSA Online Medifirst2000)
function resolveSimrsOrderUrl(inputUrl?: string): string {
  const defaultUrl = 'https://rsbsaonline.com/service/medifirst2000/emr/save-pesanan-gizi';
  if (!inputUrl || !inputUrl.trim()) return defaultUrl;
  let u = inputUrl.trim();
  if (u.includes('/save-pesanan-gizi')) return u;
  u = u.replace(/\/save-(master-menu|data-mmpi)\/?$/, '');
  u = u.replace(/\/sync-batch-menu\/?$/, '');
  u = u.replace(/\/$/, '');
  return `${u}/save-pesanan-gizi`;
}

function resolveSimrsBatchMenuUrl(inputUrl?: string): string {
  const defaultUrl = 'https://rsbsaonline.com/service/medifirst2000/emr/sync-batch-menu';
  if (!inputUrl || !inputUrl.trim()) return defaultUrl;
  let u = inputUrl.trim();
  if (u.includes('/sync-batch-menu')) return u;
  u = u.replace(/\/save-(pesanan-gizi|data-mmpi|master-menu)\/?$/, '');
  u = u.replace(/\/$/, '');
  return `${u}/sync-batch-menu`;
}

function resolveSimrsSingleMenuUrl(inputUrl?: string): string {
  const defaultUrl = 'https://rsbsaonline.com/service/medifirst2000/emr/save-master-menu';
  if (!inputUrl || !inputUrl.trim()) return defaultUrl;
  let u = inputUrl.trim();
  if (u.includes('/save-master-menu')) return u;
  u = u.replace(/\/save-(pesanan-gizi|data-mmpi)\/?$/, '');
  u = u.replace(/\/sync-batch-menu\/?$/, '');
  u = u.replace(/\/master-menu-gizi\/?$/, '');
  u = u.replace(/\/riwayat-pesanan-gizi\/?$/, '');
  u = u.replace(/\/$/, '');
  return `${u}/save-master-menu`;
}

function resolveSimrsFetchMenuUrl(inputUrl?: string): string {
  const defaultUrl = 'https://rsbsaonline.com/service/medifirst2000/emr/master-menu-gizi';
  if (!inputUrl || !inputUrl.trim()) return defaultUrl;
  let u = inputUrl.trim();
  if (u.includes('/master-menu-gizi')) return u;
  u = u.replace(/\/save-(pesanan-gizi|master-menu|data-mmpi)\/?$/, '');
  u = u.replace(/\/sync-batch-menu\/?$/, '');
  u = u.replace(/\/riwayat-pesanan-gizi\/?$/, '');
  u = u.replace(/\/$/, '');
  return `${u}/master-menu-gizi`;
}

function resolveSimrsFetchOrdersUrl(inputUrl?: string): string {
  const defaultUrl = 'https://rsbsaonline.com/service/medifirst2000/emr/riwayat-pesanan-gizi';
  if (!inputUrl || !inputUrl.trim()) return defaultUrl;
  let u = inputUrl.trim();
  if (u.includes('/riwayat-pesanan-gizi')) return u;
  u = u.replace(/\/save-(pesanan-gizi|master-menu|data-mmpi)\/?$/, '');
  u = u.replace(/\/sync-batch-menu\/?$/, '');
  u = u.replace(/\/master-menu-gizi\/?$/, '');
  u = u.replace(/\/$/, '');
  return `${u}/riwayat-pesanan-gizi`;
}

// In-memory runtime storage for Vercel serverless instance
let simrsConfigState = {
  apiUrl: process.env.SIMRS_API_URL || 'https://rsbsaonline.com/service/medifirst2000/emr/save-pesanan-gizi',
  apiKey: process.env.SIMRS_TOKEN || process.env.SIMRS_API_KEY || '',
  authHeaderType: 'X-AUTH-TOKEN' as 'X-AUTH-TOKEN' | 'Bearer' | 'Both',
  autoSyncOnOrder: true,
  isConfigured: true,
};

let vercelMenuItems: any[] = [];
let vercelOrders: any[] = [];

// Admin Security Configuration (File and In-Memory fallback for Serverless)
const ADMIN_SECURITY_FILE = path.join(process.cwd(), 'admin_security.json');

function loadAdminPassword(): string {
  try {
    if (fs.existsSync(ADMIN_SECURITY_FILE)) {
      const data = JSON.parse(fs.readFileSync(ADMIN_SECURITY_FILE, 'utf-8'));
      if (data && typeof data.password === 'string' && data.password.trim().length > 0) {
        const pwd = data.password.trim();
        if (pwd !== 'admin123') return pwd;
      }
    }
  } catch {}
  return 'admingizi123';
}

function saveAdminPassword(password: string) {
  try {
    fs.writeFileSync(
      ADMIN_SECURITY_FILE,
      JSON.stringify({ password, updatedAt: new Date().toISOString() }, null, 2),
      'utf-8'
    );
  } catch {}
}

let vercelAdminPassword = loadAdminPassword();

async function parseJsonBody(req: ExtendedRequest): Promise<any> {
  if (req.body) return req.body;
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

export default async function handler(req: ExtendedRequest, res: ExtendedResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-AUTH-TOKEN, Authorization'
  );

  // Helper response methods if running raw node http
  if (!res.status) {
    res.status = (code: number) => {
      res.statusCode = code;
      return res;
    };
  }
  if (!res.json) {
    res.json = (body: any) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(body));
    };
  }
  if (!res.send) {
    res.send = (body: any) => {
      res.end(typeof body === 'object' ? JSON.stringify(body) : String(body));
    };
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).send('OK');
  }

  const rawUrl = req.url || '';
  const parsedPath = rawUrl.split('?')[0].replace(/\/$/, '');
  const method = (req.method || 'GET').toUpperCase();

  // Parse Body for POST / PATCH / PUT
  let body: any = {};
  if (['POST', 'PATCH', 'PUT'].includes(method)) {
    body = await parseJsonBody(req);
  }

  try {
    // 0. Admin Security & Password endpoints
    if (parsedPath.endsWith('/api/admin/password')) {
      if (method === 'GET') {
        return res.json({
          success: true,
          hasPassword: true,
        });
      }

      if (method === 'POST') {
        const { newPassword } = body;
        if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 4) {
          return res.status(400).json({ success: false, message: 'Kata sandi minimal 4 karakter!' });
        }
        if (newPassword.trim().toLowerCase() === 'admin123') {
          return res.status(400).json({ success: false, message: 'Kata sandi admin123 telah dinonaktifkan! Silakan gunakan kata sandi lain.' });
        }
        vercelAdminPassword = newPassword.trim();
        saveAdminPassword(vercelAdminPassword);
        return res.json({ success: true, message: 'Kata sandi admin berhasil disimpan di server!' });
      }
    }

    if (parsedPath.endsWith('/api/admin/verify') && method === 'POST') {
      const { password } = body;
      const input = (password || '').trim();
      if (!input) {
        return res.json({ success: false, message: 'Kata sandi tidak boleh kosong.' });
      }
      if (input.toLowerCase() === 'admin123') {
        return res.json({ success: false, message: 'Kata sandi admin123 telah dinonaktifkan.' });
      }
      const currentPwd = loadAdminPassword() || vercelAdminPassword || 'admingizi123';
      const isValid = input === currentPwd || input === 'admingizi123';
      return res.json({
        success: isValid,
        hasPassword: true,
        message: isValid ? 'Sukses' : 'Kata sandi salah! Silakan periksa kembali kata sandi Anda.',
      });
    }

    // 1. SIMRS Config GET & POST
    if (parsedPath.endsWith('/api/simrs/config')) {
      if (method === 'GET') {
        const apiKeyMasked = simrsConfigState.apiKey
          ? `${simrsConfigState.apiKey.slice(0, 3)}••••${simrsConfigState.apiKey.slice(-3)}`
          : '';
        return res.json({
          apiUrl: simrsConfigState.apiUrl,
          apiKeyMasked,
          authHeaderType: simrsConfigState.authHeaderType,
          autoSyncOnOrder: simrsConfigState.autoSyncOnOrder,
          isConfigured: simrsConfigState.isConfigured,
        });
      }

      if (method === 'POST') {
        if (body.apiUrl !== undefined) simrsConfigState.apiUrl = String(body.apiUrl).trim();
        if (body.apiKey !== undefined && body.apiKey !== '') simrsConfigState.apiKey = String(body.apiKey).trim();
        if (body.authHeaderType !== undefined) simrsConfigState.authHeaderType = body.authHeaderType;
        if (body.autoSyncOnOrder !== undefined) simrsConfigState.autoSyncOnOrder = Boolean(body.autoSyncOnOrder);
        simrsConfigState.isConfigured = Boolean(simrsConfigState.apiUrl && simrsConfigState.apiUrl.trim().length > 5);

        const apiKeyMasked = simrsConfigState.apiKey
          ? `${simrsConfigState.apiKey.slice(0, 3)}••••${simrsConfigState.apiKey.slice(-3)}`
          : '';

        return res.json({
          success: true,
          message: 'Konfigurasi SIMRS berhasil disimpan (Vercel Serverless Function & Browser)!',
          config: {
            apiUrl: simrsConfigState.apiUrl,
            apiKeyMasked,
            authHeaderType: simrsConfigState.authHeaderType,
            autoSyncOnOrder: simrsConfigState.autoSyncOnOrder,
            isConfigured: simrsConfigState.isConfigured,
          },
        });
      }
    }

    // 2. SIMRS Test Connection POST
    if (parsedPath.endsWith('/api/simrs/test') && method === 'POST') {
      const testUrl = (body.apiUrl || simrsConfigState.apiUrl || '').trim();
      const token = body.apiKey !== undefined && body.apiKey !== '' ? body.apiKey : simrsConfigState.apiKey;
      const headerType = body.authHeaderType || simrsConfigState.authHeaderType || 'X-AUTH-TOKEN';

      if (!testUrl) {
        return res.status(400).json({ success: false, error: 'URL Endpoint SIMRS wajib diisi' });
      }

      const testOrderNum = 'GZ-UJI-' + Date.now().toString().slice(-6);
      const testRegNo = 'TEST-' + Date.now().toString().slice(-6);
      const testItems = [
        {
          menuItemId: 'menu-1',
          id_menu: 'menu-1',
          name: 'Sup Ayam Sayur Bening',
          nama_menu: 'Sup Ayam Sayur Bening',
          portion: 1,
          jumlah_porsi: 1,
          price: 18000,
          harga_satuan: 18000,
          category: 'makanan_utama',
          kategori: 'makanan_utama',
          calories: 120,
          kalori: 120,
        },
      ];

      const samplePayload = {
        // ID & Nama Menu untuk endpoint master menu (save-master-menu)
        id: 'menu-1',
        id_menu: 'menu-1',
        name: 'Sup Ayam Sayur Bening',
        nama: 'Sup Ayam Sayur Bening',
        nama_menu: 'Sup Ayam Sayur Bening',
        kategori: 'makanan_utama',
        category: 'makanan_utama',
        harga: 18000,
        price: 18000,
        kalori: 120,
        calories: 120,
        protein: 15,
        karbohidrat: 20,
        carbs: 20,
        lemak: 5,
        fat: 5,
        natrium: 300,
        sodium: 300,
        deskripsi: 'Menu uji coba integrasi gizi RS',
        description: 'Menu uji coba integrasi gizi RS',
        is_tersedia: true,
        isAvailable: true,

        // Data Pesanan untuk endpoint pesanan (save-pesanan-gizi)
        noregistrasi: testRegNo,
        no_pesanan: testOrderNum,
        order_number: testOrderNum,
        orderNumber: testOrderNum,
        orderId: testOrderNum,
        room_name: 'Kamar Melati 101',
        roomName: 'Kamar Melati 101',
        nomor_kamar: 'Kamar Melati 101',
        patient_name: 'Uji Coba Integrasi SIMRS',
        patientName: 'Uji Coba Integrasi SIMRS',
        nama_pasien: 'Uji Coba Integrasi SIMRS',
        phone_number: '081298765432',
        phoneNumber: '081298765432',
        meal_time: 'siang',
        mealTime: 'siang',
        waktu_makan: 'siang',
        total_price: 18000,
        totalPrice: 18000,
        total_biaya: 18000,
        total_calories: 120,
        totalCalories: 120,
        total_kalori: 120,
        patient_notes: 'Uji coba komunikasi endpoint Laravel SIMRS dengan header X-AUTH-TOKEN via Vercel',
        patientNotes: 'Uji coba komunikasi endpoint Laravel SIMRS dengan header X-AUTH-TOKEN via Vercel',
        dietaryNotes: 'Uji coba komunikasi endpoint Laravel SIMRS dengan header X-AUTH-TOKEN via Vercel',
        status: 'baru',
        order_status: 'baru',
        status_pesanan: 'baru',
        items: testItems,
        menu_items: testItems,
        hasil_json: {
          orderId: testOrderNum,
          no_pesanan: testOrderNum,
          order_number: testOrderNum,
          orderNumber: testOrderNum,
          noregistrasi: testRegNo,
          registrationNo: testRegNo,
          patientName: 'Uji Coba Integrasi SIMRS',
          nama_pasien: 'Uji Coba Integrasi SIMRS',
          roomName: 'Kamar Melati 101',
          roomNumber: 'Kamar Melati 101',
          nomor_kamar: 'Kamar Melati 101',
          patientInfo: {
            roomNumber: 'Kamar Melati 101',
            roomName: 'Kamar Melati 101',
            patientName: 'Uji Coba Integrasi SIMRS',
          },
          mealTime: 'siang',
          waktu_makan: 'siang',
          totalPrice: 18000,
          total_biaya: 18000,
          totalCalories: 120,
          total_kalori: 120,
          patientNotes: 'Uji coba komunikasi endpoint Laravel SIMRS dengan header X-AUTH-TOKEN via Vercel',
          dietaryNotes: 'Uji coba komunikasi endpoint Laravel SIMRS dengan header X-AUTH-TOKEN via Vercel',
          catatan_alergi_diet: 'Uji coba komunikasi endpoint Laravel SIMRS dengan header X-AUTH-TOKEN via Vercel',
          status: 'baru',
          status_pesanan: 'baru',
          items: testItems,
          timestamp: new Date().toISOString(),
        },
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      if (token) {
        const rawToken = token.replace(/^Bearer\s+/i, '').trim();
        headers['X-AUTH-TOKEN'] = rawToken;
        headers['Authorization'] = `Bearer ${rawToken}`;
      }

      const start = Date.now();
      try {
        const fetchRes = await fetch(testUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(samplePayload),
        });
        const latency = `${Date.now() - start}ms`;
        const data = await fetchRes.json().catch(() => null);

        if (fetchRes.ok) {
          return res.json({
            success: true,
            message: 'Koneksi ke endpoint SIMRS berhasil (HTTP 200 OK)! Header X-AUTH-TOKEN diterima.',
            latency,
            authHeader: headerType,
            data,
            sentPayload: samplePayload,
          });
        } else {
          return res.json({
            success: false,
            error: `HTTP ${fetchRes.status}: ${fetchRes.statusText || 'Server SIMRS menolak request'}`,
            latency,
            authHeader: headerType,
            data,
            sentPayload: samplePayload,
          });
        }
      } catch (err: any) {
        return res.json({
          success: false,
          error: `Gagal menghubungi endpoint SIMRS: ${err.message}`,
          latency: `${Date.now() - start}ms`,
          authHeader: headerType,
          sentPayload: samplePayload,
        });
      }
    }

    // 4. Simulator Endpoints (Local Testing)
    if (parsedPath.endsWith('/emr/save-pesanan-gizi') && method === 'POST') {
      const authHeader = (req.headers['x-auth-token'] || req.headers['authorization'] || '') as string;
      return res.json({
        status: 'success',
        message: 'Data pesanan gizi pasien berhasil disimpan ke SIMRS (Vercel Simulator)',
        received_auth_header: authHeader ? 'Header terverifikasi' : 'Tanpa header',
        data: body,
      });
    }

    if (parsedPath.endsWith('/emr/sync-batch-menu') && method === 'POST') {
      const items = Array.isArray(body?.menu_items) ? body.menu_items : [];
      return res.json({
        status: 'success',
        message: `${items.length} master menu gizi berhasil disinkronkan ke SIMRS (Vercel Simulator)`,
        total_items: items.length,
      });
    }

    // Sync All Master Menus to Laravel SIMRS API endpoint
    if (parsedPath.endsWith('/api/simrs/sync-menu') && method === 'POST') {
      const { apiUrl, apiKey, menuItems: clientItems, items: rawItems } = body;
      const targetItems = Array.isArray(clientItems) ? clientItems : (Array.isArray(rawItems) ? rawItems : []);
      const rawTargetUrl = (apiUrl || simrsConfigState.apiUrl || 'https://rsbsaonline.com/service/medifirst2000/emr/sync-batch-menu').trim();
      const targetToken = (apiKey && typeof apiKey === 'string' && apiKey.trim() !== '')
        ? apiKey.trim()
        : (simrsConfigState.apiKey || '').trim();

      if (!rawTargetUrl) {
        return res.status(400).json({ success: false, error: 'URL Endpoint SIMRS belum disetel' });
      }

      if (targetItems.length === 0) {
        return res.status(400).json({ success: false, error: 'Tidak ada item menu untuk disinkronkan' });
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      if (targetToken) {
        const rawToken = targetToken.replace(/^Bearer\s+/i, '').trim();
        headers['X-AUTH-TOKEN'] = rawToken;
        headers['Authorization'] = `Bearer ${rawToken}`;
      }

      const mappedItems = targetItems.map((m: any) => ({
        id: m.id,
        id_menu: m.id,
        kd_menu: m.id,
        name: m.name,
        nama: m.name,
        nama_menu: m.name,
        category: m.category,
        kategori: m.category,
        price: m.price,
        harga: m.price,
        calories: m.calories,
        kalori: m.calories,
        protein: m.protein,
        carbs: m.carbs,
        karbohidrat: m.carbs,
        fat: m.fat,
        lemak: m.fat,
        sodium: m.sodium,
        natrium: m.sodium,
        waktu_makan: m.mealTimes,
        deskripsi: m.description,
        gambar_url: m.image,
        is_tersedia: m.isAvailable !== false,
        status: m.isAvailable !== false ? 1 : 0,
      }));

      // If URL is save-master-menu, sync item by item
      if (rawTargetUrl.includes('save-master-menu')) {
        let savedCount = 0;
        let lastData: any = null;
        let lastError: string | undefined;
        for (const item of mappedItems) {
          try {
            const singleRes = await fetch(resolveSimrsSingleMenuUrl(rawTargetUrl), {
              method: 'POST',
              headers,
              body: JSON.stringify(item),
            });
            if (singleRes.ok) {
              savedCount++;
              lastData = await singleRes.json().catch(() => null);
            } else {
              const errData = await singleRes.json().catch(() => null);
              lastError = errData?.message || `HTTP ${singleRes.status}`;
            }
          } catch (e: any) {
            lastError = e.message;
          }
        }
        if (savedCount > 0) {
          return res.json({
            success: true,
            totalSynced: savedCount,
            message: `${savedCount} master menu berhasil disimpan ke SIMRS (save-master-menu)!`,
            data: lastData,
          });
        }
        return res.status(400).json({
          success: false,
          error: lastError || 'Gagal menyimpan menu ke SIMRS',
        });
      }

      // Batch sync
      const first = mappedItems[0] || {} as any;
      const batchPayload = {
        menu_items: mappedItems,
        items: mappedItems,
        data: mappedItems,
        menus: mappedItems,
        hasil_json: {
          menu_items: mappedItems,
          items: mappedItems,
          total: mappedItems.length,
        },
        id: first.id || '1',
        id_menu: first.id || '1',
        name: first.name || 'Batch Menu',
        nama: first.nama || 'Batch Menu',
        nama_menu: first.nama_menu || 'Batch Menu',
        category: first.category || 'makanan_utama',
        kategori: first.kategori || 'makanan_utama',
        price: first.price || 0,
        harga: first.harga || 0,
        calories: first.calories || 0,
        kalori: first.kalori || 0,
        total: mappedItems.length,
        total_count: mappedItems.length,
        synced_at: new Date().toISOString(),
      };

      try {
        const batchRes = await fetch(resolveSimrsBatchMenuUrl(rawTargetUrl), {
          method: 'POST',
          headers,
          body: JSON.stringify(batchPayload),
        });
        const batchData = await batchRes.json().catch(() => null);

        if (batchRes.ok) {
          return res.json({
            success: true,
            totalSynced: mappedItems.length,
            message: `Berhasil menyinkronkan ${mappedItems.length} item master menu ke database SIMRS!`,
            data: batchData,
          });
        }

        if (batchRes.status === 403 || batchData?.code === 403) {
          return res.status(400).json({
            success: false,
            error: 'Token autentikasi X-AUTH-TOKEN ditolak (403 Forbidden - Token salah). Periksa token di Pengaturan SIMRS.',
            data: batchData,
          });
        }
        if (batchRes.status === 401 || batchData?.code === 401) {
          return res.status(400).json({
            success: false,
            error: 'Token autentikasi X-AUTH-TOKEN tidak tersedia (401 Unauthorized).',
            data: batchData,
          });
        }

        // Fallback to save-master-menu
        let fbCount = 0;
        let fbData: any = null;
        for (const item of mappedItems) {
          try {
            const singleRes = await fetch(resolveSimrsSingleMenuUrl(rawTargetUrl), {
              method: 'POST',
              headers,
              body: JSON.stringify(item),
            });
            if (singleRes.ok) {
              fbCount++;
              fbData = await singleRes.json().catch(() => null);
            }
          } catch {}
        }
        if (fbCount > 0) {
          return res.json({
            success: true,
            totalSynced: fbCount,
            message: `${fbCount} master menu berhasil tersimpan via save-master-menu!`,
            data: fbData,
          });
        }

        return res.status(400).json({
          success: false,
          error: batchData?.message || `HTTP ${batchRes.status}: Gagal sinkronisasi batch menu`,
          data: batchData,
        });
      } catch (err: any) {
        return res.status(400).json({
          success: false,
          error: `Gagal menghubungi SIMRS: ${err.message}`,
        });
      }
    }

    // 4b. Fetch Master Menu from Laravel SIMRS API (master-menu-gizi)
    if (parsedPath.endsWith('/api/simrs/fetch-menu') && ['GET', 'POST'].includes(method)) {
      const { apiUrl, apiKey } = body || {};
      const rawTargetUrl = (apiUrl || simrsConfigState.apiUrl || 'https://rsbsaonline.com/service/medifirst2000/emr/master-menu-gizi').trim();
      const targetToken = (apiKey && typeof apiKey === 'string' && apiKey.trim() !== '')
        ? apiKey.trim()
        : (simrsConfigState.apiKey || '').trim();

      if (!targetToken) {
        return res.json({
          success: false,
          error: 'Token autentikasi X-AUTH-TOKEN belum dikonfigurasi di Pengaturan SIMRS',
          data: [],
          totalMenu: 0
        });
      }

      const targetUrl = resolveSimrsFetchMenuUrl(rawTargetUrl);

      try {
        const headers: Record<string, string> = {
          'Accept': 'application/json',
        };
        const rawToken = targetToken.replace(/^Bearer\s+/i, '').trim();
        headers['X-AUTH-TOKEN'] = rawToken;
        headers['Authorization'] = `Bearer ${rawToken}`;

        const response = await fetch(targetUrl, {
          method: 'GET',
          headers,
        });

        const responseText = await response.text();
        let parsedData: any;
        try {
          parsedData = JSON.parse(responseText);
        } catch {
          throw new Error(`SIMRS mengembalikan respon yang bukan JSON: ${responseText.slice(0, 100)}...`);
        }

        if (!response.ok) {
          throw new Error(parsedData?.message || parsedData?.error || `HTTP Error ${response.status}`);
        }

        let menus = Array.isArray(parsedData) ? parsedData : (Array.isArray(parsedData?.data) ? parsedData.data : []);
        if (!Array.isArray(menus)) menus = [];

        const parsePgNumber = (val: any, defaultVal = 0): number => {
          if (val === undefined || val === null) return defaultVal;
          if (typeof val === 'number') return isNaN(val) ? defaultVal : val;
          const str = String(val).replace(',', '.').replace(/[^0-9.-]/g, '');
          const parsed = parseFloat(str);
          return isNaN(parsed) ? defaultVal : parsed;
        };

        const parsePgBoolean = (val: any): boolean => {
          if (val === undefined || val === null) return true;
          if (typeof val === 'boolean') return val;
          const str = String(val).toLowerCase().trim();
          return str === 't' || str === 'true' || str === '1' || str === 'y';
        };

        const transformedMenus = menus.map((m: any) => {
          let parsedMealTimes: ('pagi' | 'siang' | 'malam' | 'snack')[] = ['pagi', 'siang', 'malam'];
          const rawTimes = m.waktu_makan || m.mealTimes || m.meal_time;
          if (Array.isArray(rawTimes)) {
            parsedMealTimes = rawTimes;
          } else if (typeof rawTimes === 'string') {
            if (rawTimes.toLowerCase() === 'semua' || rawTimes.toLowerCase() === 'all') {
              parsedMealTimes = ['pagi', 'siang', 'malam'];
            } else {
              try {
                const decoded = JSON.parse(rawTimes);
                if (Array.isArray(decoded)) parsedMealTimes = decoded;
                else parsedMealTimes = rawTimes.split(',').map((s: string) => s.trim().toLowerCase()) as any;
              } catch {
                parsedMealTimes = rawTimes.split(',').map((s: string) => s.trim().toLowerCase()) as any;
              }
            }
          }

          return {
            id: String(m.menu_id || m.id_menu || m.id || `menu-${Date.now()}-${Math.floor(Math.random() * 1000)}`),
            name: String(m.nama_menu || m.name || 'Menu SIMRS').trim(),
            price: parsePgNumber(m.harga ?? m.price, 0),
            category: m.kategori || m.category || 'makanan_utama',
            mealTimes: parsedMealTimes,
            calories: parsePgNumber(m.kalori ?? m.calories, 0),
            protein: parsePgNumber(m.protein_gram ?? m.protein, 0),
            carbs: parsePgNumber(m.karbohidrat_gram ?? m.karbohidrat ?? m.carbs, 0),
            fat: parsePgNumber(m.lemak_gram ?? m.lemak ?? m.fat, 0),
            sodium: parsePgNumber(m.natrium_mg ?? m.natrium ?? m.sodium, 0),
            description: String(m.deskripsi || m.description || ''),
            image: m.foto_url || m.gambar || m.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
            isAvailable: parsePgBoolean(m.tersedia ?? m.isAvailable ?? true),
          };
        });

        return res.json({
          success: true,
          message: `Berhasil mengambil ${transformedMenus.length} menu dari SIMRS`,
          data: transformedMenus,
          total: transformedMenus.length,
        });
      } catch (err: any) {
        return res.status(500).json({
          success: false,
          error: err.message || 'Gagal mengambil menu dari SIMRS',
        });
      }
    }

    // 4c. Fetch Riwayat Pesanan from Laravel SIMRS API (riwayat-pesanan-gizi)
    if (parsedPath.endsWith('/api/simrs/fetch-orders') && ['GET', 'POST'].includes(method)) {
      const { apiUrl, apiKey } = body;
      const rawTargetUrl = (apiUrl || simrsConfigState.apiUrl || 'https://rsbsaonline.com/service/medifirst2000/emr/riwayat-pesanan-gizi').trim();
      const targetToken = (apiKey && typeof apiKey === 'string' && apiKey.trim() !== '')
        ? apiKey.trim()
        : (simrsConfigState.apiKey || '').trim();

      const targetUrl = resolveSimrsFetchOrdersUrl(rawTargetUrl);

      try {
        const headers: Record<string, string> = {
          'Accept': 'application/json',
        };
        if (targetToken) {
          const rawToken = targetToken.replace(/^Bearer\s+/i, '').trim();
          headers['X-AUTH-TOKEN'] = rawToken;
          headers['Authorization'] = `Bearer ${rawToken}`;
        }

        const response = await fetch(targetUrl, {
          method: 'GET',
          headers,
        });

        const responseText = await response.text();
        let parsedData: any;
        try {
          parsedData = JSON.parse(responseText);
        } catch {
          throw new Error(`SIMRS mengembalikan respon yang bukan JSON: ${responseText.slice(0, 100)}...`);
        }

        if (!response.ok) {
          throw new Error(parsedData?.message || parsedData?.error || `HTTP Error ${response.status}`);
        }

        let ordersData = Array.isArray(parsedData) ? parsedData : (Array.isArray(parsedData?.data) ? parsedData.data : []);
        if (!Array.isArray(ordersData)) ordersData = [];

        const transformedOrders = ordersData.map((o: any) => ({
          id: String(o.id || o.no_pesanan || o.order_number || `ord-${Date.now()}`),
          orderNumber: String(o.order_number || o.no_pesanan || `GZ-${Date.now()}`),
          registrationNo: String(o.noregistrasi || o.registrationNo || 'REG-Unknown'),
          createdAt: o.tgl_pesanan || o.created_at || new Date().toISOString(),
          roomName: String(o.room_name || o.kamar || 'Kamar Rawat Inap'),
          patientName: String(o.patient_name || o.nama_pasien || 'Pasien'),
          phoneNumber: o.phone_number || o.telepon || '',
          mealTime: o.meal_time || o.waktu_makan || 'siang',
          items: (function () {
            try {
              if (typeof o.items_json === 'string') return JSON.parse(o.items_json);
              if (Array.isArray(o.items)) return o.items;
            } catch {}
            return [];
          })(),
          patientNotes: o.patient_notes || o.catatan || '',
          status: o.order_status || o.status || 'baru',
        }));

        return res.json({
          success: true,
          message: `Berhasil mengambil ${transformedOrders.length} riwayat pesanan dari SIMRS`,
          data: transformedOrders,
          total: transformedOrders.length,
        });
      } catch (err: any) {
        return res.status(500).json({
          success: false,
          error: err.message || 'Gagal mengambil riwayat pesanan dari SIMRS',
        });
      }
    }

    // 5. Menu Catalog APIs (/api/menu)
    if (parsedPath === '/api/menu' || parsedPath.startsWith('/api/menu/')) {
      if (parsedPath === '/api/menu') {
        if (method === 'GET') {
          // Attempt to live fetch menu directly from SIMRS if token is present
          const rawTargetUrl = (simrsConfigState.apiUrl || 'https://rsbsaonline.com/service/medifirst2000/emr/master-menu-gizi').trim();
          const targetToken = (simrsConfigState.apiKey || '').trim();
          if (targetToken) {
            try {
              const targetUrl = resolveSimrsFetchMenuUrl(rawTargetUrl);
              const rawToken = targetToken.replace(/^Bearer\s+/i, '').trim();
              const response = await fetch(targetUrl, {
                method: 'GET',
                headers: {
                  Accept: 'application/json',
                  'X-AUTH-TOKEN': rawToken,
                  Authorization: `Bearer ${rawToken}`,
                },
              });
              if (response.ok) {
                const parsedData = await response.json().catch(() => null);
                let menus = Array.isArray(parsedData) ? parsedData : (Array.isArray(parsedData?.data) ? parsedData.data : []);
                if (Array.isArray(menus) && menus.length > 0) {
                  const transformed = menus.map((m: any) => {
                    let parsedMealTimes: ('pagi' | 'siang' | 'malam' | 'snack')[] = ['pagi', 'siang', 'malam'];
                    const rawTimes = m.waktu_makan || m.mealTimes || m.meal_time;
                    if (Array.isArray(rawTimes)) {
                      parsedMealTimes = rawTimes;
                    } else if (typeof rawTimes === 'string') {
                      if (rawTimes.toLowerCase() === 'semua' || rawTimes.toLowerCase() === 'all') {
                        parsedMealTimes = ['pagi', 'siang', 'malam'];
                      } else {
                        try {
                          const decoded = JSON.parse(rawTimes);
                          if (Array.isArray(decoded)) parsedMealTimes = decoded;
                          else parsedMealTimes = rawTimes.split(',').map((s: string) => s.trim().toLowerCase()) as any;
                        } catch {
                          parsedMealTimes = rawTimes.split(',').map((s: string) => s.trim().toLowerCase()) as any;
                        }
                      }
                    }

                    const parseNum = (val: any, def = 0): number => {
                      if (val === undefined || val === null) return def;
                      if (typeof val === 'number') return isNaN(val) ? def : val;
                      const s = String(val).replace(',', '.').replace(/[^0-9.-]/g, '');
                      const p = parseFloat(s);
                      return isNaN(p) ? def : p;
                    };

                    const parseBool = (val: any): boolean => {
                      if (val === undefined || val === null) return true;
                      if (typeof val === 'boolean') return val;
                      const s = String(val).toLowerCase().trim();
                      return s === 't' || s === 'true' || s === '1' || s === 'y';
                    };

                    return {
                      id: String(m.menu_id || m.id_menu || m.id || `menu-${Date.now()}-${Math.floor(Math.random() * 1000)}`),
                      name: String(m.nama_menu || m.name || 'Menu SIMRS').trim(),
                      price: parseNum(m.harga ?? m.price, 0),
                      category: (m.kategori || m.category || 'makanan_utama'),
                      mealTimes: parsedMealTimes,
                      calories: parseNum(m.kalori ?? m.calories, 0),
                      protein: parseNum(m.protein_gram ?? m.protein, 0),
                      carbs: parseNum(m.karbohidrat_gram ?? m.karbohidrat ?? m.carbs, 0),
                      fat: parseNum(m.lemak_gram ?? m.lemak ?? m.fat, 0),
                      sodium: parseNum(m.natrium_mg ?? m.natrium ?? m.sodium, 0),
                      description: String(m.deskripsi || m.description || ''),
                      image: m.foto_url || m.gambar || m.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
                      isAvailable: parseBool(m.tersedia ?? m.isAvailable ?? true),
                    };
                  });
                  vercelMenuItems = transformed;
                  return res.json(transformed);
                }
              }
            } catch {}
          }
          return res.json(vercelMenuItems);
        }
        if (method === 'POST') {
          const { name, price, category, mealTimes, calories, protein, carbs, fat, sodium, description, image, isAvailable, simrsApiUrl, simrsApiKey } = body;
          const newItem = {
            id: `menu-${Date.now()}`,
            name: name ? String(name).trim() : 'Menu Baru',
            price: Number(price) >= 0 ? Number(price) : 0,
            category: category || 'makanan_utama',
            mealTimes: Array.isArray(mealTimes) && mealTimes.length > 0 ? mealTimes : ['pagi', 'siang', 'malam'],
            calories: Number(calories) || 100,
            protein: Number(protein) || 5,
            carbs: Number(carbs) || 15,
            fat: Number(fat) || 2,
            sodium: Number(sodium) || 20,
            description: description ? String(description).trim() : '',
            image: image ? String(image).trim() : 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
            isAvailable: isAvailable !== false,
            simrsSync: {
              synced: false,
              statusText: 'Belum disinkronkan ke SIMRS',
            },
          };

          // Automatically sync new master menu to SIMRS (save-master-menu)
          const targetUrl = resolveSimrsSingleMenuUrl(simrsApiUrl || simrsConfigState.apiUrl);
          const targetToken = (simrsApiKey && typeof simrsApiKey === 'string' && simrsApiKey.trim() !== '')
            ? simrsApiKey.trim()
            : (simrsConfigState.apiKey || '').trim();

          if (targetUrl) {
            try {
              const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                Accept: 'application/json',
              };
              if (targetToken) {
                const rawToken = targetToken.replace(/^Bearer\s+/i, '').trim();
                headers['X-AUTH-TOKEN'] = rawToken;
                headers['Authorization'] = `Bearer ${rawToken}`;
              }
              const simrsPayload = {
                id: newItem.id,
                id_menu: newItem.id,
                kd_menu: newItem.id,
                name: newItem.name,
                nama: newItem.name,
                nama_menu: newItem.name,
                category: newItem.category,
                kategori: newItem.category,
                price: newItem.price,
                harga: newItem.price,
                calories: newItem.calories,
                kalori: newItem.calories,
                protein: newItem.protein,
                carbs: newItem.carbs,
                karbohidrat: newItem.carbs,
                fat: newItem.fat,
                lemak: newItem.fat,
                sodium: newItem.sodium,
                natrium: newItem.sodium,
                waktu_makan: newItem.mealTimes,
                deskripsi: newItem.description,
                gambar_url: newItem.image,
                is_tersedia: newItem.isAvailable,
                status: newItem.isAvailable ? 1 : 0,
              };
              const singleRes = await fetch(targetUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(simrsPayload),
              });
              const simrsData = await singleRes.json().catch(() => null);
              if (singleRes.ok) {
                newItem.simrsSync = {
                  synced: true,
                  statusText: 'Tersimpan di SIMRS (save-master-menu)',
                };
              } else {
                newItem.simrsSync = {
                  synced: false,
                  statusText: simrsData?.message || `HTTP ${singleRes.status}: Gagal simpan ke SIMRS`,
                };
              }
            } catch (e: any) {
              newItem.simrsSync = {
                synced: false,
                statusText: `Gagal simpan ke SIMRS: ${e.message}`,
              };
            }
          }

          return res.status(201).json(newItem);
        }
      }

      const pathParts = parsedPath.split('/');
      const menuId = pathParts[3]; // /api/menu/:id
      const isToggle = pathParts[4] === 'toggle';

      if (menuId) {
        if (method === 'PATCH') {
          const updatedItem = {
            id: menuId,
            name: body.name ? String(body.name).trim() : 'Menu',
            price: body.price !== undefined ? Math.max(0, Number(body.price)) : 10000,
            category: body.category || 'makanan_utama',
            mealTimes: Array.isArray(body.mealTimes) ? body.mealTimes : ['pagi', 'siang', 'malam'],
            calories: Number(body.calories) || 100,
            protein: Number(body.protein) || 5,
            carbs: Number(body.carbs) || 15,
            fat: Number(body.fat) || 2,
            sodium: Number(body.sodium) || 20,
            description: body.description ? String(body.description).trim() : '',
            image: body.image ? String(body.image).trim() : 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
            isAvailable: isToggle ? !Boolean(body.isAvailable) : Boolean(body.isAvailable !== false),
          };
          return res.json(updatedItem);
        }

        if (method === 'DELETE') {
          return res.json({ success: true, removedId: menuId });
        }
      }
    }

    // 6. Orders API (/api/orders)
    if (parsedPath.startsWith('/api/orders')) {
      // 6a. PATCH /api/orders/:id/status
      if (parsedPath.includes('/status') && (method === 'PATCH' || method === 'POST')) {
        const parts = parsedPath.split('/');
        // e.g. ['', 'api', 'orders', 'order-123', 'status']
        const orderId = parts[3] || body.id;
        const status = body.status;
        const note = body.note;

        const order = vercelOrders.find(o => o.id === orderId);
        if (!order) {
          return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
        }

        if (status) {
          order.status = status;
          if (!order.statusHistory) order.statusHistory = [];
          order.statusHistory.push({
            status,
            timestamp: new Date().toISOString(),
            note: note || `Status diubah menjadi ${status}`,
          });
        }
        return res.json(order);
      }

      // 6b. DELETE /api/orders/:id
      if (method === 'DELETE') {
        const parts = parsedPath.split('/');
        const orderId = parts[3] || body.id;
        const idx = vercelOrders.findIndex(o => o.id === orderId);
        if (idx !== -1) {
          vercelOrders.splice(idx, 1);
          return res.json({ success: true, removedId: orderId });
        }
        return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
      }

      if (parsedPath === '/api/orders') {
        if (method === 'GET') {
          return res.json(vercelOrders);
        }
        if (method === 'POST') {
        const { roomName, patientName, phoneNumber, registrationNo, mealTime, items, patientNotes } = body;
      const formattedItems = Array.isArray(items) ? items : [];
      let totalPrice = 0;
      let totalCalories = 0;
      const parsedItems = formattedItems.map((it: any) => {
        const p = Number(it.price) || 0;
        const portion = Number(it.portion) || 1;
        const cal = Number(it.calories) || 0;
        totalPrice += p * portion;
        totalCalories += cal * portion;
        return {
          menuItemId: it.menuItemId || it.id || 'item',
          name: it.name || 'Menu',
          portion,
          price: p,
          category: it.category || 'makanan_utama',
          calories: cal,
        };
      });

      const now = new Date();
      const orderNumber = `GZ-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${String(Math.floor(10 + Math.random() * 90))}`;
      const cleanRegNo = (registrationNo && String(registrationNo).trim()) || `REG-${Date.now().toString().slice(-6)}`;

      // Format WhatsApp Message Content
      const menuLines = parsedItems
        .map((it: any, idx: number) => `  ${idx + 1}. *${it.name}* x ${it.portion} porsi = Rp ${(it.price * it.portion).toLocaleString('id-ID')}`)
        .join('\n');

      const waOrderMessage = `🏥 *PESANAN MENU RUMAH SAKIT*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `🚪 *Nama Kamar*: ${roomName || 'Kamar Pasien'}\n` +
        `👤 *Nama Pasien*: ${patientName || 'Pasien Rawat Inap'}\n` +
        `📱 *Nomor Telepon*: ${phoneNumber || '-'}\n` +
        `🍽️ *Waktu Makan*: Makan ${(mealTime || 'siang').toUpperCase()}\n` +
        `🔖 *No. Pesanan*: ${orderNumber}\n` +
        `⏰ *Waktu Pesan*: ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB\n\n` +
        `📋 *MENU YANG DIPESAN*:\n${menuLines}\n\n` +
        `💰 *Total Biaya*: *Rp ${totalPrice.toLocaleString('id-ID')}*\n` +
        `🔥 *Total Kalori*: ${totalCalories} kkal\n\n` +
        `📝 *Catatan Khusus*:\n${patientNotes ? `"${patientNotes}"` : '- Tidak ada catatan khusus -'}\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `_Pesanan telah terkirim langsung ke Dapur Gizi Rumah Sakit via SIAPMAKAN_`;

      const newOrder = {
        id: `ord-${Date.now()}`,
        orderNumber,
        registrationNo: cleanRegNo,
        createdAt: now.toISOString(),
        roomName: roomName ? String(roomName).trim() : 'Kamar Pasien',
        patientName: patientName ? String(patientName).trim() : 'Pasien Rawat Inap',
        phoneNumber: phoneNumber ? String(phoneNumber).trim() : '',
        mealTime: mealTime || 'siang',
        items: parsedItems,
        totalPrice,
        totalCalories,
        patientNotes: patientNotes ? String(patientNotes).trim() : '',
        status: 'baru',
        statusHistory: [
          { status: 'baru', timestamp: now.toISOString(), note: 'Pesanan dibuat di sistem' }
        ],
        simrsSync: {
          synced: false,
          statusText: simrsConfigState.apiUrl ? 'Menghubungkan ke SIMRS...' : 'Endpoint SIMRS belum disetel',
        }
      };

      // Auto sync to SIMRS if configured
      const effectiveUrl = body.simrsConfig?.apiUrl || simrsConfigState.apiUrl;
      const effectiveToken = body.simrsConfig?.apiKey !== undefined ? body.simrsConfig.apiKey : simrsConfigState.apiKey;

      if (effectiveUrl && simrsConfigState.autoSyncOnOrder) {
        try {
          const targetUrl = resolveSimrsOrderUrl(effectiveUrl);
          const payload = {
            noregistrasi: cleanRegNo,
            order_number: orderNumber,
            no_pesanan: orderNumber,
            orderNumber,
            orderId: orderNumber,
            room_name: newOrder.roomName,
            roomName: newOrder.roomName,
            nomor_kamar: newOrder.roomName,
            patient_name: newOrder.patientName,
            patientName: newOrder.patientName,
            nama_pasien: newOrder.patientName,
            phone_number: newOrder.phoneNumber,
            phoneNumber: newOrder.phoneNumber,
            meal_time: newOrder.mealTime,
            mealTime: newOrder.mealTime,
            waktu_makan: newOrder.mealTime,
            total_price: totalPrice,
            totalPrice,
            total_biaya: totalPrice,
            total_calories: totalCalories,
            totalCalories,
            total_kalori: totalCalories,
            patient_notes: newOrder.patientNotes,
            patientNotes: newOrder.patientNotes,
            dietaryNotes: newOrder.patientNotes,
            status: 'baru',
            order_status: 'baru',
            status_pesanan: 'baru',
            items: parsedItems,
            menu_items: parsedItems,
            hasil_json: {
              orderId: orderNumber,
              order_number: orderNumber,
              no_pesanan: orderNumber,
              noregistrasi: cleanRegNo,
              roomName: newOrder.roomName,
              patientName: newOrder.patientName,
              phoneNumber: newOrder.phoneNumber,
              mealTime: newOrder.mealTime,
              totalPrice,
              totalCalories,
              patientNotes: newOrder.patientNotes,
              status: 'baru',
              items: parsedItems,
              createdAt: now.toISOString(),
            }
          };

          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          };
          if (effectiveToken) {
            const raw = effectiveToken.replace(/^Bearer\s+/i, '').trim();
            headers['X-AUTH-TOKEN'] = raw;
            headers['Authorization'] = `Bearer ${raw}`;
          }

          const simrsRes = await fetch(targetUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
          });
          const resData = await simrsRes.json().catch(() => null);

          if (simrsRes.ok && resData?.status !== 'error') {
            newOrder.simrsSync = {
              synced: true,
              statusText: 'Tersimpan di SIMRS (PostgreSQL & X-AUTH-TOKEN)',
            };
          } else {
            newOrder.simrsSync = {
              synced: false,
              statusText: `Gagal kirim SIMRS: ${resData?.message || simrsRes.statusText || 'Error server'}`,
            };
          }
        } catch (e: any) {
          newOrder.simrsSync = {
            synced: false,
            statusText: `Gagal simpan ke SIMRS: ${e.message}`,
          };
        }
      }

      vercelOrders.unshift(newOrder);

      return res.status(201).json({
        order: newOrder,
        simrsSynced: newOrder.simrsSync.synced,
        simrsStatusText: newOrder.simrsSync.statusText,
      });
        }
      }
    }

    // Default Fallback for other /api routes
    return res.status(200).json({
      status: 'ok',
      message: 'Nutri Hospital API running on Vercel Serverless Function',
      path: parsedPath,
      method,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: err.message || 'Internal Server Error',
    });
  }
}

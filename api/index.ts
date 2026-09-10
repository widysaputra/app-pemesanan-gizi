import type { IncomingMessage, ServerResponse } from 'http';

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

// In-memory runtime storage for Vercel serverless instance
let simrsConfigState = {
  apiUrl: process.env.SIMRS_API_URL || 'http://localhost:8000/api/save-pesanan-gizi',
  apiKey: process.env.SIMRS_TOKEN || process.env.SIMRS_API_KEY || '',
  authHeaderType: 'X-AUTH-TOKEN' as 'X-AUTH-TOKEN' | 'Bearer' | 'Both',
  autoSyncOnOrder: true,
  isConfigured: Boolean(process.env.SIMRS_API_URL),
};

let fonnteConfigState = {
  token: process.env.FONNTE_TOKEN || '',
  targetNumber: process.env.FONNTE_TARGET_PHONE || '081234567890',
  sendToAdmin: true,
  sendToPatient: true,
  isConfigured: Boolean(process.env.FONNTE_TOKEN),
};

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

      const samplePayload = {
        noregistrasi: 'TEST-' + Date.now().toString().slice(-6),
        hasil_json: {
          orderNumber: 'GZ-UJI-VERCEL',
          patientName: 'Uji Coba Integrasi SIMRS',
          roomName: 'Kamar Bedah / Tes',
          mealTime: 'siang',
          totalPrice: 28000,
          patientNotes: 'Uji coba komunikasi endpoint Laravel SIMRS dengan header X-AUTH-TOKEN via Vercel',
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

    // 3. Fonnte Config GET & POST
    if (parsedPath.endsWith('/api/fonnte/config')) {
      if (method === 'GET') {
        const tokenMasked = fonnteConfigState.token
          ? `${fonnteConfigState.token.slice(0, 3)}••••${fonnteConfigState.token.slice(-3)}`
          : '';
        return res.json({
          tokenMasked,
          targetNumber: fonnteConfigState.targetNumber,
          sendToAdmin: fonnteConfigState.sendToAdmin,
          sendToPatient: fonnteConfigState.sendToPatient,
          isConfigured: fonnteConfigState.isConfigured,
        });
      }

      if (method === 'POST') {
        if (body.token !== undefined && body.token !== '') fonnteConfigState.token = String(body.token).trim();
        if (body.targetNumber !== undefined) fonnteConfigState.targetNumber = String(body.targetNumber).trim();
        if (body.sendToAdmin !== undefined) fonnteConfigState.sendToAdmin = Boolean(body.sendToAdmin);
        if (body.sendToPatient !== undefined) fonnteConfigState.sendToPatient = Boolean(body.sendToPatient);
        fonnteConfigState.isConfigured = Boolean(fonnteConfigState.token && fonnteConfigState.token.length > 3);

        const tokenMasked = fonnteConfigState.token
          ? `${fonnteConfigState.token.slice(0, 3)}••••${fonnteConfigState.token.slice(-3)}`
          : '';
        return res.json({
          success: true,
          message: 'Pengaturan WhatsApp Fonnte berhasil disimpan!',
          config: {
            tokenMasked,
            targetNumber: fonnteConfigState.targetNumber,
            sendToAdmin: fonnteConfigState.sendToAdmin,
            sendToPatient: fonnteConfigState.sendToPatient,
            isConfigured: fonnteConfigState.isConfigured,
          },
        });
      }
    }

    // 4. Simulator Endpoints (Local Testing)
    if (parsedPath.endsWith('/api/save-pesanan-gizi') && method === 'POST') {
      const authHeader = (req.headers['x-auth-token'] || req.headers['authorization'] || '') as string;
      return res.json({
        status: 'success',
        message: 'Data pesanan gizi pasien berhasil disimpan ke SIMRS (Vercel Simulator)',
        received_auth_header: authHeader ? 'Header terverifikasi' : 'Tanpa header',
        data: body,
      });
    }

    if (parsedPath.endsWith('/api/sync-batch-menu') && method === 'POST') {
      const items = Array.isArray(body?.menu_items) ? body.menu_items : [];
      return res.json({
        status: 'success',
        message: `${items.length} master menu gizi berhasil disinkronkan ke SIMRS (Vercel Simulator)`,
        total_items: items.length,
      });
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

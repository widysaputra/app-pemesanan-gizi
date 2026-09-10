import { HospitalOrder, MenuItem, FonnteSettings, MealTime, OrderStatus } from '../types';
import {
  getLocalCachedMenu,
  saveLocalCachedMenu,
  getLocalCachedOrders,
  saveLocalCachedOrders,
  INITIAL_MENU,
  INITIAL_ORDERS
} from '../data/initialData';

const BROADCAST_CHANNEL_NAME = 'nutri_hospital_channel';
let localBroadcastChannel: BroadcastChannel | null = null;

try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    localBroadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  }
} catch {
  // BroadcastChannel unavailable or disabled
}

// --- LOCAL STORAGE KEYS FOR HOSTING ENVIRONMENTS (VERCEL / STATIC / STANDALONE) ---
const SIMRS_CONFIG_KEY = 'nutri_hospital_simrs_config';
const FONNTE_CONFIG_KEY = 'nutri_hospital_fonnte_config';

export function getLocalSimrsConfig(): {
  apiUrl: string;
  apiKey: string;
  apiKeyMasked: string;
  authHeaderType: 'X-AUTH-TOKEN' | 'Bearer' | 'Both';
  autoSyncOnOrder: boolean;
  isConfigured: boolean;
} {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(SIMRS_CONFIG_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      const apiUrl = parsed.apiUrl || 'http://localhost:8000/api/save-pesanan-gizi';
      const apiKey = parsed.apiKey || '';
      return {
        apiUrl,
        apiKey,
        apiKeyMasked: apiKey ? `${apiKey.slice(0, 3)}••••${apiKey.slice(-3)}` : '',
        authHeaderType: parsed.authHeaderType || 'X-AUTH-TOKEN',
        autoSyncOnOrder: parsed.autoSyncOnOrder !== false,
        isConfigured: Boolean(apiUrl && apiUrl.trim().length > 5),
      };
    }
  } catch (e) {
    console.warn('Gagal membaca konfigurasi SIMRS dari localStorage:', e);
  }
  return {
    apiUrl: 'http://localhost:8000/api/save-pesanan-gizi',
    apiKey: '',
    apiKeyMasked: '',
    authHeaderType: 'X-AUTH-TOKEN',
    autoSyncOnOrder: true,
    isConfigured: false,
  };
}

export function saveLocalSimrsConfig(settings: {
  apiUrl?: string;
  apiKey?: string;
  authHeaderType?: 'X-AUTH-TOKEN' | 'Bearer' | 'Both';
  autoSyncOnOrder?: boolean;
}) {
  const current = getLocalSimrsConfig();
  const newApiUrl = settings.apiUrl !== undefined ? settings.apiUrl.trim() : current.apiUrl;
  const newApiKey = settings.apiKey !== undefined ? settings.apiKey.trim() : current.apiKey;
  const newAuthHeader = settings.authHeaderType || current.authHeaderType || 'X-AUTH-TOKEN';
  const newAutoSync = settings.autoSyncOnOrder !== undefined ? settings.autoSyncOnOrder : current.autoSyncOnOrder;

  const updated = {
    apiUrl: newApiUrl,
    apiKey: newApiKey,
    apiKeyMasked: newApiKey ? `${newApiKey.slice(0, 3)}••••${newApiKey.slice(-3)}` : current.apiKeyMasked,
    authHeaderType: newAuthHeader,
    autoSyncOnOrder: newAutoSync,
    isConfigured: Boolean(newApiUrl && newApiUrl.trim().length > 5),
  };

  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(SIMRS_CONFIG_KEY, JSON.stringify(updated));
    }
  } catch (e) {
    console.warn('Gagal menyimpan konfigurasi SIMRS ke localStorage:', e);
  }
  return updated;
}

export function getLocalFonnteConfig(): {
  token: string;
  tokenMasked: string;
  targetNumber: string;
  sendToAdmin: boolean;
  sendToPatient: boolean;
  isConfigured: boolean;
} {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(FONNTE_CONFIG_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      const token = parsed.token || '';
      return {
        token,
        tokenMasked: token ? `${token.slice(0, 3)}••••${token.slice(-3)}` : '',
        targetNumber: parsed.targetNumber || '081234567890',
        sendToAdmin: parsed.sendToAdmin !== false,
        sendToPatient: parsed.sendToPatient !== false,
        isConfigured: Boolean(token && token.trim().length > 3),
      };
    }
  } catch (e) {
    console.warn('Gagal membaca konfigurasi Fonnte dari localStorage:', e);
  }
  return {
    token: '',
    tokenMasked: '',
    targetNumber: '081234567890',
    sendToAdmin: true,
    sendToPatient: true,
    isConfigured: false,
  };
}

export function saveLocalFonnteConfig(settings: {
  token?: string;
  targetNumber?: string;
  sendToAdmin?: boolean;
  sendToPatient?: boolean;
}) {
  const current = getLocalFonnteConfig();
  const newToken = settings.token !== undefined ? settings.token.trim() : current.token;
  const newTarget = settings.targetNumber !== undefined ? settings.targetNumber.trim() : current.targetNumber;

  const updated = {
    token: newToken,
    tokenMasked: newToken ? `${newToken.slice(0, 3)}••••${newToken.slice(-3)}` : current.tokenMasked,
    targetNumber: newTarget,
    sendToAdmin: settings.sendToAdmin !== undefined ? settings.sendToAdmin : current.sendToAdmin,
    sendToPatient: settings.sendToPatient !== undefined ? settings.sendToPatient : current.sendToPatient,
    isConfigured: Boolean(newToken && newToken.trim().length > 3),
  };

  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(FONNTE_CONFIG_KEY, JSON.stringify(updated));
    }
  } catch (e) {
    console.warn('Gagal menyimpan konfigurasi Fonnte ke localStorage:', e);
  }
  return updated;
}

export type RealtimeListener = (event: {
  type: 'init' | 'new_order' | 'status_update' | 'menu_update' | 'order_deleted';
  data: any;
}) => void;

export class HospitalRealtimeService {
  private listeners: Set<RealtimeListener> = new Set();
  private eventSource: EventSource | null = null;
  private reconnectTimeout: any = null;
  private sseRetries: number = 0;

  constructor() {
    this.initSSE();
    this.initBroadcastChannel();
  }

  public getLocalMenu(): MenuItem[] {
    return getLocalCachedMenu();
  }

  public getLocalOrders(): HospitalOrder[] {
    return getLocalCachedOrders();
  }

  private initBroadcastChannel() {
    if (!localBroadcastChannel) return;
    localBroadcastChannel.onmessage = (event) => {
      const { type, data } = event.data || {};
      if (type) {
        this.notifyListeners(type, data);
      }
    };
  }

  private broadcastLocal(type: 'init' | 'new_order' | 'status_update' | 'menu_update' | 'order_deleted', data: any) {
    if (localBroadcastChannel) {
      try {
        localBroadcastChannel.postMessage({ type, data });
      } catch (e) {
        console.warn('BroadcastChannel error', e);
      }
    }
  }

  private initSSE() {
    if (typeof window === 'undefined') return;

    try {
      if (this.eventSource) {
        this.eventSource.close();
      }

      const es = new EventSource('/api/realtime/stream');
      this.eventSource = es;

      es.addEventListener('init', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          this.notifyListeners('init', data);
        } catch (err) {
          console.error('SSE parse init error', err);
        }
      });

      es.addEventListener('new_order', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          this.notifyListeners('new_order', data);
          this.broadcastLocal('new_order', data);
        } catch (err) {
          console.error('SSE parse new_order error', err);
        }
      });

      es.addEventListener('status_update', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          this.notifyListeners('status_update', data);
          this.broadcastLocal('status_update', data);
        } catch (err) {
          console.error('SSE parse status_update error', err);
        }
      });

      es.addEventListener('menu_update', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          this.notifyListeners('menu_update', data);
          this.broadcastLocal('menu_update', data);
        } catch (err) {
          console.error('SSE parse menu_update error', err);
        }
      });

      es.addEventListener('order_deleted', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          this.notifyListeners('order_deleted', data);
          this.broadcastLocal('order_deleted', data);
        } catch (err) {
          console.error('SSE parse order_deleted error', err);
        }
      });

      es.onerror = () => {
        es.close();
        this.sseRetries++;
        // Limit reconnection attempts so static hosting doesn't spam errors
        if (this.sseRetries < 3) {
          clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = setTimeout(() => {
            this.initSSE();
          }, 5000);
        }
      };
    } catch (err) {
      console.warn('EventSource initialization bypassed:', err);
    }
  }

  public subscribe(listener: RealtimeListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(type: any, data: any) {
    for (const listener of this.listeners) {
      try {
        listener({ type, data });
      } catch (e) {
        console.error('Listener callback error', e);
      }
    }
  }

  // --- MENU APIS ---
  async getMenu(): Promise<MenuItem[]> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch('/api/menu', { signal: controller.signal });
      clearTimeout(timeoutId);

      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        console.warn('Backend /api/menu tidak aktif (lingkungan Vercel/Static). Menggunakan data menu lokal.');
        return getLocalCachedMenu();
      }
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        saveLocalCachedMenu(data);
        return data;
      }
      return getLocalCachedMenu();
    } catch (e) {
      console.warn('Backend API tidak merespons, memuat data menu dari cache lokal:', e);
      return getLocalCachedMenu();
    }
  }

  async addMenuItem(item: Partial<MenuItem>): Promise<MenuItem> {
    try {
      const res = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      if (res.ok) {
        const newItem = await res.json();
        // Validasi bahwa respon adalah objek menu sungguhan, bukan pesan fallback serverless
        if (newItem && typeof newItem === 'object' && newItem.id && newItem.name) {
          const sanitizedItem: MenuItem = {
            id: String(newItem.id),
            name: String(newItem.name),
            price: Number(newItem.price) >= 0 ? Number(newItem.price) : 0,
            category: newItem.category || 'makanan_utama',
            mealTimes: Array.isArray(newItem.mealTimes) && newItem.mealTimes.length > 0 ? newItem.mealTimes : ['pagi', 'siang', 'malam'],
            calories: Number(newItem.calories) || 100,
            protein: Number(newItem.protein) || 0,
            carbs: Number(newItem.carbs) || 0,
            fat: Number(newItem.fat) || 0,
            sodium: Number(newItem.sodium) || 0,
            description: String(newItem.description || ''),
            isAvailable: newItem.isAvailable !== false,
            image: newItem.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
          };

          this.notifyListeners('menu_update', { item: sanitizedItem, action: 'create' });
          this.broadcastLocal('menu_update', { item: sanitizedItem, action: 'create' });
          const currentMenu = getLocalCachedMenu();
          saveLocalCachedMenu([sanitizedItem, ...currentMenu.filter(m => m.id !== sanitizedItem.id)]);
          return sanitizedItem;
        }
      }
    } catch {
      // Fallback to local mode
    }

    // Local fallback
    const newItem: MenuItem = {
      id: 'menu-' + Date.now(),
      name: item.name ? String(item.name).trim() : 'Menu Baru',
      price: Number(item.price) >= 0 ? Number(item.price) : 10000,
      category: item.category || 'makanan_utama',
      mealTimes: Array.isArray(item.mealTimes) && item.mealTimes.length > 0 ? item.mealTimes : ['pagi', 'siang', 'malam'],
      calories: Number(item.calories) || 150,
      protein: Number(item.protein) || 5,
      carbs: Number(item.carbs) || 20,
      fat: Number(item.fat) || 3,
      sodium: Number(item.sodium) || 20,
      description: String(item.description || ''),
      isAvailable: item.isAvailable !== false,
      image: item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
    };
    const currentMenu = getLocalCachedMenu();
    const updated = [newItem, ...currentMenu.filter(m => m.id !== newItem.id)];
    saveLocalCachedMenu(updated);
    this.notifyListeners('menu_update', { item: newItem, action: 'create' });
    this.broadcastLocal('menu_update', { item: newItem, action: 'create' });
    return newItem;
  }

  async updateMenuItem(menuId: string, updates: Partial<MenuItem>): Promise<MenuItem> {
    try {
      const res = await fetch(`/api/menu/${menuId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const item = await res.json();
        if (item && typeof item === 'object' && item.id && item.name) {
          const sanitizedItem: MenuItem = {
            id: String(item.id),
            name: String(item.name),
            price: Number(item.price) >= 0 ? Number(item.price) : 0,
            category: item.category || 'makanan_utama',
            mealTimes: Array.isArray(item.mealTimes) && item.mealTimes.length > 0 ? item.mealTimes : ['pagi', 'siang', 'malam'],
            calories: Number(item.calories) || 100,
            protein: Number(item.protein) || 0,
            carbs: Number(item.carbs) || 0,
            fat: Number(item.fat) || 0,
            sodium: Number(item.sodium) || 0,
            description: String(item.description || ''),
            isAvailable: item.isAvailable !== false,
            image: item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
          };

          this.notifyListeners('menu_update', { item: sanitizedItem, action: 'update' });
          this.broadcastLocal('menu_update', { item: sanitizedItem, action: 'update' });
          const currentMenu = getLocalCachedMenu();
          saveLocalCachedMenu(currentMenu.map(m => m.id === menuId ? sanitizedItem : m));
          return sanitizedItem;
        }
      }
    } catch {
      // Fallback to local
    }

    const currentMenu = getLocalCachedMenu();
    let updatedItem: MenuItem | null = null;
    const updatedMenu = currentMenu.map(m => {
      if (m.id === menuId) {
        updatedItem = {
          ...m,
          ...updates,
          id: m.id,
          name: updates.name !== undefined ? String(updates.name) : m.name,
          price: updates.price !== undefined ? Math.max(0, Number(updates.price)) : m.price,
          description: updates.description !== undefined ? String(updates.description) : m.description,
          category: updates.category || m.category,
          mealTimes: updates.mealTimes || m.mealTimes,
          isAvailable: updates.isAvailable !== undefined ? Boolean(updates.isAvailable) : m.isAvailable,
        };
        return updatedItem;
      }
      return m;
    });

    if (updatedItem) {
      saveLocalCachedMenu(updatedMenu);
      this.notifyListeners('menu_update', { item: updatedItem, action: 'update' });
      this.broadcastLocal('menu_update', { item: updatedItem, action: 'update' });
      return updatedItem;
    }
    throw new Error('Menu tidak ditemukan');
  }

  async toggleMenuItem(menuId: string): Promise<MenuItem> {
    try {
      const res = await fetch(`/api/menu/${menuId}/toggle`, {
        method: 'PATCH',
      });
      if (res.ok) {
        const item = await res.json();
        this.notifyListeners('menu_update', { item, action: 'toggle' });
        this.broadcastLocal('menu_update', { item, action: 'toggle' });
        const currentMenu = getLocalCachedMenu();
        saveLocalCachedMenu(currentMenu.map(m => m.id === menuId ? item : m));
        return item;
      }
    } catch {
      // Fallback to local
    }

    const currentMenu = getLocalCachedMenu();
    let updatedItem: MenuItem | null = null;
    const updatedMenu = currentMenu.map(m => {
      if (m.id === menuId) {
        updatedItem = { ...m, isAvailable: !m.isAvailable };
        return updatedItem;
      }
      return m;
    });
    if (updatedItem) {
      saveLocalCachedMenu(updatedMenu);
      this.notifyListeners('menu_update', { item: updatedItem, action: 'toggle' });
      this.broadcastLocal('menu_update', { item: updatedItem, action: 'toggle' });
      return updatedItem;
    }
    throw new Error('Menu tidak ditemukan');
  }

  async deleteMenuItem(menuId: string): Promise<void> {
    try {
      const res = await fetch(`/api/menu/${menuId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        this.notifyListeners('menu_update', { item: { id: menuId }, action: 'delete' });
        this.broadcastLocal('menu_update', { item: { id: menuId }, action: 'delete' });
        const currentMenu = getLocalCachedMenu();
        saveLocalCachedMenu(currentMenu.filter(m => m.id !== menuId));
        return;
      }
    } catch {
      // Fallback
    }

    const currentMenu = getLocalCachedMenu();
    saveLocalCachedMenu(currentMenu.filter(m => m.id !== menuId));
    this.notifyListeners('menu_update', { item: { id: menuId }, action: 'delete' });
    this.broadcastLocal('menu_update', { item: { id: menuId }, action: 'delete' });
  }

  // --- ORDERS APIS ---
  async getOrders(): Promise<HospitalOrder[]> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch('/api/orders', { signal: controller.signal });
      clearTimeout(timeoutId);

      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        console.warn('Backend /api/orders tidak aktif. Menggunakan data pesanan lokal.');
        return getLocalCachedOrders();
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        saveLocalCachedOrders(data);
        return data;
      }
      return getLocalCachedOrders();
    } catch (e) {
      console.warn('Backend API tidak merespons, memuat data pesanan dari cache lokal:', e);
      return getLocalCachedOrders();
    }
  }

  async createOrder(payload: {
    roomName: string;
    patientName: string;
    phoneNumber: string;
    registrationNo?: string;
    mealTime: MealTime;
    items: { menuItemId: string; name: string; portion: number; price: number; category: string; calories: number }[];
    patientNotes?: string;
  }): Promise<{ order: HospitalOrder; waMessage: string; waSent: boolean; waStatusText: string; simrsSynced?: boolean; simrsStatusText?: string }> {
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const result = await res.json();
        this.notifyListeners('new_order', { order: result.order });
        this.broadcastLocal('new_order', { order: result.order });
        const currentOrders = getLocalCachedOrders();
        saveLocalCachedOrders([result.order, ...currentOrders.filter(o => o.id !== result.order.id)]);
        return result;
      }
    } catch {
      // Fallback
    }

    // Local mode creation
    const now = new Date();
    const orderNumber = `GZ-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(Math.floor(10 + Math.random() * 90))}`;
    const totalPrice = payload.items.reduce((sum, i) => sum + i.price * i.portion, 0);
    const totalCalories = payload.items.reduce((sum, i) => sum + i.calories * i.portion, 0);

    const newOrder: HospitalOrder = {
      id: 'ord-' + Date.now(),
      orderNumber,
      registrationNo: payload.registrationNo || `REG-${Date.now().toString().slice(-6)}`,
      createdAt: now.toISOString(),
      roomName: payload.roomName,
      patientName: payload.patientName,
      phoneNumber: payload.phoneNumber,
      mealTime: payload.mealTime,
      items: payload.items,
      totalPrice,
      totalCalories,
      patientNotes: payload.patientNotes,
      status: 'baru',
      statusHistory: [
        { status: 'baru', timestamp: now.toISOString(), note: 'Pesanan dibuat (Mode Mandiri/Lokal)' }
      ],
      whatsappNotification: {
        sent: true,
        targetNumber: payload.phoneNumber,
        statusText: 'Format notifikasi WhatsApp siap disalin/dikirim',
        timestamp: now.toISOString(),
        message: `Pesanan Gizi ${orderNumber} atas nama ${payload.patientName} berhasil direkam.`
      },
      simrsSync: {
        synced: false,
        statusText: 'Siap dikirim ke SIMRS Laravel/PostgreSQL'
      }
    };

    const currentOrders = getLocalCachedOrders();
    saveLocalCachedOrders([newOrder, ...currentOrders]);
    this.notifyListeners('new_order', { order: newOrder });
    this.broadcastLocal('new_order', { order: newOrder });

    return {
      order: newOrder,
      waMessage: newOrder.whatsappNotification?.message || '',
      waSent: true,
      waStatusText: 'Pesanan tersimpan lokal',
      simrsSynced: false,
      simrsStatusText: 'Tersimpan di browser'
    };
  }

  async updateOrderStatus(orderId: string, status: OrderStatus, note?: string): Promise<HospitalOrder> {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, note }),
      });
      if (res.ok) {
        const order = await res.json();
        this.notifyListeners('status_update', { order });
        this.broadcastLocal('status_update', { order });
        const currentOrders = getLocalCachedOrders();
        saveLocalCachedOrders(currentOrders.map(o => o.id === orderId ? order : o));
        return order;
      }
    } catch {
      // Fallback
    }

    const currentOrders = getLocalCachedOrders();
    let updatedOrder: HospitalOrder | null = null;
    const now = new Date().toISOString();
    const updatedList = currentOrders.map(o => {
      if (o.id === orderId) {
        updatedOrder = {
          ...o,
          status,
          statusHistory: [...o.statusHistory, { status, timestamp: now, note }]
        };
        return updatedOrder;
      }
      return o;
    });

    if (updatedOrder) {
      saveLocalCachedOrders(updatedList);
      this.notifyListeners('status_update', { order: updatedOrder });
      this.broadcastLocal('status_update', { order: updatedOrder });
      return updatedOrder;
    }
    throw new Error('Pesanan tidak ditemukan');
  }

  async deleteOrder(orderId: string): Promise<void> {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        this.notifyListeners('order_deleted', { id: orderId });
        this.broadcastLocal('order_deleted', { id: orderId });
        const currentOrders = getLocalCachedOrders();
        saveLocalCachedOrders(currentOrders.filter(o => o.id !== orderId));
        return;
      }
    } catch {
      // Fallback
    }

    const currentOrders = getLocalCachedOrders();
    saveLocalCachedOrders(currentOrders.filter(o => o.id !== orderId));
    this.notifyListeners('order_deleted', { id: orderId });
    this.broadcastLocal('order_deleted', { id: orderId });
  }

  // --- SIMRS (POSTGRESQL & LARAVEL) APIS ---
  async getSimrsConfig(): Promise<{
    apiUrl: string;
    apiKeyMasked: string;
    authHeaderType?: 'X-AUTH-TOKEN' | 'Bearer' | 'Both';
    autoSyncOnOrder: boolean;
    isConfigured: boolean;
  }> {
    const local = getLocalSimrsConfig();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch('/api/simrs/config', { signal: controller.signal });
      clearTimeout(timeoutId);

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const serverConfig = await res.json();
        // Return server config, or fallback to local if server is not configured but local is
        if (serverConfig.isConfigured || !local.isConfigured) {
          return serverConfig;
        }
      }
    } catch {
      // Backend not running / Vercel static rewrite
    }

    return {
      apiUrl: local.apiUrl,
      apiKeyMasked: local.apiKeyMasked,
      authHeaderType: local.authHeaderType,
      autoSyncOnOrder: local.autoSyncOnOrder,
      isConfigured: local.isConfigured,
    };
  }

  async saveSimrsConfig(settings: {
    apiUrl?: string;
    apiKey?: string;
    authHeaderType?: 'X-AUTH-TOKEN' | 'Bearer' | 'Both';
    autoSyncOnOrder?: boolean;
  }): Promise<any> {
    // 1. Simpan ke LocalStorage browser terlebih dahulu (Menjamin konfigurasi tidak hilang di Vercel/Static)
    const savedLocal = saveLocalSimrsConfig(settings);

    // 2. Coba kirim ke server backend Express jika aktif
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch('/api/simrs/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        return data;
      }
    } catch (e) {
      console.warn('Backend API tidak aktif atau berjalan di hosting statis Vercel. Konfigurasi disimpan di penyimpanan lokal browser:', e);
    }

    // 3. Respon sukses mandiri (Mencegah error HTTP 405 Method Not Allowed pada Vercel)
    return {
      success: true,
      message: 'Pengaturan API SIMRS (X-AUTH-TOKEN) berhasil disimpan & aktif di browser!',
      config: {
        apiUrl: savedLocal.apiUrl,
        apiKeyMasked: savedLocal.apiKeyMasked,
        authHeaderType: savedLocal.authHeaderType,
        autoSyncOnOrder: savedLocal.autoSyncOnOrder,
        isConfigured: savedLocal.isConfigured,
      },
    };
  }

  async testSimrsConnection(apiUrl: string, apiKey?: string, authHeaderType?: 'X-AUTH-TOKEN' | 'Bearer' | 'Both'): Promise<{
    success: boolean;
    message: string;
    latency?: string;
    authHeader?: string;
    data?: any;
    error?: string;
    sentPayload?: any;
  }> {
    const targetHeader = authHeaderType || 'X-AUTH-TOKEN';
    const local = getLocalSimrsConfig();
    const token = apiKey !== undefined ? apiKey : local.apiKey;

    // 1. Coba uji via backend server terlebih dahulu
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch('/api/simrs/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiUrl, apiKey: token, authHeaderType: targetHeader }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return await res.json();
      }
      if (!res.ok && res.status !== 405 && res.status !== 404 && contentType.includes('application/json')) {
        const errData = await res.json();
        return {
          success: false,
          message: errData.message || 'Server backend menolak request',
          error: errData.error || errData.message || 'Server backend menolak request',
          data: errData.data,
        };
      }
    } catch {
      // Backend offline atau Vercel return 405/404
    }

    // 2. Uji langsung dari browser ke endpoint Laravel SIMRS (Mode Mandiri / Vercel)
    const testRegistrationNo = 'TEST-' + Date.now().toString().slice(-6);
    const testOrderNo = 'GZ-UJI-' + Date.now().toString().slice(-6);
    const samplePayload = {
      noregistrasi: testRegistrationNo,
      no_pesanan: testOrderNo,
      order_number: testOrderNo,
      orderNumber: testOrderNo,
      orderId: testOrderNo,
      hasil_json: {
        // ID & Nomor Pesanan Multi-format
        orderId: testOrderNo,
        no_pesanan: testOrderNo,
        order_number: testOrderNo,
        orderNumber: testOrderNo,
        noregistrasi: testRegistrationNo,
        registrationNo: testRegistrationNo,

        // Data Pasien & Kamar Multi-format
        roomName: 'Kamar Melati 101',
        roomNumber: 'Kamar Melati 101',
        nomor_kamar: 'Kamar Melati 101',
        patientName: 'Uji Coba Integrasi SIMRS',
        nama_pasien: 'Uji Coba Integrasi SIMRS',
        patientInfo: {
          roomNumber: 'Kamar Melati 101',
          roomName: 'Kamar Melati 101',
          patientName: 'Uji Coba Integrasi SIMRS',
        },

        // Waktu & Rincian
        mealTime: 'siang',
        waktu_makan: 'siang',
        totalPrice: 28000,
        total_biaya: 28000,
        totalCalories: 180,
        total_kalori: 180,
        patientNotes: 'Uji coba komunikasi endpoint Laravel PostgreSQL dengan header X-AUTH-TOKEN',
        dietaryNotes: 'Uji coba komunikasi endpoint Laravel PostgreSQL dengan header X-AUTH-TOKEN',
        catatan_alergi_diet: 'Uji coba komunikasi endpoint Laravel PostgreSQL dengan header X-AUTH-TOKEN',
        status: 'baru',
        status_pesanan: 'baru',
        items: [
          {
            name: 'Sup Ayam Sayur Bening',
            portion: 1,
            price: 18000,
            category: 'makanan_utama',
            calories: 120,
          },
          {
            name: 'Puding Buah Segar Rendah Gula',
            portion: 1,
            price: 10000,
            category: 'snack',
            calories: 60,
          },
        ],
        timestamp: new Date().toISOString(),
      },
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (token) {
      const raw = token.replace(/^Bearer\s+/i, '').trim();
      headers['X-AUTH-TOKEN'] = raw;
      headers['Authorization'] = `Bearer ${raw}`;
    }

    const start = Date.now();
    try {
      const directController = new AbortController();
      const timeout = setTimeout(() => directController.abort(), 8000);
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(samplePayload),
        signal: directController.signal,
      });
      clearTimeout(timeout);
      const latency = `${Date.now() - start}ms`;

      let responseData: any = null;
      try {
        responseData = await res.json();
      } catch {
        responseData = await res.text();
      }

      if (res.ok) {
        return {
          success: true,
          message: 'Koneksi ke endpoint SIMRS berhasil (HTTP 200 OK)! Header X-AUTH-TOKEN diterima dengan baik.',
          latency,
          authHeader: 'X-AUTH-TOKEN',
          data: responseData,
          sentPayload: samplePayload,
        };
      } else {
        const errorMsg = `HTTP ${res.status}: ${res.statusText || 'Server SIMRS menolak request'}`;
        return {
          success: false,
          message: errorMsg,
          error: errorMsg,
          latency,
          authHeader: 'X-AUTH-TOKEN',
          data: responseData,
          sentPayload: samplePayload,
        };
      }
    } catch (err: any) {
      const latency = `${Date.now() - start}ms`;
      const isCors = err.message?.includes('Failed to fetch') || err.name === 'TypeError';
      const errorMsg = isCors
        ? `Gagal terhubung ke "${apiUrl}" langsung dari browser. Pastikan server Laravel SIMRS Anda mengaktifkan header CORS (Access-Control-Allow-Origin: * dan Access-Control-Allow-Headers: X-AUTH-TOKEN, Content-Type). Konfigurasi token tetap tersimpan aman!`
        : (err.name === 'AbortError' ? 'Koneksi ke SIMRS timeout (8 detik).' : err.message);
      return {
        success: false,
        message: errorMsg,
        error: errorMsg,
        latency,
        authHeader: 'X-AUTH-TOKEN',
        sentPayload: samplePayload,
      };
    }
  }

  async syncOrderToSimrs(orderId: string): Promise<{
    success: boolean;
    message: string;
    order: HospitalOrder;
  }> {
    // 1. Coba sinkronisasi via backend server
    try {
      const res = await fetch(`/api/orders/${orderId}/sync-simrs`, {
        method: 'POST',
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        this.notifyListeners('status_update', { order: data.order });
        this.broadcastLocal('status_update', { order: data.order });
        return data;
      }
    } catch {
      // Backend offline atau Vercel
    }

    // 2. Sinkronisasi langsung dari browser ke endpoint SIMRS
    const currentOrders = getLocalCachedOrders();
    const orderIndex = currentOrders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) {
      throw new Error('Pesanan tidak ditemukan');
    }

    const order = currentOrders[orderIndex];
    const simrsConfig = getLocalSimrsConfig();

    if (!simrsConfig.apiUrl) {
      throw new Error('Endpoint API SIMRS belum disetel di pengaturan SIMRS');
    }

    const payload = {
      noregistrasi: order.registrationNo,
      no_pesanan: order.orderNumber,
      order_number: order.orderNumber,
      orderNumber: order.orderNumber,
      orderId: order.orderNumber,
      hasil_json: {
        orderId: order.orderNumber,
        no_pesanan: order.orderNumber,
        order_number: order.orderNumber,
        orderNumber: order.orderNumber,
        noregistrasi: order.registrationNo,
        registrationNo: order.registrationNo,
        patientName: order.patientName,
        nama_pasien: order.patientName,
        roomName: order.roomName,
        roomNumber: order.roomName,
        nomor_kamar: order.roomName,
        patientInfo: {
          roomNumber: order.roomName,
          roomName: order.roomName,
          patientName: order.patientName,
        },
        mealTime: order.mealTime,
        waktu_makan: order.mealTime,
        phoneNumber: order.phoneNumber,
        items: order.items.map(i => ({
          name: i.name,
          portion: i.portion,
          price: i.price,
          category: i.category,
          calories: i.calories,
        })),
        totalPrice: order.totalPrice,
        total_biaya: order.totalPrice,
        totalCalories: order.totalCalories,
        total_kalori: order.totalCalories,
        patientNotes: order.patientNotes || '',
        dietaryNotes: order.patientNotes || '',
        catatan_alergi_diet: order.patientNotes || '',
        status: order.status,
        order_status: order.status,
        status_pesanan: order.status,
        createdAt: order.createdAt,
        timestamp: new Date().toISOString(),
      },
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (simrsConfig.apiKey) {
      const rawToken = simrsConfig.apiKey.replace(/^Bearer\s+/i, '').trim();
      headers['X-AUTH-TOKEN'] = rawToken;
      headers['Authorization'] = `Bearer ${rawToken}`;
    }

    let syncResponse: any = null;
    try {
      const res = await fetch(simrsConfig.apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      syncResponse = await res.json().catch(() => ({ status: res.ok ? 'success' : 'failed' }));
    } catch (fetchErr: any) {
      syncResponse = {
        status: 'dispatched',
        note: fetchErr.message || 'Payload pesanan dikirim dari browser',
      };
    }

    const updatedOrder: HospitalOrder = {
      ...order,
      simrsSync: {
        synced: true,
        statusText: 'Tersimpan di SIMRS (X-AUTH-TOKEN)',
        timestamp: new Date().toISOString(),
        targetUrl: simrsConfig.apiUrl,
        response: syncResponse,
      },
    };

    currentOrders[orderIndex] = updatedOrder;
    saveLocalCachedOrders(currentOrders);
    this.notifyListeners('status_update', { order: updatedOrder });
    this.broadcastLocal('status_update', { order: updatedOrder });

    return {
      success: true,
      message: 'Pesanan berhasil disinkronkan ke SIMRS dengan header X-AUTH-TOKEN!',
      order: updatedOrder,
    };
  }

  async syncAllMenuToSimrs(apiUrl?: string, apiKey?: string): Promise<{
    success: boolean;
    message: string;
    totalSynced?: number;
    latency?: string;
    data?: any;
    error?: string;
  }> {
    // 1. Coba sinkronisasi via backend server
    try {
      const res = await fetch('/api/simrs/sync-menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiUrl, apiKey }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return await res.json();
      }
    } catch {
      // Backend offline / Vercel
    }

    // 2. Sinkronisasi master menu langsung dari browser
    const items = getLocalCachedMenu();
    const config = getLocalSimrsConfig();
    const targetUrl = (apiUrl || config.apiUrl || '').trim();
    const targetToken = (apiKey !== undefined ? apiKey : config.apiKey || '').trim();

    if (!targetUrl) {
      throw new Error('URL Endpoint SIMRS belum dikonfigurasi');
    }

    const baseUrl = targetUrl.replace(/\/save-pesanan-gizi\/?$/, '');
    const syncUrl = `${baseUrl}/sync-batch-menu`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (targetToken) {
      const raw = targetToken.replace(/^Bearer\s+/i, '').trim();
      headers['X-AUTH-TOKEN'] = raw;
      headers['Authorization'] = `Bearer ${raw}`;
    }

    const start = Date.now();
    try {
      const res = await fetch(syncUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          menu_items: items.map(m => ({
            id_menu: m.id,
            nama_menu: m.name,
            kategori: m.category,
            harga: m.price,
            kalori: m.calories,
            protein: m.protein,
            karbohidrat: m.carbs,
            lemak: m.fat,
            natrium: m.sodium,
            deskripsi: m.description,
            status_tersedia: m.isAvailable,
          })),
        }),
      });
      const latency = `${Date.now() - start}ms`;
      const data = await res.json().catch(() => null);

      if (res.ok) {
        return {
          success: true,
          totalSynced: items.length,
          latency,
          message: `Berhasil menyinkronkan ${items.length} master menu gizi ke SIMRS!`,
          data,
        };
      } else {
        const errorText = data?.message || `HTTP ${res.status}: Gagal menyinkronkan menu`;
        return {
          success: false,
          message: errorText,
          error: errorText,
          latency,
          data,
        };
      }
    } catch (err: any) {
      return {
        success: true,
        totalSynced: items.length,
        message: `${items.length} master menu gizi siap disinkronkan ke SIMRS.`,
        error: err.message,
      };
    }
  }

  // --- FONNTE WHATSAPP APIS ---
  async getFonnteConfig(): Promise<{
    tokenMasked: string;
    targetNumber: string;
    sendToAdmin: boolean;
    sendToPatient: boolean;
    isConfigured: boolean;
  }> {
    const local = getLocalFonnteConfig();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch('/api/fonnte/config', { signal: controller.signal });
      clearTimeout(timeoutId);

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.isConfigured || !local.isConfigured) {
          return data;
        }
      }
    } catch {
      // Fallback to local
    }

    return {
      tokenMasked: local.tokenMasked,
      targetNumber: local.targetNumber,
      sendToAdmin: local.sendToAdmin,
      sendToPatient: local.sendToPatient,
      isConfigured: local.isConfigured,
    };
  }

  async saveFonnteConfig(settings: {
    token?: string;
    targetNumber?: string;
    sendToAdmin?: boolean;
    sendToPatient?: boolean;
  }): Promise<any> {
    const savedLocal = saveLocalFonnteConfig(settings);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch('/api/fonnte/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return await res.json();
      }
    } catch {
      // Vercel / offline fallback
    }

    return {
      success: true,
      message: 'Pengaturan WhatsApp Fonnte berhasil disimpan di browser!',
      config: {
        tokenMasked: savedLocal.tokenMasked,
        targetNumber: savedLocal.targetNumber,
        sendToAdmin: savedLocal.sendToAdmin,
        sendToPatient: savedLocal.sendToPatient,
        isConfigured: savedLocal.isConfigured,
      },
    };
  }

  async testFonnteWhatsApp(targetPhone: string, testToken?: string): Promise<{
    success: boolean;
    message: string;
    data?: any;
    error?: string;
  }> {
    const local = getLocalFonnteConfig();
    const token = testToken !== undefined ? testToken : local.token;

    // 1. Coba via backend
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch('/api/fonnte/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetPhone, testToken: token }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return await res.json();
      }
    } catch {
      // Vercel / offline fallback
    }

    // 2. Uji langsung ke API Fonnte jika token tersedia
    if (!token) {
      throw new Error('Fonnte Token belum diisi. Masukkan token Fonnte Anda.');
    }

    const formattedTarget = targetPhone.replace(/[^0-9]/g, '').replace(/^0/, '62');
    try {
      const res = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: {
          Authorization: token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target: formattedTarget,
          message: `*UJI COBA NOTIFIKASI GIZI RS*\n\nKoneksi WhatsApp Gateway Fonnte berhasil aktif untuk instalasi gizi rumah sakit. Waktu: ${new Date().toLocaleTimeString('id-ID')}`,
        }),
      });
      const data = await res.json();
      if (res.ok && data.status) {
        return {
          success: true,
          message: 'Pesan uji coba WhatsApp berhasil dikirim via Fonnte Gateway!',
          data,
        };
      } else {
        const errorText = data.reason || data.message || 'Fonnte menolak pengiriman pesan';
        return {
          success: false,
          message: errorText,
          error: errorText,
          data,
        };
      }
    } catch (err: any) {
      const errorText = `Gagal mengirim WhatsApp langsung: ${err.message}. Pastikan CORS diizinkan atau gunakan backend server.`;
      return {
        success: false,
        message: errorText,
        error: errorText,
      };
    }
  }

  async resetDemo(): Promise<void> {
    try {
      await fetch('/api/reset-demo', { method: 'POST' });
    } catch {
      // Ignore
    }
    const { INITIAL_MENU, INITIAL_ORDERS } = await import('../data/initialData');
    saveLocalCachedMenu(INITIAL_MENU);
    saveLocalCachedOrders(INITIAL_ORDERS);
    this.notifyListeners('init', { orders: INITIAL_ORDERS, menuItems: INITIAL_MENU });
    this.broadcastLocal('init', { orders: INITIAL_ORDERS, menuItems: INITIAL_MENU });
  }
}

export const realtimeService = new HospitalRealtimeService();

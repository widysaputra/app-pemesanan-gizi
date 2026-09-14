import { HospitalOrder, MenuItem, FonnteSettings, MealTime, OrderStatus } from '../types';
import {
  getLocalCachedMenu,
  saveLocalCachedMenu,
  getLocalCachedOrders,
  saveLocalCachedOrders,
  INITIAL_MENU,
  INITIAL_ORDERS
} from '../data/initialData';
import { getCategoryFallbackImage } from '../utils/imageHelper';

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

export function resolveSimrsOrderUrl(baseUrl?: string): string {
  const defaultUrl = 'https://rsbsaonline.com/service/medifirst2000/emr/save-pesanan-gizi';
  if (!baseUrl || !baseUrl.trim()) return defaultUrl;
  let u = baseUrl.trim();
  if (u.includes('/save-pesanan-gizi')) return u;
  u = u.replace(/\/save-(master-menu|data-mmpi)\/?$/, '');
  u = u.replace(/\/sync-batch-menu\/?$/, '');
  u = u.replace(/\/$/, '');
  return `${u}/save-pesanan-gizi`;
}

export function resolveSimrsBatchMenuUrl(baseUrl?: string): string {
  const defaultUrl = 'https://rsbsaonline.com/service/medifirst2000/emr/sync-batch-menu';
  if (!baseUrl || !baseUrl.trim()) return defaultUrl;
  let u = baseUrl.trim();
  if (u.includes('/sync-batch-menu')) return u;
  u = u.replace(/\/save-(pesanan-gizi|data-mmpi|master-menu)\/?$/, '');
  u = u.replace(/\/$/, '');
  return `${u}/sync-batch-menu`;
}

export function resolveSimrsSingleMenuUrl(baseUrl?: string): string {
  const defaultUrl = 'https://rsbsaonline.com/service/medifirst2000/emr/save-master-menu';
  if (!baseUrl || !baseUrl.trim()) return defaultUrl;
  let u = baseUrl.trim();
  if (u.includes('/save-master-menu')) return u;
  u = u.replace(/\/save-(pesanan-gizi|data-mmpi)\/?$/, '');
  u = u.replace(/\/sync-batch-menu\/?$/, '');
  u = u.replace(/\/master-menu-gizi\/?$/, '');
  u = u.replace(/\/riwayat-pesanan-gizi\/?$/, '');
  u = u.replace(/\/$/, '');
  return `${u}/save-master-menu`;
}

export function resolveSimrsFetchMenuUrl(baseUrl?: string): string {
  const defaultUrl = 'https://rsbsaonline.com/service/medifirst2000/emr/master-menu-gizi';
  if (!baseUrl || !baseUrl.trim()) return defaultUrl;
  let u = baseUrl.trim();
  if (u.includes('/master-menu-gizi')) return u;
  u = u.replace(/\/save-(pesanan-gizi|master-menu|data-mmpi)\/?$/, '');
  u = u.replace(/\/sync-batch-menu\/?$/, '');
  u = u.replace(/\/riwayat-pesanan-gizi\/?$/, '');
  u = u.replace(/\/$/, '');
  return `${u}/master-menu-gizi`;
}

export const DEFAULT_SIMRS_URL = 'https://rsbsaonline.com/service/medifirst2000/emr/save-pesanan-gizi';
export const DEFAULT_SIMRS_TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJhZG1pbi5yZWdpc3RyYXNpIn0.z1sCAtuc6ODM-HKzftAXqvqUPlFs7bm4wd-qTY-EvnBN1uHSk-OHhlHEpgs2vznkiem7u579VFGC2kxAhxD3NA';

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
      const rawApiUrl = parsed.apiUrl || '';
      // Migrasi jika masih menggunakan URL default lama localhost:8000
      const apiUrl = (!rawApiUrl || rawApiUrl.includes('localhost:8000'))
        ? DEFAULT_SIMRS_URL
        : rawApiUrl;
      const parsedKey = (parsed.apiKey && typeof parsed.apiKey === 'string') ? parsed.apiKey.trim() : '';
      const apiKey = (parsedKey && parsedKey.length > 5) ? parsedKey : DEFAULT_SIMRS_TOKEN;
      return {
        apiUrl,
        apiKey,
        apiKeyMasked: `${apiKey.slice(0, 3)}••••${apiKey.slice(-3)}`,
        authHeaderType: parsed.authHeaderType || 'X-AUTH-TOKEN',
        autoSyncOnOrder: parsed.autoSyncOnOrder !== false,
        isConfigured: true,
      };
    }
  } catch (e) {
    console.warn('Gagal membaca konfigurasi SIMRS dari localStorage:', e);
  }
  return {
    apiUrl: DEFAULT_SIMRS_URL,
    apiKey: DEFAULT_SIMRS_TOKEN,
    apiKeyMasked: `${DEFAULT_SIMRS_TOKEN.slice(0, 3)}••••${DEFAULT_SIMRS_TOKEN.slice(-3)}`,
    authHeaderType: 'X-AUTH-TOKEN',
    autoSyncOnOrder: true,
    isConfigured: true,
  };
}

export function saveLocalSimrsConfig(settings: {
  apiUrl?: string;
  apiKey?: string;
  authHeaderType?: 'X-AUTH-TOKEN' | 'Bearer' | 'Both';
  autoSyncOnOrder?: boolean;
}) {
  const current = getLocalSimrsConfig();
  const newApiUrl = (settings.apiUrl !== undefined && settings.apiUrl.trim()) ? settings.apiUrl.trim() : current.apiUrl;
  const newApiKey = (settings.apiKey !== undefined && settings.apiKey.trim().length > 5)
    ? settings.apiKey.trim()
    : (current.apiKey || DEFAULT_SIMRS_TOKEN);
  const newAuthHeader = settings.authHeaderType || current.authHeaderType || 'X-AUTH-TOKEN';
  const newAutoSync = settings.autoSyncOnOrder !== undefined ? settings.autoSyncOnOrder : current.autoSyncOnOrder;

  const updated = {
    apiUrl: newApiUrl,
    apiKey: newApiKey,
    apiKeyMasked: newApiKey ? `${newApiKey.slice(0, 3)}••••${newApiKey.slice(-3)}` : '',
    authHeaderType: newAuthHeader,
    autoSyncOnOrder: newAutoSync,
    isConfigured: true,
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
  const DEFAULT_TOKEN = 'irrv1yX7bCHMUXWjHezr';
  const DEFAULT_TARGET = '081394947002';

  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(FONNTE_CONFIG_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      const token = (parsed.token || DEFAULT_TOKEN).trim();
      const targetNumber = (parsed.targetNumber || DEFAULT_TARGET).trim();
      return {
        token,
        tokenMasked: token ? `${token.slice(0, 3)}••••${token.slice(-3)}` : '',
        targetNumber,
        sendToAdmin: parsed.sendToAdmin !== false,
        sendToPatient: parsed.sendToPatient !== false,
        isConfigured: Boolean(token && token.trim().length > 3),
      };
    }
  } catch (e) {
    console.warn('Gagal membaca konfigurasi Fonnte dari localStorage:', e);
  }
  return {
    token: DEFAULT_TOKEN,
    tokenMasked: `${DEFAULT_TOKEN.slice(0, 3)}••••${DEFAULT_TOKEN.slice(-3)}`,
    targetNumber: DEFAULT_TARGET,
    sendToAdmin: true,
    sendToPatient: true,
    isConfigured: true,
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
  private pollInterval: any = null;
  private lastMenuHash: string = '';
  private lastOrdersHash: string = '';

  constructor() {
    this.initSSE();
    this.initBroadcastChannel();
    this.initVisibilityListeners();
    this.startBackgroundPolling();
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

  private initVisibilityListeners() {
    if (typeof window === 'undefined') return;

    const handleWakeSync = () => {
      if (document.visibilityState === 'visible' || navigator.onLine) {
        // When tab is reopened or phone unlocks, reconnect SSE immediately and do a quick sync
        if (!this.eventSource || this.eventSource.readyState === EventSource.CLOSED) {
          this.sseRetries = 0;
          this.initSSE();
        }
        this.syncWithServer();
      }
    };

    document.addEventListener('visibilitychange', handleWakeSync);
    window.addEventListener('online', handleWakeSync);
    window.addEventListener('focus', handleWakeSync);
  }

  private startBackgroundPolling() {
    if (typeof window === 'undefined') return;
    if (this.pollInterval) clearInterval(this.pollInterval);

    // Hybrid background polling: every 4 seconds, checks for changes
    this.pollInterval = setInterval(() => {
      this.syncWithServer();
    }, 4000);
  }

  public async syncWithServer() {
    try {
      const [menuRes, ordersRes] = await Promise.all([
        fetch('/api/menu').then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/orders').then(r => r.ok ? r.json() : null).catch(() => null),
      ]);

      if (Array.isArray(menuRes) && menuRes.length > 0) {
        const hash = JSON.stringify(menuRes.map(m => `${m.id}-${m.price}-${m.isAvailable}-${m.name}-${(m.image || '').slice(0, 30)}-${(m.image || '').length}`));
        if (hash !== this.lastMenuHash) {
          this.lastMenuHash = hash;
          saveLocalCachedMenu(menuRes);
          this.notifyListeners('init', { menuItems: menuRes });
        }
      }

      if (Array.isArray(ordersRes) && ordersRes.length > 0) {
        const hash = JSON.stringify(ordersRes.map(o => `${o.id}-${o.status}-${o.orderNumber}`));
        if (hash !== this.lastOrdersHash) {
          this.lastOrdersHash = hash;
          saveLocalCachedOrders(ordersRes);
          this.notifyListeners('init', { orders: ordersRes });
        }
      }
    } catch {
      // Background sync silent catch
    }
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

      es.onopen = () => {
        this.sseRetries = 0;
      };

      es.addEventListener('init', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (data.menuItems && Array.isArray(data.menuItems) && data.menuItems.length > 0) {
            saveLocalCachedMenu(data.menuItems);
          }
          if (data.orders && Array.isArray(data.orders)) {
            saveLocalCachedOrders(data.orders);
          }
          this.notifyListeners('init', data);
        } catch (err) {
          console.error('SSE parse init error', err);
        }
      });

      es.addEventListener('new_order', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (data.order) {
            const currentOrders = getLocalCachedOrders();
            const updated = [data.order, ...currentOrders.filter(o => o.id !== data.order.id)];
            saveLocalCachedOrders(updated);
          }
          this.notifyListeners('new_order', data);
          this.broadcastLocal('new_order', data);
        } catch (err) {
          console.error('SSE parse new_order error', err);
        }
      });

      es.addEventListener('status_update', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (data.order) {
            const currentOrders = getLocalCachedOrders();
            const updated = currentOrders.map(o => o.id === data.order.id ? data.order : o);
            saveLocalCachedOrders(updated);
          }
          this.notifyListeners('status_update', data);
          this.broadcastLocal('status_update', data);
        } catch (err) {
          console.error('SSE parse status_update error', err);
        }
      });

      es.addEventListener('menu_update', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (data.item) {
            const currentMenu = getLocalCachedMenu();
            const isMatch = (m: any) => String(m.id) === String(data.item.id) || (m.name && data.item.name && m.name.trim().toLowerCase() === data.item.name.trim().toLowerCase());
            if (data.action === 'delete') {
              saveLocalCachedMenu(currentMenu.filter(m => !isMatch(m)));
            } else if (data.action === 'create') {
              saveLocalCachedMenu([data.item, ...currentMenu.filter(m => !isMatch(m))]);
            } else {
              const hasMatch = currentMenu.some(m => isMatch(m));
              if (hasMatch) {
                saveLocalCachedMenu(currentMenu.map(m => isMatch(m) ? { ...m, ...data.item } : m));
              } else {
                saveLocalCachedMenu([data.item, ...currentMenu]);
              }
            }
          }
          this.notifyListeners('menu_update', data);
          this.broadcastLocal('menu_update', data);
        } catch (err) {
          console.error('SSE parse menu_update error', err);
        }
      });

      es.addEventListener('order_deleted', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (data.id) {
            const currentOrders = getLocalCachedOrders();
            saveLocalCachedOrders(currentOrders.filter(o => o.id !== data.id));
          }
          this.notifyListeners('order_deleted', data);
          this.broadcastLocal('order_deleted', data);
        } catch (err) {
          console.error('SSE parse order_deleted error', err);
        }
      });

      es.onerror = () => {
        es.close();
        this.sseRetries++;
        // Resilient reconnection with exponential backoff capped at 8 seconds
        const delay = Math.min(8000, 1000 * Math.pow(1.5, Math.min(this.sseRetries, 6)));
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = setTimeout(() => {
          this.initSSE();
        }, delay);
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
      const timeoutId = setTimeout(() => controller.abort(), 8000);
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
        this.notifyListeners('init', { menuItems: data, orders: getLocalCachedOrders() });
        this.broadcastLocal('init', { menuItems: data, orders: getLocalCachedOrders() });
        return data;
      }
      return getLocalCachedMenu();
    } catch (e) {
      console.warn('Backend API tidak merespons, memuat data menu dari cache lokal:', e);
      return getLocalCachedMenu();
    }
  }

  async addMenuItem(item: Partial<MenuItem>): Promise<MenuItem> {
    const simrsConfig = getLocalSimrsConfig();
    try {
      const res = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...item,
          simrsApiUrl: simrsConfig.apiUrl,
          simrsApiKey: simrsConfig.apiKey,
        }),
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
            simrsSync: newItem.simrsSync,
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
    const simrsConfig = getLocalSimrsConfig();
    try {
      const res = await fetch(`/api/menu/${menuId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: menuId,
          id_menu: menuId,
          ...updates,
          simrsApiUrl: simrsConfig.apiUrl,
          simrsApiKey: simrsConfig.apiKey,
        }),
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
            simrsSync: item.simrsSync,
          };

          this.notifyListeners('menu_update', { item: sanitizedItem, action: 'update' });
          this.broadcastLocal('menu_update', { item: sanitizedItem, action: 'update' });
          const currentMenu = getLocalCachedMenu();
          const isMatch = (m: any) => String(m.id) === String(menuId) || String(m.id) === String(sanitizedItem.id) || (m.name && sanitizedItem.name && m.name.trim().toLowerCase() === sanitizedItem.name.trim().toLowerCase());
          const hasExisting = currentMenu.some(isMatch);
          const updatedList = hasExisting 
            ? currentMenu.map(m => isMatch(m) ? sanitizedItem : m)
            : [sanitizedItem, ...currentMenu];
          saveLocalCachedMenu(updatedList);
          return sanitizedItem;
        }
      }
    } catch {
      // Fallback to local
    }

    const currentMenu = getLocalCachedMenu();
    let updatedItem: MenuItem | null = null;
    const isTarget = (m: any) => String(m.id) === String(menuId) || (updates.name && m.name && m.name.trim().toLowerCase() === String(updates.name).trim().toLowerCase());
    const updatedMenu = currentMenu.map(m => {
      if (isTarget(m)) {
        const resolvedImage = updates.image ?? (updates as any).foto_url ?? (updates as any).gambar_url ?? m.image;
        updatedItem = {
          ...m,
          ...updates,
          id: m.id,
          name: updates.name !== undefined ? String(updates.name).trim() : m.name,
          price: updates.price !== undefined ? Math.max(0, Number(updates.price)) : m.price,
          description: updates.description !== undefined ? String(updates.description).trim() : m.description,
          category: updates.category || m.category,
          mealTimes: updates.mealTimes || m.mealTimes,
          isAvailable: updates.isAvailable !== undefined ? Boolean(updates.isAvailable) : m.isAvailable,
          image: resolvedImage ? String(resolvedImage).trim() : m.image,
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

  async resetAllMenuItems(): Promise<void> {
    try {
      await fetch('/api/menu/reset/all', { method: 'DELETE' });
    } catch {
      // Fallback
    }
    saveLocalCachedMenu([]);
    this.notifyListeners('menu_update', { action: 'reset' });
    this.broadcastLocal('menu_update', { action: 'reset' });
  }

  // --- ORDERS APIS ---
  async fetchOrdersFromSimrs(): Promise<{ success: boolean; data?: HospitalOrder[]; error?: string; totalOrders?: number; latency?: string }> {
    const config = getLocalSimrsConfig();
    try {
      const startTime = Date.now();
      const res = await fetch('/api/simrs/fetch-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          apiUrl: config.apiUrl,
          apiKey: config.apiKey
        }),
      });
      const data = await res.json();
      const latency = (Date.now() - startTime) + 'ms';
      if (res.ok && data.success) {
         if (data.data && Array.isArray(data.data)) {
            const currentOrders = getLocalCachedOrders();
            // Merge logic (prioritize SIMRS data)
            const merged = [...data.data];
            currentOrders.forEach(localOrder => {
               if (!merged.find(o => o.orderNumber === localOrder.orderNumber || o.id === localOrder.id)) {
                   merged.push(localOrder);
               }
            });
            // sort by newest
            merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            saveLocalCachedOrders(merged);
            
            // notify UI to update
            this.notifyListeners('new_order', { action: 'sync_orders' });
            this.broadcastLocal('new_order', { action: 'sync_orders' });
         }
         data.latency = latency;
         return data;
      }
      return { success: false, error: data.error || 'Gagal sinkronisasi pesanan' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error' };
    }
  }

  async getOrders(): Promise<HospitalOrder[]> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const res = await fetch('/api/orders', { signal: controller.signal });
      clearTimeout(timeoutId);

      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        console.warn('Backend /api/orders tidak aktif. Menggunakan data pesanan lokal.');
        return getLocalCachedOrders();
      }
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
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
    const simrsConfig = getLocalSimrsConfig();
    const fonnteConfig = getLocalFonnteConfig();

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          simrsConfig,
          fonnteConfig,
        }),
      });
      if (res.ok) {
        const result = await res.json();
        if (result && result.order && result.order.id) {
          // Jika backend belum berhasil kirim WhatsApp tapi client memiliki token, kirim langsung dari browser
          if (!result.waSent && fonnteConfig.token) {
            try {
              const target = fonnteConfig.targetNumber || '081394947002';
              const formData = new URLSearchParams();
              formData.append('target', target);
              formData.append('message', result.waMessage || result.order.whatsappNotification?.message || `Pesanan Gizi ${result.order.orderNumber} berhasil dibuat.`);
              formData.append('countryCode', '62');

              const directRes = await fetch('https://api.fonnte.com/send', {
                method: 'POST',
                headers: { Authorization: fonnteConfig.token },
                body: formData,
              });
              const directData = await directRes.json();
              if (directData.status === true || directData.status === 'true') {
                result.waSent = true;
                result.waStatusText = `Terkirim langsung ke WhatsApp Admin Gizi (${target}) via Fonnte Gateway`;
                if (result.order.whatsappNotification) {
                  result.order.whatsappNotification.sent = true;
                  result.order.whatsappNotification.statusText = result.waStatusText;
                }
              }
            } catch (wErr) {
              console.warn('[Fonnte Client] Dispatch fallback error:', wErr);
            }
          }

          // Jika backend belum tersinkronisasi ke SIMRS, jalankan sync sekarang
          if (!result.order.simrsSync?.synced && simrsConfig.autoSyncOnOrder && simrsConfig.apiUrl) {
            try {
              const syncRes = await this.syncOrderToSimrs(result.order.id);
              if (syncRes && syncRes.order) {
                result.order = syncRes.order;
                result.simrsSynced = syncRes.order.simrsSync?.synced;
                result.simrsStatusText = syncRes.order.simrsSync?.statusText;
              }
            } catch (err: any) {
              console.warn('Auto-sync fallback error:', err);
            }
          }

          this.notifyListeners('new_order', { order: result.order });
          this.broadcastLocal('new_order', { order: result.order });
          const currentOrders = getLocalCachedOrders();
          saveLocalCachedOrders([result.order, ...currentOrders.filter(o => o.id !== result.order.id)]);
          return result;
        }
      }
    } catch {
      // Fallback
    }

    // Local mode creation
    const now = new Date();
    const orderNumber = `GZ-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(Math.floor(10 + Math.random() * 90))}`;
    const totalPrice = payload.items.reduce((sum, i) => sum + i.price * i.portion, 0);
    const totalCalories = payload.items.reduce((sum, i) => sum + i.calories * i.portion, 0);

    const menuLines = payload.items
      .map((it, idx) => `  ${idx + 1}. *${it.name}* x ${it.portion} porsi = Rp ${(it.price * it.portion).toLocaleString('id-ID')}`)
      .join('\n');

    const waOrderMessage = `🏥 *PESANAN MENU RUMAH SAKIT*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `🚪 *Nama Kamar*: ${payload.roomName}\n` +
      `👤 *Nama Pasien*: ${payload.patientName || 'Pasien Rawat Inap'}\n` +
      `📱 *Nomor Telepon*: ${payload.phoneNumber}\n` +
      `🍽️ *Waktu Makan*: Makan ${payload.mealTime.toUpperCase()}\n` +
      `🔖 *No. Pesanan*: ${orderNumber}\n` +
      `⏰ *Waktu Pesan*: ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB\n\n` +
      `📋 *MENU YANG DIPESAN*:\n${menuLines}\n\n` +
      `💰 *Total Biaya*: *Rp ${totalPrice.toLocaleString('id-ID')}*\n` +
      `🔥 *Total Kalori*: ${totalCalories} kkal\n\n` +
      `📝 *Catatan Khusus*:\n${payload.patientNotes ? `"${payload.patientNotes}"` : '- Tidak ada catatan khusus -'}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `_Pesanan telah terkirim langsung ke Dapur Gizi Rumah Sakit via NutriHospital (Fonnte Gateway)_`;

    let waSent = false;
    let waStatusText = 'Menyiapkan pengiriman ke WhatsApp Admin Gizi';

    if (fonnteConfig.token) {
      try {
        const targetList = [fonnteConfig.targetNumber || '081394947002'];
        const cleanPat = (payload.phoneNumber || '').replace(/[^0-9]/g, '');
        const cleanAdm = (fonnteConfig.targetNumber || '081394947002').replace(/[^0-9]/g, '');
        if (fonnteConfig.sendToPatient && cleanPat && cleanPat !== cleanAdm) {
          targetList.push(payload.phoneNumber);
        }
        const formData = new URLSearchParams();
        formData.append('target', targetList.join(','));
        formData.append('message', waOrderMessage);
        formData.append('countryCode', '62');

        const directRes = await fetch('https://api.fonnte.com/send', {
          method: 'POST',
          headers: { Authorization: fonnteConfig.token },
          body: formData,
        });
        const directData = await directRes.json();
        if (directData.status === true || directData.status === 'true') {
          waSent = true;
          waStatusText = `Terkirim langsung ke WhatsApp Admin Gizi (${fonnteConfig.targetNumber || '081394947002'}) via Fonnte Gateway`;
        } else {
          waStatusText = `Gagal kirim otomatis via Fonnte: ${directData.reason || directData.detail || 'Perangkat disconnect'}`;
        }
      } catch (err: any) {
        waStatusText = `Gagal kirim WhatsApp: ${err.message}`;
      }
    }

    const newOrder: HospitalOrder = {
      id: 'ord-' + Date.now(),
      orderNumber,
      registrationNo: payload.registrationNo || `REG-${Date.now().toString().slice(-6)}`,
      createdAt: now.toISOString(),
      roomName: payload.roomName,
      patientName: payload.patientName || 'Pasien Rawat Inap',
      phoneNumber: payload.phoneNumber,
      mealTime: payload.mealTime,
      items: payload.items,
      totalPrice,
      totalCalories,
      patientNotes: payload.patientNotes,
      status: 'baru',
      statusHistory: [
        { status: 'baru', timestamp: now.toISOString(), note: 'Pesanan dibuat di sistem' }
      ],
      whatsappNotification: {
        sent: waSent,
        targetNumber: fonnteConfig.targetNumber || '081394947002',
        statusText: waStatusText,
        timestamp: now.toISOString(),
        message: waOrderMessage,
      },
      simrsSync: {
        synced: false,
        statusText: 'Menghubungkan ke SIMRS...'
      }
    };

    const currentOrders = getLocalCachedOrders();
    saveLocalCachedOrders([newOrder, ...currentOrders]);
    this.notifyListeners('new_order', { order: newOrder });
    this.broadcastLocal('new_order', { order: newOrder });

    // Auto-sync order directly to SIMRS if URL configured
    let simrsSynced = false;
    let simrsStatusText = 'Tersimpan di browser';
    if (simrsConfig.autoSyncOnOrder && simrsConfig.apiUrl && simrsConfig.apiUrl.trim()) {
      try {
        const syncResult = await this.syncOrderToSimrs(newOrder.id);
        simrsSynced = syncResult.order?.simrsSync?.synced || false;
        simrsStatusText = syncResult.order?.simrsSync?.statusText || syncResult.message;
      } catch (err: any) {
        simrsStatusText = `Gagal auto-sync SIMRS: ${err.message || 'Error'}`;
      }
    }

    return {
      order: newOrder,
      waMessage: waOrderMessage,
      waSent,
      waStatusText,
      simrsSynced,
      simrsStatusText
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
    apiKey?: string;
    apiKeyMasked: string;
    hasToken?: boolean;
    authHeaderType?: 'X-AUTH-TOKEN' | 'Bearer' | 'Both';
    autoSyncOnOrder: boolean;
    isConfigured: boolean;
  }> {
    const local = getLocalSimrsConfig();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch('/api/simrs/config', { signal: controller.signal });
      clearTimeout(timeoutId);

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const serverConfig = await res.json();
        const activeToken = (serverConfig.apiKey && serverConfig.apiKey.trim().length > 5)
          ? serverConfig.apiKey.trim()
          : local.apiKey;
        saveLocalSimrsConfig({
          apiUrl: serverConfig.apiUrl || local.apiUrl,
          apiKey: activeToken,
          authHeaderType: serverConfig.authHeaderType || local.authHeaderType,
          autoSyncOnOrder: serverConfig.autoSyncOnOrder !== undefined ? serverConfig.autoSyncOnOrder : local.autoSyncOnOrder,
        });
        return {
          apiUrl: serverConfig.apiUrl || local.apiUrl,
          apiKey: activeToken,
          apiKeyMasked: activeToken ? `${activeToken.slice(0, 3)}••••${activeToken.slice(-3)}` : local.apiKeyMasked,
          hasToken: true,
          authHeaderType: serverConfig.authHeaderType || local.authHeaderType,
          autoSyncOnOrder: serverConfig.autoSyncOnOrder !== undefined ? serverConfig.autoSyncOnOrder : local.autoSyncOnOrder,
          isConfigured: true,
        };
      }
    } catch {
      // Backend not running / Vercel static rewrite
    }

    return {
      apiUrl: local.apiUrl,
      apiKey: local.apiKey,
      apiKeyMasked: local.apiKeyMasked,
      hasToken: Boolean(local.apiKey && local.apiKey.length > 5),
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
    const sampleItems = [
      {
        id_menu: 'menu-1',
        menuItemId: 'menu-1',
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
      {
        id_menu: 'menu-5',
        menuItemId: 'menu-5',
        name: 'Puding Buah Segar Rendah Gula',
        nama_menu: 'Puding Buah Segar Rendah Gula',
        portion: 1,
        jumlah_porsi: 1,
        price: 10000,
        harga_satuan: 10000,
        category: 'snack',
        kategori: 'snack',
        calories: 60,
        kalori: 60,
      },
    ];

    const samplePayload = {
      // 1. Data Menu jika endpoint yang diuji adalah save-master-menu
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
      lemak: 5,
      natrium: 300,
      deskripsi: 'Menu uji coba integrasi SIMRS gizi',
      is_tersedia: true,

      // 2. Data Pesanan jika endpoint yang diuji adalah save-pesanan-gizi
      noregistrasi: testRegistrationNo,
      no_pesanan: testOrderNo,
      order_number: testOrderNo,
      orderNumber: testOrderNo,
      orderId: testOrderNo,
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
      total_price: 28000,
      totalPrice: 28000,
      total_biaya: 28000,
      total_calories: 180,
      totalCalories: 180,
      total_kalori: 180,
      patient_notes: 'Uji coba komunikasi endpoint Laravel PostgreSQL dengan header X-AUTH-TOKEN',
      patientNotes: 'Uji coba komunikasi endpoint Laravel PostgreSQL dengan header X-AUTH-TOKEN',
      dietaryNotes: 'Uji coba komunikasi endpoint Laravel PostgreSQL dengan header X-AUTH-TOKEN',
      status: 'baru',
      order_status: 'baru',
      status_pesanan: 'baru',
      items: sampleItems,
      menu_items: sampleItems,
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
      const isGetEndpoint = apiUrl.toLowerCase().includes('master-menu-gizi') || apiUrl.toLowerCase().includes('get-') || apiUrl.toLowerCase().endsWith('/master-menu');
      const directController = new AbortController();
      const timeout = setTimeout(() => directController.abort(), 8000);
      
      const res = await fetch(apiUrl, {
        method: isGetEndpoint ? 'GET' : 'POST',
        headers,
        body: isGetEndpoint ? undefined : JSON.stringify(samplePayload),
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
          message: `Koneksi ke endpoint SIMRS (${isGetEndpoint ? 'GET' : 'POST'}) berhasil (HTTP 200 OK)! Header X-AUTH-TOKEN diterima dengan baik.`,
          latency,
          authHeader: 'X-AUTH-TOKEN',
          data: responseData,
          sentPayload: isGetEndpoint ? undefined : samplePayload,
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
          sentPayload: isGetEndpoint ? undefined : samplePayload,
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

  async syncOrderToSimrs(
    orderId: string,
    configOverride?: { apiUrl?: string; apiKey?: string }
  ): Promise<{
    success: boolean;
    message: string;
    order: HospitalOrder;
  }> {
    // 1. Coba sinkronisasi via backend server
    const simrsConfig = getLocalSimrsConfig();
    const effectiveApiUrl = configOverride?.apiUrl || simrsConfig.apiUrl;
    const effectiveApiKey = configOverride?.apiKey !== undefined ? configOverride.apiKey : simrsConfig.apiKey;
    const targetOrderUrl = resolveSimrsOrderUrl(effectiveApiUrl);

    try {
      const res = await fetch(`/api/orders/${orderId}/sync-simrs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiUrl: targetOrderUrl,
          apiKey: effectiveApiKey,
          simrsConfig: {
            ...simrsConfig,
            apiUrl: effectiveApiUrl,
            apiKey: effectiveApiKey,
          },
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        this.notifyListeners('status_update', { order: data.order });
        this.broadcastLocal('status_update', { order: data.order });
        const currentOrders = getLocalCachedOrders();
        saveLocalCachedOrders(currentOrders.map(o => o.id === orderId ? data.order : o));
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

    if (!targetOrderUrl) {
      throw new Error('Endpoint API SIMRS belum disetel di pengaturan SIMRS');
    }

    const mappedItems = (order.items || []).map(i => ({
      id_menu: (i as any).menuItemId || (i as any).id || 'item',
      menuItemId: (i as any).menuItemId || (i as any).id || 'item',
      name: i.name,
      nama_menu: i.name,
      portion: i.portion,
      jumlah_porsi: i.portion,
      price: i.price,
      harga_satuan: i.price,
      category: i.category,
      kategori: i.category,
      calories: i.calories,
      kalori: i.calories,
    }));

    const payload = {
      noregistrasi: order.registrationNo,
      no_pesanan: order.orderNumber,
      order_number: order.orderNumber,
      orderNumber: order.orderNumber,
      orderId: order.orderNumber,
      room_name: order.roomName,
      roomName: order.roomName,
      nomor_kamar: order.roomName,
      patient_name: order.patientName,
      patientName: order.patientName,
      nama_pasien: order.patientName,
      phone_number: order.phoneNumber,
      phoneNumber: order.phoneNumber,
      meal_time: order.mealTime,
      mealTime: order.mealTime,
      waktu_makan: order.mealTime,
      total_price: order.totalPrice,
      totalPrice: order.totalPrice,
      total_biaya: order.totalPrice,
      total_calories: order.totalCalories,
      totalCalories: order.totalCalories,
      total_kalori: order.totalCalories,
      patient_notes: order.patientNotes || '',
      patientNotes: order.patientNotes || '',
      dietaryNotes: order.patientNotes || '',
      status: order.status,
      order_status: order.status,
      status_pesanan: order.status,
      items: mappedItems,
      menu_items: mappedItems,
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
        items: mappedItems,
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
    let isSynced = false;
    let statusText = '';

    try {
      const res = await fetch(targetOrderUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      syncResponse = await res.json().catch(() => null);
      if (res.ok && syncResponse?.status !== 'error') {
        isSynced = true;
        statusText = 'Tersimpan di SIMRS (PostgreSQL & X-AUTH-TOKEN)';
      } else {
        isSynced = false;
        statusText = `Gagal kirim SIMRS (${res.status}): ${syncResponse?.message || res.statusText || 'Error server SIMRS'}`;
      }
    } catch (fetchErr: any) {
      isSynced = false;
      statusText = `Gagal terhubung ke SIMRS: ${fetchErr.message || 'CORS / Network Error'}`;
      syncResponse = {
        status: 'error',
        note: fetchErr.message || 'Koneksi ke endpoint SIMRS gagal',
      };
    }

    const updatedOrder: HospitalOrder = {
      ...order,
      simrsSync: {
        synced: isSynced,
        statusText,
        timestamp: new Date().toISOString(),
        targetUrl: simrsConfig.apiUrl,
        response: syncResponse,
        error: isSynced ? undefined : statusText,
      },
    };

    currentOrders[orderIndex] = updatedOrder;
    saveLocalCachedOrders(currentOrders);
    this.notifyListeners('status_update', { order: updatedOrder });
    this.broadcastLocal('status_update', { order: updatedOrder });

    return {
      success: isSynced,
      message: isSynced 
        ? 'Pesanan berhasil disinkronkan ke SIMRS dengan header X-AUTH-TOKEN!' 
        : statusText,
      order: updatedOrder,
    };
  }

  async fetchMenuFromSimrs(): Promise<{ success: boolean; data?: MenuItem[]; error?: string; totalMenu?: number; latency?: string }> {
    const config = getLocalSimrsConfig();
    const effectiveToken = (config.apiKey && config.apiKey.trim().length > 5) ? config.apiKey.trim() : DEFAULT_SIMRS_TOKEN;
    const startTime = Date.now();

    // 1. Coba via backend server / Express API terlebih dahulu (Server menyimpan token dari admin untuk seluruh device)
    try {
      const res = await fetch('/api/simrs/fetch-menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          apiUrl: config.apiUrl,
          apiKey: effectiveToken
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        const latency = (Date.now() - startTime) + 'ms';
        if (res.ok && data.success && Array.isArray(data.data)) {
          const currentMenu = getLocalCachedMenu();
          const merged = [...data.data];
          currentMenu.forEach(localMenu => {
            if (!merged.find(m => m.id === localMenu.id || m.name.toLowerCase() === localMenu.name.toLowerCase())) {
              merged.push(localMenu);
            }
          });
          saveLocalCachedMenu(merged);
          this.notifyListeners('init', { menuItems: merged, orders: getLocalCachedOrders() });
          this.broadcastLocal('init', { menuItems: merged, orders: getLocalCachedOrders() });
          data.latency = latency;
          return data;
        }
      }
    } catch {
      // Backend offline, fallback ke direct browser fetch
    }

    // 2. Fallback: Tarik langsung dari browser ke endpoint SIMRS master-menu-gizi
    try {
      const targetUrl = resolveSimrsFetchMenuUrl(config.apiUrl);
      const rawToken = effectiveToken.replace(/^Bearer\s+/i, '').trim();
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'X-AUTH-TOKEN': rawToken,
        'Authorization': `Bearer ${rawToken}`,
      };

      const res = await fetch(targetUrl, {
        method: 'GET',
        headers,
      });
      const latency = (Date.now() - startTime) + 'ms';

      const responseText = await res.text();
      let parsedData: any;
      try {
        parsedData = JSON.parse(responseText);
      } catch {
        throw new Error(`Server SIMRS membalas bukan JSON: ${responseText.slice(0, 80)}...`);
      }

      if (!res.ok) {
        throw new Error(parsedData?.message || parsedData?.error || `HTTP ${res.status}`);
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

      const transformedMenus: MenuItem[] = menus.map((m: any) => {
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

        const rawImg = m.foto_url || m.gambar_url || m.image || m.gambar || m.foto || m.url_gambar || m.url_foto || m.photo || m.photo_url || m.img || m.image_url;
        let validImg = '';
        if (typeof rawImg === 'string' && rawImg.trim().length > 5 && rawImg !== 'true' && rawImg !== 'false') {
          validImg = rawImg.trim();
        }

        return {
          id: String(m.menu_id || m.id_menu || m.id || `menu-${Date.now()}-${Math.floor(Math.random() * 1000)}`),
          name: String(m.nama_menu || m.name || 'Menu SIMRS').trim(),
          price: parsePgNumber(m.harga ?? m.price, 0),
          category: (m.kategori || m.category || 'makanan_utama') as MenuItem['category'],
          mealTimes: parsedMealTimes,
          calories: parsePgNumber(m.kalori ?? m.calories, 0),
          protein: parsePgNumber(m.protein_gram ?? m.protein, 0),
          carbs: parsePgNumber(m.karbohidrat_gram ?? m.karbohidrat ?? m.carbs, 0),
          fat: parsePgNumber(m.lemak_gram ?? m.lemak ?? m.fat, 0),
          sodium: parsePgNumber(m.natrium_mg ?? m.natrium ?? m.sodium, 0),
          description: String(m.deskripsi || m.description || ''),
          image: validImg || getCategoryFallbackImage(m.kategori || m.category || 'makanan_utama', m.nama_menu || m.name),
          isAvailable: parsePgBoolean(m.tersedia ?? m.isAvailable ?? true),
        };
      });

      const currentMenu = getLocalCachedMenu();
      const merged = [...currentMenu];
      transformedMenus.forEach(simrsMenu => {
        const existingIdx = merged.findIndex(m => m.id === simrsMenu.id || m.name.toLowerCase() === simrsMenu.name.toLowerCase());
        if (existingIdx === -1) {
          // Menu baru dari SIMRS yang belum ada di katalog lokal
          merged.push(simrsMenu);
        } else {
          // Update menu yang sudah ada: jika dari SIMRS terdapat foto asli, terapkan ke data lokal
          const existing = merged[existingIdx];
          const hasRealExistingImage = Boolean(existing.image && typeof existing.image === 'string' && existing.image.length > 15 && !existing.image.includes('unsplash.com'));
          const hasRealSimrsImage = Boolean(simrsMenu.image && typeof simrsMenu.image === 'string' && simrsMenu.image.length > 15 && !simrsMenu.image.includes('unsplash.com'));
          const finalImage = hasRealSimrsImage ? simrsMenu.image : (hasRealExistingImage ? existing.image : (simrsMenu.image || existing.image));
          merged[existingIdx] = {
            ...existing,
            ...simrsMenu,
            image: finalImage,
            price: existing.price !== undefined ? existing.price : simrsMenu.price,
            description: (existing.description && existing.description.trim() !== '') ? existing.description : simrsMenu.description,
          };
        }
      });
      saveLocalCachedMenu(merged);
      this.notifyListeners('init', { menuItems: merged, orders: getLocalCachedOrders() });
      this.broadcastLocal('init', { menuItems: merged, orders: getLocalCachedOrders() });

      return {
        success: true,
        data: transformedMenus,
        totalMenu: transformedMenus.length,
        latency,
      };
    } catch (e: any) {
      return { success: false, error: e.message || 'Gagal menarik menu dari SIMRS' };
    }
  }

  async syncAllMenuToSimrs(apiUrl?: string, apiKey?: string): Promise<{
    success: boolean;
    message: string;
    totalSynced?: number;
    latency?: string;
    data?: any;
    error?: string;
  }> {
    // 2. Sinkronisasi master menu langsung dari browser
    const items = getLocalCachedMenu();
    const config = getLocalSimrsConfig();
    const targetUrl = (apiUrl || config.apiUrl || '').trim();
    const targetToken = (apiKey !== undefined ? apiKey : config.apiKey || '').trim();

    if (!targetUrl) {
      throw new Error('URL Endpoint SIMRS belum dikonfigurasi');
    }

    // Cek apakah endpoint diarahkan khusus ke save-master-menu (menyimpan 1 menu per request)
    const isSingleMenuEndpoint = targetUrl.includes('save-master-menu');
    const syncUrl = isSingleMenuEndpoint 
      ? resolveSimrsSingleMenuUrl(targetUrl) 
      : resolveSimrsBatchMenuUrl(targetUrl);

    const enrichedItems = items.map(m => {
      const img = m.image || (m as any).foto_url || (m as any).gambar_url || '';
      return {
        ...m,
        id_menu: m.id,
        nama_menu: m.name,
        harga: m.price,
        kalori: m.calories,
        foto_url: img,
        gambar_url: img,
        image: img,
        foto: img,
        gambar: img,
      };
    });

    // 1. Coba sinkronisasi via backend server terlebih dahulu
    try {
      const res = await fetch('/api/simrs/sync-menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          apiUrl: syncUrl, 
          apiKey: targetToken, 
          isSingle: isSingleMenuEndpoint,
          menuItems: enrichedItems,
          items: enrichedItems,
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const result = await res.json();
        if (result && (result.success !== undefined || result.message || result.error)) {
          return {
            success: Boolean(result.success),
            message: result.message || (result.success ? 'Berhasil sinkronisasi master menu ke SIMRS!' : (result.error || 'Gagal sinkronisasi menu')),
            totalSynced: result.totalSynced || (result.success ? items.length : 0),
            latency: result.latency,
            data: result.data,
            error: result.error,
          };
        }
      }
    } catch {
      // Backend offline / Vercel
    }

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
      if (isSingleMenuEndpoint) {
        // Simpan setiap item menu satu per satu ke endpoint save-master-menu
        let successCount = 0;
        let lastResponseData: any = null;
        for (const m of items) {
          const itemPayload = {
            id: m.id,
            id_menu: m.id,
            name: m.name,
            nama: m.name,
            nama_menu: m.name,
            kategori: m.category,
            category: m.category,
            harga: m.price,
            price: m.price,
            kalori: m.calories,
            calories: m.calories,
            protein: m.protein,
            karbohidrat: m.carbs,
            lemak: m.fat,
            natrium: m.sodium,
            waktu_makan: m.mealTimes,
            deskripsi: m.description,
            image: m.image,
            gambar: m.image,
            gambar_url: m.image,
            foto: m.image,
            foto_url: m.image,
            image_url: m.image,
            url_gambar: m.image,
            url_foto: m.image,
            photo: m.image,
            photo_url: m.image,
            is_tersedia: m.isAvailable !== false,
          };
          const singleRes = await fetch(targetUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(itemPayload),
          });
          if (singleRes.ok) {
            successCount++;
            lastResponseData = await singleRes.json().catch(() => null);
          }
        }
        const latency = `${Date.now() - start}ms`;
        return {
          success: successCount > 0,
          totalSynced: successCount,
          latency,
          message: `Berhasil menyinkronkan ${successCount} dari ${items.length} master menu ke endpoint SIMRS!`,
          data: lastResponseData || { status: 'success' },
        };
      }

      // Batch Sync ke sync-batch-menu
      const firstItem = items[0] || {} as any;
      const res = await fetch(syncUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          // Sertakan juga parameter id & name di level root agar aman jika endpoint ternyata save-master-menu
          id: firstItem.id || 'menu-1',
          id_menu: firstItem.id || 'menu-1',
          name: firstItem.name || 'Master Menu',
          nama: firstItem.name || 'Master Menu',
          nama_menu: firstItem.name || 'Master Menu',
          kategori: firstItem.category || 'makanan_utama',
          category: firstItem.category || 'makanan_utama',
          harga: firstItem.price || 0,
          price: firstItem.price || 0,
          kalori: firstItem.calories || 0,
          calories: firstItem.calories || 0,
          image: firstItem.image,
          gambar_url: firstItem.image,
          foto_url: firstItem.image,
          menu_items: items.map(m => ({
            id: m.id,
            id_menu: m.id,
            name: m.name,
            nama_menu: m.name,
            kategori: m.category,
            category: m.category,
            harga: m.price,
            price: m.price,
            kalori: m.calories,
            calories: m.calories,
            protein: m.protein,
            karbohidrat: m.carbs,
            lemak: m.fat,
            natrium: m.sodium,
            waktu_makan: m.mealTimes,
            deskripsi: m.description,
            image: m.image,
            gambar: m.image,
            gambar_url: m.image,
            foto: m.image,
            foto_url: m.image,
            image_url: m.image,
            url_gambar: m.image,
            url_foto: m.image,
            photo: m.image,
            photo_url: m.image,
            status_tersedia: m.isAvailable,
            is_tersedia: m.isAvailable,
          })),
          items: enrichedItems,
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
      const isCors = err.message?.includes('Failed to fetch') || err.name === 'TypeError';
      const errorMsg = isCors
        ? `Gagal terhubung langsung ke SIMRS dari browser (CORS). Pastikan backend aktif atau server Laravel SIMRS mengizinkan CORS header.`
        : `Gagal menyinkronkan master menu ke SIMRS: ${err.message}`;
      return {
        success: false,
        totalSynced: 0,
        message: errorMsg,
        error: errorMsg,
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
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch('/api/fonnte/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetPhone, testToken: token }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const backendRes = await res.json();
        return {
          success: Boolean(backendRes.success),
          message: backendRes.message || backendRes.error || (backendRes.success ? 'Pesan berhasil dikirim!' : 'Gagal mengirim pesan'),
          error: backendRes.error,
          data: backendRes.data,
        };
      }
    } catch {
      // Vercel / offline fallback
    }

    // 2. Uji langsung ke API Fonnte jika token tersedia
    if (!token) {
      throw new Error('Fonnte Token belum diisi. Masukkan token Fonnte Anda.');
    }

    const formattedTarget = targetPhone.replace(/[^0-9]/g, '');
    try {
      const formData = new URLSearchParams();
      formData.append('target', formattedTarget);
      formData.append('message', `*UJI COBA NOTIFIKASI GIZI RS*\n\nKoneksi WhatsApp Gateway Fonnte berhasil aktif untuk instalasi gizi rumah sakit. Waktu: ${new Date().toLocaleTimeString('id-ID')}`);
      formData.append('countryCode', '62');

      const res = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: {
          Authorization: token,
        },
        body: formData,
      });
      const data = await res.json();
      if (res.ok && (data.status === true || data.status === 'true')) {
        return {
          success: true,
          message: 'Pesan uji coba WhatsApp berhasil dikirim via Fonnte Gateway!',
          data,
        };
      } else {
        let errorText = data.reason || data.message || 'Fonnte menolak pengiriman pesan';
        if (data.reason === 'request invalid on disconnected device' || String(data.reason).includes('disconnected device')) {
          errorText = 'Perangkat WhatsApp di Fonnte berstatus DISCONNECT (belum scan QR code atau sesi terputus). Silakan buka https://md.fonnte.com dan scan QR code pada device Anda.';
        }
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

  async getFonnteDeviceStatus(token?: string): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    const local = getLocalFonnteConfig();
    const effectiveToken = token !== undefined && token.trim() !== '' ? token.trim() : local.token;
    if (!effectiveToken) {
      return { success: false, error: 'Token Fonnte belum diatur' };
    }

    try {
      const res = await fetch('/api/fonnte/device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: effectiveToken }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {}

    try {
      const direct = await fetch('https://api.fonnte.com/device', {
        method: 'POST',
        headers: { Authorization: effectiveToken },
      });
      const data = await direct.json();
      return { success: true, data };
    } catch (e: any) {
      return { success: false, error: e.message || 'Gagal mengecek status device Fonnte' };
    }
  }

  // --- ADMIN SECURITY & PASSWORD ---
  async getAdminPassword(): Promise<{ currentPassword: string; hasPassword?: boolean }> {
    try {
      const res = await fetch('/api/admin/password');
      if (res.ok) {
        const data = await res.json();
        if (data.currentPassword) {
          if (typeof window !== 'undefined') {
            localStorage.setItem('nutrihospital_admin_pwd', data.currentPassword);
          }
          return data;
        }
        if (typeof window !== 'undefined' && data.currentPassword === '') {
          localStorage.removeItem('nutrihospital_admin_pwd');
        }
        return data;
      }
    } catch {}
    const local = (typeof window !== 'undefined' && localStorage.getItem('nutrihospital_admin_pwd')) || '';
    return { currentPassword: local, hasPassword: local.length > 0 };
  }

  async updateAdminPassword(newPassword: string): Promise<{ success: boolean; message: string }> {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nutrihospital_admin_pwd', newPassword.trim());
    }
    try {
      const res = await fetch('/api/admin/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: newPassword.trim() }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {}
    return { success: true, message: 'Kata sandi berhasil disimpan!' };
  }

  async verifyAdminPassword(password: string): Promise<boolean> {
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && typeof window !== 'undefined') {
          localStorage.setItem('nutrihospital_admin_pwd', password.trim());
        }
        return Boolean(data.success);
      }
    } catch {}
    const local = (typeof window !== 'undefined' && localStorage.getItem('nutrihospital_admin_pwd')) || '';
    return Boolean(local && password.trim() === local);
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

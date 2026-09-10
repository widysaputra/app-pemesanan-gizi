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
        this.notifyListeners('menu_update', { item: newItem, action: 'create' });
        this.broadcastLocal('menu_update', { item: newItem, action: 'create' });
        const currentMenu = getLocalCachedMenu();
        saveLocalCachedMenu([newItem, ...currentMenu.filter(m => m.id !== newItem.id)]);
        return newItem;
      }
    } catch {
      // Fallback to local mode
    }

    // Local fallback
    const newItem: MenuItem = {
      id: 'menu-' + Date.now(),
      name: item.name || 'Menu Baru',
      price: item.price || 10000,
      category: item.category || 'makanan_utama',
      mealTimes: item.mealTimes || ['pagi', 'siang', 'malam'],
      calories: item.calories || 150,
      protein: item.protein || 5,
      carbs: item.carbs || 20,
      fat: item.fat || 3,
      sodium: item.sodium || 20,
      description: item.description || '',
      isAvailable: item.isAvailable !== false,
      image: item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
    };
    const currentMenu = getLocalCachedMenu();
    const updated = [newItem, ...currentMenu];
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
        this.notifyListeners('menu_update', { item, action: 'update' });
        this.broadcastLocal('menu_update', { item, action: 'update' });
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
        updatedItem = { ...m, ...updates };
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
    autoSyncOnOrder: boolean;
    isConfigured: boolean;
  }> {
    const res = await fetch('/api/simrs/config');
    if (!res.ok) throw new Error('Gagal mengambil konfigurasi SIMRS');
    return res.json();
  }

  async saveSimrsConfig(settings: {
    apiUrl?: string;
    apiKey?: string;
    autoSyncOnOrder?: boolean;
  }): Promise<any> {
    const res = await fetch('/api/simrs/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error('Gagal menyimpan konfigurasi SIMRS');
    return res.json();
  }

  async testSimrsConnection(apiUrl: string, apiKey?: string): Promise<{
    success: boolean;
    message: string;
    latency?: string;
    data?: any;
    error?: string;
    sentPayload?: any;
  }> {
    const res = await fetch('/api/simrs/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiUrl, apiKey }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Uji coba koneksi ke SIMRS gagal');
    }
    return data;
  }

  async syncOrderToSimrs(orderId: string): Promise<{
    success: boolean;
    message: string;
    order: HospitalOrder;
  }> {
    const res = await fetch(`/api/orders/${orderId}/sync-simrs`, {
      method: 'POST',
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Gagal menyimpan pesanan ke SIMRS');
    }
    this.notifyListeners('status_update', { order: data.order });
    this.broadcastLocal('status_update', { order: data.order });
    return data;
  }

  async syncAllMenuToSimrs(apiUrl?: string, apiKey?: string): Promise<{
    success: boolean;
    message: string;
    totalSynced?: number;
    latency?: string;
    data?: any;
    error?: string;
  }> {
    const res = await fetch('/api/simrs/sync-menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiUrl, apiKey }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Gagal menyinkronkan master menu ke SIMRS');
    }
    return data;
  }

  // --- FONNTE WHATSAPP APIS ---
  async getFonnteConfig(): Promise<{
    tokenMasked: string;
    targetNumber: string;
    sendToAdmin: boolean;
    sendToPatient: boolean;
    isConfigured: boolean;
  }> {
    const res = await fetch('/api/fonnte/config');
    if (!res.ok) throw new Error('Gagal mengambil pengaturan Fonnte');
    return res.json();
  }

  async saveFonnteConfig(settings: {
    token?: string;
    targetNumber?: string;
    sendToAdmin?: boolean;
    sendToPatient?: boolean;
  }): Promise<any> {
    const res = await fetch('/api/fonnte/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error('Gagal menyimpan pengaturan Fonnte');
    return res.json();
  }

  async testFonnteWhatsApp(targetPhone: string, testToken?: string): Promise<{
    success: boolean;
    message: string;
    data?: any;
    error?: string;
  }> {
    const res = await fetch('/api/fonnte/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetPhone, testToken }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Uji coba kirim WhatsApp gagal');
    }
    return data;
  }

  async resetDemo(): Promise<void> {
    const res = await fetch('/api/reset-demo', { method: 'POST' });
    if (!res.ok) throw new Error('Gagal mereset data demo');
  }
}

export const realtimeService = new HospitalRealtimeService();

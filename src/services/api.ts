import { HospitalOrder, MenuItem, FonnteSettings, MealTime, OrderStatus } from '../types';

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

  constructor() {
    this.initSSE();
    this.initBroadcastChannel();
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
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = setTimeout(() => {
          this.initSSE();
        }, 4000);
      };
    } catch (err) {
      console.warn('EventSource initialization failed, using polling fallback', err);
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
    const res = await fetch('/api/menu');
    if (!res.ok) throw new Error('Gagal mengambil data menu');
    return res.json();
  }

  async addMenuItem(item: Partial<MenuItem>): Promise<MenuItem> {
    const res = await fetch('/api/menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Gagal menambah menu' }));
      throw new Error(err.error || 'Gagal menambah menu');
    }
    const newItem = await res.json();
    this.notifyListeners('menu_update', { item: newItem, action: 'create' });
    this.broadcastLocal('menu_update', { item: newItem, action: 'create' });
    return newItem;
  }

  async updateMenuItem(menuId: string, updates: Partial<MenuItem>): Promise<MenuItem> {
    const res = await fetch(`/api/menu/${menuId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Gagal memperbarui menu');
    const item = await res.json();
    this.notifyListeners('menu_update', { item, action: 'update' });
    this.broadcastLocal('menu_update', { item, action: 'update' });
    return item;
  }

  async toggleMenuItem(menuId: string): Promise<MenuItem> {
    const res = await fetch(`/api/menu/${menuId}/toggle`, {
      method: 'PATCH',
    });
    if (!res.ok) throw new Error('Gagal mengubah ketersediaan menu');
    const item = await res.json();
    this.notifyListeners('menu_update', { item, action: 'toggle' });
    this.broadcastLocal('menu_update', { item, action: 'toggle' });
    return item;
  }

  async deleteMenuItem(menuId: string): Promise<void> {
    const res = await fetch(`/api/menu/${menuId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Gagal menghapus menu');
    this.notifyListeners('menu_update', { item: { id: menuId }, action: 'delete' });
    this.broadcastLocal('menu_update', { item: { id: menuId }, action: 'delete' });
  }

  // --- ORDERS APIS ---
  async getOrders(): Promise<HospitalOrder[]> {
    const res = await fetch('/api/orders');
    if (!res.ok) throw new Error('Gagal mengambil daftar pesanan');
    return res.json();
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
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Gagal membuat pesanan' }));
      throw new Error(err.error || 'Gagal mengirim pesanan');
    }
    const result = await res.json();
    this.notifyListeners('new_order', { order: result.order });
    this.broadcastLocal('new_order', { order: result.order });
    return result;
  }

  async updateOrderStatus(orderId: string, status: OrderStatus, note?: string): Promise<HospitalOrder> {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, note }),
    });
    if (!res.ok) throw new Error('Gagal memperbarui status pesanan');
    const order = await res.json();
    this.notifyListeners('status_update', { order });
    this.broadcastLocal('status_update', { order });
    return order;
  }

  async deleteOrder(orderId: string): Promise<void> {
    const res = await fetch(`/api/orders/${orderId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Gagal menghapus pesanan');
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

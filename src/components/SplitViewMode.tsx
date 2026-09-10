import React from 'react';
import { HospitalOrder, MenuItem, MealTime, OrderStatus } from '../types';
import { PatientDashboard } from './PatientDashboard';
import { AdminDashboard } from './AdminDashboard';
import { Split, Sparkles, Smartphone, ShieldCheck } from 'lucide-react';

interface SplitViewModeProps {
  menuItems: MenuItem[];
  orders: HospitalOrder[];
  onSubmitOrder: (orderPayload: {
    roomName: string;
    patientName: string;
    phoneNumber: string;
    mealTime: MealTime;
    items: { menuItemId: string; name: string; portion: number; price: number; category: string; calories: number }[];
    patientNotes?: string;
  }) => Promise<{ order: HospitalOrder; waMessage: string; waSent: boolean; waStatusText: string }>;
  onUpdateStatus: (orderId: string, status: OrderStatus, note?: string) => Promise<void>;
  onToggleMenuItem: (menuId: string) => Promise<void>;
  onResetDemo?: () => Promise<void>;
}

export const SplitViewMode: React.FC<SplitViewModeProps> = ({
  menuItems,
  orders,
  onSubmitOrder,
  onUpdateStatus,
  onToggleMenuItem,
  onResetDemo,
}) => {
  return (
    <div className="space-y-4">
      {/* Guidance Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-slate-900 text-white p-4 rounded-2xl border border-emerald-700/50 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/20 text-emerald-300 rounded-xl">
            <Split className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Mode Demonstrasi Layar Ganda (Pasien &amp; Admin)
            </div>
            <div className="text-sm font-semibold text-white">
              Pesan menu di sisi kiri (Pasien) &rarr; Lihat pesanan &amp; log WhatsApp langsung muncul di sisi kanan (Admin)!
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-emerald-200 shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Sync Real-Time &amp; WhatsApp Ready</span>
        </div>
      </div>

      {/* Dual Column Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        
        {/* Left Side: Pasien View */}
        <div className="border-2 border-emerald-600/30 rounded-3xl p-4 bg-white shadow-xs relative">
          <div className="mb-4 pb-3 border-b border-emerald-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-600 text-white rounded-lg">
                <Smartphone className="w-4 h-4" />
              </span>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Dashboard Pasien</h3>
                <span className="text-[11px] text-emerald-800 font-medium">Tablet Kamar &bull; Pemesanan &amp; WhatsApp Fonnte</span>
              </div>
            </div>
            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-300">
              Sisi Pasien
            </span>
          </div>

          <PatientDashboard
            menuItems={menuItems}
            orders={orders}
            onSubmitOrder={onSubmitOrder}
          />
        </div>

        {/* Right Side: Admin View */}
        <div className="border-2 border-slate-700/30 rounded-3xl p-4 bg-white shadow-xs relative">
          <div className="mb-4 pb-3 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-slate-900 text-white rounded-lg">
                <ShieldCheck className="w-4 h-4" />
              </span>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Dashboard Admin</h3>
                <span className="text-[11px] text-slate-500 font-medium">Kelola Menu, Atur Harga, &amp; WhatsApp Fonnte</span>
              </div>
            </div>
            <span className="text-[11px] font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-300">
              Sisi Admin
            </span>
          </div>

          <AdminDashboard
            orders={orders}
            menuItems={menuItems}
            onUpdateStatus={onUpdateStatus}
            onToggleMenuItem={onToggleMenuItem}
            onResetDemo={onResetDemo}
          />
        </div>

      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { HospitalOrder } from '../types';
import { getLocalFonnteConfig } from '../services/api';
import { CheckCircle2, MessageCircle, Copy, Check, X, ShieldCheck, ExternalLink } from 'lucide-react';

interface OrderSuccessModalProps {
  order: HospitalOrder | null;
  waMessage: string;
  waSent: boolean;
  waStatusText: string;
  isOpen: boolean;
  onClose: () => void;
}

export const OrderSuccessModal: React.FC<OrderSuccessModalProps> = ({
  order,
  waMessage,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !order) return null;

  const fonnteConfig = getLocalFonnteConfig();
  const rawTarget = (order.whatsappNotification?.targetNumber || fonnteConfig?.targetNumber || '081573570843').trim();
  const cleanPhone = rawTarget.replace(/[^0-9]/g, '');
  const giziPhoneWaTarget = cleanPhone.startsWith('0') ? `62${cleanPhone.slice(1)}` : cleanPhone.startsWith('62') ? cleanPhone : `62${cleanPhone}`;
  const giziPhoneFormatted = rawTarget;
  const waDirectUrl = `https://api.whatsapp.com/send?phone=${giziPhoneWaTarget}&text=${encodeURIComponent(waMessage)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(waMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header with Green Accent */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 px-6 py-5 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 text-white/80 hover:text-white bg-black/10 hover:bg-black/20 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-7 h-7 text-white" />
            </div>
            <div>
              <span className="text-xs font-bold text-emerald-200 uppercase tracking-wider">
                Pesanan Berhasil Dibuat
              </span>
              <h3 className="text-lg font-black text-white leading-tight">
                Menu Makanan Siap Diproses
              </h3>
              <p className="text-xs text-emerald-100 mt-0.5">
                No. Pesanan: <span className="font-mono font-bold">{order.orderNumber}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          
          {/* Automatic Delivery Status */}
          <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/90 text-emerald-950 text-xs flex items-start gap-3 shadow-2xs">
            <div className="p-2 rounded-xl bg-emerald-600 text-white shrink-0 mt-0.5 shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-black text-emerald-900 text-sm flex items-center gap-2">
                <span>Pesanan Tercatat di Dapur Gizi</span>
                <span className="text-[10px] bg-emerald-200/90 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full uppercase">
                  Diterima
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-emerald-800">
                Pesanan telah tersimpan di sistem. Kirimkan langsung rincian pesanan ini ke WhatsApp Dapur Gizi (<strong>{giziPhoneFormatted}</strong>) melalui tombol hijau di bawah agar segera dipersiapkan oleh petugas.
              </p>
            </div>
          </div>

          {/* Direct WhatsApp Send Action Banner */}
          <div className="space-y-2">
            <a
              href={waDirectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer no-underline"
            >
              <MessageCircle className="w-5 h-5" />
              <span>Kirim ke WhatsApp Gizi ({giziPhoneFormatted})</span>
              <ExternalLink className="w-4 h-4 opacity-80" />
            </a>
            <p className="text-[11px] text-center text-slate-500">
              Langsung membuka WhatsApp dengan rincian pesanan tanpa perlu perantara gateway.
            </p>
          </div>

          {/* Key Order Details Summary */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs space-y-2">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200/80">
              <span className="text-slate-500 font-medium">Ruangan / Kamar:</span>
              <span className="font-bold text-slate-900">{order.roomName}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-200/80">
              <span className="text-slate-500 font-medium">Nama Pemesan:</span>
              <span className="font-bold text-slate-900">{order.patientName}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-200/80">
              <span className="text-slate-500 font-medium">No. Telepon Pemesan:</span>
              <span className="font-bold font-mono text-slate-900">{order.phoneNumber}</span>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="text-slate-500 font-medium">Total Tagihan:</span>
              <span className="text-sm font-black text-emerald-600">
                Rp {order.totalPrice.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          {/* WhatsApp Message Preview Box */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>Rincian Teks Pesanan WhatsApp:</span>
              </label>
              <button
                onClick={handleCopy}
                className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-600 font-bold">Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Teks</span>
                  </>
                )}
              </button>
            </div>
            <div className="bg-slate-900 text-slate-100 p-3.5 rounded-2xl font-mono text-[11px] leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto border border-slate-800 selection:bg-emerald-500">
              {waMessage}
            </div>
          </div>

        </div>

        {/* Modal Footer with Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center gap-2">
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold text-xs transition-colors cursor-pointer"
          >
            Selesai / Tutup
          </button>
        </div>

      </div>
    </div>
  );
};

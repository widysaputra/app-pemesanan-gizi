import React, { useState } from 'react';
import { HospitalOrder } from '../types';
import { getLocalFonnteConfig } from '../services/api';
import { CheckCircle2, MessageCircle, Copy, Check, X, ExternalLink, ShieldCheck, AlertCircle } from 'lucide-react';

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
  waSent,
  waStatusText,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !order) return null;

  const fonnteConfig = getLocalFonnteConfig();
  const adminPhone = order.whatsappNotification?.targetNumber || fonnteConfig.targetNumber || '081394947002';

  // Format admin phone number for WhatsApp manual fallback link
  const cleanAdminPhone = adminPhone.replace(/[^0-9]/g, '');
  const waAdminTarget = cleanAdminPhone.startsWith('0') ? `62${cleanAdminPhone.slice(1)}` : cleanAdminPhone;
  const adminWhatsappUrl = `https://wa.me/${waAdminTarget}?text=${encodeURIComponent(waMessage)}`;

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
                Pesanan Berhasil Disimpan!
              </span>
              <h3 className="text-lg font-black text-white leading-tight">
                Menu Makanan Berhasil Dipesan
              </h3>
              <p className="text-xs text-emerald-100 mt-0.5">
                No. Pesanan: <span className="font-mono font-bold">{order.orderNumber}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          
          {/* Fonnte Automatic Delivery Status */}
          {waSent ? (
            <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/90 text-emerald-950 text-xs flex items-start gap-3 shadow-2xs">
              <div className="p-2 rounded-xl bg-emerald-600 text-white shrink-0 mt-0.5 shadow-xs">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-black text-emerald-900 text-sm flex items-center gap-2">
                  <span>Otomatis Terkirim ke WhatsApp Admin Gizi</span>
                  <span className="text-[10px] bg-emerald-200/90 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full uppercase">
                    Aktif
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-emerald-800">
                  Rincian pesanan ini telah <strong>otomatis terkirim langsung</strong> oleh sistem ke nomor WhatsApp Admin Dapur Gizi (<span className="font-mono font-bold">{adminPhone}</span>). Petugas dapur dapat segera menyiapkan menu.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50 text-amber-950 text-xs flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-500 text-white shrink-0 mt-0.5 shadow-xs">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-amber-900 text-sm">
                  Pengiriman Otomatis Mengalami Kendala
                </div>
                <p className="mt-1 text-xs leading-relaxed text-amber-800">
                  {waStatusText || 'Gateway WhatsApp sedang offline'}. Anda dapat meneruskan pesanan ini secara manual ke WhatsApp Admin Gizi menggunakan tombol di bawah.
                </p>
              </div>
            </div>
          )}

          {/* Key Order Details Summary */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs space-y-2">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200/80">
              <span className="text-slate-500 font-medium">Ruangan / Kamar:</span>
              <span className="font-bold text-slate-900">{order.roomName}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-200/80">
              <span className="text-slate-500 font-medium">Nama Pasien:</span>
              <span className="font-bold text-slate-900">{order.patientName}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-200/80">
              <span className="text-slate-500 font-medium">No. WhatsApp Pasien:</span>
              <span className="font-bold font-mono text-slate-900">{order.phoneNumber}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-200/80">
              <span className="text-slate-500 font-medium">Admin Gizi Tujuan:</span>
              <span className="font-bold font-mono text-emerald-700">{adminPhone}</span>
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
                <span>Format Pesan WhatsApp:</span>
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
                    <span>Salin Pesan</span>
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
        <div className="p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center gap-2.5">
          {waSent ? (
            <>
              <button
                onClick={onClose}
                className="w-full sm:flex-1 py-3 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Selesai (Sudah Diterima Dapur)</span>
              </button>

              <a
                href={adminWhatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto py-3 px-4 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                title="Buka chat WhatsApp dengan Admin Gizi jika ada konfirmasi khusus"
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>Buka Chat Admin</span>
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
            </>
          ) : (
            <>
              <a
                href={adminWhatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
              >
                <MessageCircle className="w-4 h-4 fill-white text-transparent" />
                <span>Kirim Manual ke WhatsApp Admin Gizi</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </a>

              <button
                onClick={onClose}
                className="w-full sm:w-auto py-3 px-5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
};

import React from 'react';
import { HospitalOrder } from '../types';
import { Printer, X, ShieldAlert, CheckCircle2, QrCode } from 'lucide-react';

interface EtiketModalProps {
  order: HospitalOrder;
  onClose: () => void;
}

export const EtiketModal: React.FC<EtiketModalProps> = ({ order, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  const getDietBadgeColor = (diet: string) => {
    switch (diet) {
      case 'rendah_garam':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'diabetes':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'tktp':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'lunak':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    }
  };

  const getMealTimeLabel = (time: string) => {
    switch (time) {
      case 'pagi': return 'MAKAN PAGI (07:00)';
      case 'siang': return 'MAKAN SIANG (12:00)';
      case 'malam': return 'MAKAN MALAM (18:00)';
      case 'snack': return 'SNACK / SELINGAN';
      default: return time.toUpperCase();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div 
        id="etiket-modal-content" 
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header Modal Bar */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-sm tracking-wide">Etiket Baki Makan</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* The Printable Label Slip */}
        <div className="p-6 bg-slate-50">
          <div className="bg-white p-5 rounded-xl border-2 border-dashed border-slate-300 shadow-xs relative print:border-solid print:m-0 print:p-4">
            
            {/* Hospital Header */}
            <div className="text-center border-b border-slate-300 pb-3 mb-3">
              <div className="text-xs font-bold text-slate-500 tracking-wider">RS BHAYANGKARA TK II SARTIKAASIH</div>
              <div className="text-sm font-black text-slate-900 uppercase">INSTALASI GIZI &amp; PELAYANAN DIETETIK</div>
              <div className="text-[11px] text-slate-500">Label Distribusi Makanan Rawat Inap</div>
            </div>

            {/* Top Barcode & Order Number */}
            <div className="flex items-center justify-between text-xs mb-3 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
              <span className="font-mono font-bold text-slate-800">{order.orderNumber}</span>
              <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded text-[11px]">
                {getMealTimeLabel(order.mealTime)}
              </span>
            </div>

            {/* Patient Clinical Info Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs mb-3 pb-3 border-b border-slate-200">
              <div>
                <span className="text-slate-400 block text-[10px] font-semibold">NAMA PEMESAN</span>
                <span className="font-bold text-slate-900 text-sm">{order.patientName || 'Pemesan Umum'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-semibold">NO. REGISTRASI / RM</span>
                <span className="font-mono font-bold text-slate-800 text-sm">{order.registrationNo || '-'}</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 block text-[10px] font-semibold">RUANGAN &amp; BED</span>
                <span className="font-bold text-slate-900">{order.roomName || 'Ruang Rawat'}</span>
              </div>
            </div>

            {/* Clinical Diet Prescription */}
            <div className="mb-3">
              <span className="text-slate-400 block text-[10px] font-semibold uppercase mb-1">CATATAN DIET KLINIS</span>
              <div className="px-2.5 py-1.5 rounded-md border font-bold text-xs bg-emerald-100 text-emerald-800 border-emerald-300">
                {order.patientNotes || 'Diet Standar Gizi Rumah Sakit'}
              </div>
            </div>

            {/* Menu Items List */}
            <div className="mb-3">
              <span className="text-slate-400 block text-[10px] font-semibold uppercase mb-1">KOMPOSISI MENU BAKI</span>
              <ul className="text-xs space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                {order.items.map((item, idx) => (
                  <li key={idx} className="flex justify-between items-center text-slate-800 font-medium">
                    <span>• {item.name}</span>
                    <span className="text-[11px] text-slate-500 font-normal">1 Porsi ({item.calories} kkal)</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Special Request / Allergies */}
            {order.patientNotes && (
              <div className="mb-3 p-2 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900">
                <span className="font-bold block text-[10px] uppercase text-amber-800">Catatan Khusus / Pantangan:</span>
                "{order.patientNotes}"
              </div>
            )}

            {/* Footer Slip */}
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500">
              <div>
                <span>Waktu Siap: </span>
                <span className="font-semibold text-slate-700">
                  {new Date(order.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                </span>
                <div className="text-[9px] text-slate-400">Baik dikonsumsi maks 2 jam setelah saji</div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-slate-800">Petugas Instalasi Gizi</div>
                <div className="text-[9px] text-slate-400">Paraf: [Terverifikasi Gizi]</div>
              </div>
            </div>

          </div>
        </div>

        {/* Modal Actions */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Tutup
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Cetak Etiket Baki
          </button>
        </div>

      </div>
    </div>
  );
};

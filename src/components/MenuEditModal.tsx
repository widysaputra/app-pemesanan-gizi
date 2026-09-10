import React, { useState, useEffect } from 'react';
import { MenuItem, MenuCategory, MealTime } from '../types';
import { X, Save, DollarSign, Image as ImageIcon, Flame, Tag, AlertCircle } from 'lucide-react';

interface MenuEditModalProps {
  item: MenuItem | null; // null if adding new item
  isOpen: boolean;
  onClose: () => void;
  onSave: (itemData: Partial<MenuItem>) => Promise<void>;
}

const CATEGORY_LABELS: Record<MenuCategory, string> = {
  makanan_utama: 'Makanan Pokok / Utama',
  lauk_hewani: 'Lauk Hewani',
  lauk_nabati: 'Lauk Nabati',
  sayuran: 'Sayur-mayur',
  buah_snack: 'Buah & Snack Sehat',
  minuman: 'Minuman Sehat',
};

const SAMPLE_FOOD_IMAGES = [
  { name: 'Nasi Organik', url: 'https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=400&q=80' },
  { name: 'Ayam Panggang', url: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=400&q=80' },
  { name: 'Sup Ikan Bening', url: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=400&q=80' },
  { name: 'Rolade Sapi', url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80' },
  { name: 'Tahu Kukus', url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80' },
  { name: 'Sayur Bayam', url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=400&q=80' },
  { name: 'Buah Potong', url: 'https://images.unsplash.com/photo-1519996529931-28324d5a630e?auto=format&fit=crop&w=400&q=80' },
  { name: 'Puding Rendah Gula', url: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=400&q=80' },
];

export const MenuEditModal: React.FC<MenuEditModalProps> = ({
  item,
  isOpen,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [category, setCategory] = useState<MenuCategory>('makanan_utama');
  const [mealTimes, setMealTimes] = useState<MealTime[]>(['pagi', 'siang', 'malam']);
  const [calories, setCalories] = useState<number>(100);
  const [protein, setProtein] = useState<number>(5);
  const [carbs, setCarbs] = useState<number>(15);
  const [fat, setFat] = useState<number>(2);
  const [sodium, setSodium] = useState<number>(20);
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [isAvailable, setIsAvailable] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setPrice(item.price || 0);
      setCategory(item.category);
      setMealTimes(item.mealTimes || ['pagi', 'siang', 'malam']);
      setCalories(item.calories || 100);
      setProtein(item.protein || 0);
      setCarbs(item.carbs || 0);
      setFat(item.fat || 0);
      setSodium(item.sodium || 0);
      setDescription(item.description || '');
      setImage(item.image || '');
      setIsAvailable(item.isAvailable !== false);
    } else {
      // Defaults for new item
      setName('');
      setPrice(15000);
      setCategory('makanan_utama');
      setMealTimes(['pagi', 'siang', 'malam']);
      setCalories(150);
      setProtein(6);
      setCarbs(20);
      setFat(3);
      setSodium(30);
      setDescription('');
      setImage(SAMPLE_FOOD_IMAGES[0].url);
      setIsAvailable(true);
    }
    setErrorMsg(null);
  }, [item, isOpen]);

  if (!isOpen) return null;

  const handleMealTimeToggle = (time: MealTime) => {
    if (mealTimes.includes(time)) {
      if (mealTimes.length === 1) return; // Keep at least one
      setMealTimes(mealTimes.filter(t => t !== time));
    } else {
      setMealTimes([...mealTimes, time]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Nama menu wajib diisi.');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMsg(null);
      await onSave({
        name: name.trim(),
        price: Number(price) >= 0 ? Number(price) : 0,
        category,
        mealTimes,
        calories: Number(calories) || 0,
        protein: Number(protein) || 0,
        carbs: Number(carbs) || 0,
        fat: Number(fat) || 0,
        sodium: Number(sodium) || 0,
        description: description.trim(),
        image: image.trim(),
        isAvailable,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan menu');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-6">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {item ? 'Ubah Menu & Atur Harga' : 'Tambah Menu Makanan Baru'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Kelola detail makanan, harga satuan (Rp), gizi, dan status ketersediaan.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Row 1: Name & Price */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nama Menu Makanan <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Ayam Panggang Bumbu Kuning"
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Harga Satuan (Rupiah) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">Rp</span>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  placeholder="20000"
                  className="w-full pl-9 pr-3 py-2 text-sm font-semibold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Masukkan 0 jika menu ini gratis / termasuk subsidi rawat inap.</p>
            </div>
          </div>

          {/* Row 2: Category & Availability */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Kategori Menu
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as MenuCategory)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                {Object.entries(CATEGORY_LABELS).map(([catKey, label]) => (
                  <option key={catKey} value={catKey}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Status Ketersediaan
              </label>
              <div className="flex items-center gap-3 pt-1.5">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="isAvailable"
                    checked={isAvailable}
                    onChange={() => setIsAvailable(true)}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Tersedia di Menu
                  </span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="isAvailable"
                    checked={!isAvailable}
                    onChange={() => setIsAvailable(false)}
                    className="text-rose-600 focus:ring-rose-500"
                  />
                  <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                    Habis / Kosong
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Row 3: Meal Times */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Waktu Penyajian Menu
            </label>
            <div className="flex flex-wrap gap-2">
              {(['pagi', 'siang', 'malam', 'snack'] as MealTime[]).map((time) => {
                const active = mealTimes.includes(time);
                return (
                  <button
                    key={time}
                    type="button"
                    onClick={() => handleMealTimeToggle(time)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer capitalize ${
                      active
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Makan {time}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 4: Nutrients (Calories & Macros) */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-2">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              <span>Kandungan Kalori &amp; Nutrisi per Porsi</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500">Kalori (kkal)</label>
                <input
                  type="number"
                  value={calories}
                  onChange={(e) => setCalories(Number(e.target.value))}
                  className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500">Protein (g)</label>
                <input
                  type="number"
                  value={protein}
                  onChange={(e) => setProtein(Number(e.target.value))}
                  className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500">Karbohidrat (g)</label>
                <input
                  type="number"
                  value={carbs}
                  onChange={(e) => setCarbs(Number(e.target.value))}
                  className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500">Lemak (g)</label>
                <input
                  type="number"
                  value={fat}
                  onChange={(e) => setFat(Number(e.target.value))}
                  className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500">Natrium (mg)</label>
                <input
                  type="number"
                  value={sodium}
                  onChange={(e) => setSodium(Number(e.target.value))}
                  className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Row 5: Photo URL with Quick Presets */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              URL Foto / Gambar Menu
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {image && (
                <div className="w-10 h-10 rounded-xl border border-slate-200 overflow-hidden shrink-0 bg-slate-100">
                  <img src={image} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
            {/* Quick Presets */}
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-medium text-slate-400">Pilihan cepat:</span>
              {SAMPLE_FOOD_IMAGES.slice(0, 5).map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => setImage(preset.url)}
                  className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-0.5 rounded cursor-pointer transition-colors"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Row 6: Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Deskripsi Makanan &amp; Petunjuk Penyajian
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Deskripsi bahan segar, tekstur makanan, atau anjuran diet klinis..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Modal Footer */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Menyimpan...' : 'Simpan Menu'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

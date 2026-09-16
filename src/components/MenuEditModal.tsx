import React, { useState, useEffect, useRef } from 'react';
import { MenuItem, MenuCategory, MealTime } from '../types';
import { X, Save, DollarSign, Image as ImageIcon, Flame, Tag, AlertCircle, Upload, Link as LinkIcon, Trash2, Camera, Check, Search, Sparkles, RefreshCw } from 'lucide-react';

interface MenuEditModalProps {
  item: MenuItem | null; // null if adding new item
  isOpen: boolean;
  onClose: () => void;
  onSave: (itemData: Partial<MenuItem>) => Promise<void>;
}

interface CustomImageItem {
  id: string;
  name: string;
  url: string;
  category?: string;
  dateAdded: number;
}

const CATEGORY_LABELS: Record<MenuCategory, string> = {
  makanan_utama: 'Makanan Pokok / Utama',
  lauk_hewani: 'Lauk Hewani',
  lauk_nabati: 'Lauk Nabati',
  sayuran: 'Sayur-mayur',
  buah_snack: 'Buah & Snack Sehat',
  minuman: 'Minuman Sehat',
};

const SAMPLE_FOOD_IMAGES: Array<{ name: string; category: string; url: string }> = [
  // 1. Sarapan Spesial (Matching user uploaded images)
  {
    name: 'Roti Bakar & Telur Mata Sapi + Teh',
    category: 'sarapan',
    url: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Bubur Ayam Suwir Komplit Kerupuk',
    category: 'sarapan',
    url: 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Nasi Kuning Komplit Telur & Tempe',
    category: 'sarapan',
    url: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Nasi Tim Ayam Jamur Lembut',
    category: 'sarapan',
    url: 'https://images.unsplash.com/photo-1541832676-9b763b0239ab?auto=format&fit=crop&w=600&q=80',
  },

  // 2. Makanan Pokok & Utama
  {
    name: 'Nasi Putih Pulen Organik',
    category: 'makanan_utama',
    url: 'https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Nasi Merah Rendah Glikemik',
    category: 'makanan_utama',
    url: 'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Kentang Tumbuk (Mashed Potato)',
    category: 'makanan_utama',
    url: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=600&q=80',
  },

  // 3. Lauk Hewani & Nabati
  {
    name: 'Ayam Panggang Kecap / Madu',
    category: 'lauk_hewani',
    url: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Sup Ikan Gurame Bening',
    category: 'lauk_hewani',
    url: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Rolade Daging Sapi Saus Gurih',
    category: 'lauk_hewani',
    url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Tahu & Tempe Bacem Kukus',
    category: 'lauk_nabati',
    url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
  },

  // 4. Sayuran Sehat
  {
    name: 'Sayur Bening Bayam & Jagung',
    category: 'sayuran',
    url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Capcay Kuah Segar Sayur Campur',
    category: 'sayuran',
    url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&q=80',
  },

  // 5. Buah, Snack & Minuman
  {
    name: 'Buah Potong Segar (Pepaya & Melon)',
    category: 'buah_snack',
    url: 'https://images.unsplash.com/photo-1519996529931-28324d5a630e?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Puding Gizi Rendah Gula',
    category: 'buah_snack',
    url: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Teh Manis Hangat / Melati',
    category: 'minuman',
    url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Jus Jeruk Segar Tinggi Vitamin C',
    category: 'minuman',
    url: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=600&q=80',
  },
];

const CUSTOM_GALLERY_KEY = 'siapmakan_custom_gallery_images';

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
  const [imageInputMode, setImageInputMode] = useState<'presets' | 'upload' | 'url'>('presets');
  const [galleryCategoryFilter, setGalleryCategoryFilter] = useState<string>('all');
  const [gallerySearch, setGallerySearch] = useState<string>('');
  const [customGallery, setCustomGallery] = useState<CustomImageItem[]>([]);
  const [uploadTitle, setUploadTitle] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stock, setStock] = useState<number>(50);
  const [isAvailable, setIsAvailable] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load custom gallery from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CUSTOM_GALLERY_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setCustomGallery(parsed);
        }
      }
    } catch {}
  }, []);

  const saveCustomGallery = (newList: CustomImageItem[]) => {
    setCustomGallery(newList);
    try {
      localStorage.setItem(CUSTOM_GALLERY_KEY, JSON.stringify(newList));
    } catch {}
  };

  const processImageFile = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Format file harus berupa gambar (JPG, PNG, WEBP, GIF).');
      return;
    }
    
    setIsProcessingImage(true);
    const defaultName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') || 'Foto Menu Baru';
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            // Optimal 480px resolution for crisp hospital food thumbnails while keeping Base64 ~25KB - 40KB
            // This prevents QuotaExceededError in browser localStorage and ensures fast network sync
            const maxDim = 480;
            let width = img.width;
            let height = img.height;
            if (width > height && width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';
              ctx.drawImage(img, 0, 0, width, height);
              const compressed = canvas.toDataURL('image/jpeg', 0.75);
              setImage(compressed);

              // Auto-save to custom gallery (limit to latest 8 to preserve localStorage quota)
              const newItem: CustomImageItem = {
                id: `img-${Date.now()}`,
                name: uploadTitle.trim() || name.trim() || defaultName,
                url: compressed,
                category: category,
                dateAdded: Date.now(),
              };
              const updated = [newItem, ...customGallery.filter((g) => g.url !== compressed)];
              saveCustomGallery(updated.slice(0, 8));
              setImageInputMode('presets');
              setGalleryCategoryFilter('custom');
            } else {
              setImage(result);
              setImageInputMode('presets');
            }
          } catch {
            setImage(result);
          } finally {
            setIsProcessingImage(false);
          }
        };
        img.onerror = () => {
          setImage(result);
          setIsProcessingImage(false);
        };
        img.src = result;
      } else {
        setIsProcessingImage(false);
      }
    };
    reader.onerror = () => {
      setErrorMsg('Gagal membaca file gambar.');
      setIsProcessingImage(false);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveFromCustomGallery = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = customGallery.filter((item) => item.id !== id);
    saveCustomGallery(updated);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processImageFile(e.dataTransfer.files[0]);
    }
  };

  // Filtered lists for the preset gallery tab
  const filteredCustom = customGallery.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(gallerySearch.toLowerCase());
    const matchesCat = galleryCategoryFilter === 'all' || galleryCategoryFilter === 'custom' || c.category === galleryCategoryFilter;
    return matchesSearch && matchesCat;
  });

  const filteredPresets = SAMPLE_FOOD_IMAGES.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(gallerySearch.toLowerCase());
    const matchesCat = galleryCategoryFilter === 'all' || p.category === galleryCategoryFilter;
    return matchesSearch && matchesCat;
  });

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
      const parsedStock = item.stock !== undefined ? item.stock : 50;
      setStock(parsedStock);
      setIsAvailable(item.isAvailable !== false && parsedStock > 0);
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
      setStock(50);
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
      const parsedStock = Math.max(0, Number(stock) || 0);
      const effectiveAvail = isAvailable && parsedStock > 0;
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
        stock: parsedStock,
        isAvailable: effectiveAvail,
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

          {/* Row 2: Category, Stock & Availability */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  Stok Tersedia (Porsi) <span className="text-rose-500">*</span>
                </label>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${stock > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                  {stock > 0 ? `${stock} Porsi` : 'Habis (0)'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const next = Math.max(0, stock - 1);
                    setStock(next);
                    if (next === 0) setIsAvailable(false);
                  }}
                  className="w-8 h-9 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-sm flex items-center justify-center cursor-pointer transition-colors"
                  title="Kurangi 1 porsi"
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  value={stock}
                  onChange={(e) => {
                    const val = Math.max(0, parseInt(e.target.value) || 0);
                    setStock(val);
                    if (val === 0) {
                      setIsAvailable(false);
                    } else if (!isAvailable) {
                      setIsAvailable(true);
                    }
                  }}
                  className="w-full text-center py-2 text-sm font-bold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => {
                    const next = stock + 1;
                    setStock(next);
                    if (next > 0) setIsAvailable(true);
                  }}
                  className="w-8 h-9 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-sm flex items-center justify-center cursor-pointer transition-colors"
                  title="Tambah 1 porsi"
                >
                  +
                </button>
              </div>
              <div className="flex items-center gap-1 mt-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setStock(0);
                    setIsAvailable(false);
                  }}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer"
                >
                  Habiskan (0)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStock(stock + 10);
                    setIsAvailable(true);
                  }}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  +10
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStock(50);
                    setIsAvailable(true);
                  }}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
                >
                  Isi 50
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Status Ketersediaan
              </label>
              <div className="space-y-1.5 pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="isAvailable"
                    checked={isAvailable && stock > 0}
                    onChange={() => {
                      setIsAvailable(true);
                      if (stock <= 0) setStock(25);
                    }}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    Tersedia ({stock > 0 ? stock : 25} Porsi)
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="isAvailable"
                    checked={!isAvailable || stock === 0}
                    onChange={() => {
                      setIsAvailable(false);
                      setStock(0);
                    }}
                    className="text-rose-600 focus:ring-rose-500"
                  />
                  <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                    Habis / Kosong (0 Porsi)
                  </span>
                </label>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Stok 0 otomatis Tidak Tersedia.</p>
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

          {/* Row 5: Photo Selector (Presets Gallery / File Upload / Custom URL) */}
          <div className="bg-slate-50/90 p-4 rounded-2xl border border-slate-200 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-emerald-600" />
                <span>Pilih / Upload Foto Makanan</span>
              </label>

              {/* Source Switcher Tabs */}
              <div className="flex items-center bg-slate-200/80 p-0.5 rounded-xl text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setImageInputMode('presets')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    imageInputMode === 'presets'
                      ? 'bg-white text-slate-900 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>Galeri Pilihan</span>
                  {customGallery.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-bold">
                      {customGallery.length + SAMPLE_FOOD_IMAGES.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setImageInputMode('upload')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    imageInputMode === 'upload'
                      ? 'bg-white text-slate-900 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Upload className="w-3 h-3 text-emerald-600" />
                  <span>Upload Foto Baru</span>
                </button>
                <button
                  type="button"
                  onClick={() => setImageInputMode('url')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    imageInputMode === 'url'
                      ? 'bg-white text-slate-900 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <LinkIcon className="w-3 h-3" />
                  <span>URL / Link</span>
                </button>
              </div>
            </div>

            {/* TAB 1: PRESETS & SAVED GALLERY PHOTOS */}
            {imageInputMode === 'presets' && (
              <div className="space-y-3">
                {/* Search & Category Filter */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={gallerySearch}
                      onChange={(e) => setGallerySearch(e.target.value)}
                      placeholder="Cari foto: Roti, Bubur, Nasi Kuning, Sup, Ayam..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Category Pills */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[10px]">
                    {[
                      { key: 'all', label: 'Semua' },
                      { key: 'custom', label: `Foto Saya (${customGallery.length})` },
                      { key: 'sarapan', label: 'Sarapan' },
                      { key: 'makanan_utama', label: 'Makanan Pokok' },
                      { key: 'lauk_hewani', label: 'Lauk Hewani' },
                      { key: 'sayuran', label: 'Sayuran' },
                      { key: 'buah_snack', label: 'Snack/Buah' },
                      { key: 'minuman', label: 'Minuman' },
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setGalleryCategoryFilter(tab.key)}
                        className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-colors cursor-pointer ${
                          galleryCategoryFilter === tab.key
                            ? 'bg-slate-900 text-white'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Section: Custom Uploaded Photos (If any) */}
                {(galleryCategoryFilter === 'all' || galleryCategoryFilter === 'custom') && customGallery.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                        <Camera className="w-3 h-3 text-emerald-600" />
                        <span>Foto Unggahan Anda Sendiri</span>
                      </span>
                      <span className="text-[10px] text-slate-400">Tersimpan di Galeri</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {filteredCustom.map((cust) => {
                        const isSelected = image === cust.url;
                        return (
                          <div
                            key={cust.id}
                            onClick={() => setImage(cust.url)}
                            className={`group relative p-1.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer overflow-hidden ${
                              isSelected
                                ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-300 shadow-xs'
                                : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                            }`}
                          >
                            <img src={cust.url} alt={cust.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                            <div className="min-w-0 flex-1">
                              <span className="text-[11px] font-bold text-slate-900 block truncate" title={cust.name}>
                                {cust.name}
                              </span>
                              <span className="text-[9px] text-emerald-600 font-semibold block">Foto Saya</span>
                            </div>
                            
                            {isSelected ? (
                              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => handleRemoveFromCustomGallery(e, cust.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 rounded transition-opacity"
                                title="Hapus dari galeri saya"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Section: Standard Hospital Photos */}
                {galleryCategoryFilter !== 'custom' && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Koleksi Standar Menu Rumah Sakit ({filteredPresets.length})
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-56 overflow-y-auto pr-1">
                      {filteredPresets.map((preset) => {
                        const isSelected = image === preset.url;
                        return (
                          <button
                            key={preset.name}
                            type="button"
                            onClick={() => setImage(preset.url)}
                            className={`p-1.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                              isSelected
                                ? 'border-emerald-500 bg-emerald-50/90 ring-2 ring-emerald-200 shadow-xs'
                                : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
                            }`}
                          >
                            <img src={preset.url} alt={preset.name} className="w-9 h-9 rounded-lg object-cover shrink-0" />
                            <div className="min-w-0 flex-1">
                              <span className="text-[11px] font-bold text-slate-800 block truncate" title={preset.name}>
                                {preset.name}
                              </span>
                              <span className="text-[9px] text-slate-400 capitalize block truncate">
                                {preset.category.replace('_', ' ')}
                              </span>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: UPLOAD NEW PHOTO FILE */}
            {imageInputMode === 'upload' && (
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      processImageFile(e.target.files[0]);
                    }
                    e.target.value = '';
                  }}
                  className="hidden"
                />

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Nama / Label Foto (Opsional, untuk disimpan di Galeri Saya)
                  </label>
                  <input
                    type="text"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="Contoh: Roti Bakar Telur, Bubur..."
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-emerald-500 bg-emerald-50/80 scale-[0.99]'
                      : 'border-slate-300 hover:border-emerald-500 bg-white hover:bg-slate-50/80'
                  }`}
                >
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <div className="w-11 h-11 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
                      {isProcessingImage ? (
                        <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
                      ) : (
                        <Upload className="w-5 h-5" />
                      )}
                    </div>
                    <div className="text-xs font-extrabold text-slate-900">
                      {isProcessingImage ? 'Mengompresi Gambar...' : 'Pilih Foto dari Galeri / Kamera / Komputer'}
                    </div>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto leading-relaxed">
                      Klik atau geser file gambar ke sini (JPG, PNG, WEBP). Foto otomatis disimpan ke <strong>Galeri Saya</strong> untuk digunakan kapan saja.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: CUSTOM URL / LINK */}
            {imageInputMode === 'url' && (
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-700">
                  URL / Direct Link Gambar
                </label>
                <input
                  type="url"
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                  placeholder="https://contoh-domain.com/foto-makanan.jpg"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                />
                <p className="text-[10px] text-slate-400">
                  Masukkan link gambar HTTPS langsung dari server rumah sakit atau hosting gambar publik.
                </p>
              </div>
            )}

            {/* Live Preview & Clear Button */}
            {image && (
              <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-12 h-12 rounded-lg border border-slate-200 overflow-hidden shrink-0 bg-slate-100 shadow-xs">
                    <img src={image} alt="Preview Foto Menu" className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 block">
                      Foto Terpilih Aktif
                    </span>
                    <span className="text-xs font-semibold text-slate-700 truncate block max-w-xs">
                      {image.startsWith('data:') ? 'Foto Unggahan Lokal (Tersimpan di Galeri)' : image}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setImageInputMode('presets')}
                    className="px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors"
                  >
                    Ganti Foto
                  </button>
                  <button
                    type="button"
                    onClick={() => setImage('')}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                    title="Hapus Foto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
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

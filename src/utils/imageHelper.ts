// Helper utilitas untuk sanitasi gambar menu dan pencegahan gambar blank
export function getCategoryFallbackImage(category: string, menuName = ''): string {
  const lowerName = (menuName || '').toLowerCase();

  // Pencocokan spesifik berdasarkan nama menu masakan Indonesia
  if (lowerName.includes('nasi kuning')) {
    return 'https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=500&q=80';
  }
  if (lowerName.includes('bubur ayam') || lowerName.includes('bubur')) {
    return 'https://images.unsplash.com/photo-1541832676-9b763b0239ab?auto=format&fit=crop&w=500&q=80';
  }
  if (lowerName.includes('roti bakar') || lowerName.includes('roti')) {
    return 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=500&q=80';
  }
  if (lowerName.includes('ayam goreng') || lowerName.includes('ayam')) {
    return 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=500&q=80';
  }
  if (lowerName.includes('ikan')) {
    return 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=500&q=80';
  }
  if (lowerName.includes('telur')) {
    return 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=500&q=80';
  }
  if (lowerName.includes('mie') || lowerName.includes('bihun')) {
    return 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=500&q=80';
  }
  if (lowerName.includes('sup') || lowerName.includes('sayur') || lowerName.includes('bening')) {
    return 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=500&q=80';
  }
  if (lowerName.includes('teh') || lowerName.includes('manis')) {
    return 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=500&q=80';
  }
  if (lowerName.includes('air') || lowerName.includes('mineral')) {
    return 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=500&q=80';
  }
  if (lowerName.includes('buah') || lowerName.includes('pisang') || lowerName.includes('pepaya') || lowerName.includes('melon')) {
    return 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&w=500&q=80';
  }

  // Fallback berdasarkan kategori
  switch (category) {
    case 'lauk_hewani':
      return 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=500&q=80';
    case 'lauk_nabati':
      return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=500&q=80';
    case 'sayuran':
      return 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=500&q=80';
    case 'buah_snack':
      return 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&w=500&q=80';
    case 'minuman':
      return 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=500&q=80';
    case 'makanan_utama':
    default:
      return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=500&q=80';
  }
}

export function getValidMenuImage(raw: any, menuName = '', category = 'makanan_utama'): string {
  if (typeof raw === 'string') {
    const s = raw.trim();
    // Validasi Base64 image
    if (s.startsWith('data:image/')) {
      return s;
    }
    // Validasi URL http / https
    if ((s.startsWith('http://') || s.startsWith('https://')) && !s.includes('localhost')) {
      return s;
    }
    // Jika string berisi teks 'true', 'false', 'null', 'undefined' (akibat respon boolean SIMRS)
    if (s === 'true' || s === 'false' || s === 'null' || s === 'undefined' || s.length < 8) {
      return getCategoryFallbackImage(category, menuName);
    }
    return s;
  }

  // Jika raw bertipe boolean (seperti { "image": true } dari SIMRS Laravel) atau null/undefined
  return getCategoryFallbackImage(category, menuName);
}

/**
 * Snippet SQL PostgreSQL, Kode Controller Laravel, dan Route API
 * untuk Integrasi SIMRS (Sistem Informasi Manajemen Rumah Sakit)
 */

export const SQL_PESANAN_GIZI_TABLE = `-- ====================================================================
-- 1. SQL DDL POSTGRESQL: TABEL pesanan_gizi_t & rincian_pesanan_gizi_t
-- Digunakan untuk menyimpan pesanan makanan pasien rawat inap ke SIMRS
-- Terhubung langsung dengan No. Registrasi Pasien SIMRS
-- ====================================================================

-- Tabel Utama Pesanan Gizi Pasien
CREATE TABLE IF NOT EXISTS pesanan_gizi_t (
    id BIGSERIAL PRIMARY KEY,
    order_number VARCHAR(50) NOT NULL UNIQUE,
    noregistrasi VARCHAR(64) NOT NULL,
    room_name VARCHAR(100) NOT NULL,
    patient_name VARCHAR(150),
    phone_number VARCHAR(25),
    meal_time VARCHAR(20) DEFAULT 'siang', -- 'pagi', 'siang', 'malam', 'snack'
    total_price NUMERIC(12,2) DEFAULT 0,
    total_calories INT DEFAULT 0,
    patient_notes TEXT,
    order_status VARCHAR(30) DEFAULT 'baru', -- 'baru', 'diproses', 'diantar', 'selesai', 'dibatalkan'
    
    -- Penyimpanan Payload Lengkap Menggunakan PostgreSQL JSONB (Cepat & Fleksibel)
    items_json JSONB,
    
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indeks Performa untuk Pencarian Cepat di SIMRS
CREATE INDEX IF NOT EXISTS idx_pesanan_gizi_noregistrasi ON pesanan_gizi_t (noregistrasi);
CREATE INDEX IF NOT EXISTS idx_pesanan_gizi_order_number ON pesanan_gizi_t (order_number);
CREATE INDEX IF NOT EXISTS idx_pesanan_gizi_created_at ON pesanan_gizi_t (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pesanan_gizi_status ON pesanan_gizi_t (order_status);
CREATE INDEX IF NOT EXISTS idx_pesanan_gizi_items_gin ON pesanan_gizi_t USING GIN (items_json);

-- (Opsional) Tabel Rincian Menu Termasuk Porsi & Kalori (Bila Dapur Gizi Membutuhkan Relasi Baris per Baris)
CREATE TABLE IF NOT EXISTS rincian_pesanan_gizi_t (
    id BIGSERIAL PRIMARY KEY,
    order_number VARCHAR(50) NOT NULL REFERENCES pesanan_gizi_t(order_number) ON DELETE CASCADE,
    id_menu VARCHAR(50) NOT NULL,
    nama_menu VARCHAR(150) NOT NULL,
    kategori VARCHAR(50),
    porsi INT DEFAULT 1,
    harga NUMERIC(12,2) DEFAULT 0,
    kalori INT DEFAULT 0,
    catatan_khusus VARCHAR(255),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rincian_gizi_order ON rincian_pesanan_gizi_t (order_number);
CREATE INDEX IF NOT EXISTS idx_rincian_gizi_menu ON rincian_pesanan_gizi_t (id_menu);

COMMENT ON TABLE pesanan_gizi_t IS 'Tabel Utama Pesanan Makanan Kamar Pasien Terhubung SIMRS';
COMMENT ON COLUMN pesanan_gizi_t.noregistrasi IS 'Nomor Registrasi Pasien Rawat Inap SIMRS';
COMMENT ON COLUMN pesanan_gizi_t.items_json IS 'Dokumen JSON detail menu yang dipesan';
`;

export const SQL_MASTER_MENU_TABLE = `-- ====================================================================
-- 2. SQL DDL POSTGRESQL: TABEL master_menu_gizi_m
-- Digunakan untuk Master Data Menu Makanan & Diet Gizi Rumah Sakit
-- Lengkap dengan Informasi Nutrisi (Kalori, Protein, Karbohidrat, Lemak, Natrium)
-- ====================================================================

CREATE TABLE IF NOT EXISTS master_menu_gizi_m (
    id_menu VARCHAR(50) PRIMARY KEY,
    nama_menu VARCHAR(150) NOT NULL,
    kategori VARCHAR(50) NOT NULL, -- 'makanan_utama', 'lauk_hewani', 'lauk_nabati', 'sayuran', 'buah_snack', 'minuman'
    harga NUMERIC(12,2) DEFAULT 0,
    kalori INT DEFAULT 0,          -- kkal per porsi
    protein NUMERIC(6,2) DEFAULT 0, -- gram
    karbohidrat NUMERIC(6,2) DEFAULT 0, -- gram
    lemak NUMERIC(6,2) DEFAULT 0,   -- gram
    natrium NUMERIC(6,2) DEFAULT 0, -- mg
    
    -- Waktu Makan yang Berlaku ('pagi', 'siang', 'malam', 'snack')
    waktu_makan JSONB DEFAULT '["pagi", "siang", "malam"]'::jsonb,
    
    deskripsi TEXT,
    gambar_url TEXT,
    is_tersedia BOOLEAN DEFAULT TRUE,
    
    -- Indikasi Diet Khusus (Contoh: Rendah Garam, DM/Diabetes, Rendah Purin)
    tags_diet JSONB DEFAULT '[]'::jsonb,
    
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indeks Pencarian Master Menu
CREATE INDEX IF NOT EXISTS idx_master_menu_kategori ON master_menu_gizi_m (kategori);
CREATE INDEX IF NOT EXISTS idx_master_menu_tersedia ON master_menu_gizi_m (is_tersedia);
CREATE INDEX IF NOT EXISTS idx_master_menu_waktu ON master_menu_gizi_m USING GIN (waktu_makan);

COMMENT ON TABLE master_menu_gizi_m IS 'Master Data Menu Makanan & Nilai Gizi Pasien SIMRS';
`;

export const SQL_MMPI_TABLE = `-- ====================================================================
-- 3. SQL DDL POSTGRESQL: TABEL mmpi_t (EMR MMPI-2)
-- Sesuai dengan Controller: EMRController@simpanHasilMMPI
-- Menggunakan PostgreSQL native JSONB untuk efisiensi penyimpanan & query
-- ====================================================================

CREATE TABLE IF NOT EXISTS mmpi_t (
    id BIGSERIAL PRIMARY KEY,
    noregistrasi VARCHAR(64) NOT NULL UNIQUE,
    tgl_test TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    validitas VARCHAR(100),
    codetype VARCHAR(50),
    kesimpulan_singkat TEXT,
    
    -- Validity Scales T-Score (L, F, K)
    t_score_l NUMERIC(6,2),
    t_score_f NUMERIC(6,2),
    t_score_k NUMERIC(6,2),
    
    -- Clinical Scales T-Score
    t_score_hs NUMERIC(6,2),
    t_score_d NUMERIC(6,2),
    t_score_hy NUMERIC(6,2),
    t_score_pd NUMERIC(6,2),
    t_score_mf NUMERIC(6,2),
    t_score_pa NUMERIC(6,2),
    t_score_pt NUMERIC(6,2),
    t_score_sc NUMERIC(6,2),
    t_score_ma NUMERIC(6,2),
    t_score_si NUMERIC(6,2),
    
    -- Penyimpanan Payload Lengkap (Format Native JSONB PostgreSQL)
    hasiltestmmpi JSONB,
    
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mmpi_noregistrasi ON mmpi_t (noregistrasi);
CREATE INDEX IF NOT EXISTS idx_mmpi_tgl_test ON mmpi_t (tgl_test DESC);
CREATE INDEX IF NOT EXISTS idx_mmpi_hasiljson_gin ON mmpi_t USING GIN (hasiltestmmpi);

COMMENT ON TABLE mmpi_t IS 'Tabel Rekam Medis Elektronik (EMR) Hasil Tes MMPI-2 Pasien SIMRS';
`;

export const LARAVEL_ROUTES_CODE = `<?php
/**
 * File: routes/api.php
 * Daftarkan route ini di file routes/api.php project Laravel SIMRS Anda
 */

use Illuminate\\Support\\Facades\\Route;
use App\\Http\\Controllers\\Gizi\\GiziSIMRSController;
use App\\Http\\Controllers\\EMR\\EMRController;

Route::prefix('api')->group(function () {
    
    // ==========================================
    // 1. API PESANAN GIZI PASIEN
    // ==========================================
    // Endpoint untuk menyimpan pesanan makanan dari kamar rawat inap
    Route::post('/save-pesanan-gizi', [GiziSIMRSController::class, 'simpanPesananGizi']);
    
    // Ambil riwayat pesanan berdasarkan No. Registrasi pasien
    Route::get('/pesanan-gizi/{noregistrasi}', [GiziSIMRSController::class, 'getPesananByRegistrasi']);

    // ==========================================
    // 2. API MASTER DATA MENU GIZI RS
    // ==========================================
    // Simpan / update 1 item menu makanan
    Route::post('/save-master-menu', [GiziSIMRSController::class, 'simpanMasterMenu']);
    
    // Sinkronisasi massal (bulk sync) seluruh menu makanan
    Route::post('/sync-batch-menu', [GiziSIMRSController::class, 'syncBatchMenu']);
    
    // Ambil daftar menu gizi aktif untuk aplikasi pemesanan pasien
    Route::get('/master-menu', [GiziSIMRSController::class, 'getMasterMenu']);

    // ==========================================
    // 3. API HASIL TEST MMPI-2 (EMR)
    // ==========================================
    Route::post('/save-data-mmpi', [EMRController::class, 'simpanHasilMMPI']);
});
`;

export const LARAVEL_GIZI_CONTROLLER_CODE = `<?php

namespace App\\Http\\Controllers\\Gizi;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;

class GiziSIMRSController extends Controller
{
    /**
     * Middleware / Verifikasi Token Autentikasi X-AUTH-TOKEN
     * Aplikasi web NutriHospital mengirimkan token via header: X-AUTH-TOKEN: <token>
     */
    private function checkAuthToken(Request $request)
    {
        $expectedToken = env('SIMRS_AUTH_TOKEN', '');
        // Jika environment token disetel, validasi header X-AUTH-TOKEN
        if (!empty($expectedToken)) {
            $receivedToken = $request->header('X-AUTH-TOKEN') 
                          ?: str_replace('Bearer ', '', $request->header('Authorization', ''));

            if ($receivedToken !== $expectedToken) {
                return response()->json([
                    'status'  => 'unauthorized',
                    'message' => 'Token autentikasi X-AUTH-TOKEN tidak valid atau tidak disertakan.'
                ], 401);
            }
        }
        return null;
    }

    /**
     * POST /api/save-pesanan-gizi
     * Simpan / Perbarui Pesanan Makanan Kamar Pasien ke PostgreSQL
     * Menerima input: 'noregistrasi' dan 'hasil_json'
     * Header Autentikasi: X-AUTH-TOKEN: <token_rahasia>
     */
    public function simpanPesananGizi(Request $request)
    {
        // Validasi X-AUTH-TOKEN jika diaktifkan
        $authError = $this->checkAuthToken($request);
        if ($authError) return $authError;

        $noRegistrasi = $request->input('noregistrasi');
        $orderData    = $request->input('hasil_json');

        if (!$noRegistrasi || !$orderData) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Parameter noregistrasi dan hasil_json wajib dikirim.'
            ], 400);
        }

        DB::beginTransaction();
        try {
            $orderNumber = $orderData['orderNumber'] ?? ('GZ-' . date('YmdHis'));

            // 1. Simpan data header pesanan ke pesanan_gizi_t (Idempotent: updateOrInsert)
            DB::table('pesanan_gizi_t')->updateOrInsert(
                ['order_number' => $orderNumber],
                [
                    'noregistrasi'   => $noRegistrasi,
                    'room_name'      => $orderData['roomName'] ?? '',
                    'patient_name'   => $orderData['patientName'] ?? '',
                    'phone_number'   => $orderData['phoneNumber'] ?? '',
                    'meal_time'      => $orderData['mealTime'] ?? 'siang',
                    'total_price'    => $orderData['totalPrice'] ?? 0,
                    'total_calories' => $orderData['totalCalories'] ?? 0,
                    'patient_notes'  => $orderData['patientNotes'] ?? '',
                    'order_status'   => $orderData['status'] ?? 'baru',
                    'items_json'     => json_encode($orderData['items'] ?? []),
                    'updated_at'     => date('Y-m-d H:i:s'),
                    'created_at'     => date('Y-m-d H:i:s')
                ]
            );

            // 2. (Opsional) Simpan rincian ke tabel relasional rincian_pesanan_gizi_t
            if (!empty($orderData['items']) && is_array($orderData['items'])) {
                DB::table('rincian_pesanan_gizi_t')->where('order_number', $orderNumber)->delete();
                
                $detailsToInsert = [];
                foreach ($orderData['items'] as $item) {
                    $detailsToInsert[] = [
                        'order_number' => $orderNumber,
                        'id_menu'      => $item['menuItemId'] ?? $item['id'] ?? 'CUSTOM',
                        'nama_menu'    => $item['name'] ?? $item['nama_menu'] ?? 'Menu Makanan',
                        'kategori'     => $item['category'] ?? $item['kategori'] ?? 'makanan_utama',
                        'porsi'        => $item['portion'] ?? 1,
                        'harga'        => $item['price'] ?? 0,
                        'kalori'       => $item['calories'] ?? 0,
                        'created_at'   => date('Y-m-d H:i:s')
                    ];
                }
                if (!empty($detailsToInsert)) {
                    DB::table('rincian_pesanan_gizi_t')->insert($detailsToInsert);
                }
            }

            DB::commit();

            return response()->json([
                'status'       => 'success',
                'message'      => 'Pesanan gizi berhasil disimpan ke database SIMRS!',
                'orderNumber'  => $orderNumber,
                'noregistrasi' => $noRegistrasi
            ], 200);

        } catch (\\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status'  => 'error',
                'message' => 'Gagal menyimpan pesanan gizi: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * POST /api/save-master-menu
     * Simpan / Update 1 Item Master Menu Gizi ke master_menu_gizi_m
     */
    public function simpanMasterMenu(Request $request)
    {
        $idMenu = $request->input('id_menu') ?? $request->input('id');
        $nama   = $request->input('nama_menu') ?? $request->input('name');

        if (!$idMenu || !$nama) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Parameter id_menu dan nama_menu wajib dikirim.'
            ], 400);
        }

        try {
            DB::table('master_menu_gizi_m')->updateOrInsert(
                ['id_menu' => $idMenu],
                [
                    'nama_menu'    => $nama,
                    'kategori'     => $request->input('kategori', $request->input('category', 'makanan_utama')),
                    'harga'        => $request->input('harga', $request->input('price', 0)),
                    'kalori'       => $request->input('kalori', $request->input('calories', 0)),
                    'protein'      => $request->input('protein', 0),
                    'karbohidrat'  => $request->input('karbohidrat', $request->input('carbs', 0)),
                    'lemak'        => $request->input('lemak', $request->input('fat', 0)),
                    'natrium'      => $request->input('natrium', $request->input('sodium', 0)),
                    'waktu_makan'  => json_encode($request->input('waktu_makan', $request->input('mealTimes', ['pagi', 'siang', 'malam']))),
                    'deskripsi'    => $request->input('deskripsi', $request->input('description', '')),
                    'gambar_url'   => $request->input('gambar_url', $request->input('image', '')),
                    'is_tersedia'  => $request->input('is_tersedia', $request->input('isAvailable', true)),
                    'tags_diet'    => json_encode($request->input('tags_diet', [])),
                    'updated_at'   => date('Y-m-d H:i:s'),
                    'created_at'   => date('Y-m-d H:i:s')
                ]
            );

            return response()->json([
                'status'  => 'success',
                'message' => "Master menu '{$nama}' berhasil disimpan ke SIMRS!",
                'id_menu' => $idMenu
            ], 200);

        } catch (\\Exception $e) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Gagal menyimpan master menu: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * POST /api/sync-batch-menu
     * Sinkronisasi Sekaligus Seluruh Menu Makanan (Batch Sync)
     */
    public function syncBatchMenu(Request $request)
    {
        $menuList = $request->input('menu_items') ?? $request->input('items') ?? [];

        if (empty($menuList) || !is_array($menuList)) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Array menu_items tidak boleh kosong.'
            ], 400);
        }

        DB::beginTransaction();
        try {
            $syncedCount = 0;
            foreach ($menuList as $item) {
                $idMenu = $item['id'] ?? $item['id_menu'] ?? null;
                $nama   = $item['name'] ?? $item['nama_menu'] ?? null;

                if (!$idMenu || !$nama) continue;

                DB::table('master_menu_gizi_m')->updateOrInsert(
                    ['id_menu' => $idMenu],
                    [
                        'nama_menu'    => $nama,
                        'kategori'     => $item['category'] ?? $item['kategori'] ?? 'makanan_utama',
                        'harga'        => $item['price'] ?? $item['harga'] ?? 0,
                        'kalori'       => $item['calories'] ?? $item['kalori'] ?? 0,
                        'protein'      => $item['protein'] ?? 0,
                        'karbohidrat'  => $item['carbs'] ?? $item['karbohidrat'] ?? 0,
                        'lemak'        => $item['fat'] ?? $item['lemak'] ?? 0,
                        'natrium'      => $item['sodium'] ?? $item['natrium'] ?? 0,
                        'waktu_makan'  => json_encode($item['mealTimes'] ?? $item['waktu_makan'] ?? ['pagi','siang','malam']),
                        'deskripsi'    => $item['description'] ?? $item['deskripsi'] ?? '',
                        'gambar_url'   => $item['image'] ?? $item['gambar_url'] ?? '',
                        'is_tersedia'  => $item['isAvailable'] ?? $item['is_tersedia'] ?? true,
                        'updated_at'   => date('Y-m-d H:i:s'),
                        'created_at'   => date('Y-m-d H:i:s')
                    ]
                );
                $syncedCount++;
            }

            DB::commit();

            return response()->json([
                'status'       => 'success',
                'message'      => "Berhasil menyinkronkan {$syncedCount} menu ke master_menu_gizi_m (PostgreSQL).",
                'total_synced' => $syncedCount
            ], 200);

        } catch (\\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status'  => 'error',
                'message' => 'Gagal menyinkronkan batch master menu: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * GET /api/master-menu
     * Mengambil daftar master menu aktif dari database SIMRS
     */
    public function getMasterMenu(Request $request)
    {
        $kategori = $request->query('kategori');
        $query = DB::table('master_menu_gizi_m')->where('is_tersedia', true);

        if ($kategori && $kategori !== 'all') {
            $query->where('kategori', $kategori);
        }

        $menus = $query->orderBy('kategori')->orderBy('nama_menu')->get();

        return response()->json([
            'status' => 'success',
            'data'   => $menus
        ], 200);
    }
}
`;

export const JSON_PAYLOAD_EXAMPLES = `// ====================================================================
// 1. CONTOH REQUEST: SIMPAN PESANAN GIZI PASIEN
// METHOD: POST /api/save-pesanan-gizi
// HEADERS:
//   Content-Type: application/json
//   Accept: application/json
//   X-AUTH-TOKEN: secret_token_simrs_12345
// ====================================================================

{
  "noregistrasi": "REG-20260908-001",
  "hasil_json": {
    "orderNumber": "GZ-20260908-01",
    "registrationNo": "REG-20260908-001",
    "roomName": "Kamar Mawar 201 - Bed 01",
    "patientName": "Ny. Siti Rahmawati",
    "phoneNumber": "081298765432",
    "mealTime": "siang",
    "totalPrice": 45000,
    "totalCalories": 465,
    "patientNotes": "Mohon kuah sayur agak hangat, jangan terlalu pedas.",
    "status": "baru",
    "items": [
      {
        "menuItemId": "menu-1",
        "name": "Nasi Putih Pulen Organik",
        "portion": 1,
        "price": 6000,
        "category": "makanan_utama",
        "calories": 175
      },
      {
        "menuItemId": "menu-5",
        "name": "Ayam Panggang Bumbu Kuning Non-MSG",
        "portion": 1,
        "price": 22000,
        "category": "lauk_hewani",
        "calories": 185
      },
      {
        "menuItemId": "menu-11",
        "name": "Sayur Bening Bayam Jagung Manis",
        "portion": 1,
        "price": 9000,
        "category": "sayuran",
        "calories": 45
      }
    ]
  }
}

// ====================================================================
// 2. CONTOH JSON REQUEST: SIMPAN 1 MASTER MENU GIZI
// METHOD: POST /api/save-master-menu
// ====================================================================

{
  "id_menu": "menu-5",
  "nama_menu": "Ayam Panggang Bumbu Kuning Non-MSG",
  "kategori": "lauk_hewani",
  "harga": 22000,
  "kalori": 185,
  "protein": 24.5,
  "karbohidrat": 2.0,
  "lemak": 7.5,
  "natrium": 120,
  "waktu_makan": ["siang", "malam"],
  "deskripsi": "Dada ayam fillet tanpa kulit dipanggang oven dengan marinasi kunyit segar.",
  "gambar_url": "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b",
  "is_tersedia": true
}

// ====================================================================
// 3. CONTOH JSON REQUEST: SINKRONISASI MASSAL MASTER MENU (BATCH)
// METHOD: POST /api/sync-batch-menu
// ====================================================================

{
  "menu_items": [
    {
      "id": "menu-1",
      "name": "Nasi Putih Pulen Organik",
      "category": "makanan_utama",
      "price": 6000,
      "calories": 175,
      "protein": 3.5,
      "carbs": 38,
      "fat": 0.5,
      "sodium": 2,
      "mealTimes": ["pagi", "siang", "malam"],
      "description": "Beras organik pilihan ditanak pulen lembut, ramah lambung.",
      "isAvailable": true
    },
    {
      "id": "menu-2",
      "name": "Nasi Merah Berserat Tinggi",
      "category": "makanan_utama",
      "price": 8000,
      "calories": 150,
      "protein": 4.0,
      "carbs": 32,
      "fat": 1.2,
      "sodium": 3,
      "mealTimes": ["pagi", "siang", "malam"],
      "description": "Beras merah pecah kulit kaya antosianin dan serat pangan.",
      "isAvailable": true
    }
  ]
}
`;

/**
 * Snippet SQL PostgreSQL, Kode Controller Laravel, dan Route API
 * untuk Integrasi SIMRS (Sistem Informasi Manajemen Rumah Sakit)
 */

export const SQL_PESANAN_GIZI_TABLE = `-- ====================================================================
-- 1. SQL DDL POSTGRESQL: TABEL rego_pesanan_gizi_t (DB SIMRS)
-- Digunakan untuk menyimpan & membaca pesanan makanan pasien rawat inap
-- Terhubung langsung dengan No. Registrasi Pasien SIMRS
-- ====================================================================

-- PERINTAH CEPAT (Bila tabel rego_pesanan_gizi_t sudah ada di SIMRS):
ALTER TABLE IF EXISTS rego_pesanan_gizi_t ADD COLUMN IF NOT EXISTS no_pesanan VARCHAR(64);
ALTER TABLE IF EXISTS rego_pesanan_gizi_t ADD COLUMN IF NOT EXISTS order_number VARCHAR(64);
ALTER TABLE IF EXISTS rego_pesanan_gizi_t ADD COLUMN IF NOT EXISTS room_name VARCHAR(100);
ALTER TABLE IF EXISTS rego_pesanan_gizi_t ADD COLUMN IF NOT EXISTS patient_name VARCHAR(150);
ALTER TABLE IF EXISTS rego_pesanan_gizi_t ADD COLUMN IF NOT EXISTS phone_number VARCHAR(25);
ALTER TABLE IF EXISTS rego_pesanan_gizi_t ADD COLUMN IF NOT EXISTS meal_time VARCHAR(20) DEFAULT 'siang';
ALTER TABLE IF EXISTS rego_pesanan_gizi_t ADD COLUMN IF NOT EXISTS total_price NUMERIC(12,2) DEFAULT 0;
ALTER TABLE IF EXISTS rego_pesanan_gizi_t ADD COLUMN IF NOT EXISTS total_calories INT DEFAULT 0;
ALTER TABLE IF EXISTS rego_pesanan_gizi_t ADD COLUMN IF NOT EXISTS patient_notes TEXT;
ALTER TABLE IF EXISTS rego_pesanan_gizi_t ADD COLUMN IF NOT EXISTS order_status VARCHAR(30) DEFAULT 'baru';
ALTER TABLE IF EXISTS rego_pesanan_gizi_t ADD COLUMN IF NOT EXISTS items_json JSONB;
ALTER TABLE IF EXISTS rego_pesanan_gizi_t ADD COLUMN IF NOT EXISTS hasil_json JSONB;
ALTER TABLE IF EXISTS rego_pesanan_gizi_t ADD COLUMN IF NOT EXISTS tgl_pesanan TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- DDL Pembuatan Tabel Baru: rego_pesanan_gizi_t
CREATE TABLE IF NOT EXISTS rego_pesanan_gizi_t (
    id BIGSERIAL PRIMARY KEY,
    no_pesanan VARCHAR(64) NOT NULL UNIQUE,
    order_number VARCHAR(64),
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
    hasil_json JSONB,
    
    tgl_pesanan TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indeks Performa untuk Pencarian Cepat di SIMRS
CREATE INDEX IF NOT EXISTS idx_rego_pesanan_gizi_noregistrasi ON rego_pesanan_gizi_t (noregistrasi);
CREATE INDEX IF NOT EXISTS idx_rego_pesanan_gizi_no_pesanan ON rego_pesanan_gizi_t (no_pesanan);
CREATE INDEX IF NOT EXISTS idx_rego_pesanan_gizi_order_number ON rego_pesanan_gizi_t (order_number);
CREATE INDEX IF NOT EXISTS idx_rego_pesanan_gizi_created_at ON rego_pesanan_gizi_t (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rego_pesanan_gizi_status ON rego_pesanan_gizi_t (order_status);
CREATE INDEX IF NOT EXISTS idx_rego_pesanan_gizi_items_gin ON rego_pesanan_gizi_t USING GIN (items_json);

-- CONTOH QUERY CEK DATA REKAP & PESANAN MASUK DI DB SIMRS:
-- 1. Ambil 100 pesanan gizi terbaru
-- SELECT * FROM rego_pesanan_gizi_t ORDER BY created_at DESC LIMIT 100;

-- 2. Rekap total porsi dan omset per ruangan / kamar
-- SELECT room_name, count(*) as total_pesanan, sum(total_price) as total_biaya 
-- FROM rego_pesanan_gizi_t 
-- WHERE order_status != 'dibatalkan'
-- GROUP BY room_name ORDER BY total_pesanan DESC;

-- 3. Rekap jumlah pesanan per waktu makan (pagi, siang, malam)
-- SELECT meal_time, count(*) as jumlah_pesanan, sum(total_price) as omset
-- FROM rego_pesanan_gizi_t 
-- GROUP BY meal_time;
`;

export const SQL_MASTER_MENU_TABLE = `-- ====================================================================
-- 2. SQL DDL POSTGRESQL: TABEL master_menu_gizi_m
-- Digunakan untuk Master Data Menu Makanan & Diet Gizi Rumah Sakit
-- Lengkap dengan Informasi Nutrisi (Kalori, Protein, Karbohidrat, Lemak, Natrium)
-- ====================================================================

-- PERINTAH CEPAT (Bila tabel master_menu_gizi_m sudah ada):
ALTER TABLE IF EXISTS master_menu_gizi_m ADD COLUMN IF NOT EXISTS foto_url TEXT;
ALTER TABLE IF EXISTS master_menu_gizi_m ADD COLUMN IF NOT EXISTS gambar_url TEXT;

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
    foto_url TEXT,                 -- Menyimpan URL gambar atau String Base64 foto menu
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
    // 1. API PESANAN GIZI PASIEN (RAWAT INAP)
    // ==========================================
    // GET: Ambil seluruh riwayat pesanan gizi masuk (Ditarik oleh Dashboard Admin & Sistem Gizi)
    Route::get('/riwayat-pesanan-gizi', [GiziSIMRSController::class, 'getRiwayatPesananGizi']);
    Route::get('/pesanan-gizi', [GiziSIMRSController::class, 'getRiwayatPesananGizi']);

    // GET: Ambil pesanan spesifik berdasarkan No. Registrasi pasien
    Route::get('/pesanan-gizi/{noregistrasi}', [GiziSIMRSController::class, 'getPesananByRegistrasi']);

    // GET: Ambil detail 1 pesanan berdasarkan No. Pesanan
    Route::get('/detail-pesanan-gizi/{order_number}', [GiziSIMRSController::class, 'getDetailPesananGizi']);
    
    // POST: Simpan pesanan makanan baru dari kamar pasien
    Route::post('/save-pesanan-gizi', [GiziSIMRSController::class, 'simpanPesananGizi']);
    
    // POST: Update status pesanan (diproses, diantar, selesai, dibatalkan)
    Route::post('/update-status-pesanan-gizi', [GiziSIMRSController::class, 'updateStatusPesananGizi']);

    // ==========================================
    // 2. API MASTER DATA MENU GIZI RS
    // ==========================================
    // GET: Ambil daftar master menu aktif untuk aplikasi pemesanan pasien & admin
    Route::get('/master-menu-gizi', [GiziSIMRSController::class, 'getMasterMenuGizi']);
    Route::get('/master-menu', [GiziSIMRSController::class, 'getMasterMenuGizi']);
    
    // POST: Simpan / update 1 item menu makanan
    Route::post('/save-master-menu', [GiziSIMRSController::class, 'simpanMasterMenu']);
    
    // POST: Sinkronisasi massal (bulk sync) seluruh menu makanan
    Route::post('/sync-batch-menu', [GiziSIMRSController::class, 'syncBatchMenu']);

// ==========================================
// OPSIONAL 2: GAYA ROUTE MEDIFIRST2000 (EMRController)
// ==========================================
Route::group(['prefix' => 'service/medifirst2000/emr'], function () {
    // GET: Tarik riwayat pesanan gizi dari SIMRS (tabel rego_pesanan_gizi_t)
    Route::get('riwayat-pesanan-gizi', 'EMR\\EMRController@getRiwayatPesananGizi');
    Route::get('pesanan-gizi', 'EMR\\EMRController@getRiwayatPesananGizi');
    
    // GET: Rekapan & ringkasan pesanan gizi masuk
    Route::get('rekap-pesanan-gizi', 'EMR\\EMRController@getRekapPesananGizi');
    
    // GET: Detail 1 pesanan berdasarkan order_number
    Route::get('detail-pesanan-gizi/{order_number}', 'EMR\\EMRController@getDetailPesananGizi');

    // POST: Simpan pesanan gizi baru
    Route::post('save-pesanan-gizi', 'EMR\\EMRController@savePesananGizi');

    // POST: Update status pesanan gizi (diproses, diantar, selesai, dibatalkan)
    Route::post('update-status-pesanan-gizi', 'EMR\\EMRController@updateStatusPesananGizi');

    // Master Menu Gizi
    Route::get('master-menu-gizi', 'EMR\\EMRController@getMasterMenuGizi');
    Route::post('save-master-menu', 'EMR\\EMRController@saveMasterMenu');
    Route::post('sync-batch-menu', 'EMR\\EMRController@syncBatchMenu');
});
`;

/**
 * Controller EMRController untuk Medifirst2000 / RSBSA SIMRS
 * Mengambil dan memproses data dari tabel: rego_pesanan_gizi_t
 */
export const LARAVEL_EMR_CONTROLLER_CODE = `<?php

namespace App\\Http\\Controllers\\EMR;

use App\\Http\\Controllers\\Controller;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;

class EMRController extends Controller
{
    /**
     * Verifikasi Header X-AUTH-TOKEN (Opsional, jika env diset)
     */
    private function checkAuthToken(Request $request)
    {
        $expectedToken = env("SIMRS_AUTH_TOKEN", "");
        if (!empty($expectedToken)) {
            $receivedToken = $request->header("X-AUTH-TOKEN") 
                          ?: str_replace("Bearer ", "", $request->header("Authorization", ""));

            if ($receivedToken !== $expectedToken) {
                return response()->json([
                    "status"  => "unauthorized",
                    "message" => "Token autentikasi X-AUTH-TOKEN tidak valid atau tidak disertakan."
                ], 401);
            }
        }
        return null;
    }

    /**
     * GET /service/medifirst2000/emr/riwayat-pesanan-gizi
     * (atau /api/riwayat-pesanan-gizi)
     * FUNGSI UTAMA UNTUK ADMIN: Mengambil seluruh riwayat pesanan masuk dari tabel rego_pesanan_gizi_t
     * MENGGUNAKAN \\DB::table("rego_pesanan_gizi_t") LANGSUNG (BEBAS DARI ERROR Schema NOT FOUND)
     */
    public function getRiwayatPesananGizi(Request $request)
    {
        $authError = $this->checkAuthToken($request);
        if ($authError) return $authError;

        try {
            $query = \\DB::table("rego_pesanan_gizi_t");

            // Filter status pesanan jika dikirim
            if (!empty($request->input("status")) && $request->input("status") !== "all") {
                $st = $request->input("status");
                $query->where(function($q) use ($st) {
                    $q->where("order_status", $st)->orWhere("status", $st);
                });
            }

            // Filter nomor registrasi pasien jika ada
            if (!empty($request->input("noregistrasi"))) {
                $query->where("noregistrasi", $request->input("noregistrasi"));
            }

            // Filter waktu makan (pagi, siang, malam, snack)
            if (!empty($request->input("meal_time")) && $request->input("meal_time") !== "all") {
                $mt = $request->input("meal_time");
                $query->where(function($q) use ($mt) {
                    $q->where("meal_time", $mt)->orWhere("waktu_makan", $mt);
                });
            }

            // Filter tanggal pesanan
            if (!empty($request->input("tgl_awal"))) {
                $query->whereDate("tgl_pesanan", ">=", $request->input("tgl_awal"));
            }
            if (!empty($request->input("tgl_akhir"))) {
                $query->whereDate("tgl_pesanan", "<=", $request->input("tgl_akhir"));
            }

            // Urutkan dari pesanan paling baru (ID desc)
            try {
                $rawOrders = $query->orderBy("id", "desc")->limit($request->input("limit", 200))->get();
            } catch (\\Exception $e) {
                $rawOrders = $query->limit($request->input("limit", 200))->get();
            }

            // Gunakan foreach agar kompatibel dengan Laravel versi lama (di mana ->get() mengembalikan array biasa)
            $formattedOrders = [];
            foreach ($rawOrders as $o) {
                $items = [];
                $rawItems = $o->items_json ?? ($o->hasil_json ?? null);
                if (!empty($rawItems)) {
                    if (is_array($rawItems)) {
                        $items = $rawItems;
                    } elseif (is_string($rawItems)) {
                        $decoded = json_decode($rawItems, true);
                        if (is_array($decoded)) {
                            $items = isset($decoded["items"]) && is_array($decoded["items"]) ? $decoded["items"] : $decoded;
                        }
                    }
                }

                $normalizedItems = [];
                if (is_array($items)) {
                    foreach ($items as $it) {
                        $normalizedItems[] = [
                            "menuItemId" => (string)($it["menuItemId"] ?? $it["id_menu"] ?? $it["id"] ?? "item"),
                            "name"       => (string)($it["name"] ?? $it["nama_menu"] ?? "Menu Makanan"),
                            "portion"    => (int)($it["portion"] ?? $it["porsi"] ?? $it["jumlah_porsi"] ?? 1),
                            "price"      => (int)($it["price"] ?? $it["harga"] ?? $it["harga_satuan"] ?? 0),
                            "category"   => (string)($it["category"] ?? $it["kategori"] ?? "makanan_utama"),
                            "calories"   => (int)($it["calories"] ?? $it["kalori"] ?? 100),
                        ];
                    }
                }

                $computedPrice = 0;
                $computedCal = 0;
                foreach ($normalizedItems as $it) {
                    $computedPrice += $it["price"] * $it["portion"];
                    $computedCal += $it["calories"] * $it["portion"];
                }

                $orderNum = (string)($o->order_number ?? ($o->no_pesanan ?? ("GZ-" . ($o->id ?? time()))));
                $createdAt = $o->tgl_pesanan ?? ($o->created_at ?? date("Y-m-d H:i:s"));

                $formattedOrders[] = [
                    "id"             => (string)($o->id ?? $orderNum),
                    "orderNumber"    => $orderNum,
                    "no_pesanan"     => $orderNum,
                    "registrationNo" => (string)($o->noregistrasi ?? ""),
                    "noregistrasi"   => (string)($o->noregistrasi ?? ""),
                    "createdAt"      => $createdAt,
                    "tgl_pesanan"    => $createdAt,
                    "roomName"       => (string)($o->room_name ?? ($o->nomor_kamar ?? ($o->kamar ?? "Kamar Pasien"))),
                    "patientName"    => (string)($o->patient_name ?? ($o->nama_pasien ?? "Pasien")),
                    "phoneNumber"    => (string)($o->phone_number ?? ($o->telepon ?? "")),
                    "mealTime"       => (string)($o->meal_time ?? ($o->waktu_makan ?? "siang")),
                    "items"          => $normalizedItems,
                    "totalPrice"     => (int)($o->total_price ?? ($o->total_biaya ?? $computedPrice)),
                    "totalCalories"  => (int)($o->total_calories ?? ($o->total_kalori ?? $computedCal)),
                    "patientNotes"   => (string)($o->patient_notes ?? ($o->catatan ?? "")),
                    "status"         => (string)($o->order_status ?? ($o->status ?? "baru")),
                    "simrsSource"    => "rego_pesanan_gizi_t",
                ];
            }

            return response()->json([
                "status"      => "success",
                "message"     => "Berhasil mengambil riwayat pesanan gizi dari tabel rego_pesanan_gizi_t.",
                "totalOrders" => count($formattedOrders),
                "data"        => $formattedOrders
            ], 200);

        } catch (\\Exception $e) {
            return response()->json([
                "status"  => "error",
                "message" => "Gagal mengambil riwayat pesanan gizi: " . $e->getMessage()
            ], 500);
        }
    }

    /**
     * GET /service/medifirst2000/emr/detail-pesanan-gizi/{order_number}
     * Mengambil 1 pesanan berdasarkan order_number
     */
    public function getDetailPesananGizi($order_number, Request $request)
    {
        $authError = $this->checkAuthToken($request);
        if ($authError) return $authError;

        try {
            $order = \\DB::table("rego_pesanan_gizi_t")
                ->where("order_number", $order_number)
                ->orWhere("no_pesanan", $order_number)
                ->first();

            if (!$order) {
                return response()->json([
                    "status"  => "error",
                    "message" => "Pesanan gizi {} tidak ditemukan di tabel rego_pesanan_gizi_t."
                ], 404);
            }

            return response()->json([
                "status" => "success",
                "data"   => $order
            ], 200);
        } catch (\\Exception $e) {
            return response()->json([
                "status"  => "error",
                "message" => "Gagal mengambil detail pesanan: " . $e->getMessage()
            ], 500);
        }
    }

    /**
     * GET /service/medifirst2000/emr/rekap-pesanan-gizi
     * Rekapitulasi pesanan gizi dari PostgreSQL
     */
    public function getRekapPesananGizi(Request $request)
    {
        $authError = $this->checkAuthToken($request);
        if ($authError) return $authError;

        try {
            $query = \\DB::table("rego_pesanan_gizi_t");
            if (!empty($request->input("tgl_awal"))) {
                $query->whereDate("tgl_pesanan", ">=", $request->input("tgl_awal"));
            }
            if (!empty($request->input("tgl_akhir"))) {
                $query->whereDate("tgl_pesanan", "<=", $request->input("tgl_akhir"));
            }

            $totalOrders = (clone $query)->count();
            $totalRevenue = (clone $query)->where("order_status", "!=", "dibatalkan")->sum("total_price");
            $rekapPerKamar = (clone $query)->select("room_name", \\DB::raw("count(*) as total_pesanan"), \\DB::raw("sum(total_price) as total_biaya"))
                                          ->groupBy("room_name")->orderByDesc("total_pesanan")->get();
            $rekapPerWaktu = (clone $query)->select("meal_time", \\DB::raw("count(*) as total_pesanan"), \\DB::raw("sum(total_price) as total_biaya"))
                                          ->groupBy("meal_time")->get();

            return response()->json([
                "status"        => "success",
                "totalOrders"   => $totalOrders,
                "totalRevenue"  => (int)$totalRevenue,
                "rekapPerKamar" => $rekapPerKamar,
                "rekapPerWaktu" => $rekapPerWaktu
            ], 200);
        } catch (\\Exception $e) {
            return response()->json([
                "status"  => "error",
                "message" => "Gagal mengambil rekapan pesanan: " . $e->getMessage()
            ], 500);
        }
    }

    /**
     * POST /service/medifirst2000/emr/update-status-pesanan-gizi
     * Update status pesanan gizi: baru -> diproses -> diantar -> selesai / dibatalkan
     */
    public function updateStatusPesananGizi(Request $request)
    {
        $authError = $this->checkAuthToken($request);
        if ($authError) return $authError;

        $orderNumber = $request->input("order_number") ?? ($request->input("no_pesanan") ?? $request->input("orderNumber"));
        $newStatus   = $request->input("status") ?? $request->input("order_status");

        if (!$orderNumber || !$newStatus) {
            return response()->json([
                "status"  => "error",
                "message" => "Parameter order_number dan status wajib dikirim."
            ], 400);
        }

        try {
            $affected = \\DB::table("rego_pesanan_gizi_t")
                ->where("order_number", $orderNumber)
                ->orWhere("no_pesanan", $orderNumber)
                ->update([
                    "order_status" => $newStatus,
                    "updated_at"   => date("Y-m-d H:i:s")
                ]);

            return response()->json([
                "status"       => "success",
                "message"      => "Status pesanan {$orderNumber} berhasil diperbarui menjadi {}.",
                "order_number" => $orderNumber,
                "new_status"   => $newStatus,
                "affected"     => $affected
            ], 200);

        } catch (\\Exception $e) {
            return response()->json([
                "status"  => "error",
                "message" => "Gagal memperbarui status pesanan: " . $e->getMessage()
            ], 500);
        }
    }

    /**
     * POST /service/medifirst2000/emr/save-pesanan-gizi
     * Simpan / Perbarui Pesanan Pasien Rawat Inap ke rego_pesanan_gizi_t
     */
    public function savePesananGizi(Request $request)
    {
        $authError = $this->checkAuthToken($request);
        if ($authError) return $authError;

        $noRegistrasi = $request->input("noregistrasi");
        $orderData    = $request->input("hasil_json");

        if (!$noRegistrasi || !$orderData) {
            return response()->json([
                "status"  => "error",
                "message" => "Parameter noregistrasi dan hasil_json wajib dikirim."
            ], 400);
        }

        try {
            $orderNumber = $orderData["no_pesanan"] 
                ?? $orderData["orderNumber"] 
                ?? $orderData["order_number"] 
                ?? $request->input("no_pesanan") 
                ?? ("GZ-" . date("YmdHis"));

            $headerData = [
                "noregistrasi"   => $noRegistrasi,
                "order_number"   => $orderNumber,
                "no_pesanan"     => $orderNumber,
                "room_name"      => $orderData["roomName"] ?? ($orderData["nomor_kamar"] ?? "Kamar Pasien"),
                "patient_name"   => $orderData["patientName"] ?? ($orderData["nama_pasien"] ?? null),
                "phone_number"   => $orderData["phoneNumber"] ?? null,
                "meal_time"      => $orderData["mealTime"] ?? ($orderData["waktu_makan"] ?? "siang"),
                "total_price"    => $orderData["totalPrice"] ?? ($orderData["total_biaya"] ?? 0),
                "total_calories" => $orderData["totalCalories"] ?? ($orderData["total_kalori"] ?? 0),
                "patient_notes"  => $orderData["patientNotes"] ?? ($orderData["dietaryNotes"] ?? null),
                "order_status"   => $orderData["status"] ?? ($orderData["order_status"] ?? "baru"),
                "items_json"     => json_encode($orderData["items"] ?? []),
                "hasil_json"     => json_encode($orderData),
                "tgl_pesanan"    => date("Y-m-d H:i:s"),
                "updated_at"     => date("Y-m-d H:i:s"),
                "created_at"     => date("Y-m-d H:i:s")
            ];

            \\DB::table("rego_pesanan_gizi_t")->updateOrInsert(
                [
                    "order_number" => $orderNumber,
                ],
                $headerData
            );

            return response()->json([
                "status"       => "success",
                "message"      => "Pesanan gizi berhasil disimpan ke tabel rego_pesanan_gizi_t SIMRS!",
                "orderNumber"  => $orderNumber,
                "noregistrasi" => $noRegistrasi
            ], 200);

        } catch (\\Exception $e) {
            return response()->json([
                "status"  => "error",
                "message" => "Gagal menyimpan pesanan ke rego_pesanan_gizi_t: " . $e->getMessage()
            ], 500);
        }
    }
}
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
            // Kompatibilitas multi-format: no_pesanan, orderNumber, order_number
            $orderNumber = $orderData['no_pesanan'] 
                ?? $orderData['orderNumber'] 
                ?? $orderData['order_number'] 
                ?? $request->input('no_pesanan') 
                ?? ('GZ-' . date('YmdHis'));

            // Nama tabel otomatis dideteksi: 'rego_pesanan_gizi_t', 'go_pesanan_gizi_t', atau 'pesanan_gizi_t'
            $tableName = 'rego_pesanan_gizi_t';
            if (!\\Illuminate\\Support\\Facades\\Schema::hasTable($tableName)) {
                $tableName = \\Illuminate\\Support\\Facades\\Schema::hasTable('go_pesanan_gizi_t') 
                    ? 'go_pesanan_gizi_t' 
                    : 'pesanan_gizi_t';
            }

            // 1. Simpan data header pesanan (Idempotent: updateOrInsert)
            $headerData = [
                'noregistrasi'   => $noRegistrasi,
                'order_number'   => $orderNumber,
                'room_name'      => $orderData['roomName'] ?? ($orderData['nomor_kamar'] ?? 'Kamar Pasien'),
                'patient_name'   => $orderData['patientName'] ?? ($orderData['nama_pasien'] ?? null),
                'phone_number'   => $orderData['phoneNumber'] ?? null,
                'meal_time'      => $orderData['mealTime'] ?? ($orderData['waktu_makan'] ?? 'siang'),
                'total_price'    => $orderData['totalPrice'] ?? ($orderData['total_biaya'] ?? 0),
                'total_calories' => $orderData['totalCalories'] ?? ($orderData['total_kalori'] ?? 0),
                'patient_notes'  => $orderData['patientNotes'] ?? ($orderData['dietaryNotes'] ?? ($orderData['catatan_alergi_diet'] ?? null)),
                'order_status'   => $orderData['status'] ?? ($orderData['order_status'] ?? 'baru'),
                'items_json'     => json_encode($orderData['items'] ?? []),
                'updated_at'     => date('Y-m-d H:i:s'),
                'created_at'     => date('Y-m-d H:i:s')
            ];

            // Tambahkan kolom no_pesanan jika ada di skema
            if (\\Illuminate\\Support\\Facades\\Schema::hasColumn($tableName, 'no_pesanan')) {
                $headerData['no_pesanan'] = $orderNumber;
            }

            // Tambahkan kolom tgl_pesanan jika ada di skema
            if (\\Illuminate\\Support\\Facades\\Schema::hasColumn($tableName, 'tgl_pesanan')) {
                $headerData['tgl_pesanan'] = date('Y-m-d H:i:s');
            }

            DB::table($tableName)->updateOrInsert(
                [
                    'noregistrasi' => $noRegistrasi,
                    'order_number' => $orderNumber,
                ],
                $headerData
            );

            // 2. (Opsional) Simpan rincian ke tabel relasional
            $detailTableName = \\Illuminate\\Support\\Facades\\Schema::hasTable('go_rincian_pesanan_gizi_t') 
                ? 'go_rincian_pesanan_gizi_t' 
                : 'rincian_pesanan_gizi_t';

            if (\\Illuminate\\Support\\Facades\\Schema::hasTable($detailTableName) && !empty($orderData['items']) && is_array($orderData['items'])) {
                $orderCol = \\Illuminate\\Support\\Facades\\Schema::hasColumn($detailTableName, 'order_number') ? 'order_number' : 'no_pesanan';
                DB::table($detailTableName)->where($orderCol, $orderNumber)->delete();
                
                $detailsToInsert = [];
                foreach ($orderData['items'] as $item) {
                    $detailsToInsert[] = [
                        $orderCol      => $orderNumber,
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
                    DB::table($detailTableName)->insert($detailsToInsert);
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
        $idMenu = $request->input('id_menu') ?? $request->input('id') ?? $request->input('kd_menu');
        $nama   = $request->input('nama_menu') ?? $request->input('name') ?? $request->input('nama');

        if (!$idMenu || !$nama) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Parameter id_menu dan nama_menu wajib dikirim.'
            ], 400);
        }

        // Parsing ketersediaan boolean secara ketat
        $rawAvail = $request->input('isAvailable', $request->input('is_tersedia', $request->input('tersedia', $request->input('status', true))));
        $isTersedia = filter_var($rawAvail, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        if ($isTersedia === null) {
            $isTersedia = in_array(strtolower((string)$rawAvail), ['1', 't', 'true', 'yes', 'tersedia', 'ada'], true);
        }

        try {
            $tableName = DB::getSchemaBuilder()->hasTable('rego_master_menu_gizi_m') ? 'rego_master_menu_gizi_m' : 'master_menu_gizi_m';
            $primaryKey = DB::getSchemaBuilder()->hasColumn($tableName, 'id_menu') ? 'id_menu' : (DB::getSchemaBuilder()->hasColumn($tableName, 'menu_id') ? 'menu_id' : 'id');

            DB::table($tableName)->updateOrInsert(
                [$primaryKey => $idMenu],
                [
                    'nama_menu'    => $nama,
                    'kategori'     => $request->input('kategori', $request->input('category', 'makanan_utama')),
                    'harga'        => (int)$request->input('harga', $request->input('price', 0)),
                    'kalori'       => (int)$request->input('kalori', $request->input('calories', 0)),
                    'protein'      => (float)$request->input('protein', 0),
                    'karbohidrat'  => (float)$request->input('karbohidrat', $request->input('carbs', 0)),
                    'lemak'        => (float)$request->input('lemak', $request->input('fat', 0)),
                    'natrium'      => (float)$request->input('natrium', $request->input('sodium', 0)),
                    'waktu_makan'  => is_array($request->input('waktu_makan')) ? json_encode($request->input('waktu_makan')) : (string)$request->input('waktu_makan', json_encode(['pagi', 'siang', 'malam'])),
                    'deskripsi'    => (string)$request->input('deskripsi', $request->input('description', '')),
                    'foto_url'     => (string)$request->input('foto_url', $request->input('gambar_url', $request->input('image', ''))),
                    'gambar_url'   => (string)$request->input('foto_url', $request->input('gambar_url', $request->input('image', ''))),
                    'is_tersedia'  => $isTersedia,
                    'tersedia'     => $isTersedia,
                    'tags_diet'    => is_array($request->input('tags_diet')) ? json_encode($request->input('tags_diet')) : json_encode([]),
                    'updated_at'   => date('Y-m-d H:i:s'),
                    'created_at'   => date('Y-m-d H:i:s')
                ]
            );

            return response()->json([
                'status'      => 'success',
                'message'     => "Master menu '{$nama}' berhasil disimpan ke SIMRS!",
                'id_menu'     => $idMenu,
                'is_tersedia' => $isTersedia
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
            $tableName = DB::getSchemaBuilder()->hasTable('rego_master_menu_gizi_m') ? 'rego_master_menu_gizi_m' : 'master_menu_gizi_m';
            $primaryKey = DB::getSchemaBuilder()->hasColumn($tableName, 'id_menu') ? 'id_menu' : (DB::getSchemaBuilder()->hasColumn($tableName, 'menu_id') ? 'menu_id' : 'id');

            $syncedCount = 0;
            foreach ($menuList as $item) {
                $idMenu = $item['id'] ?? $item['id_menu'] ?? $item['kd_menu'] ?? null;
                $nama   = $item['name'] ?? $item['nama_menu'] ?? $item['nama'] ?? null;

                if (!$idMenu || !$nama) continue;

                // Parsing ketersediaan boolean secara ketat
                $rawAvail = $item['isAvailable'] ?? $item['is_tersedia'] ?? $item['tersedia'] ?? $item['status'] ?? true;
                $isTersedia = filter_var($rawAvail, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
                if ($isTersedia === null) {
                    $isTersedia = in_array(strtolower((string)$rawAvail), ['1', 't', 'true', 'yes', 'tersedia', 'ada'], true);
                }

                $waktuMakan = $item['mealTimes'] ?? $item['waktu_makan'] ?? ['pagi','siang','malam'];
                $fotoUrl = $item['foto_url'] ?? $item['image'] ?? $item['gambar_url'] ?? '';

                DB::table($tableName)->updateOrInsert(
                    [$primaryKey => $idMenu],
                    [
                        'nama_menu'    => $nama,
                        'kategori'     => $item['category'] ?? $item['kategori'] ?? 'makanan_utama',
                        'harga'        => (int)($item['price'] ?? $item['harga'] ?? 0),
                        'kalori'       => (int)($item['calories'] ?? $item['kalori'] ?? 0),
                        'protein'      => (float)($item['protein'] ?? 0),
                        'carbs'        => (float)($item['carbs'] ?? $item['karbohidrat'] ?? 0),
                        'lemak'        => (float)($item['fat'] ?? $item['lemak'] ?? 0),
                        'natrium'      => (float)($item['sodium'] ?? $item['natrium'] ?? 0),
                        'waktu_makan'  => is_array($waktuMakan) ? json_encode($waktuMakan) : (string)$waktuMakan,
                        'deskripsi'    => (string)($item['description'] ?? $item['deskripsi'] ?? ''),
                        'foto_url'     => $fotoUrl,
                        'gambar_url'   => $fotoUrl,
                        'is_tersedia'  => $isTersedia,
                        'tersedia'     => $isTersedia,
                        'updated_at'   => date('Y-m-d H:i:s'),
                        'created_at'   => date('Y-m-d H:i:s')
                    ]
                );
                $syncedCount++;
            }

            DB::commit();

            return response()->json([
                'status'       => 'success',
                'message'      => "Berhasil menyinkronkan {$syncedCount} menu ke {$tableName} (PostgreSQL).",
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
     * GET /api/master-menu-gizi (atau /api/master-menu)
     * Mengambil daftar master menu aktif dari tabel 'rego_master_menu_gizi_m' (DB SIMRS)
     * untuk ditampilkan langsung di aplikasi pemesanan pasien & admin
     */
    public function getMasterMenuGizi(Request $request)
    {
        // Validasi X-AUTH-TOKEN jika diaktifkan
        $authError = $this->checkAuthToken($request);
        if ($authError) return $authError;

        try {
            $tableName = 'rego_master_menu_gizi_m';
            if (!DB::getSchemaBuilder()->hasTable($tableName)) {
                $tableName = DB::getSchemaBuilder()->hasTable('master_menu_gizi_m') ? 'master_menu_gizi_m' : 'rego_master_menu_gizi_m';
            }

            $query = DB::table($tableName);

            // Filter ketersediaan: jika untuk pasien, ambil yang tersedia (tersedia = true / 1)
            if (!$request->has('include_all')) {
                $query->where(function($q) {
                    $q->where('tersedia', true)
                      ->orWhere('tersedia', 1)
                      ->orWhereNull('tersedia');
                });
            }

            // Filter kategori opsional jika dikirim oleh client
            if (!empty($request->input('kategori')) && $request->input('kategori') !== 'all') {
                $query->where('kategori', $request->input('kategori'));
            }

            // Filter waktu makan opsional (pagi, siang, malam, snack)
            if (!empty($request->input('waktu_makan')) && $request->input('waktu_makan') !== 'all') {
                $waktu = strtolower($request->input('waktu_makan'));
                $query->where(function($q) use ($waktu) {
                    $q->where('waktu_makan', 'like', "%{$waktu}%")
                      ->orWhere('waktu_makan', 'semua')
                      ->orWhere('waktu_makan', 'all')
                      ->orWhereNull('waktu_makan');
                });
            }

            $rawMenus = $query->orderBy('kategori', 'asc')->orderBy('nama_menu', 'asc')->get();

            // Transformasi data agar sesuai dengan struktur objek MenuItem di aplikasi frontend pasien & admin
            $formattedMenus = $rawMenus->map(function ($item) {
                // Parsing waktu makan
                $mealTimes = ['pagi', 'siang', 'malam'];
                if (!empty($item->waktu_makan)) {
                    if (strtolower($item->waktu_makan) === 'semua' || strtolower($item->waktu_makan) === 'all') {
                        $mealTimes = ['pagi', 'siang', 'malam'];
                    } else {
                        $decoded = json_decode($item->waktu_makan, true);
                        if (is_array($decoded)) {
                            $mealTimes = $decoded;
                        } else {
                            $mealTimes = array_map('trim', explode(',', $item->waktu_makan));
                        }
                    }
                }

                // Parsing tags diet khusus
                $dietaryTags = [];
                if (!empty($item->tags_diet)) {
                    $decodedTags = json_decode($item->tags_diet, true);
                    if (is_array($decodedTags)) {
                        $dietaryTags = $decodedTags;
                    }
                }

                return [
                    'id'          => (string)($item->menu_id ?? $item->id ?? $item->id_menu),
                    'name'        => (string)($item->nama_menu ?? $item->name ?? 'Menu Gizi'),
                    'description' => (string)($item->deskripsi ?? $item->description ?? ''),
                    'category'    => (string)($item->kategori ?? $item->category ?? 'makanan_utama'),
                    'price'       => (int)($item->harga ?? $item->price ?? 0),
                    'calories'    => (int)($item->kalori ?? $item->calories ?? 0),
                    'protein'     => (float)($item->protein_gram ?? $item->protein ?? 0),
                    'carbs'       => (float)($item->karbohidrat_gram ?? $item->karbohidrat ?? $item->carbs ?? 0),
                    'fat'         => (float)($item->lemak_gram ?? $item->lemak ?? $item->fat ?? 0),
                    'sodium'      => (float)($item->natrium_mg ?? $item->natrium ?? $item->sodium ?? 0),
                    'mealTimes'   => $mealTimes,
                    'dietaryTags' => $dietaryTags,
                    'isAvailable' => (bool)($item->tersedia ?? $item->is_tersedia ?? true),
                    'foto_url'    => (string)($item->foto_url ?? $item->gambar_url ?? $item->image ?? ''),
                    'image'       => $item->foto_url ?? $item->gambar_url ?? $item->image ?? 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
                ];
            });

            return response()->json([
                'status'  => 'success',
                'message' => 'Data master menu gizi berhasil diambil dari database SIMRS.',
                'total'   => count($formattedMenus),
                'data'    => $formattedMenus
            ], 200);

        } catch (\\Exception $e) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Gagal mengambil master menu: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * GET /api/riwayat-pesanan-gizi (atau /api/pesanan-gizi)
     * Mengambil daftar seluruh riwayat pesanan makanan gizi pasien dari PostgreSQL
     * Digunakan oleh Dashboard Admin & Sistem Dapur Instalasi Gizi
     */
    public function getRiwayatPesananGizi(Request $request)
    {
        // Validasi X-AUTH-TOKEN jika diaktifkan
        $authError = $this->checkAuthToken($request);
        if ($authError) return $authError;

        try {
            // Deteksi nama tabel pesanan gizi secara dinamis
            $tableName = 'rego_pesanan_gizi_t';
            if (!\\Illuminate\\Support\\Facades\\Schema::hasTable($tableName)) {
                $tableName = \\Illuminate\\Support\\Facades\\Schema::hasTable('go_pesanan_gizi_t') 
                    ? 'go_pesanan_gizi_t' 
                    : 'pesanan_gizi_t';
            }

            $query = DB::table($tableName);

            // Filter status pesanan (baru, diproses, diantar, selesai, dibatalkan) jika dikirim
            if (!empty($request->input('status')) && $request->input('status') !== 'all') {
                $statusCol = \\Illuminate\\Support\\Facades\\Schema::hasColumn($tableName, 'order_status') ? 'order_status' : 'status';
                $query->where($statusCol, $request->input('status'));
            }

            // Filter nomor registrasi pasien jika ada
            if (!empty($request->input('noregistrasi'))) {
                $query->where('noregistrasi', $request->input('noregistrasi'));
            }

            // Filter waktu makan (pagi, siang, malam, snack)
            if (!empty($request->input('meal_time')) && $request->input('meal_time') !== 'all') {
                $mealCol = \\Illuminate\\Support\\Facades\\Schema::hasColumn($tableName, 'meal_time') ? 'meal_time' : 'waktu_makan';
                $query->where($mealCol, $request->input('meal_time'));
            }

            // Filter tanggal pesanan
            if (!empty($request->input('tgl_awal'))) {
                $dateCol = \\Illuminate\\Support\\Facades\\Schema::hasColumn($tableName, 'tgl_pesanan') ? 'tgl_pesanan' : 'created_at';
                $query->whereDate($dateCol, '>=', $request->input('tgl_awal'));
            }
            if (!empty($request->input('tgl_akhir'))) {
                $dateCol = \\Illuminate\\Support\\Facades\\Schema::hasColumn($tableName, 'tgl_pesanan') ? 'tgl_pesanan' : 'created_at';
                $query->whereDate($dateCol, '<=', $request->input('tgl_akhir'));
            }

            // Urutkan dari pesanan terbaru
            $sortCol = \\Illuminate\\Support\\Facades\\Schema::hasColumn($tableName, 'created_at') ? 'created_at' : (
                \\Illuminate\\Support\\Facades\\Schema::hasColumn($tableName, 'tgl_pesanan') ? 'tgl_pesanan' : 'id'
            );
            $rawOrders = $query->orderBy($sortCol, 'desc')->limit($request->input('limit', 150))->get();

            // Format data agar langsung sesuai dengan struktur HospitalOrder di frontend
            $formattedOrders = [];
            foreach ($rawOrders as $o) {
                // Parsing rincian item pesanan dari items_json / hasil_json
                $items = [];
                $rawItems = $o->items_json ?? ($o->hasil_json ?? null);
                if (!empty($rawItems)) {
                    if (is_array($rawItems)) {
                        $items = $rawItems;
                    } elseif (is_string($rawItems)) {
                        $decoded = json_decode($rawItems, true);
                        if (is_array($decoded)) {
                            // Cek jika nested di dalam key 'items'
                            $items = isset($decoded['items']) && is_array($decoded['items']) ? $decoded['items'] : $decoded;
                        }
                    }
                }

                // Normalisasi struktur items
                $normalizedItems = [];
                if (is_array($items)) {
                    foreach ($items as $it) {
                        $normalizedItems[] = [
                            'menuItemId' => (string)($it['menuItemId'] ?? $it['id_menu'] ?? $it['id'] ?? 'item'),
                            'name'       => (string)($it['name'] ?? $it['nama_menu'] ?? 'Menu Makanan'),
                            'portion'    => (int)($it['portion'] ?? $it['porsi'] ?? $it['jumlah_porsi'] ?? 1),
                            'price'      => (int)($it['price'] ?? $it['harga'] ?? $it['harga_satuan'] ?? 0),
                            'category'   => (string)($it['category'] ?? $it['kategori'] ?? 'makanan_utama'),
                            'calories'   => (int)($it['calories'] ?? $it['kalori'] ?? 100),
                        ];
                    }
                }

                $orderNum = (string)($o->order_number ?? ($o->no_pesanan ?? ('GZ-' . ($o->id ?? time()))));
                $createdAt = $o->tgl_pesanan ?? ($o->created_at ?? date('Y-m-d H:i:s'));

                $formattedOrders[] = [
                    'id'             => (string)($o->id ?? $orderNum),
                    'orderNumber'    => $orderNum,
                    'no_pesanan'     => $orderNum,
                    'registrationNo' => (string)($o->noregistrasi ?? ''),
                    'noregistrasi'   => (string)($o->noregistrasi ?? ''),
                    'createdAt'      => $createdAt,
                    'tgl_pesanan'    => $createdAt,
                    'roomName'       => (string)($o->room_name ?? ($o->nomor_kamar ?? ($o->kamar ?? 'Kamar Pasien'))),
                    'kamar'          => (string)($o->room_name ?? ($o->nomor_kamar ?? ($o->kamar ?? 'Kamar Pasien'))),
                    'patientName'    => (string)($o->patient_name ?? ($o->nama_pasien ?? 'Pasien')),
                    'nama_pasien'    => (string)($o->patient_name ?? ($o->nama_pasien ?? 'Pasien')),
                    'phoneNumber'    => (string)($o->phone_number ?? ($o->telepon ?? '')),
                    'mealTime'       => (string)($o->meal_time ?? ($o->waktu_makan ?? 'siang')),
                    'waktu_makan'    => (string)($o->meal_time ?? ($o->waktu_makan ?? 'siang')),
                    'items'          => $normalizedItems,
                    'items_json'     => json_encode($normalizedItems),
                    'totalPrice'     => (int)($o->total_price ?? ($o->total_biaya ?? 0)),
                    'total_price'    => (int)($o->total_price ?? ($o->total_biaya ?? 0)),
                    'totalCalories'  => (int)($o->total_calories ?? ($o->total_kalori ?? 0)),
                    'total_calories' => (int)($o->total_calories ?? ($o->total_kalori ?? 0)),
                    'patientNotes'   => (string)($o->patient_notes ?? ($o->catatan ?? '')),
                    'catatan'        => (string)($o->patient_notes ?? ($o->catatan ?? '')),
                    'status'         => (string)($o->order_status ?? ($o->status ?? 'baru')),
                    'order_status'   => (string)($o->order_status ?? ($o->status ?? 'baru')),
                ];
            }

            return response()->json([
                'status'      => 'success',
                'message'     => 'Berhasil mengambil riwayat pesanan gizi dari SIMRS.',
                'totalOrders' => count($formattedOrders),
                'data'        => $formattedOrders
            ], 200);

        } catch (\\Exception $e) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Gagal mengambil riwayat pesanan gizi: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * GET /api/pesanan-gizi/{noregistrasi}
     * Mengambil riwayat pesanan khusus untuk 1 Nomor Registrasi Pasien Rawat Inap
     */
    public function getPesananByRegistrasi($noregistrasi, Request $request)
    {
        $authError = $this->checkAuthToken($request);
        if ($authError) return $authError;

        $request->merge(['noregistrasi' => $noregistrasi]);
        return $this->getRiwayatPesananGizi($request);
    }

    /**
     * GET /api/detail-pesanan-gizi/{order_number}
     * Mengambil data detail 1 pesanan berdasarkan Nomor Pesanan
     */
    public function getDetailPesananGizi($order_number, Request $request)
    {
        $authError = $this->checkAuthToken($request);
        if ($authError) return $authError;

        try {
            $tableName = 'rego_pesanan_gizi_t';
            if (!\\Illuminate\\Support\\Facades\\Schema::hasTable($tableName)) {
                $tableName = \\Illuminate\\Support\\Facades\\Schema::hasTable('go_pesanan_gizi_t') ? 'go_pesanan_gizi_t' : 'pesanan_gizi_t';
            }

            $orderCol = \\Illuminate\\Support\\Facades\\Schema::hasColumn($tableName, 'order_number') ? 'order_number' : 'no_pesanan';
            $order = DB::table($tableName)->where($orderCol, $order_number)->first();

            if (!$order) {
                return response()->json([
                    'status'  => 'error',
                    'message' => "Pesanan dengan nomor '{$order_number}' tidak ditemukan di SIMRS."
                ], 404);
            }

            return response()->json([
                'status'  => 'success',
                'data'    => $order
            ], 200);

        } catch (\\Exception $e) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Gagal mengambil detail pesanan: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * POST /api/update-status-pesanan-gizi
     * Mengubah status pesanan makanan (baru -> diproses -> diantar -> selesai / dibatalkan)
     * Request body: { "order_number": "GZ-...", "status": "diproses", "catatan": "..." }
     */
    public function updateStatusPesananGizi(Request $request)
    {
        $authError = $this->checkAuthToken($request);
        if ($authError) return $authError;

        $orderNumber = $request->input('order_number') ?? ($request->input('no_pesanan') ?? $request->input('orderNumber'));
        $newStatus   = $request->input('status') ?? $request->input('order_status');

        if (!$orderNumber || !$newStatus) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Parameter order_number dan status wajib dikirim.'
            ], 400);
        }

        try {
            $tableName = 'rego_pesanan_gizi_t';
            if (!\\Illuminate\\Support\\Facades\\Schema::hasTable($tableName)) {
                $tableName = \\Illuminate\\Support\\Facades\\Schema::hasTable('go_pesanan_gizi_t') ? 'go_pesanan_gizi_t' : 'pesanan_gizi_t';
            }

            $orderCol = \\Illuminate\\Support\\Facades\\Schema::hasColumn($tableName, 'order_number') ? 'order_number' : 'no_pesanan';
            $statusCol = \\Illuminate\\Support\\Facades\\Schema::hasColumn($tableName, 'order_status') ? 'order_status' : 'status';

            $updated = DB::table($tableName)->where($orderCol, $orderNumber)->update([
                $statusCol   => $newStatus,
                'updated_at' => date('Y-m-d H:i:s')
            ]);

            return response()->json([
                'status'       => 'success',
                'message'      => "Status pesanan {$orderNumber} berhasil diperbarui menjadi '{$newStatus}'.",
                'order_number' => $orderNumber,
                'new_status'   => $newStatus
            ], 200);

        } catch (\\Exception $e) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Gagal memperbarui status pesanan: ' . $e->getMessage()
            ], 500);
        }
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

// ====================================================================
// 4. CONTOH RESPON GET: RIWAYAT PESANAN GIZI (DITARIK APLIKASI)
// METHOD: GET /api/riwayat-pesanan-gizi
// ====================================================================

{
  "status": "success",
  "message": "Berhasil mengambil riwayat pesanan gizi dari SIMRS.",
  "totalOrders": 1,
  "data": [
    {
      "id": "GZ-20260908-01",
      "orderNumber": "GZ-20260908-01",
      "registrationNo": "REG-20260908-001",
      "createdAt": "2026-09-08 11:30:00",
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
        }
      ]
    }
  ]
}
`;

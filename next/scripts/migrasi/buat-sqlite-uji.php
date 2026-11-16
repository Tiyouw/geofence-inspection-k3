<?php
/**
 * Pembangkit data uji migrasi: dijalankan di DALAM salinan aplikasi Laravel
 * (lihat buat-sqlite-uji.sh), SETELAH `php artisan migrate --seed`.
 *
 * Meniru docs/v2/samples: 30 inspeksi final Oktober 2026 oleh dua inspektur
 * fiktif, 5 APAR belum diperiksa, temuan dibangun IssueGenerator asli, jadwal
 * lewat Schedule::pastikanAda()->tandaiSelesai(), foto JPEG kecil per inspeksi.
 * Ditambah kasus tepi untuk transformasi SPEC §2.4: satu draf, status lama
 * "terkirim", gate "lolos", peran "supervisor", satu temuan selesai, satu foto
 * yang berkasnya hilang, dan inspeksi yang sudah ditinjau. Bukan data asli.
 */

use App\Models\Asset;
use App\Models\ChecklistItem;
use App\Models\Inspection;
use App\Models\InspectionAnswer;
use App\Models\InspectionPhoto;
use App\Models\Issue;
use App\Models\Schedule;
use App\Models\User;
use App\Services\IssueGenerator;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

require __DIR__.'/vendor/autoload.php';
$app = require __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

Carbon::setTestNow(Carbon::create(2026, 11, 2, 9, 0, 0, 'Asia/Jakarta'));

// JPEG 1x1 (berkas foto contoh, bukan foto asli).
$jpeg = base64_decode('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=');

$aset = Asset::whereHas('assetType', fn ($q) => $q->where('slug', 'apar'))
    ->orderBy('gedung')->orderBy('lantai')->orderBy('kode')->get();
$butir = ChecklistItem::whereHas('group', fn ($q) => $q->whereHas('assetType', fn ($q) => $q->where('slug', 'apar')))
    ->where('aktif', true)->orderBy('urut')->get();
$petugas = [User::where('nip', '2002')->first(), User::where('nip', '2001')->first()];

$belum = ['34D', '06D', '13D', '20D', '27D'];
$tidakLayak = ['31D', '16D', '26C'];
$catatan = ['01D', '11D', '21D'];
$tinjau = ['31D', '05D', '15D', '28C'];
$gen = new IssueGenerator;

foreach ($aset as $idx => $a) {
    if (in_array($a->kode, $belum, true)) {
        continue;
    }
    $waktu = Carbon::create(2026, 10, ($idx % 27) + 1, 9, 0, 0, 'Asia/Jakarta')->addMinutes($idx);
    $ins = Inspection::create([
        'asset_id' => $a->id,
        'user_id' => $petugas[$idx % 2]->id,
        'status' => 'final',
        'mulai_pada' => $waktu->copy()->subMinutes(4),
        'inspected_at' => $waktu,
        'durasi_detik' => $idx === 3 ? 30 : 240,
        'device_time' => $waktu->copy()->subSeconds(5),
        'ua' => 'Mozilla/5.0 (uji migrasi)',
        'gps_lat' => $a->lat,
        'gps_lng' => $a->lng,
        'gps_accuracy' => 12,
        'jarak_m' => in_array($a->kode, $tinjau, true) ? 140 : 6,
        'qr_verified' => true,
        'gate_status' => in_array($a->kode, $tinjau, true) ? 'perlu_review' : 'sesuai',
    ]);
    foreach ($butir as $b) {
        $nilai = match (true) {
            $b->urut === 1 => in_array($a->kode, $tidakLayak, true) ? 'Tidak penuh' : 'Penuh',
            $b->urut === 2 => 'Zona hijau',
            $b->urut === 4 => 'Mulus',
            $b->urut === 6 && in_array($a->kode, $catatan, true) => 'tidak',
            default => 'ok',
        };
        InspectionAnswer::create(['inspection_id' => $ins->id, 'checklist_item_id' => $b->id, 'nilai' => $nilai]);
    }
    $ins->load('answers.item');
    $ins->update(['kesimpulan' => $gen->usulKesimpulan($ins), 'rekomendasi' => $gen->usulKesimpulan($ins) === 'layak' ? null : 'Tindak lanjuti temuan.']);
    $gen->bangun($ins);
    Schedule::pastikanAda($a->fresh('assetType'), $waktu)->tandaiSelesai($ins);
    $a->update(['terakhir_dicek' => $waktu->toDateString()]);

    $path = 'inspeksi/'.$ins->id.'/'.Str::uuid().'.jpg';
    $penuh = storage_path('app/public/'.$path);
    @mkdir(dirname($penuh), 0775, true);
    file_put_contents($penuh, $jpeg);
    InspectionPhoto::create(['inspection_id' => $ins->id, 'path' => $path, 'taken_at' => $waktu, 'lat' => $a->lat, 'lng' => $a->lng, 'bytes' => strlen($jpeg)]);
}

// Kasus tepi SPEC §2.4.
$admin = User::where('nip', '1001')->first();
$pertama = Inspection::where('status', 'final')->orderBy('id')->first();
$pertama->update(['ditinjau_pada' => now(), 'ditinjau_oleh' => $admin->id, 'catatan_review' => 'Posisi diverifikasi lewat foto dan kesaksian.']);
DB::table('inspections')->where('id', $pertama->id + 1)->update(['status' => 'terkirim']);
DB::table('inspections')->where('id', $pertama->id + 2)->update(['gate_status' => 'lolos']);
DB::table('users')->where('nip', '3002')->update(['role' => 'supervisor']);
Issue::where('severity', 'ringan')->orderBy('id')->first()?->update(['status' => 'selesai', 'selesai_pada' => now(), 'tindak_lanjut' => 'Label sudah dipasang ulang.']);

$draf = Inspection::create([
    'asset_id' => Asset::where('kode', '34D')->first()->id,
    'user_id' => $petugas[0]->id,
    'status' => 'draf',
    'mulai_pada' => now()->subHour(),
    'qr_verified' => true,
    'gate_status' => 'tanpa_gps',
]);
InspectionAnswer::create(['inspection_id' => $draf->id, 'checklist_item_id' => $butir[0]->id, 'nilai' => 'Penuh']);
// Foto yang barisnya ada tetapi berkasnya hilang (harus dilaporkan, bukan menggagalkan migrasi).
InspectionPhoto::create(['inspection_id' => $draf->id, 'path' => 'inspeksi/'.$draf->id.'/hilang.jpg', 'taken_at' => now(), 'bytes' => 1234]);

// Sandi contoh yang diketahui untuk uji "masuk dengan sandi lama" (O5): hanya di basis data uji ini.
User::where('nip', '2001')->update(['password' => Hash::make('sandi-lama-uji')]);

printf("Inspeksi final: %d, draf: %d, temuan: %d, jadwal: %d, foto: %d\n",
    Inspection::where('status', '!=', 'draf')->count(), Inspection::where('status', 'draf')->count(),
    Issue::count(), Schedule::count(), InspectionPhoto::count());

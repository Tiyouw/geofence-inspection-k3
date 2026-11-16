/** Tombol aksi antrean yang dipakai dasbor dan halaman temuan/tinjauan (Server Component). */
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { hariIniJakarta } from "@/lib/format";
import { tandaiDitinjau } from "../actions/inspeksi";
import { tetapkanTenggat, ubahStatusTemuan } from "../actions/temuan";
import { DialogAksi } from "./dialog-aksi";

export function AksiTenggat({ id, targetSelesai }: { id: number; targetSelesai: string | null }) {
  return (
    <DialogAksi judul="Tetapkan tenggat temuan" pemicu="Tetapkan tenggat" aksi={tetapkanTenggat} tersembunyi={{ id }}>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Target penyelesaian
        <Input type="date" name="targetSelesai" required min={hariIniJakarta()} defaultValue={targetSelesai ?? ""} />
      </label>
    </DialogAksi>
  );
}

export function AksiSelesai({ id }: { id: number }) {
  return (
    <DialogAksi
      judul="Selesaikan tindak lanjut"
      deskripsi="Uraikan tindakan yang sudah dilakukan. Uraian disimpan sebagai tindak lanjut temuan."
      pemicu="Tandai selesai"
      aksi={ubahStatusTemuan}
      tersembunyi={{ id, ke: "selesai" }}
      labelKirim="Tandai selesai"
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Tindakan yang sudah dilakukan
        <Textarea name="uraian" required minLength={10} maxLength={2000} rows={4} />
      </label>
    </DialogAksi>
  );
}

export function AksiTinjau({ id }: { id: string }) {
  return (
    <DialogAksi
      judul="Tinjau bukti posisi"
      deskripsi="Catat hasil verifikasi kehadiran. Data GPS dan hasil pemeriksaan asli tetap tersimpan."
      pemicu="Tinjau posisi"
      aksi={tandaiDitinjau}
      tersembunyi={{ id }}
      labelKirim="Tandai ditinjau"
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Alasan atau hasil verifikasi
        <Textarea name="catatanReview" required minLength={10} maxLength={2000} rows={4} />
      </label>
    </DialogAksi>
  );
}

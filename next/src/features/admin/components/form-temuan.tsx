"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SEVERITIES } from "@/lib/domain/constants";
import { LABEL_SEVERITY } from "../lib/temuan";
import type { HasilAksi } from "../server/aksi";
import { Bidang, Pilihan } from "./ui";
import { useFormAksi } from "./use-form-aksi";

/** Temuan manual dengan pilihan terkontrol (H9): aset berdasarkan kode, tingkat, PIC. */
export function FormTemuan({
  aksi,
  aset,
  pic,
  hariIni,
}: {
  aksi: (prev: unknown, fd: FormData) => Promise<HasilAksi<{ id: number }>>;
  aset: { id: number; kode: string; lokasi: string }[];
  pic: { id: number; name: string; nip: string }[];
  hariIni: string;
}) {
  const router = useRouter();
  const { state, onSubmit, menunggu } = useFormAksi(aksi, {
    setelahBerhasil: (r) => {
      if (r.ok && r.data) router.push(`/admin/temuan/${r.data.id}`);
    },
  });
  const g = (k: string) => (state && !state.ok ? state.galat?.[k] : undefined);

  return (
    <form onSubmit={onSubmit} className="grid max-w-2xl gap-4 rounded-xl border bg-card p-5" noValidate>
      {state && !state.ok && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.pesan}
        </p>
      )}
      <Bidang label="Aset" htmlFor="assetId" galat={g("assetId")}>
        <Pilihan id="assetId" name="assetId" defaultValue="" required>
          <option value="" disabled>
            Pilih nomor aset…
          </option>
          {aset.map((a) => (
            <option key={a.id} value={a.id}>
              {a.kode} · {a.lokasi}
            </option>
          ))}
        </Pilihan>
      </Bidang>
      <Bidang label="Uraian temuan" htmlFor="item" galat={g("item")} bantuan='Mis. "Tekanan manometer: Kurang".'>
        <Input id="item" name="item" required maxLength={500} />
      </Bidang>
      <Bidang label="Tingkat" htmlFor="severity" galat={g("severity")}>
        <Pilihan id="severity" name="severity" defaultValue="sedang">
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {LABEL_SEVERITY[s]}
            </option>
          ))}
        </Pilihan>
      </Bidang>
      <Bidang label="Tindakan yang diminta" htmlFor="tindakLanjut" galat={g("tindakLanjut")} bantuan="Kosong = tindakan baku sesuai tingkat.">
        <Textarea id="tindakLanjut" name="tindakLanjut" rows={3} maxLength={2000} />
      </Bidang>
      <div className="grid gap-4 sm:grid-cols-2">
        <Bidang label="Tenggat" htmlFor="targetSelesai" galat={g("targetSelesai")}>
          <Input id="targetSelesai" name="targetSelesai" type="date" min={hariIni} />
        </Bidang>
        <Bidang label="Penanggung jawab" htmlFor="picUserId" galat={g("picUserId")}>
          <Pilihan id="picUserId" name="picUserId" defaultValue="">
            <option value="">Tanpa penanggung jawab</option>
            {pic.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.nip})
              </option>
            ))}
          </Pilihan>
        </Bidang>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push("/admin/temuan")}>
          Batal
        </Button>
        <Button type="submit" variant="brand" disabled={menunggu}>
          {menunggu ? "Menyimpan…" : "Simpan temuan"}
        </Button>
      </div>
    </form>
  );
}

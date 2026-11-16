import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TombolAktif } from "@/features/admin/components/aksi-pengguna";
import { Kosong, Lencana, Pilihan, Tabel } from "@/features/admin/components/ui";
import { daftarPengguna, parseFilterPengguna } from "@/features/admin/server/pengguna";
import { requireRole } from "@/lib/auth/guards";
import { ROLES, ROLE_LABEL } from "@/lib/domain/constants";
import { formatWaktu } from "@/lib/format";

export const metadata: Metadata = { title: "Pengguna" };

/** Petugas dan akun panel (SPEC §4.5). Hanya admin; tidak ada hapus. */
export default async function DaftarPengguna({ searchParams }: PageProps<"/admin/pengguna">) {
  const saya = await requireRole("admin");
  const f = parseFilterPengguna(await searchParams);
  const rows = await daftarPengguna(f);

  return (
    <>
      <PageHeader
        title="Pengguna"
        description="Akun masuk dengan NIP. Petugas tidak dihapus, hanya dinonaktifkan, agar riwayat inspeksi tetap terikat."
        actions={
          <Button asChild variant="brand">
            <Link href="/admin/pengguna/baru">
              <Plus aria-hidden /> Tambah petugas
            </Link>
          </Button>
        }
      />
      <form method="get" className="mb-4 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-4" aria-label="Saring pengguna">
        <label className="flex flex-col gap-1 text-xs font-medium sm:col-span-2">
          Cari
          <Input name="q" defaultValue={f.q} placeholder="NIP atau nama" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Peran
          <Pilihan name="peran" defaultValue={f.role ?? ""}>
            <option value="">Semua</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </Pilihan>
        </label>
        <div className="flex items-end gap-2">
          <Pilihan name="aktif" defaultValue={f.aktif ?? ""} aria-label="Status akun">
            <option value="">Aktif dan nonaktif</option>
            <option value="ya">Aktif</option>
            <option value="tidak">Nonaktif</option>
          </Pilihan>
          <Button type="submit">Terapkan</Button>
        </div>
      </form>
      {rows.length === 0 ? (
        <Kosong>Tidak ada akun yang cocok.</Kosong>
      ) : (
        <Tabel>
          <thead>
            <tr>
              <th>NIP</th>
              <th>Nama</th>
              <th>Peran</th>
              <th>Divisi</th>
              <th>Jabatan</th>
              <th>Terakhir masuk</th>
              <th>Status</th>
              <th>
                <span className="sr-only">Aksi</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td className="font-mono text-xs">{u.nip}</td>
                <td>
                  <Link href={`/admin/pengguna/${u.id}`} className="font-medium hover:underline">
                    {u.name}
                  </Link>
                  {u.isDemo && <Lencana className="ml-2">Demo</Lencana>}
                </td>
                <td>{ROLE_LABEL[u.role]}</td>
                <td>{u.divisi ?? "-"}</td>
                <td>{u.jabatan ?? "-"}</td>
                <td className="whitespace-nowrap">{u.lastLoginAt ? formatWaktu(u.lastLoginAt) : "Belum pernah"}</td>
                <td>{u.aktif ? <Lencana nada="success">Aktif</Lencana> : <Lencana nada="danger">Nonaktif</Lencana>}</td>
                <td className="text-right">{u.id !== saya.id && <TombolAktif id={u.id} aktif={u.aktif} nama={u.name} />}</td>
              </tr>
            ))}
          </tbody>
        </Tabel>
      )}
    </>
  );
}

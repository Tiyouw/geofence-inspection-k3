import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/app-shell";
import { ubahPengguna } from "@/features/admin/actions/pengguna";
import { TerbitkanSandi } from "@/features/admin/components/aksi-pengguna";
import { FormPengguna } from "@/features/admin/components/form-pengguna";
import { ambilPengguna, pilihanDivisi } from "@/features/admin/server/pengguna";
import { requireRole } from "@/lib/auth/guards";
import { ROLE_LABEL } from "@/lib/domain/constants";
import { formatWaktu } from "@/lib/format";

export const metadata: Metadata = { title: "Ubah pengguna" };

export default async function UbahPengguna({ params }: PageProps<"/admin/pengguna/[id]">) {
  const saya = await requireRole("admin");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const [u, divisi] = await Promise.all([ambilPengguna(id), pilihanDivisi()]);
  if (!u) notFound();
  return (
    <>
      <PageHeader
        title={u.name}
        description={`${ROLE_LABEL[u.role]} · ${u.nip} · terakhir masuk ${u.lastLoginAt ? formatWaktu(u.lastLoginAt) : "belum pernah"}`}
        actions={<TerbitkanSandi id={u.id} nama={u.name} />}
      />
      <FormPengguna aksi={ubahPengguna.bind(null, u.id)} nilai={u} divisi={divisi} baru={false} diriSendiri={u.id === saya.id} />
    </>
  );
}

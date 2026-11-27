import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/app-shell";
import { buatPengguna } from "@/features/admin/actions/pengguna";
import { FormPengguna } from "@/features/admin/components/form-pengguna";
import { pilihanDivisi } from "@/features/admin/server/pengguna";
import { requireRole } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Tambah petugas" };

export default async function PenggunaBaru() {
    await requireRole("admin");
    const divisi = await pilihanDivisi();
    return (
        <>
            <PageHeader
                title="Tambah petugas"
                description="Akun baru langsung bisa masuk di /masuk dengan NIP dan sandi ini."
            />
            <FormPengguna aksi={buatPengguna} divisi={divisi} baru />
        </>
    );
}

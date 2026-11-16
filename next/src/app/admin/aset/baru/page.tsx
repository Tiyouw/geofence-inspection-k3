import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/app-shell";
import { buatAset } from "@/features/admin/actions/aset";
import { FormAset } from "@/features/admin/components/form-aset";
import { pilihanAset } from "@/features/admin/server/aset";
import { requireRole } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Tambah aset" };

export default async function AsetBaru() {
    await requireRole("admin");
    const p = await pilihanAset();
    return (
        <>
            <PageHeader
                title="Tambah aset"
                description="Token stiker QR dibuat otomatis dan acak; cetak stiker setelah aset tersimpan."
            />
            <FormAset aksi={buatAset} tipe={p.tipe} divisi={p.divisi} gedung={p.gedung} labelKirim="Simpan aset" />
        </>
    );
}

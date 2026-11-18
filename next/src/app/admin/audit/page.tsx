import type { Metadata } from "next";
import { History } from "lucide-react";
import { PageHeader } from "@/components/shell/app-shell";
import { JejakAudit as DaftarJejak } from "@/features/admin/components/jejak-audit";
import { SaringAudit } from "@/features/admin/components/saring-audit";
import { Kosong, Paginasi, halamanDari, qs } from "@/features/admin/components/ui";
import { KATEGORI_AUDIT, saringanDari, type KategoriAudit } from "@/features/admin/lib/audit";
import { PER_HALAMAN_AUDIT, daftarAudit, penggunaDiJejak, rujukanUntuk } from "@/features/admin/server/audit";
import { requireRole } from "@/lib/auth/guards";
import { formatAngka } from "@/lib/format";

export const metadata: Metadata = { title: "Riwayat perubahan" };

const PILIHAN_KATEGORI = (Object.keys(KATEGORI_AUDIT) as KategoriAudit[]).map((k) => ({
    nilai: k,
    label: KATEGORI_AUDIT[k].label,
}));

/** Jejak aksi penting (audit_logs) dalam kalimat sehari-hari, dikelompokkan per hari. */
export default async function JejakAudit({ searchParams }: PageProps<"/admin/audit">) {
    await requireRole("admin");
    const sp = await searchParams;
    const f = saringanDari(sp);
    const halaman = halamanDari(sp.hal);
    const [{ rows, total }, pengguna] = await Promise.all([daftarAudit(f, halaman), penggunaDiJejak()]);
    const rujukan = await rujukanUntuk(rows);
    const nilai = {
        kategori: f.kategori,
        pengguna: f.pengguna ? String(f.pengguna) : undefined,
        dari: f.dari,
        sampai: f.sampai,
    };
    const disaring = Object.values(nilai).some(Boolean);

    return (
        <>
            <PageHeader
                title="Riwayat perubahan"
                description="Siapa melakukan apa dan kapan, dalam kalimat biasa. Kata sandi, token QR, dan koordinat tidak pernah ditampilkan."
            />
            <SaringAudit
                key={JSON.stringify(nilai)}
                jumlah={`${formatAngka(total)} kegiatan${disaring ? " cocok" : ""}`}
                nilai={nilai}
                kategori={PILIHAN_KATEGORI}
                pengguna={pengguna}
            />
            {rows.length === 0 ? (
                <Kosong ilustrasi={<History className="size-10 text-muted-foreground" aria-hidden />}>
                    {disaring
                        ? "Tidak ada kegiatan yang cocok dengan saringan ini."
                        : "Belum ada kegiatan yang tercatat."}
                </Kosong>
            ) : (
                <DaftarJejak rows={rows} rujukan={rujukan} sekarang={new Date()} />
            )}
            <div className="mt-4">
                <Paginasi
                    halaman={halaman}
                    total={total}
                    per={PER_HALAMAN_AUDIT}
                    hrefUntuk={(h) => `/admin/audit${qs({ ...nilai, hal: h > 1 ? h : undefined })}`}
                />
            </div>
        </>
    );
}

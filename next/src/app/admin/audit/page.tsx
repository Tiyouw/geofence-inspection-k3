import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Kosong, Paginasi, Pilihan, Tabel, halamanDari, qs } from "@/features/admin/components/ui";
import { PER_HALAMAN_AUDIT, daftarAudit, kelompokAksi } from "@/features/admin/server/audit";
import { requireRole } from "@/lib/auth/guards";
import { formatWaktu } from "@/lib/format";

export const metadata: Metadata = { title: "Jejak audit" };

/** Jejak aksi penting (audit_logs): masuk, perubahan data induk, tinjauan, ganti token, sandi. */
export default async function JejakAudit({ searchParams }: PageProps<"/admin/audit">) {
    await requireRole("admin");
    const sp = await searchParams;
    const kelompok = typeof sp.kelompok === "string" && sp.kelompok ? sp.kelompok : undefined;
    const halaman = halamanDari(sp.hal);
    const [{ rows, total }, daftarKelompok] = await Promise.all([daftarAudit({ kelompok }, halaman), kelompokAksi()]);

    return (
        <>
            <PageHeader
                title="Jejak audit"
                description="Siapa melakukan apa dan kapan. Sandi dan token tidak pernah dicatat."
            />
            <form
                method="get"
                className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4"
                aria-label="Saring jejak"
            >
                <label className="flex flex-col gap-1 text-xs font-medium">
                    Jenis aksi
                    <Pilihan name="kelompok" defaultValue={kelompok ?? ""}>
                        <option value="">Semua</option>
                        {daftarKelompok.map((k) => (
                            <option key={k}>{k}</option>
                        ))}
                    </Pilihan>
                </label>
                <Button type="submit">Terapkan</Button>
            </form>
            {rows.length === 0 ? (
                <Kosong>Belum ada jejak.</Kosong>
            ) : (
                <Tabel>
                    <thead>
                        <tr>
                            <th>Waktu</th>
                            <th>Pengguna</th>
                            <th>Aksi</th>
                            <th>Objek</th>
                            <th>Rincian</th>
                            <th>IP</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.id}>
                                <td className="whitespace-nowrap">{formatWaktu(r.createdAt)}</td>
                                <td>{r.oleh ? `${r.oleh} (${r.olehNip})` : "-"}</td>
                                <td className="font-mono text-xs">{r.aksi}</td>
                                <td className="whitespace-nowrap text-xs">
                                    {r.entitas ? `${r.entitas} ${r.entitasId ?? ""}` : "-"}
                                </td>
                                <td
                                    className="max-w-md truncate font-mono text-xs"
                                    title={r.data ? JSON.stringify(r.data) : undefined}
                                >
                                    {r.data ? JSON.stringify(r.data) : "-"}
                                </td>
                                <td className="text-xs">{r.ip ?? "-"}</td>
                            </tr>
                        ))}
                    </tbody>
                </Tabel>
            )}
            <Paginasi
                halaman={halaman}
                total={total}
                per={PER_HALAMAN_AUDIT}
                hrefUntuk={(h) => `/admin/audit${qs({ kelompok, hal: h > 1 ? h : undefined })}`}
            />
        </>
    );
}

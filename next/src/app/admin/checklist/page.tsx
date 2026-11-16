import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/app-shell";
import { Kartu, Kosong, Lencana } from "@/features/admin/components/ui";
import { LABEL_SEVERITY } from "@/features/admin/lib/temuan";
import { checklistPerTipe } from "@/features/admin/server/checklist";
import { requireRole } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Checklist" };

const JENIS: Record<string, string> = {
    fungsi: "Berfungsi / Tidak",
    kondisi: "Baik / Tidak baik",
    boolean: "Ada / Tidak ada",
    select: "Pilihan",
    number: "Angka",
    date: "Tanggal",
    text: "Teks",
};

/** Butir checklist per tipe objek (baca saja; editor terkontrol menyusul, SPEC §9 celah #15). */
export default async function Checklist() {
    await requireRole("admin");
    const rows = await checklistPerTipe();
    const perTipe = Map.groupBy(rows, (r) => r.tipe);
    return (
        <>
            <PageHeader
                title="Checklist"
                description="Butir pemeriksaan per tipe objek, berikut dasar hukum dan tingkat temuan."
            />
            {perTipe.size === 0 && <Kosong>Belum ada checklist.</Kosong>}
            <div className="flex flex-col gap-4">
                {[...perTipe.entries()].map(([tipe, butir]) => (
                    <Kartu key={tipe} judul={`${tipe} · ${butir.length} butir`}>
                        <ol className="divide-y text-sm">
                            {butir.map((b) => (
                                <li key={b.id} className="grid gap-1 py-2 sm:grid-cols-[2.5rem_1fr_16rem]">
                                    <span className="text-muted-foreground tabular-nums">{b.urut}.</span>
                                    <span>
                                        {b.label}
                                        <span className="block text-xs text-muted-foreground">
                                            {b.grupKode ? `${b.grupKode}. ` : ""}
                                            {b.grup}
                                            {b.dasarHukum && ` · ${b.dasarHukum}`}
                                        </span>
                                        {b.options && (
                                            <span className="block text-xs">
                                                Pilihan:{" "}
                                                {b.options
                                                    .map((o) =>
                                                        b.severityMap?.[o]
                                                            ? `${o} (${LABEL_SEVERITY[b.severityMap[o]]})`
                                                            : o,
                                                    )
                                                    .join(", ")}
                                            </span>
                                        )}
                                    </span>
                                    <span className="flex flex-wrap items-start gap-1">
                                        <Lencana>{JENIS[b.answerType]}</Lencana>
                                        <Lencana
                                            nada={
                                                b.severityDefault === "berat"
                                                    ? "danger"
                                                    : b.severityDefault === "sedang"
                                                      ? "warning"
                                                      : "muted"
                                            }
                                        >
                                            {LABEL_SEVERITY[b.severityDefault]}
                                        </Lencana>
                                        {!b.aktif && <Lencana nada="danger">Nonaktif</Lencana>}
                                    </span>
                                </li>
                            ))}
                        </ol>
                    </Kartu>
                ))}
            </div>
        </>
    );
}

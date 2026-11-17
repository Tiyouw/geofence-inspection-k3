/**
 * Rekapitulasi temuan (PRD "Laporan", ADR-4): A4 potret, lokasi, temuan, tingkat, tindakan yang
 * direkomendasikan, tanggal, dan inspektur; berat → ringan, lalu terlama. Tanpa status, tenggat,
 * atau penanggung jawab: laporan ini adalah akhir alur dan diteruskan ke pihak terkait.
 *
 * Lampiran foto bukti dari inspeksi yang melahirkan setiap temuan (foto butirnya bila ada).
 */
import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import type { RekapTemuan } from "@/features/temuan/rekap";
import { kapital, tglDmy2, tglPanjang, waktuCetak, waktuDmyHm } from "../format";
import { gayaHalaman, Kop, Sel, TandaTangan, barisTabel, kepalaTabel, s, wadahTabel } from "./dasar";

const MM = 72 / 25.4;

export type FotoLampiran = { data: Buffer; format: "jpg" | "png"; diunggah: Date };

const KOLOM = [
    ["No", "4%", true],
    ["Kode unit", "11%", false],
    ["Lokasi", "17%", false],
    ["Temuan", "24%", false],
    ["Tingkat", "8%", true],
    ["Tindakan yang direkomendasikan", "17%", false],
    ["Tanggal", "9%", true],
    ["Inspektur", "10%", false],
] as const;

export type IsiRekap = {
    /** Mis. "APAR" atau "Semua modul". */
    judulModul: string;
    /** Mis. "1 s.d. 30 November 2026 · Gedung PIP · tingkat berat". */
    lingkup: string;
    rekap: RekapTemuan;
    tandaTangan: [string, string][];
};

export function DokumenRekap({
    isi,
    dicetak,
    foto,
}: {
    isi: IsiRekap;
    dicetak: Date;
    foto: Map<number, FotoLampiran[]> | null;
}) {
    const { rekap } = isi;
    const r = rekap.ringkas;
    const pad: [number, number] = [3.5, 4];
    const adaFoto = foto && rekap.baris.some((b) => (foto.get(b.temuan.id)?.length ?? 0) > 0);

    return (
        <Document title={`Rekapitulasi Temuan — ${isi.judulModul}`} author="Sistem Inspeksi K3" language="id">
            <Page
                size="A4"
                style={{
                    ...gayaHalaman,
                    fontSize: 8.5,
                    paddingTop: 14 * MM,
                    paddingBottom: 16 * MM,
                    paddingHorizontal: 12 * MM,
                }}
            >
                <Kop
                    ukuranNama={11.5}
                    kanan={[
                        <Text key="j" style={s.tebal}>
                            REKAPITULASI TEMUAN
                        </Text>,
                        "Lampiran pendukung laporan PMS",
                        `Dicetak ${waktuCetak(dicetak)} WIB`,
                    ]}
                />
                <Text style={{ fontSize: 10.5, fontWeight: "bold", textAlign: "center", marginBottom: 3 }}>
                    {`REKAPITULASI TEMUAN ${isi.judulModul.toUpperCase()}`}
                </Text>
                <Text style={{ textAlign: "center", marginBottom: 10 }}>
                    {`Keadaan per ${tglPanjang(dicetak)} · ${isi.lingkup}`}
                </Text>

                <View style={{ ...wadahTabel, marginBottom: 10, fontSize: 8 }}>
                    {[
                        ["Jumlah temuan", `${r.jumlah} butir`, "Tingkat berat", `${r.berat} butir`],
                        [
                            "Sedang · ringan",
                            `${r.sedang} · ${r.ringan} butir`,
                            "Unit terdampak",
                            r.totalUnit != null ? `${r.unitTerdampak} dari ${r.totalUnit} unit` : `${r.unitTerdampak} unit`,
                        ],
                    ].map((row) => (
                        <View key={row[0]} style={{ flexDirection: "row" }}>
                            <Sel lebar="28%" kepala padding={[3.5, 5]}>
                                <Text style={s.tebal}>{row[0]}</Text>
                            </Sel>
                            <Sel lebar="22%" padding={[3.5, 5]}>
                                <Text>{row[1]}</Text>
                            </Sel>
                            <Sel lebar="28%" kepala padding={[3.5, 5]}>
                                <Text style={s.tebal}>{row[2]}</Text>
                            </Sel>
                            <Sel lebar="22%" padding={[3.5, 5]}>
                                <Text>{row[3]}</Text>
                            </Sel>
                        </View>
                    ))}
                </View>

                <View>
                    <View fixed style={kepalaTabel}>
                        {KOLOM.map(([judul, lebar, tengah]) => (
                            <Sel key={judul} lebar={lebar} kepala padding={pad} style={{ justifyContent: "flex-start" }}>
                                <Text style={{ fontSize: 7.5, fontWeight: "bold", textAlign: tengah ? "center" : "left" }}>
                                    {judul}
                                </Text>
                            </Sel>
                        ))}
                    </View>
                    {rekap.baris.length === 0 && (
                        <View style={barisTabel}>
                            <Sel lebar="100%" padding={[16, 4]} tengah>
                                <Text style={s.miring}>Tidak ada temuan pada lingkup ini.</Text>
                            </Sel>
                        </View>
                    )}
                    {rekap.baris.map((b) => {
                        const berat = b.temuan.severity === "berat";
                        const latar = {
                            justifyContent: "flex-start" as const,
                            ...(berat ? { backgroundColor: "#f0f0f0" } : {}),
                        };
                        const t = { fontSize: 8, fontWeight: berat ? ("bold" as const) : ("normal" as const) };
                        const kecil = { fontSize: 7, color: "#333" };
                        return (
                            <View key={b.temuan.id} wrap={false} style={barisTabel}>
                                <Sel lebar="4%" padding={pad} style={latar} tengah>
                                    <Text style={t}>{b.no}</Text>
                                </Sel>
                                <Sel lebar="11%" padding={pad} style={latar}>
                                    <Text style={{ ...t, fontWeight: "bold" }}>{b.temuan.asetKode}</Text>
                                    <Text style={kecil}>{b.temuan.modul}</Text>
                                </Sel>
                                <Sel lebar="17%" padding={pad} style={latar}>
                                    <Text style={t}>{b.temuan.lokasi}</Text>
                                </Sel>
                                <Sel lebar="24%" padding={pad} style={latar}>
                                    <Text style={t}>{b.temuan.item}</Text>
                                    {b.berulang && <Text style={kecil}>{b.berulang}</Text>}
                                </Sel>
                                <Sel lebar="8%" padding={pad} style={latar} tengah>
                                    <Text style={t}>{kapital(b.temuan.severity)}</Text>
                                </Sel>
                                <Sel lebar="17%" padding={pad} style={latar}>
                                    <Text style={t}>{b.tindakan}</Text>
                                </Sel>
                                <Sel lebar="9%" padding={pad} style={latar} tengah>
                                    <Text style={t}>{tglDmy2(b.temuan.waktu)}</Text>
                                </Sel>
                                <Sel lebar="10%" padding={pad} style={latar}>
                                    <Text style={t}>{b.temuan.inspektur ?? "-"}</Text>
                                </Sel>
                            </View>
                        );
                    })}
                </View>

                <TandaTangan ukuran={8} jarak={40} sisi={10} marginTop={18} kolom={isi.tandaTangan} />

                {adaFoto && (
                    <View break>
                        <Text style={{ fontSize: 10.5, fontWeight: "bold", textAlign: "center", marginBottom: 3 }}>
                            LAMPIRAN FOTO BUKTI
                        </Text>
                        <Text style={{ textAlign: "center", marginBottom: 10 }}>
                            Foto dari inspeksi yang melahirkan setiap temuan, disimpan privat di sistem. Nomor
                            mengikuti tabel di atas.
                        </Text>
                        {rekap.baris.map((b) => {
                            const daftar = foto!.get(b.temuan.id) ?? [];
                            if (!daftar.length) return null;
                            return (
                                <View
                                    key={b.temuan.id}
                                    wrap={false}
                                    style={{
                                        marginBottom: 10,
                                        borderBottomWidth: 0.6,
                                        borderBottomColor: "#bbb",
                                        paddingBottom: 8,
                                    }}
                                >
                                    <Text style={{ fontSize: 8, marginBottom: 4 }}>
                                        <Text style={s.tebal}>{`${b.no}. ${b.temuan.asetKode}`}</Text>
                                        {` · ${b.temuan.item}`}
                                    </Text>
                                    <View style={{ flexDirection: "row", gap: 8 }}>
                                        {daftar.map((f, i) => (
                                            <View key={i} style={{ width: "48%" }}>
                                                {/* eslint-disable-next-line jsx-a11y/alt-text -- Image react-pdf tidak punya atribut alt */}
                                                <Image
                                                    src={{ data: f.data, format: f.format }}
                                                    style={{ height: 150, objectFit: "contain", backgroundColor: "#f5f5f5" }}
                                                />
                                                <Text style={{ fontSize: 6.5, color: "#555", marginTop: 2 }}>
                                                    {`Diunggah ${waktuDmyHm(f.diunggah)} WIB`}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}

                <Text
                    fixed
                    style={{
                        position: "absolute",
                        bottom: 2 * MM + 10,
                        left: 12 * MM,
                        right: 12 * MM,
                        fontSize: 6.5,
                        color: "#555",
                    }}
                >
                    Baris berlatar abu menandakan temuan tingkat berat. Temuan dicatat otomatis dari butir checklist
                    yang gagal; tindak lanjut di luar sistem.
                </Text>
            </Page>
        </Document>
    );
}

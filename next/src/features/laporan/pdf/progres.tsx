/**
 * Laporan "Progres per gedung" (PRD F15): A4 lanskap, per gedung/area dan per modul jumlah aset
 * wajib periksa dan yang sudah diperiksa (%), inspeksi yang menunggu tinjauan, yang ditolak
 * peninjau, dan jumlah temuan pada periode itu; ditambah daftar aset yang belum dicek.
 * Angka sama dengan dasbor Admin K3 dan papan Pemantau (features/dasbor/server.ts `progres`).
 */
import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { LaporanProgresGedung } from "@/features/dasbor/laporan";
import { persen1, tglDm, tglDmy2, tglPanjang, waktuCetak } from "../format";
import { gayaHalaman, Kop, Sel, TandaTangan, barisTabel, kepalaTabel, s } from "./dasar";

const MM = 72 / 25.4;

export type IsiProgres = {
    data: LaporanProgresGedung;
    /** Mis. "Periode berjalan (sama dengan dasbor)" atau "November 2026". */
    judulPeriode: string;
    /** Mis. "Semua modul" atau "APAR". */
    judulModul: string;
    tandaTangan: [string, string][];
};

const angka = (sudah: number, total: number, p: number) => (total ? `${sudah}/${total} (${persen1(p)}%)` : "-");

export function DokumenProgres({ isi, dicetak }: { isi: IsiProgres; dicetak: Date }) {
    const { data } = isi;
    const lebarModul = data.modul.length ? Math.min(14, 54 / data.modul.length) : 0;
    const lebarGedung = 100 - 4 - lebarModul * data.modul.length - 10 - 8 - 8 - 8;
    const pad: [number, number] = [3.5, 4];
    const t = { fontSize: 7.5 };
    const tebal = { fontSize: 7.5, fontWeight: "bold" as const };
    const belum = data.baris.filter((b) => b.belum.length > 0);
    const mingguan = new Set(data.modul.filter((m) => m.mingguan).map((m) => m.slug));
    const kolomAngka = (lebar: number, isiTeks: string, gaya = t, kepala = false) => (
        <Sel lebar={`${lebar}%`} padding={pad} tengah kepala={kepala}>
            <Text style={{ ...gaya, textAlign: "center" }}>{isiTeks}</Text>
        </Sel>
    );

    return (
        <Document title={`Progres per Gedung — ${isi.judulPeriode}`} author="Sistem Inspeksi K3" language="id">
            <Page
                size="A4"
                orientation="landscape"
                style={{
                    ...gayaHalaman,
                    fontSize: 8,
                    paddingTop: 12 * MM,
                    paddingBottom: 14 * MM,
                    paddingHorizontal: 12 * MM,
                }}
            >
                <Kop
                    ukuranNama={11.5}
                    kanan={[
                        <Text key="j" style={s.tebal}>
                            PROGRES PEMERIKSAAN PER GEDUNG
                        </Text>,
                        `Dicetak ${waktuCetak(dicetak)} WIB`,
                    ]}
                />
                <Text style={{ fontSize: 10.5, fontWeight: "bold", textAlign: "center", marginBottom: 3 }}>
                    {`PROGRES PEMERIKSAAN PER GEDUNG · ${isi.judulModul.toUpperCase()}`}
                </Text>
                <Text style={{ textAlign: "center", marginBottom: 4 }}>
                    {`Keadaan per ${tglPanjang(dicetak)} · ${isi.judulPeriode}`}
                </Text>
                <Text style={{ textAlign: "center", marginBottom: 10, fontSize: 7, color: "#333" }}>
                    {data.modul
                        .map(
                            (m) =>
                                `${m.nama}: ${m.mingguan ? "per minggu" : "per bulan"}, ${tglDmy2(m.periode)} s.d. ${tglDmy2(m.jatuhTempo)}`,
                        )
                        .join(" · ")}
                </Text>

                <View>
                    <View fixed style={kepalaTabel}>
                        <Sel lebar="4%" kepala padding={pad} tengah>
                            <Text style={tebal}>No</Text>
                        </Sel>
                        <Sel lebar={`${lebarGedung}%`} kepala padding={pad}>
                            <Text style={tebal}>Gedung / area</Text>
                        </Sel>
                        {data.modul.map((m) => (
                            <Sel key={m.slug} lebar={`${lebarModul}%`} kepala padding={pad} tengah>
                                <Text style={{ ...tebal, textAlign: "center" }}>{m.nama}</Text>
                                <Text style={{ fontSize: 6.5, textAlign: "center" }}>diperiksa / wajib</Text>
                            </Sel>
                        ))}
                        {kolomAngka(10, "Semua modul", tebal, true)}
                        {kolomAngka(8, "Perlu tinjauan", tebal, true)}
                        {kolomAngka(8, "Ditolak", tebal, true)}
                        {kolomAngka(8, "Temuan", tebal, true)}
                    </View>
                    {data.baris.length === 0 && (
                        <View style={barisTabel}>
                            <Sel lebar="100%" padding={[16, 4]} tengah>
                                <Text style={s.miring}>Tidak ada aset aktif pada lingkup ini.</Text>
                            </Sel>
                        </View>
                    )}
                    {data.baris.map((b, i) => (
                        <View key={b.nama} wrap={false} style={barisTabel}>
                            <Sel lebar="4%" padding={pad} tengah>
                                <Text style={t}>{i + 1}</Text>
                            </Sel>
                            <Sel lebar={`${lebarGedung}%`} padding={pad}>
                                <Text style={tebal}>{b.nama}</Text>
                            </Sel>
                            {data.modul.map((m) => {
                                const x = b.modul.find((y) => y.slug === m.slug);
                                return (
                                    <Sel key={m.slug} lebar={`${lebarModul}%`} padding={pad} tengah>
                                        <Text style={{ ...t, textAlign: "center" }}>{x ? angka(x.sudah, x.total, x.persen) : "-"}</Text>
                                    </Sel>
                                );
                            })}
                            {kolomAngka(10, angka(b.sudah, b.total, b.persen), tebal)}
                            {kolomAngka(8, String(b.perluTinjauan))}
                            {kolomAngka(8, String(b.ditolak))}
                            {kolomAngka(8, String(b.temuan))}
                        </View>
                    ))}
                    <View wrap={false} style={barisTabel}>
                        <Sel lebar={`${4 + lebarGedung}%`} kepala padding={pad}>
                            <Text style={tebal}>Jumlah</Text>
                        </Sel>
                        {data.modul.map((m) => (
                            <Sel key={m.slug} lebar={`${lebarModul}%`} kepala padding={pad} tengah>
                                <Text style={{ ...tebal, textAlign: "center" }}>{angka(m.sudah, m.total, m.persen)}</Text>
                            </Sel>
                        ))}
                        {kolomAngka(10, angka(data.total.sudah, data.total.total, data.total.persen), tebal, true)}
                        {kolomAngka(8, String(data.total.perluTinjauan), tebal, true)}
                        {kolomAngka(8, String(data.total.ditolak), tebal, true)}
                        {kolomAngka(8, String(data.total.temuan), tebal, true)}
                    </View>
                </View>

                <Text style={{ fontSize: 7, marginTop: 6, color: "#333" }}>
                    Wajib = aset aktif × periode modul (mobil pemadam per minggu). Perlu tinjauan = inspeksi pada periode
                    ini yang masih menunggu tinjauan Administrator K3 atau Pemantau. Ditolak = inspeksi yang ditolak
                    peninjau. Temuan = butir gagal dari inspeksi pada periode ini.
                </Text>

                {belum.length > 0 && (
                    <View style={{ marginTop: 10 }}>
                        <Text style={{ fontSize: 9, fontWeight: "bold", marginBottom: 4 }}>Aset yang belum diperiksa</Text>
                        {belum.map((b) => (
                            <Text key={b.nama} style={{ fontSize: 7.5, marginBottom: 2 }}>
                                <Text style={s.tebal}>{`${b.nama} (${b.belum.length}): `}</Text>
                                {b.belum
                                    .map((a) => (mingguan.has(a.modulSlug) && a.periode ? `${a.kode} (minggu ${tglDm(a.periode)})` : a.kode))
                                    .join(", ")}
                            </Text>
                        ))}
                    </View>
                )}

                <TandaTangan ukuran={8} jarak={36} sisi={10} marginTop={14} kolom={isi.tandaTangan} />
            </Page>
        </Document>
    );
}

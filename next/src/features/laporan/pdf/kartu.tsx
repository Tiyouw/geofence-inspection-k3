/**
 * Kartu kontrol satu unit satu tahun (SPEC §4.9, ACCEPTANCE L5): A4 potret berbingkai,
 * identitas aset dan 12 baris bulan. Bulan lewat tanpa pemeriksaan berlatar abu,
 * bulan mendatang abu muda. Acuan rupa: docs/v2/samples/contoh-kartu-kontrol.pdf.
 */
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { labelLantai } from "@/lib/domain/asset";
import { LABEL_KESIMPULAN } from "@/lib/domain/constants";
import type { ambilKartu } from "../queries";
import { labelMedia, type BarisKartu } from "../rakit";
import { tglDm, tglSingkat } from "../format";
import { bacaTipeKotak } from "@/lib/domain/modul/p3k";
import { profilLaporan } from "../profil";
import { gayaHalaman, Kop, Sel, TandaTangan, s, wadahTabel } from "./dasar";

const MM = 72 / 25.4;

type Kartu = NonNullable<Awaited<ReturnType<typeof ambilKartu>>>;

export function DokumenKartu({ kartu, tahun, baris, dicetak }: { kartu: Kartu; tahun: number; baris: BarisKartu[]; dicetak: Date }) {
  const a = kartu.aset;
  const lantai = labelLantai(a.lantai);
  const pad: [number, number] = [3.5, 5];
  const slug = a.slug;
  const profil = profilLaporan(slug);
  const tempat: [string, string, string, string] = ["Lokasi", a.lokasiTeks || "-", "Gedung", `${a.gedung || "-"}${lantai ? `, ${lantai}` : ""}`];
  // Baris identitas per modul: APAR (media, kedaluwarsa tabung), P3K (tipe kotak), hydrant (tipe).
  const identitas: [string, string, string, string][] =
    slug === "apar"
      ? [
          ["Kode unit", a.kode, "Jenis media", labelMedia(a.attributes) ?? "-"],
          tempat,
          ["Divisi", a.divisi ?? "-", "Masa kedaluwarsa", a.tglExpired ? tglSingkat(a.tglExpired) : "-"],
        ]
      : [
          [
            "Kode unit",
            a.kode,
            slug === "p3k" ? "Tipe kotak" : "Tipe",
            slug === "p3k" ? `${bacaTipeKotak(a.attributes) ?? "A (bawaan)"} · baku Lampiran II` : a.tipe,
          ],
          tempat,
          ["Unit pemilik", a.divisi ?? "-", "Periode", "Bulanan (30 hari)"],
        ];
  const kolom = [
    ["Bulan", "15%"],
    ["Tanggal", "12%"],
    ["Petugas pemeriksa", "24%"],
    ["Kesimpulan", "19%"],
    ["Temuan", "10%"],
    ["Paraf", "20%"],
  ] as const;

  return (
    <Document title={`Kartu Kontrol ${a.kode} — ${tahun}`} author="Sistem Inspeksi K3 Perusahaan Galangan Kapal" language="id">
      <Page size="A4" style={{ ...gayaHalaman, fontSize: 9, padding: 12 * MM }}>
        <View style={{ borderWidth: 1.5, borderColor: "#000", paddingTop: 8, paddingHorizontal: 10, paddingBottom: 10 }}>
          <Kop lebarKiri="62%" ukuranNama={11} ukuranSub={7.5} garis={1} kanan={[`Dicetak ${tglSingkat(dicetak)}`, "Simpan pada unit"]} />

          <Text style={{ fontSize: 12, fontWeight: "bold", textAlign: "center", letterSpacing: 0.4, marginBottom: 2 }}>KARTU KONTROL PEMERIKSAAN</Text>
          <Text style={{ fontSize: 10, fontWeight: "bold", textAlign: "center", marginBottom: 9 }}>{`${a.tipe} · Tahun ${tahun}`}</Text>

          <View style={{ ...wadahTabel, marginBottom: 9, fontSize: 8.5 }}>
            {identitas.map(([k1, v1, k2, v2]) => (
              <View key={k1} style={{ flexDirection: "row" }}>
                <Sel lebar="18%" kepala padding={pad}>
                  <Text style={s.tebal}>{k1}</Text>
                </Sel>
                <Sel lebar="32%" padding={pad}>
                  <Text style={k1 === "Kode unit" ? s.tebal : undefined}>{v1}</Text>
                </Sel>
                <Sel lebar="18%" kepala padding={pad}>
                  <Text style={s.tebal}>{k2}</Text>
                </Sel>
                <Sel lebar="32%" padding={pad}>
                  <Text>{v2}</Text>
                </Sel>
              </View>
            ))}
          </View>

          <View style={wadahTabel}>
            <View style={{ flexDirection: "row" }}>
              {kolom.map(([judul, lebar]) => (
                <Sel key={judul} lebar={lebar} kepala tengah padding={[4, 5]}>
                  <Text style={{ fontSize: 7.5, fontWeight: "bold" }}>{judul}</Text>
                </Sel>
              ))}
            </View>
            {baris.map((b) => {
              const latar = b.keadaan === "terlewat" ? { backgroundColor: "#f0f0f0" } : undefined;
              const warna = b.keadaan === "mendatang" ? { color: "#888" } : {};
              const i = b.inspeksi;
              return (
                <View key={b.bulan} style={{ flexDirection: "row", minHeight: 26 }} wrap={false}>
                  <Sel lebar="15%" padding={[4, 5]} style={latar}>
                    <Text style={{ fontSize: 8, ...warna }}>{b.bulan}</Text>
                  </Sel>
                  <Sel lebar="12%" padding={[4, 5]} style={latar} tengah>
                    <Text style={{ fontSize: 8 }}>{i ? tglDm(i.inspectedAt) : ""}</Text>
                  </Sel>
                  <Sel lebar="24%" padding={[4, 5]} style={latar}>
                    <Text style={{ fontSize: 8 }}>{i?.petugas ?? ""}</Text>
                    {b.tinjau && <Text style={{ fontSize: 7, color: "#333" }}>perlu tinjauan posisi</Text>}
                  </Sel>
                  <Sel lebar="19%" padding={[4, 5]} style={latar}>
                    {i ? (
                      <Text style={{ fontSize: 8 }}>{i.kesimpulan ? LABEL_KESIMPULAN[i.kesimpulan] : "-"}</Text>
                    ) : b.keadaan === "terlewat" ? (
                      <Text style={{ fontSize: 7, color: "#333" }}>tidak diperiksa</Text>
                    ) : null}
                  </Sel>
                  <Sel lebar="10%" padding={[4, 5]} style={latar} tengah>
                    <Text style={{ fontSize: 8 }}>{i ? String(i.jumlahTemuan) : ""}</Text>
                  </Sel>
                  <Sel lebar="20%" padding={[4, 5]} style={latar} />
                </View>
              );
            })}
          </View>

          <Text style={{ fontSize: 7, color: "#333", marginTop: 8 }}>
            {slug === "apar"
              ? "Periode pemeriksaan satu bulan, mengikuti Permenaker No. 4 Tahun 1980 dan NFPA 10."
              : `Periode pemeriksaan satu bulan. Dasar: ${profil.dasarHukum}`}{" "}
            Baris berlatar abu menandakan bulan yang sudah lewat tanpa pemeriksaan tercatat. Kolom paraf diisi tangan oleh pengawas saat
            memeriksa kartu di lokasi.
          </Text>

          <TandaTangan
            ukuran={8}
            jarak={34}
            sisi={16}
            marginTop={12}
            kolom={profil.penandaTangan}
          />
        </View>
      </Page>
    </Document>
  );
}

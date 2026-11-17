/**
 * Rekapitulasi temuan (SPEC §4.9, ACCEPTANCE L4): A4 potret, temuan belum selesai
 * berat → ringan → terlama, tindakan baku bila tindak lanjut kosong, tenggat lewat
 * ditandai. Acuan rupa: docs/v2/samples/contoh-rekap-temuan-2026-10.pdf.
 *
 * Baru di v2 (SPEC §9 #1): lampiran foto bukti dari inspeksi yang melahirkan tiap temuan.
 */
import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import type { DataPeriodeLengkap } from "../queries";
import type { rakitRekap } from "../rakit";
import { kapital, namaPeriode, tglDmy2, tglPanjang, tglSingkat, waktuCetak, waktuDmyHm } from "../format";
import { gayaHalaman, Kop, Sel, TandaTangan, barisTabel, kepalaTabel, s, wadahTabel } from "./dasar";

const MM = 72 / 25.4;

export type FotoLampiran = { data: Buffer; format: "jpg" | "png"; diunggah: Date };

const KOLOM = [
  ["No", "4%", true],
  ["Kode unit", "11%", false],
  ["Lokasi", "17%", false],
  ["Temuan", "22%", false],
  ["Tingkat", "9%", true],
  ["Tindakan yang diminta", "19%", false],
  ["Tenggat", "9%", true],
  ["Status", "9%", true],
] as const;

export function DokumenRekap({
  data,
  rekap,
  dicetak,
  foto,
}: {
  data: DataPeriodeLengkap;
  rekap: ReturnType<typeof rakitRekap>;
  dicetak: Date;
  foto: Map<number, FotoLampiran[]> | null;
}) {
  const { tipe, filter, ringkas } = data;
  const r = rekap.ringkas;
  const periode = namaPeriode(filter.tahun, filter.bulan);
  const pad: [number, number] = [3.5, 4];
  const adaFoto = foto && rekap.baris.some((b) => (foto.get(b.temuan.id)?.length ?? 0) > 0);

  return (
    <Document title={`Rekapitulasi Temuan — ${periode}`} author="Sistem Inspeksi K3 Perusahaan Galangan Kapal" language="id">
      <Page size="A4" style={{ ...gayaHalaman, fontSize: 8.5, paddingTop: 14 * MM, paddingBottom: 16 * MM, paddingHorizontal: 12 * MM }}>
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
          {`REKAPITULASI TEMUAN ${tipe.nama.toUpperCase()}`}
        </Text>
        <Text style={{ textAlign: "center", marginBottom: 10 }}>
          {`Keadaan per ${tglPanjang(dicetak)} · periode laporan ${periode}${filter.gedung ? ` · Gedung ${filter.gedung}` : ""}`}
        </Text>

        <View style={{ ...wadahTabel, marginBottom: 10, fontSize: 8 }}>
          {[
            ["Temuan terbuka", `${r.terbuka} butir`, "Tingkat berat", `${r.berat} butir`],
            ["Lewat tenggat", `${r.lewat} butir`, "Unit terdampak", `${r.unitTerdampak} dari ${r.totalUnit} unit`],
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
                <Text style={{ fontSize: 7.5, fontWeight: "bold", textAlign: tengah ? "center" : "left" }}>{judul}</Text>
              </Sel>
            ))}
          </View>
          {rekap.baris.length === 0 && (
            <View style={barisTabel}>
              <Sel lebar="100%" padding={[16, 4]} tengah>
                <Text style={s.miring}>Tidak ada temuan terbuka pada lingkup ini.</Text>
              </Sel>
            </View>
          )}
          {rekap.baris.map((b) => {
            const berat = b.temuan.severity === "berat";
            const latar = { justifyContent: "flex-start" as const, ...(berat ? { backgroundColor: "#f0f0f0" } : {}) };
            const t = { fontSize: 8, fontWeight: berat ? ("bold" as const) : ("normal" as const) };
            const kecil = { fontSize: 7, color: "#333" };
            return (
              <View key={b.temuan.id} wrap={false} style={barisTabel}>
                <Sel lebar="4%" padding={pad} style={latar} tengah>
                  <Text style={t}>{b.no}</Text>
                </Sel>
                <Sel lebar="11%" padding={pad} style={latar}>
                  <Text style={{ ...t, fontWeight: "bold" }}>{b.aset?.kode ?? "-"}</Text>
                </Sel>
                <Sel lebar="17%" padding={pad} style={latar}>
                  <Text style={t}>
                    {b.lokasi.utama}
                    {b.lokasi.lantai ? <Text style={kecil}>{` (${b.lokasi.lantai})`}</Text> : null}
                  </Text>
                </Sel>
                <Sel lebar="22%" padding={pad} style={latar}>
                  <Text style={t}>{b.temuan.item}</Text>
                  <Text style={kecil}>{`Ditemukan ${tglSingkat(b.temuan.createdAt)} · ${b.umur} hari berjalan`}</Text>
                </Sel>
                <Sel lebar="9%" padding={pad} style={latar} tengah>
                  <Text style={t}>{kapital(b.temuan.severity)}</Text>
                </Sel>
                <Sel lebar="19%" padding={pad} style={latar}>
                  <Text style={t}>{b.tindakan}</Text>
                </Sel>
                <Sel lebar="9%" padding={pad} style={latar} tengah>
                  <Text style={{ ...t, fontWeight: b.lewat || berat ? "bold" : "normal" }}>
                    {b.temuan.targetSelesai ? tglDmy2(b.temuan.targetSelesai) : "-"}
                  </Text>
                  {b.lewat && <Text style={{ ...kecil, fontWeight: "bold" }}>lewat</Text>}
                </Sel>
                <Sel lebar="9%" padding={pad} style={latar} tengah>
                  <Text style={t}>{kapital(b.temuan.status)}</Text>
                </Sel>
              </View>
            );
          })}
        </View>

        {ringkas.belum > 0 && (
          <Text style={{ fontSize: 8, marginTop: 10 }}>
            <Text style={s.tebal}>Catatan kepatuhan.</Text>
            {` ${ringkas.belum} dari ${ringkas.total} unit belum diperiksa pada periode ini, sehingga daftar di atas belum menggambarkan keadaan seluruh unit.`}
          </Text>
        )}

        <TandaTangan
          ukuran={8}
          jarak={40}
          sisi={14}
          marginTop={18}
          kolom={[
            ["Disusun oleh", "Petugas K3"],
            ["Diverifikasi oleh", "Supervisor K3LH"],
            ["Disetujui oleh", "Kepala Divisi K3LH"],
          ]}
        />

        {adaFoto && (
          <View break>
            <Text style={{ fontSize: 10.5, fontWeight: "bold", textAlign: "center", marginBottom: 3 }}>LAMPIRAN FOTO BUKTI</Text>
            <Text style={{ textAlign: "center", marginBottom: 10 }}>
              Foto dari inspeksi yang melahirkan setiap temuan, disimpan privat di sistem. Nomor mengikuti tabel di atas.
            </Text>
            {rekap.baris.map((b) => {
              const daftar = foto!.get(b.temuan.id) ?? [];
              if (!daftar.length) return null;
              return (
                <View key={b.temuan.id} wrap={false} style={{ marginBottom: 10, borderBottomWidth: 0.6, borderBottomColor: "#bbb", paddingBottom: 8 }}>
                  <Text style={{ fontSize: 8, marginBottom: 4 }}>
                    <Text style={s.tebal}>{`${b.no}. ${b.aset?.kode ?? "-"}`}</Text>
                    {` · ${b.temuan.item}`}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {daftar.map((f, i) => (
                      <View key={i} style={{ width: "48%" }}>
                        {/* eslint-disable-next-line jsx-a11y/alt-text -- Image react-pdf tidak punya atribut alt */}
                        <Image src={{ data: f.data, format: f.format }} style={{ height: 150, objectFit: "contain", backgroundColor: "#f5f5f5" }} />
                        <Text style={{ fontSize: 6.5, color: "#555", marginTop: 2 }}>{`Diunggah ${waktuDmyHm(f.diunggah)} WIB`}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <Text fixed style={{ position: "absolute", bottom: 2 * MM + 10, left: 12 * MM, right: 12 * MM, fontSize: 6.5, color: "#555" }}>
          Baris berlatar abu menandakan temuan tingkat berat: unit diturunkan dari layanan sampai diganti.
        </Text>
      </Page>
    </Document>
  );
}

/**
 * Lembar PMS bulanan (SPEC §4.9, ACCEPTANCE L1): A4 lanskap, matriks aset × butir
 * dengan simbol ✓ X O Ø -, kepala tabel berulang tiap halaman, legenda nomor butir
 * dengan dasar hukum, ringkasan, tiga kolom tanda tangan, kaki di setiap halaman.
 * Acuan rupa: docs/v2/samples/contoh-pms-apar-2026-10.pdf.
 */
import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { DataPeriodeLengkap } from "../queries";
import { namaPeriode, persen1, tglDm, waktuCetak } from "../format";
import { profilLaporan } from "../profil";
import { gayaHalaman, Kop, Sel, TandaTangan, barisTabel, kepalaTabel, s, wadahTabel } from "./dasar";

const MM = 72 / 25.4;
const LEBAR_ISI = 841.89 - 20 * MM; // A4 lanskap dikurangi margin kiri-kanan 10 mm

/**
 * Lebar kolom sesuai blade lama (Kode 9%, Lokasi 17%, Tanggal 6%, butir 3,2%,
 * Kesimpulan 8%, Petugas 9%), diregangkan ke lebar penuh seperti dompdf.
 */
function lebarKolom(nButir: number, adaLengkap: boolean) {
  const dasar = { kode: 9, lokasi: 17, tanggal: 6, butir: 3.2, kesimpulan: 8, petugas: 9, lengkap: adaLengkap ? 6 : 0 };
  const jumlah =
    dasar.kode + dasar.lokasi + dasar.tanggal + dasar.butir * nButir + dasar.lengkap + dasar.kesimpulan + dasar.petugas;
  const pt = (p: number) => (p / jumlah) * LEBAR_ISI;
  return {
    kode: pt(dasar.kode),
    lokasi: pt(dasar.lokasi),
    tanggal: pt(dasar.tanggal),
    butir: pt(dasar.butir),
    kesimpulan: pt(dasar.kesimpulan),
    petugas: pt(dasar.petugas),
    lengkap: pt(dasar.lengkap),
  };
}

const KAKI = "Dokumen dihasilkan Sistem Inspeksi K3 PT PAL Indonesia. Baris berlatar abu menandakan unit yang belum diperiksa pada periode ini.";

export function DokumenPms({ data, dicetak }: { data: DataPeriodeLengkap; dicetak: Date }) {
  const { tipe, filter, butir, grup, baris, ringkas } = data;
  /** Kotak P3K: kolom kelengkapan isi (%). */
  const adaLengkap = baris.some((b) => b.kelengkapan !== undefined);
  const w = lebarKolom(butir.length, adaLengkap);
  const profil = profilLaporan(tipe.slug);
  const periode = namaPeriode(filter.tahun, filter.bulan);
  const kepala = { fontSize: 6.8, fontWeight: "bold" as const, textAlign: "center" as const };

  return (
    <Document title={`Lembar PMS ${tipe.nama} — ${periode}`} author="Sistem Inspeksi K3 PT PAL Indonesia" language="id">
      <Page
        size="A4"
        orientation="landscape"
        style={{ ...gayaHalaman, fontSize: 7.5, paddingTop: 12 * MM, paddingBottom: 14 * MM, paddingHorizontal: 10 * MM }}
      >
        <Kop
          lebarKiri="66%"
          kanan={[
            <Text key="j" style={s.tebal}>
              PREVENTIVE MAINTENANCE SCHEDULE
            </Text>,
            ...(tipe.slug === "apar" ? ["Lampiran 03 dari 04"] : []),
            `Dicetak ${waktuCetak(dicetak)} WIB`,
          ]}
        />

        <Text style={{ fontSize: 10, fontWeight: "bold", textAlign: "center", marginBottom: 3 }}>
          {`LAPORAN PEMERIKSAAN BERKALA ${tipe.nama.toUpperCase()}`}
        </Text>
        <Text style={{ fontSize: 8, textAlign: "center", marginBottom: 9 }}>
          {`Periode ${periode}${filter.gedung ? ` · Gedung ${filter.gedung}` : ""} · ${ringkas.total} unit terdaftar`}
        </Text>

        <View>
          {/* Kepala tabel berulang di setiap halaman yang dilalui tabel. */}
          <View fixed style={kepalaTabel}>
            <Sel lebar={w.kode} kepala tengah>
              <Text style={kepala}>Kode</Text>
            </Sel>
            <Sel lebar={w.lokasi} kepala tengah>
              <Text style={kepala}>Lokasi</Text>
            </Sel>
            <Sel lebar={w.tanggal} kepala tengah>
              <Text style={kepala}>Tanggal</Text>
            </Sel>
            <View style={{ width: w.butir * butir.length }}>
              <View style={{ flexDirection: "row", flexGrow: 1 }}>
                {grup.map((g) => (
                  <Sel key={g.nama} lebar={w.butir * g.jumlah} kepala tengah>
                    <Text style={kepala}>{g.nama}</Text>
                  </Sel>
                ))}
              </View>
              <View style={{ flexDirection: "row" }}>
                {butir.map((b, i) => (
                  <Sel key={b.id} lebar={w.butir} kepala tengah>
                    <Text style={{ ...kepala, fontSize: 7.5 }}>{i + 1}</Text>
                  </Sel>
                ))}
              </View>
            </View>
            {adaLengkap && (
              <Sel lebar={w.lengkap} kepala tengah>
                <Text style={{ ...kepala, fontSize: 6 }}>Lengkap</Text>
              </Sel>
            )}
            <Sel lebar={w.kesimpulan} kepala tengah>
              <Text style={kepala}>Kesimpulan</Text>
            </Sel>
            <Sel lebar={w.petugas} kepala tengah>
              <Text style={kepala}>Petugas</Text>
            </Sel>
          </View>

          {baris.map((b) => {
            const kosong = !b.inspeksi;
            const latar = kosong ? { backgroundColor: "#f2f2f2" } : undefined;
            const gaya = kosong ? { fontStyle: "italic" as const } : {};
            return (
              <View key={b.aset.id} wrap={false} style={{ ...barisTabel, minHeight: 20 }}>
                <Sel lebar={w.kode} style={latar}>
                  <Text style={{ fontSize: 7, fontWeight: "bold", ...gaya }}>{b.aset.kode}</Text>
                </Sel>
                <Sel lebar={w.lokasi} style={latar}>
                  <Text style={{ fontSize: 7, ...gaya }}>
                    {b.lokasi.utama}
                    {b.lokasi.lantai ? <Text style={{ fontSize: 6.2, color: "#333" }}>{`  (${b.lokasi.lantai})`}</Text> : null}
                  </Text>
                </Sel>
                <Sel lebar={w.tanggal} style={latar} tengah>
                  <Text style={{ fontSize: 7, ...gaya }}>{b.inspeksi ? tglDm(b.inspeksi.inspectedAt) : "-"}</Text>
                </Sel>
                {b.simbol.map((sim, i) => (
                  <Sel key={i} lebar={w.butir} style={latar} tengah>
                    <Text style={{ fontSize: /\d/.test(sim) ? 7 : 9, fontWeight: "bold", ...gaya }}>{sim}</Text>
                  </Sel>
                ))}
                {adaLengkap && (
                  <Sel lebar={w.lengkap} style={latar} tengah>
                    <Text style={{ fontSize: 7, fontWeight: b.kelengkapan != null && b.kelengkapan < 100 ? "bold" : "normal", ...gaya }}>
                      {b.kelengkapan == null ? "-" : `${b.kelengkapan}%`}
                    </Text>
                  </Sel>
                )}
                <Sel lebar={w.kesimpulan} style={latar} tengah>
                  <Text style={{ fontSize: 7, textAlign: "center", ...gaya }}>{b.kesimpulan}</Text>
                </Sel>
                <Sel lebar={w.petugas} style={latar}>
                  <Text style={{ fontSize: 6.2, color: "#333", ...gaya }}>{b.inspeksi?.petugas ?? "-"}</Text>
                </Sel>
              </View>
            );
          })}
        </View>

        <View style={{ marginTop: 9, fontSize: 6.8 }}>
          <Text style={{ ...s.tebal, marginBottom: 3 }}>Nomor butir pemeriksaan.</Text>
          {Array.from({ length: Math.ceil(butir.length / 4) }, (_, r) => (
            <View key={r} style={{ flexDirection: "row", marginBottom: 3 }} wrap={false}>
              {butir.slice(r * 4, r * 4 + 4).map((b, k) => (
                <Text key={b.id} style={{ width: "25%", paddingRight: 6 }}>
                  <Text style={s.tebal}>{`${r * 4 + k + 1}.`}</Text>
                  {` ${b.label}`}
                  {b.dasarHukum ? <Text style={{ fontSize: 6.2, color: "#333" }}>{` (${b.dasarHukum})`}</Text> : null}
                </Text>
              ))}
            </View>
          ))}
        </View>

        <View style={{ marginTop: 8, fontSize: 7 }} wrap={false}>
          <Text>
            <Text style={s.tebal}>Keterangan simbol.</Text>
            {tipe.slug === "apar" ? " Dua dimensi dinilai terpisah:" : ""}
          </Text>
          <View style={{ flexDirection: "row", marginVertical: 2 }}>
            {profil.simbol.map(([sim, arti]) => (
              <Text key={sim} style={{ marginRight: 10 }}>
                <Text style={s.tebal}>{sim}</Text> {arti}
              </Text>
            ))}
          </View>
          {profil.dasarHukum !== "" && <Text>{`Dasar hukum: ${profil.dasarHukum}`}</Text>}
          {adaLengkap && <Text>Lengkap: persentase isi kotak yang memenuhi jumlah baku tipe kotaknya dan tidak kedaluwarsa.</Text>}
        </View>

        <View wrap={false}>
          <View style={{ ...wadahTabel, marginTop: 9, fontSize: 7.5 }}>
            <View style={{ flexDirection: "row" }}>
              <Sel lebar="26%" kepala padding={[3, 5]}>
                <Text style={s.tebal}>Unit terdaftar</Text>
              </Sel>
              <Sel lebar="24%" padding={[3, 5]}>
                <Text>{`${ringkas.total} unit`}</Text>
              </Sel>
              <Sel lebar="26%" kepala padding={[3, 5]}>
                <Text style={s.tebal}>Tingkat kepatuhan</Text>
              </Sel>
              <Sel lebar="24%" padding={[3, 5]}>
                <Text>{`${persen1(ringkas.kepatuhan)}% (${ringkas.diperiksa} diperiksa, ${ringkas.belum} belum)`}</Text>
              </Sel>
            </View>
            <View style={{ flexDirection: "row" }}>
              <Sel lebar="26%" kepala padding={[3, 5]}>
                <Text style={s.tebal}>Hasil pemeriksaan</Text>
              </Sel>
              <Sel lebar="24%" padding={[3, 5]}>
                <Text>{`Layak ${ringkas.layak} · Layak dengan catatan ${ringkas.layakCatatan} · Tidak layak ${ringkas.tidakLayak}`}</Text>
              </Sel>
              <Sel lebar="26%" kepala padding={[3, 5]}>
                <Text style={s.tebal}>Temuan berat terbuka</Text>
              </Sel>
              <Sel lebar="24%" padding={[3, 5]}>
                <Text>{`${ringkas.beratTerbuka} butir`}</Text>
              </Sel>
            </View>
            {ringkas.perluTinjauan > 0 && (
              <View style={{ flexDirection: "row" }}>
                <Sel lebar="26%" kepala padding={[3, 5]}>
                  <Text style={s.tebal}>Perlu tinjauan</Text>
                </Sel>
                <Sel lebar="74%" padding={[3, 5]}>
                  <Text>{`${ringkas.perluTinjauan} pemeriksaan memiliki catatan posisi yang perlu ditinjau Admin K3 sebelum laporan disahkan.`}</Text>
                </Sel>
              </View>
            )}
          </View>

          <TandaTangan
            ukuran={7.5}
            jarak={38}
            sisi={12}
            marginTop={16}
            kolom={profil.penandaTangan}
          />
        </View>

        <Text fixed style={{ position: "absolute", bottom: 2 * MM + 8, left: 10 * MM, right: 10 * MM, fontSize: 6, color: "#555" }}>
          {KAKI}
        </Text>
      </Page>
    </Document>
  );
}

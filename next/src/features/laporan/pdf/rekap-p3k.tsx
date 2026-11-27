/**
 * Rekap isi P3K (PRD "Laporan"), A4 potret: per kotak, kelengkapan, isi kurang dari baku,
 * isi kedaluwarsa, dan kedaluwarsa terdekat. Ditandatangani Divisi Matra & K3LH;
 * jabatan penanda tangan {{Assumption}} (PRD pertanyaan "Jabatan penanda tangan").
 */
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { LABEL_KESIMPULAN } from "@/lib/domain/constants";
import { tanggalPendek } from "@/lib/domain/modul/p3k";
import { labelLantai } from "@/lib/domain/asset";
import type { rakitRekapP3k } from "../rekap-p3k";
import { tglPanjang, waktuCetak } from "../format";
import { gayaHalaman, Kop, Sel, TandaTangan, barisTabel, kepalaTabel, s, wadahTabel } from "./dasar";

const MM = 72 / 25.4;

const KOLOM = [
  ["No", "4%", true],
  ["Kotak", "11%", false],
  ["Lokasi", "15%", false],
  ["Diperiksa", "13%", false],
  ["Lengkap", "8%", true],
  ["Isi kurang dari baku", "20%", false],
  ["Isi kedaluwarsa", "15%", false],
  ["Kedaluwarsa terdekat", "14%", false],
] as const;

export function DokumenRekapP3k({
  rekap,
  judulPeriode,
  gedung,
  dicetak,
}: {
  rekap: ReturnType<typeof rakitRekapP3k>;
  judulPeriode: string;
  gedung: string | null;
  dicetak: Date;
}) {
  const r = rekap.ringkas;
  const pad: [number, number] = [3, 3.5];
  const kecil = { fontSize: 6.8, color: "#333" };
  return (
    <Document title={`Rekap Isi Kotak P3K — ${judulPeriode}`} author="Sistem Inspeksi K3" language="id">
      <Page size="A4" style={{ ...gayaHalaman, fontSize: 8, paddingTop: 14 * MM, paddingBottom: 16 * MM, paddingHorizontal: 12 * MM }}>
        <Kop
          ukuranNama={11.5}
          kanan={[
            <Text key="j" style={s.tebal}>
              REKAP ISI KOTAK P3K
            </Text>,
            "Permenakertrans PER.15/MEN/VIII/2008",
            `Dicetak ${waktuCetak(dicetak)} WIB`,
          ]}
        />
        <Text style={{ fontSize: 10.5, fontWeight: "bold", textAlign: "center", marginBottom: 3 }}>REKAP ISI KOTAK P3K</Text>
        <Text style={{ textAlign: "center", marginBottom: 10 }}>
          {`Periode ${judulPeriode}${gedung ? ` · Gedung ${gedung}` : ""} · keadaan per ${tglPanjang(dicetak)}`}
        </Text>

        <View style={{ ...wadahTabel, marginBottom: 10 }}>
          {[
            ["Kotak diperiksa", `${r.diperiksa} dari ${r.total} kotak`, "Rata-rata kelengkapan", r.rataKelengkapan === null ? "-" : `${r.rataKelengkapan}%`],
            ["Isi kurang dari baku", `${r.isiKurang} butir`, "Isi kedaluwarsa", `${r.isiKedaluwarsa} butir`],
            ["Kotak lengkap 100%", `${r.lengkap} kotak`, "Segera kedaluwarsa (≤ 30 hari)", `${r.isiSegera} butir`],
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
                <Text style={{ fontSize: 7.2, fontWeight: "bold", textAlign: tengah ? "center" : "left" }}>{judul}</Text>
              </Sel>
            ))}
          </View>
          {rekap.baris.length === 0 && (
            <View style={barisTabel}>
              <Sel lebar="100%" padding={[16, 4]} tengah>
                <Text style={s.miring}>Belum ada kotak P3K pada lingkup ini.</Text>
              </Sel>
            </View>
          )}
          {rekap.baris.map((b) => {
            const lantai = labelLantai(b.kotak.lantai);
            const kiri = { justifyContent: "flex-start" as const };
            return (
              <View key={b.kotak.id} wrap={false} style={barisTabel}>
                <Sel lebar="4%" padding={pad} style={kiri} tengah>
                  <Text>{b.no}</Text>
                </Sel>
                <Sel lebar="11%" padding={pad} style={kiri}>
                  <Text style={s.tebal}>{b.kotak.kode}</Text>
                  <Text style={kecil}>{`Tipe ${b.tipe}${b.kotak.tipeKotak ? "" : " (bawaan)"}`}</Text>
                </Sel>
                <Sel lebar="15%" padding={pad} style={kiri}>
                  <Text>{b.kotak.lokasiTeks || b.kotak.gedung || "-"}</Text>
                  {(b.kotak.gedung || lantai) && <Text style={kecil}>{[b.kotak.gedung, lantai].filter(Boolean).join(" · ")}</Text>}
                </Sel>
                <Sel lebar="13%" padding={pad} style={kiri}>
                  {b.inspeksi ? (
                    <>
                      <Text>{tanggalPendek(b.inspeksi.tanggal)}</Text>
                      <Text style={kecil}>{b.inspeksi.kesimpulan ? LABEL_KESIMPULAN[b.inspeksi.kesimpulan] : "-"}</Text>
                    </>
                  ) : (
                    <Text style={s.miring}>Belum diperiksa</Text>
                  )}
                </Sel>
                <Sel lebar="8%" padding={pad} style={kiri} tengah>
                  <Text style={{ fontWeight: b.kelengkapan && b.kelengkapan.persen < 100 ? "bold" : "normal" }}>
                    {b.kelengkapan ? `${b.kelengkapan.persen}%` : "-"}
                  </Text>
                </Sel>
                <Sel lebar="20%" padding={pad} style={kiri}>
                  {b.inspeksi && b.kurang.length === 0 && <Text>Tidak ada</Text>}
                  {b.kurang.map((k) => (
                    <Text key={k.label}>{`${k.label}: ${k.jumlah}/${k.baku}`}</Text>
                  ))}
                </Sel>
                <Sel lebar="15%" padding={pad} style={kiri}>
                  {b.inspeksi && b.kedaluwarsa.length === 0 && <Text>Tidak ada</Text>}
                  {b.kedaluwarsa.map((k) => (
                    <Text key={k.label}>{k.tanggal ? `${k.label} (${tanggalPendek(k.tanggal)})` : k.label}</Text>
                  ))}
                </Sel>
                <Sel lebar="14%" padding={pad} style={kiri}>
                  {b.terdekat ? (
                    <>
                      <Text style={{ fontWeight: b.segera.length || b.kedaluwarsa.length ? "bold" : "normal" }}>{tanggalPendek(b.terdekat.tanggal)}</Text>
                      <Text style={kecil}>{b.terdekat.label}</Text>
                    </>
                  ) : (
                    <Text>-</Text>
                  )}
                </Sel>
              </View>
            );
          })}
        </View>

        <TandaTangan
          ukuran={8}
          jarak={40}
          sisi={24}
          marginTop={18}
          kolom={[
            ["Diperiksa oleh", "Petugas Pemeriksa"],
            ["Mengetahui", "Kepala Unit Divisi Matra & K3LH"],
          ]}
        />

        <Text fixed style={{ position: "absolute", bottom: 2 * MM + 10, left: 12 * MM, right: 12 * MM, fontSize: 6.5, color: "#555" }}>
          Baku isi mengikuti tipe kotak (Lampiran II PER.15/2008). Tanggal tebal: sudah atau segera kedaluwarsa (≤ 30 hari). Kelengkapan = butir isi yang memenuhi baku dan tidak kedaluwarsa.
        </Text>
      </Page>
    </Document>
  );
}

/**
 * Bagian bersama tiga dokumen PDF: font, kop, tabel tanda tangan, gaya sel.
 *
 * Font DejaVu Sans disematkan (bukan Helvetica bawaan) karena simbol ✓ dan Ø wajib
 * tercetak, dan supaya tampilannya sama dengan PDF dompdf aplikasi lama (SPEC §4.9).
 */
import { join } from "node:path";
import { Font, StyleSheet, Text, View, type Styles } from "@react-pdf/renderer";

type Style = Styles[string];
import type { ReactNode } from "react";

export const FONT = "DejaVu Sans";
const DIR = join(process.cwd(), "src", "features", "laporan", "pdf", "fonts");

let terdaftar = false;
export function daftarkanFont() {
  if (terdaftar) return;
  Font.register({
    family: FONT,
    fonts: [
      { src: join(DIR, "DejaVuSans.ttf") },
      { src: join(DIR, "DejaVuSans-Bold.ttf"), fontWeight: "bold" },
      { src: join(DIR, "DejaVuSans-Oblique.ttf"), fontStyle: "italic" },
      { src: join(DIR, "DejaVuSans-BoldOblique.ttf"), fontWeight: "bold", fontStyle: "italic" },
    ],
  });
  // Kata tidak dipenggal dengan tanda hubung, sama dengan dompdf.
  Font.registerHyphenationCallback((kata) => [kata]);
  terdaftar = true;
}

/**
 * Gaya dasar halaman. Ligatur dimatikan: glyph "fi" pada DejaVu membuat teks
 * hasil salin/cari terbaca "Diverifkasi". Teks PDF harus bisa dicari apa adanya.
 */
export const gayaHalaman = { fontFamily: FONT, color: "#000", fontFeatureSettings: { liga: false, clig: false } } as const;

export const ABU_KEPALA = "#e8e8e8";
export const GARIS = "#444";
export const TEBAL_GARIS = 0.6;

export const s = StyleSheet.create({
  tebal: { fontWeight: "bold" },
  miring: { fontStyle: "italic" },
  tengah: { textAlign: "center" },
});

/** Kop dokumen: nama perusahaan kiri, keterangan dokumen kanan, garis bawah tebal. */
export function Kop({
  kanan,
  lebarKiri = "64%",
  ukuranNama = 11,
  ukuranSub = 8,
  garis = 1.5,
}: {
  kanan: ReactNode[];
  lebarKiri?: string;
  ukuranNama?: number;
  ukuranSub?: number;
  garis?: number;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", borderBottomWidth: garis, borderBottomColor: "#000", paddingBottom: 6, marginBottom: 12 }}>
      <View style={{ width: lebarKiri }}>
        <Text style={{ fontSize: ukuranNama, fontWeight: "bold" }}>PERUSAHAAN GALANGAN KAPAL</Text>
        <Text style={{ fontSize: ukuranSub, marginTop: 2 }}>Geofencing: Sistem Inspeksi Sarana Tanggap Darurat K3</Text>
      </View>
      <View style={{ flexGrow: 1, alignItems: "flex-end" }}>
        {kanan.map((k, i) => (
          <Text key={i} style={{ fontSize: 7.5, textAlign: "right" }}>
            {k}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** Kolom tanda tangan: "Diperiksa oleh / Petugas K3", garis, "Nama dan tanggal". */
export function TandaTangan({
  kolom,
  ukuran,
  jarak,
  sisi,
  marginTop,
}: {
  kolom: [string, string][];
  ukuran: number;
  jarak: number;
  sisi: number;
  marginTop: number;
}) {
  return (
    <View style={{ flexDirection: "row", marginTop, fontSize: ukuran }} wrap={false}>
      {kolom.map(([peran, jabatan]) => (
        <View key={peran} style={{ flex: 1, alignItems: "center" }}>
          <Text style={s.tengah}>{peran}</Text>
          <Text style={s.tengah}>{jabatan}</Text>
          <View style={{ alignSelf: "stretch", borderTopWidth: TEBAL_GARIS, borderTopColor: "#000", marginTop: jarak, marginHorizontal: sisi, marginBottom: 2 }} />
          <Text style={s.tengah}>Nama dan tanggal</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Sel tabel bergaris tipis. Tabel memakai garis kiri+atas pada wadah dan
 * garis kanan+bawah pada sel, sehingga tidak ada garis ganda.
 */
export function Sel({
  lebar,
  children,
  style,
  kepala,
  tengah,
  padding = [2.5, 3],
}: {
  lebar: string | number;
  children?: ReactNode;
  style?: Style;
  kepala?: boolean;
  tengah?: boolean;
  padding?: [number, number];
}) {
  return (
    <View
      style={{
        width: lebar,
        borderRightWidth: TEBAL_GARIS,
        borderBottomWidth: TEBAL_GARIS,
        borderColor: GARIS,
        paddingVertical: padding[0],
        paddingHorizontal: padding[1],
        justifyContent: "center",
        ...(kepala ? { backgroundColor: ABU_KEPALA } : {}),
        ...(tengah ? { alignItems: "center" } : {}),
        ...style,
      }}
    >
      {children}
    </View>
  );
}

export const wadahTabel = { borderLeftWidth: TEBAL_GARIS, borderTopWidth: TEBAL_GARIS, borderColor: GARIS } as const;

/**
 * Untuk tabel yang bisa terbelah antarhalaman: garis kiri per baris dan garis atas
 * pada kepala (yang berulang), supaya wadah yang terbelah tidak menggambar garis
 * kiri sampai dasar halaman.
 */
export const barisTabel = { flexDirection: "row", borderLeftWidth: TEBAL_GARIS, borderColor: GARIS } as const;
export const kepalaTabel = { ...barisTabel, borderTopWidth: TEBAL_GARIS } as const;

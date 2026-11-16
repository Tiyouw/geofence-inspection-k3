import { describe, expect, it } from "vitest";
import {
  ambilToken,
  bangunTemuan,
  jatuhTempo,
  periksaKirim,
  severityJawaban,
  tenggatTemuan,
  usulanKesimpulan,
  validasiJawaban,
  waktuResmi,
  type ButirChecklist,
} from "../inspeksi";

const butir = (p: Partial<ButirChecklist> & { id: number }): ButirChecklist => ({
  label: `Butir ${p.id}`,
  answerType: "boolean",
  options: null,
  severityMap: null,
  severityDefault: "sedang",
  jumlahBaku: null,
  satuan: null,
  wajib: true,
  ...p,
});

const volume = butir({
  id: 1,
  label: "Volume isi tabung",
  answerType: "select",
  options: ["Penuh", "Tidak penuh"],
  severityMap: { "Tidak penuh": "berat" },
  severityDefault: "berat",
});
const handle = butir({ id: 2, label: "Handle dan tuas" });
const label = butir({ id: 3, label: "Label", severityDefault: "ringan" });
const kotak = butir({ id: 4, label: "Kasa", answerType: "number", jumlahBaku: 10, satuan: "lembar", wajib: false });
const ITEMS = [volume, handle, label];

describe("severity dan temuan (SPEC §3.4)", () => {
  it("select hanya temuan bila pilihan ada di severity_map", () => {
    expect(severityJawaban(volume, { checklistItemId: 1, nilai: "Tidak penuh" })).toBe("berat");
    expect(severityJawaban(volume, { checklistItemId: 1, nilai: "Penuh" })).toBeNull();
  });

  it("dua-nilai: tidak = severity_default; ok bukan temuan", () => {
    expect(severityJawaban(handle, { checklistItemId: 2, nilai: "tidak" })).toBe("sedang");
    expect(severityJawaban(handle, { checklistItemId: 2, nilai: "ok" })).toBeNull();
  });

  it("number: kurang dari baku jadi temuan dengan kalimat kekurangan", () => {
    const t = bangunTemuan([kotak], [{ checklistItemId: 4, nilaiAngka: 7 }]);
    expect(t).toEqual([{ checklistItemId: 4, item: "Kasa: 7 dari 10 lembar, kurang 3", severity: "sedang" }]);
    expect(bangunTemuan([kotak], [{ checklistItemId: 4, nilaiAngka: 10 }])).toEqual([]);
  });

  it("temuan diurutkan berat dulu dan usulan kesimpulan", () => {
    const t = bangunTemuan(ITEMS, [
      { checklistItemId: 3, nilai: "tidak" },
      { checklistItemId: 1, nilai: "Tidak penuh" },
      { checklistItemId: 2, nilai: "ok" },
    ]);
    expect(t.map((x) => x.severity)).toEqual(["berat", "ringan"]);
    expect(t[0]!.item).toBe("Volume isi tabung: Tidak penuh");
    expect(t[1]!.item).toBe("Label: Tidak ada");
    expect(usulanKesimpulan(t)).toBe("tidak_layak");
    expect(usulanKesimpulan([{ severity: "ringan" }])).toBe("layak_catatan");
    expect(usulanKesimpulan([])).toBe("layak");
  });
});

describe("validasi jawaban (SPEC §3.3)", () => {
  it("menolak jawaban palsu dan angka pada butir pilihan", () => {
    expect(validasiJawaban(volume, { checklistItemId: 1, nilai: "Kosong" })).toMatch(/tidak sah/);
    expect(validasiJawaban(handle, { checklistItemId: 2, nilai: "mungkin" })).toMatch(/tidak sah/);
    expect(validasiJawaban(handle, { checklistItemId: 2, nilaiAngka: 3 })).toMatch(/tidak menerima angka/);
    expect(validasiJawaban(kotak, { checklistItemId: 4, nilai: "3" })).toMatch(/harus berupa angka/);
    expect(validasiJawaban(handle, { checklistItemId: 2, nilai: "ok" })).toBeNull();
  });
});

describe("periksa kirim (SPEC §3.7)", () => {
  const lengkap = [
    { checklistItemId: 1, nilai: "Penuh" },
    { checklistItemId: 2, nilai: "ok" },
    { checklistItemId: 3, nilai: "ok" },
  ];

  it("lolos bila lengkap, ada foto, dan kesimpulan cocok", () => {
    expect(periksaKirim(ITEMS, { jawaban: lengkap, jumlahFoto: 1, kesimpulan: "layak" }, 6)).toEqual([]);
  });

  it("butir wajib kosong dan tanpa foto ditolak", () => {
    const g = periksaKirim(ITEMS, { jawaban: lengkap.slice(0, 2), jumlahFoto: 0, kesimpulan: "layak" }, 6);
    expect(g).toContain("Masih ada pemeriksaan yang belum diisi: Label");
    expect(g).toContain("Foto wajib diunggah minimal satu sebelum inspeksi dikirim.");
  });

  it("temuan berat tidak boleh layak, rekomendasi wajib bila ada temuan", () => {
    const j = [{ checklistItemId: 1, nilai: "Tidak penuh" }, ...lengkap.slice(1)];
    const g = periksaKirim(ITEMS, { jawaban: j, jumlahFoto: 1, kesimpulan: "layak" }, 6);
    expect(g).toContain("Terdapat temuan berat, kesimpulan tidak dapat diisi Layak pakai.");
    expect(g).toContain("Ada temuan pada inspeksi ini, rekomendasi wajib diisi.");
    // layak_catatan tetap boleh walau ada temuan berat (SPEC §3.7 butir 4)
    expect(periksaKirim(ITEMS, { jawaban: j, jumlahFoto: 1, kesimpulan: "layak_catatan", rekomendasi: "Isi ulang" }, 6)).toEqual([]);
  });

  it("maksimum foto", () => {
    expect(periksaKirim(ITEMS, { jawaban: lengkap, jumlahFoto: 7, kesimpulan: "layak" }, 6)).toContain("Foto paling banyak 6.");
  });
});

describe("waktu resmi (SPEC §7.6)", () => {
  const terima = new Date("2026-11-10T08:00:00Z");

  it("kiriman daring memakai waktu terima peladen", () => {
    const r = waktuResmi({ receivedAt: terima, submittedAtDevice: new Date("2026-11-10T07:59:30Z"), offsetMs: 0 });
    expect(r).toEqual({ inspectedAt: terima, offline: false, clockSkewS: 0 });
  });

  it("kiriman antrean memakai waktu kirim perangkat terkoreksi offset", () => {
    // jam perangkat 5 menit terlambat; dikirim dua hari lalu
    const r = waktuResmi({
      receivedAt: terima,
      submittedAtDevice: new Date("2026-11-08T07:55:00Z"),
      offsetMs: 5 * 60_000,
    });
    expect(r.inspectedAt.toISOString()).toBe("2026-11-08T08:00:00.000Z");
    expect(r.offline).toBe(true);
    expect(r.clockSkewS).toBe(-300);
  });

  it("dibatasi tidak di masa depan dan tidak lebih dari 7 hari sebelum terima", () => {
    expect(waktuResmi({ receivedAt: terima, submittedAtDevice: new Date("2026-11-20T00:00:00Z"), offsetMs: 0 }).inspectedAt).toEqual(terima);
    expect(
      waktuResmi({ receivedAt: terima, submittedAtDevice: new Date("2020-01-01T00:00:00Z"), offsetMs: 0 }).inspectedAt.toISOString(),
    ).toBe("2026-11-03T08:00:00.000Z");
  });
});

describe("jadwal dan tenggat", () => {
  it("jatuh tempo dibatasi akhir bulan (Februari)", () => {
    expect(jatuhTempo("2026-02-01", 30)).toBe("2026-02-28");
    expect(jatuhTempo("2026-01-01", 30)).toBe("2026-01-30");
    expect(jatuhTempo("2026-11-01", 7)).toBe("2026-11-07");
  });

  it("tenggat temuan 3/14/30 hari", () => {
    expect(tenggatTemuan("2026-11-30", "berat")).toBe("2026-12-03");
    expect(tenggatTemuan("2026-11-01", "sedang")).toBe("2026-11-15");
    expect(tenggatTemuan("2026-11-01", "ringan")).toBe("2026-12-01");
  });
});

describe("ambil token (SPEC §3.1)", () => {
  const tok = "PAL-K3-" + "a".repeat(32);
  it("menerima URL stiker dengan host apa pun atau token mentah", () => {
    expect(ambilToken(`https://geofencinspection.tech/i/${tok}`)).toBe(tok);
    expect(ambilToken(`https://host-lain.example/i/${tok}/`)).toBe(tok);
    expect(ambilToken(` ${tok} `)).toBe(tok);
    expect(ambilToken("PAL-K3-" + "A".repeat(32))).toBe(tok);
  });
  it("menolak QR lain", () => {
    expect(ambilToken("https://example.com/promo")).toBeNull();
    expect(ambilToken("01D")).toBeNull();
  });
});

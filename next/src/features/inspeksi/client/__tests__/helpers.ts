import { createHmac, randomBytes } from "node:crypto";
import type { PaketKerja } from "../types";

export const TOKEN = "PAL-K3-" + "ab".repeat(16);
export const TOKEN_LAIN = "PAL-K3-" + "cd".repeat(16);
/** Stiker aset milik unit lain (kotak P3K, Divisi Matra & K3LH). */
export const TOKEN_UNIT_LAIN = "PAL-K3-" + "ef".repeat(16);

export function paketContoh(): PaketKerja {
  const key = randomBytes(32);
  const h = (t: string) => createHmac("sha256", key).update(t).digest("hex");
  const items = [
    { id: 1, label: "Volume isi tabung", answerType: "select" as const, options: ["Penuh", "Tidak penuh"], severityMap: { "Tidak penuh": "berat" as const }, severityDefault: "berat" as const, jumlahBaku: null, satuan: null, wajib: true, dasarHukum: "Permenaker 4/1980 Pasal 12(1)a", keterangan: null },
    { id: 2, label: "Handle dan tuas", answerType: "boolean" as const, options: null, severityMap: null, severityDefault: "sedang" as const, jumlahBaku: null, satuan: null, wajib: true, dasarHukum: "Permenaker 4/1980 Pasal 12(1)b", keterangan: null },
  ];
  return {
    versi: "uji",
    serverTime: new Date().toISOString(),
    hmacKey: key.toString("base64"),
    periode: { mulai: "2026-11-01", hariIni: "2026-11-16", jatuhTempo: { 1: "2026-11-30" } },
    aset: [
      { id: 10, kode: "01D", assetTypeId: 1, tipe: "APAR", gedung: "Gedung PIP", lantai: "Lt. 1", lokasiTeks: "Lorong", lat: -8.18, lng: 113.7, radiusM: 75, media: null, areaTerbatas: false, qrTokenHash: h(TOKEN) },
      { id: 11, kode: "02D", assetTypeId: 1, tipe: "APAR", gedung: "Gedung PIP", lantai: "Lt. 1", lokasiTeks: "Lorong", lat: -8.18, lng: 113.7, radiusM: 75, media: null, areaTerbatas: true, qrTokenHash: h(TOKEN_LAIN) },
    ],
    checklist: { 1: [{ kode: "A", nama: "Isi", items }] },
    langkahFoto: {
      1: [
        { kode: "tabung", judul: "Tabung utuh", petunjuk: null, itemIds: [1, 2] },
        { kode: "manometer", judul: "Manometer", petunjuk: null, itemIds: [1] },
      ],
    },
    sudahDiperiksa: [],
    terkirim: [],
    unit: "SAT. PK",
    asetUnitLain: [{ qrTokenHash: h(TOKEN_UNIT_LAIN), unit: "Divisi Matra & K3LH" }],
  };
}

type Rute = (req: { method: string; url: string; headers: Headers; body: unknown }) => { status: number; body: unknown; headers?: Record<string, string> };

/** fetch palsu: meneruskan ke fungsi rute dan mencatat panggilan. */
export function fetchPalsu(rute: Rute) {
  const panggilan: { method: string; url: string; key: string | null }[] = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const headers = new Headers(init?.headers);
    panggilan.push({ method, url, key: headers.get("idempotency-key") });
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : init?.body;
    const r = rute({ method, url, headers, body });
    if (r.status === 0) throw new TypeError("Failed to fetch");
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { "content-type": "application/json", ...r.headers } });
  }) as typeof fetch;
  return { fn, panggilan };
}

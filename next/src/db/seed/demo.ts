/**
 * Lapisan DEMO v2: area poligon karangan, aset semua modul, jadwal, inspeksi dengan setiap hasil
 * gerbang, foto pengganti, temuan, antrean tinjauan, dan jejak audit, untuk dua unit dan tiga peran.
 *
 * Aman untuk basis data yang memuat denah ASLI pemilik:
 * - hanya menulis baris bertanda demo (kode `DEMO-`, akun pada AKUN_DEMO, audit `data.demo = true`);
 * - batal bila denah demo tumpang tindih dengan area non-demo;
 * - kawasan demo hanya aktif bila belum ada kawasan non-demo yang aktif dan disetujui;
 * - idempoten: area/aset di-upsert; data operasional dibuat sekali (reset dulu untuk membuat ulang).
 * - bila ada kawasan non-demo yang disetujui (denah pemilik), aset demo ditempatkan DI DALAM kawasan
 *   itu, di gedung yang disetujui (aturan src/lib/geo/penempatan.ts), dan aset demo yang sudah di
 *   dalam kawasan tidak dipindah lagi (keputusan pemilik 19 Nov 2026). Area demo tetap di denah
 *   karangan, jadi penjaga tumpang tindih tetap melindungi denah pemilik.
 * `hapusDemo` menghapus HANYA baris bertanda demo.
 */
import { and, eq, inArray, isNotNull, like, ne, notLike, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import bcrypt from "bcryptjs";
import * as s from "../schema";
import { buatTokenQr, labelLantai } from "../../lib/domain/asset";
import { PEMILIK_TIPE, type Kesimpulan, type Severity, type TindakanRekomendasi } from "../../lib/domain/constants";
import { jatuhTempo, periodeDari } from "../../lib/domain/inspeksi";
import { bakuIsi } from "../../lib/domain/modul/p3k";
import { hariIniJakarta } from "../../lib/format";
import { jarakKeAreaM, luasM2, titikDalamPoligon, type GeometriArea } from "../../lib/geo/geometri";
import { type Bangunan, bangunanDalam, rencanaPenempatan, type Tempat } from "../../lib/geo/penempatan";
import { kunciFoto, sha256Hex } from "../../lib/storage/photos";
import { AKUN_DEMO, AREA_DEMO, ASET_DEMO, AWALAN_DEMO, SKENARIO_DEMO, keLngLat, type SkenarioDemo } from "./demo-data";

type Db = NodePgDatabase<typeof s>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Butir = typeof s.checklistItems.$inferSelect;

export type Hitungan = Record<string, number>;
export type OpsiDemo = {
  /** Penyimpan foto; null = tidak menyimpan berkas (mode rencana). */
  simpanFoto: ((key: string, data: Uint8Array, type: string) => Promise<void>) | null;
  fotoContoh: Uint8Array;
  sekarang?: Date;
};

const TAMBAH = (h: Hitungan, k: string, n = 1) => (h[k] = (h[k] ?? 0) + n);

/** Kotak batas (derajat) sebuah geometri. */
function kotakBatas(g: GeometriArea) {
  const titik = (g.type === "Polygon" ? [g.coordinates] : g.coordinates).flatMap((p) => p[0] ?? []);
  const xs = titik.map((t) => t[0]);
  const ys = titik.map((t) => t[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/** Batal bila denah demo (dengan margin ~500 m) bersinggungan dengan area non-demo mana pun. */
export async function periksaTumpangTindih(tx: Tx) {
  const k = kotakBatas(AREA_DEMO.find((a) => a.jenis === "kawasan")!.geometri);
  const d = 0.0045;
  const lain = await tx
    .select({ polygon: s.areas.polygon, draf: s.areas.polygonDraf })
    .from(s.areas)
    .where(and(notLike(s.areas.kode, `${AWALAN_DEMO}%`), or(isNotNull(s.areas.polygon), isNotNull(s.areas.polygonDraf))));
  for (const a of lain) {
    for (const g of [a.polygon, a.draf]) {
      if (!g) continue;
      const b = kotakBatas(g);
      if (b.x0 <= k.x1 + d && b.x1 >= k.x0 - d && b.y0 <= k.y1 + d && b.y1 >= k.y0 - d) {
        throw new Error("Denah demo bersinggungan dengan area non-demo. Seed demo dibatalkan; tidak ada yang diubah.");
      }
    }
  }
}

/* ---------- jawaban ---------- */

function jawaban(b: Butir, tipeKotak: "A" | "B" | "C", buruk: boolean) {
  const j: Partial<typeof s.inspectionAnswers.$inferInsert> = { checklistItemId: b.id };
  let temuan: { item: string; severity: Severity } | null = null;
  if (b.answerType === "select") {
    const opsi = b.options ?? [];
    const jelek = Object.entries(b.severityMap ?? {}).sort((x, y) => "ringan sedang berat".indexOf(y[1]) - "ringan sedang berat".indexOf(x[1]))[0];
    if (buruk && jelek) {
      j.nilai = jelek[0];
      temuan = { item: `${b.label}: ${jelek[0]}`, severity: jelek[1] };
    } else j.nilai = opsi.find((o) => !b.severityMap?.[o]) ?? opsi[0] ?? "Baik";
  } else if (b.answerType === "number") {
    const baku = b.jumlahBakuPerTipe ? bakuIsi({ jumlahBaku: b.jumlahBakuPerTipe }, tipeKotak) : null;
    if (baku != null) {
      j.nilaiAngka = buruk ? Math.max(0, baku - 2) : baku;
      if (b.hasExpiry) {
        j.kondisiIsi = "aman";
        j.tglKedaluwarsaTerdekat = "2027-09-30";
      }
      if (buruk) temuan = { item: `${b.label}: kurang ${baku - j.nilaiAngka!} ${b.satuan ?? ""}`.trim(), severity: b.severityDefault };
    } else j.nilaiAngka = 12_480;
  } else if (b.answerType === "date") j.nilai = "2027-09-30";
  else if (b.answerType === "text") j.nilai = "Baik";
  else {
    j.nilai = buruk ? "tidak" : "ok";
    if (buruk) temuan = { item: `${b.label}: tidak sesuai`, severity: b.severityDefault };
  }
  return { j, temuan };
}

const bisaBuruk = (b: Butir) =>
  (b.answerType === "select" && Object.keys(b.severityMap ?? {}).length > 0) ||
  ["fungsi", "kondisi", "boolean"].includes(b.answerType) ||
  (b.answerType === "number" && !!b.jumlahBakuPerTipe);

/* ---------- seed ---------- */

export async function seedDemo(tx: Tx, opsi: OpsiDemo): Promise<Hitungan> {
  const h: Hitungan = {};
  const now = opsi.sekarang ?? new Date();
  await periksaTumpangTindih(tx);

  const div = Object.fromEntries((await tx.select().from(s.divisions)).map((d) => [d.kode, d.id])) as Record<string, number>;
  const tipe = Object.fromEntries((await tx.select().from(s.assetTypes)).map((t) => [t.slug, t])) as Record<string, typeof s.assetTypes.$inferSelect>;
  for (const a of ASET_DEMO) if (!tipe[a.tipe]) throw new Error(`Tipe aset ${a.tipe} belum ada: jalankan pnpm db:seed dulu.`);

  // Akun demo tambahan; tidak pernah menimpa akun non-demo dengan NIP yang sama.
  const pengguna: Record<string, number> = {};
  for (const u of AKUN_DEMO) {
    const [ada] = await tx.select().from(s.users).where(eq(s.users.nip, u.nip));
    if (ada && !ada.isDemo) throw new Error(`NIP ${u.nip} dipakai akun non-demo; seed demo dibatalkan.`);
    const sandi = u.role === "inspektur" ? process.env.DEMO_INSPEKTUR_PASSWORD || "inspektur123" : process.env.DEMO_PEMANTAU_PASSWORD || "pemantau123";
    const nilai = { name: u.nama, role: u.role, jabatan: "Akun demonstrasi", divisionId: div[u.unit] ?? null, isDemo: true, aktif: true };
    if (ada) {
      await tx.update(s.users).set(nilai).where(eq(s.users.id, ada.id));
      pengguna[u.nip] = ada.id;
    } else {
      const [baru] = await tx
        .insert(s.users)
        .values({ ...nilai, nip: u.nip, email: `${u.nip}@demo.contoh.test`, passwordHash: await bcrypt.hash(sandi, 10) })
        .returning({ id: s.users.id });
      pengguna[u.nip] = baru!.id;
      TAMBAH(h, "akun");
    }
  }
  const [admin] = await tx.select({ id: s.users.id }).from(s.users).where(eq(s.users.nip, "admin"));
  pengguna.admin = admin?.id ?? pengguna["pemantau.matra"]!;

  // Area: kawasan demo aktif hanya bila belum ada kawasan non-demo aktif yang disetujui.
  const [kawasanLain] = await tx
    .select({ id: s.areas.id, polygon: s.areas.polygon })
    .from(s.areas)
    .where(and(eq(s.areas.jenis, "kawasan"), eq(s.areas.aktif, true), isNotNull(s.areas.polygon), notLike(s.areas.kode, `${AWALAN_DEMO}%`)));
  const idArea: Record<string, number> = {};
  for (const a of [...AREA_DEMO].sort((x, y) => Number(y.jenis === "kawasan") - Number(x.jenis === "kawasan"))) {
    const nilai = {
      nama: a.nama,
      jenis: a.jenis,
      polygon: a.disetujui ? (a.geometri as s.GeoJsonPolygon) : null,
      polygonDraf: a.disetujui ? null : (a.geometri as s.GeoJsonPolygon),
      poligonDisetujuiPada: a.disetujui ? now : null,
      poligonDisetujuiOleh: a.disetujui ? pengguna.admin : null,
      restricted: !!a.restricted,
      divisionId: a.unit ? (div[a.unit] ?? null) : null,
      parentId: a.jenis === "kawasan" ? null : (idArea["DEMO-KAWASAN"] ?? null),
      aktif: a.jenis === "kawasan" ? !kawasanLain : true,
    };
    const [r] = await tx
      .insert(s.areas)
      .values({ kode: a.kode, ...nilai })
      .onConflictDoUpdate({ target: s.areas.kode, set: nilai })
      .returning({ id: s.areas.id, baru: sql<boolean>`xmax = 0` });
    idArea[a.kode] = r!.id;
    if (r!.baru) TAMBAH(h, "area");
  }

  // Denah pemilik: aset demo ditempatkan di dalam kawasannya (yang sudah di dalam tidak dipindah).
  const denahNyata = kawasanLain?.polygon
    ? {
        kawasan: kawasanLain.polygon as GeometriArea,
        bangunan: (
          await tx
            .select({ id: s.areas.id, nama: s.areas.nama, polygon: s.areas.polygon, restricted: s.areas.restricted })
            .from(s.areas)
            .where(and(eq(s.areas.aktif, true), isNotNull(s.areas.polygon), ne(s.areas.jenis, "kawasan"), notLike(s.areas.kode, `${AWALAN_DEMO}%`)))
        ).map((b) => ({ ...b, polygon: b.polygon as GeometriArea })) as Bangunan[],
      }
    : null;
  const tempatNyata = new Map<string, Tempat & { tetap: boolean }>();
  if (denahNyata) {
    const ada = new Map(
      (
        await tx
          .select({ kode: s.assets.kode, lat: s.assets.lat, lng: s.assets.lng, areaId: s.assets.areaId, gedung: s.assets.gedung })
          .from(s.assets)
          .where(like(s.assets.kode, `${AWALAN_DEMO}%`))
      ).map((r) => [r.kode, r]),
    );
    const perlu: typeof ASET_DEMO = [];
    for (const a of ASET_DEMO) {
      const r = ada.get(a.kode);
      if (r?.lat != null && r.lng != null && titikDalamPoligon({ lat: r.lat, lng: r.lng }, denahNyata.kawasan)) {
        tempatNyata.set(a.kode, { lat: r.lat, lng: r.lng, areaId: r.areaId, namaArea: r.gedung, tetap: true });
      } else perlu.push(a);
    }
    const terbatasDemo = (a: (typeof ASET_DEMO)[number]) => !!(a.area && AREA_DEMO.find((x) => x.kode === a.area)!.restricted);
    const dalam = new Set(bangunanDalam(denahNyata).map((b) => b.id));
    let rencana = new Map<number, Tempat>();
    try {
      rencana = rencanaPenempatan(
        perlu.map((a, i) => ({
          id: -(i + 1),
          kode: a.kode,
          slug: a.tipe,
          kelompok: a.area ? AREA_DEMO.find((x) => x.kode === a.area)!.nama : null,
          lokasiTeks: a.lokasiTeks,
          lantai: a.lantai,
          areaTetap: null,
          terbatas: terbatasDemo(a),
        })),
        { kawasan: denahNyata.kawasan, bangunan: denahNyata.bangunan.filter((b) => dalam.has(b.id)) },
      );
    } catch (e) {
      // Denah tanpa gedung yang bisa dipakai: aset demo tetap di denah karangan.
      console.log(`Aset demo tetap di denah karangan: ${(e as Error).message}`);
    }
    const idTerbatas = new Set(denahNyata.bangunan.filter((b) => b.restricted).map((b) => b.id));
    perlu.forEach((a, i) => {
      const t = rencana.get(-(i + 1));
      // Aset demo di area terbatas hanya pindah ke gedung terbatas pemilik; bila tidak ada, tetap di
      // denah karangan supaya skenario "area terbatas" (tanpa foto, otomatis ditinjau) tetap ada.
      if (t && (!terbatasDemo(a) || (t.areaId !== null && idTerbatas.has(t.areaId)))) tempatNyata.set(a.kode, { ...t, tetap: false });
    });
  }

  // Aset: upsert pada (tipe, kode); token QR hanya diterbitkan saat dibuat.
  const idAset: Record<string, typeof s.assets.$inferSelect> = {};
  for (const a of ASET_DEMO) {
    const area = a.area ? AREA_DEMO.find((x) => x.kode === a.area)! : null;
    const nyata = tempatNyata.get(a.kode);
    const [lng, lat] = nyata ? [nyata.lng, nyata.lat] : a.titik ? keLngLat(...a.titik) : [null, null];
    const nilai = {
      divisionId: div[PEMILIK_TIPE[a.tipe]] ?? null,
      gedung: nyata ? (nyata.namaArea ?? (a.tipe === "mobil_pemadam" ? null : (area?.nama ?? null))) : (area?.nama ?? null),
      areaId: nyata ? nyata.areaId : a.area ? idArea[a.area]! : null,
      lantai: a.lantai,
      lokasiTeks: a.lokasiTeks,
      lokasiTipe: a.tipe === "mobil_pemadam" ? ("kendaraan" as const) : area?.jenis === "bengkel" ? ("bengkel" as const) : area && area.jenis !== "gedung" ? ("area_terbuka" as const) : ("dalam_gedung" as const),
      lat,
      lng,
      attributes: a.atribut,
      tglExpired: a.tipe === "apar" ? "2027-06-30" : null,
      aktif: true,
    };
    const [r] = await tx
      .insert(s.assets)
      .values({ assetTypeId: tipe[a.tipe]!.id, kode: a.kode, qrToken: buatTokenQr(), ...nilai })
      .onConflictDoUpdate({ target: [s.assets.assetTypeId, s.assets.kode], set: nilai })
      .returning();
    idAset[a.kode] = r!;
    const [{ baru }] = (await tx.select({ baru: sql<boolean>`${s.assets.createdAt} >= now()` }).from(s.assets).where(eq(s.assets.id, r!.id))) as [{ baru: boolean }];
    if (baru) TAMBAH(h, "aset");
  }
  const idAsetDemo = Object.values(idAset).map((a) => a.id);

  // Data operasional dibuat sekali.
  const [{ n }] = (await tx.select({ n: sql<number>`count(*)::int` }).from(s.inspections).where(inArray(s.inspections.assetId, idAsetDemo))) as [{ n: number }];
  if (n > 0) {
    console.log("Inspeksi demo sudah ada: data operasional dilewati (jalankan reset demo untuk membuat ulang).");
    return h;
  }

  const butirPerTipe = new Map<number, Butir[]>();
  const butir = async (tipeId: number) => {
    if (!butirPerTipe.has(tipeId)) {
      const rows = await tx
        .select({ i: s.checklistItems })
        .from(s.checklistItems)
        .innerJoin(s.checklistGroups, eq(s.checklistGroups.id, s.checklistItems.checklistGroupId))
        .where(and(eq(s.checklistGroups.assetTypeId, tipeId), eq(s.checklistItems.aktif, true)))
        .orderBy(s.checklistItems.urut);
      butirPerTipe.set(tipeId, rows.map((r) => r.i));
    }
    return butirPerTipe.get(tipeId)!;
  };
  const langkah = async (tipeId: number) => {
    const rows = await tx
      .select({ id: s.photoSteps.id, item: s.photoStepItems.checklistItemId })
      .from(s.photoSteps)
      .leftJoin(s.photoStepItems, eq(s.photoStepItems.stepId, s.photoSteps.id))
      .where(and(eq(s.photoSteps.assetTypeId, tipeId), eq(s.photoSteps.aktif, true)))
      .orderBy(s.photoSteps.urut);
    const per = new Map<number, number[]>();
    for (const r of rows) per.set(r.id, [...(per.get(r.id) ?? []), ...(r.item ? [r.item] : [])]);
    return [...per.entries()];
  };

  const hariIni = hariIniJakarta(now);
  const periodeKini = periodeDari(hariIni);
  const awalBulan = new Date(`${periodeKini}T01:00:00+07:00`);
  const [y, m] = periodeKini.split("-").map(Number) as [number, number];
  const periodeLalu = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}-01`;
  const waktu = (sk: SkenarioDemo) =>
    sk.bulanLalu
      ? new Date(`${periodeLalu.slice(0, 8)}${String(sk.bulanLalu).padStart(2, "0")}T09:${String(sk.bulanLalu % 60).padStart(2, "0")}:00+07:00`)
      : new Date(Math.max(now.getTime() - sk.jamLalu * 3600_000, awalBulan.getTime() + sk.jamLalu * 60_000));
  const kawasanDemo = AREA_DEMO.find((a) => a.jenis === "kawasan")!.geometri;
  const terakhir = new Map<number, Date>();
  const selesai = new Map<string, string>(); // `${assetId}|${periode}` -> inspectionId

  for (const sk of SKENARIO_DEMO) {
    const def = ASET_DEMO.find((a) => a.kode === sk.aset)!;
    const aset = idAset[sk.aset]!;
    const t = waktu(sk);
    const areaDef = def.area ? AREA_DEMO.find((a) => a.kode === def.area)! : null;
    // Denah pemilik: posisi skenario digeser bersama asetnya (selisih meter yang sama), lalu diukur
    // terhadap poligon nyata, supaya hasil gerbang tetap masuk akal.
    const nyata = tempatNyata.get(sk.aset);
    let [plng, plat] = keLngLat(...sk.posisi);
    if (nyata) {
      const [ax, ay] = def.titik ?? sk.posisi;
      const [dx, dy] = [sk.posisi[0] - ax, sk.posisi[1] - ay];
      plat = Number((nyata.lat + dy / 111_320).toFixed(7));
      plng = Number((nyata.lng + dx / (111_320 * Math.cos((nyata.lat * Math.PI) / 180))).toFixed(7));
    }
    const pt = { lat: plat, lng: plng };
    const areaNyata = nyata?.areaId != null ? (denahNyata?.bangunan.find((b) => b.id === nyata.areaId) ?? null) : null;
    const geomArea = nyata ? (areaNyata?.polygon ?? null) : (areaDef?.geometri ?? null);
    const terdeteksiNyata = nyata
      ? (denahNyata?.bangunan.filter((b) => titikDalamPoligon(pt, b.polygon)).sort((a, b) => luasM2(a.polygon) - luasM2(b.polygon))[0] ?? null)
      : null;
    const terdeteksi = nyata
      ? null
      : AREA_DEMO.filter((a) => a.jenis !== "kawasan" && a.disetujui && titikDalamPoligon(pt, a.geometri)).sort(
          (a, b) => luasM2(a.geometri) - luasM2(b.geometri),
        )[0];
    const userId = pengguna[PEMILIK_TIPE[def.tipe] === "MATRA" ? "inspektur.matra" : "inspektur.satpk"]!;
    const daftarButir = await butir(aset.assetTypeId);
    const tipeKotak = ((def.atribut.tipe_kotak as string) ?? "A") as "A" | "B" | "C";
    let sisaBuruk = sk.buruk ?? 0;
    const temuan: { b: Butir; item: string; severity: Severity }[] = [];
    const jawabanList = daftarButir.map((b) => {
      const buruk = sisaBuruk > 0 && bisaBuruk(b);
      if (buruk) sisaBuruk--;
      const r = jawaban(b, tipeKotak, buruk);
      if (r.temuan) temuan.push({ b, ...r.temuan });
      return r.j;
    });
    const kesimpulan: Kesimpulan = temuan.some((x) => x.severity === "berat") ? "tidak_layak" : temuan.length ? "layak_catatan" : "layak";
    const terbatas = nyata ? !!areaNyata?.restricted : !!areaDef?.restricted;
    const final = !sk.ditolak;
    const [ins] = await tx
      .insert(s.inspections)
      .values({
        assetId: aset.id,
        userId,
        status: final ? "final" : "draf",
        scannedAtDevice: new Date(t.getTime() - 300_000),
        submittedAtDevice: final ? t : null,
        receivedAt: final ? t : null,
        inspectedAt: final ? t : null,
        mulaiPada: new Date(t.getTime() - 300_000),
        durasiDetik: final ? 300 : null,
        gpsLat: plat,
        gpsLng: plng,
        gpsAccuracy: sk.akurasi,
        gpsCapturedAt: t,
        jarakM: geomArea ? Math.round(jarakKeAreaM(pt, geomArea)) : null,
        jarakKeAreaM: geomArea ? Math.round(jarakKeAreaM(pt, geomArea)) : null,
        gateStatus: final ? sk.gate : "tanpa_gps",
        gateAlasan: final ? (sk.alasan ?? null) : null,
        detectedAreaId: terdeteksiNyata ? terdeteksiNyata.id : terdeteksi ? idArea[terdeteksi.kode]! : null,
        restrictedArea: final && terbatas,
        qrVerified: true,
        qrVerification: "online",
        kesimpulan: final ? kesimpulan : null,
        catatan: temuan.length ? "Temuan dicatat saat inspeksi (data demo)." : null,
        rekomendasi: temuan.length ? "Tindak lanjuti sebelum periode berikutnya." : null,
        hasilTinjauan: sk.tinjauan?.hasil ?? null,
        ditinjauPada: sk.tinjauan ? new Date(t.getTime() + 2 * 3600_000) : null,
        ditinjauOleh: sk.tinjauan ? pengguna[sk.tinjauan.oleh]! : null,
        catatanReview: sk.tinjauan?.catatan ?? null,
      })
      .returning({ id: s.inspections.id });
    TAMBAH(h, final ? "inspeksi_final" : "inspeksi_draf_ditolak");
    await tx.insert(s.inspectionAnswers).values(jawabanList.map((j) => ({ ...j, inspectionId: ins!.id, checklistItemId: j.checklistItemId!, answeredAtDevice: t })));
    TAMBAH(h, "jawaban", jawabanList.length);

    if (!final) {
      await tx.insert(s.auditLogs).values({
        userId,
        aksi: "inspeksi.ditolak_lokasi",
        entitas: "inspeksi",
        entitasId: ins!.id,
        data: { demo: true, assetId: aset.id, akurasi: sk.akurasi, jarakKeKawasanM: Math.round(jarakKeAreaM(pt, denahNyata && nyata ? denahNyata.kawasan : kawasanDemo)) },
        createdAt: t,
      });
      TAMBAH(h, "audit");
      continue;
    }

    // Foto pengganti per langkah kamera terpandu (area terbatas: tanpa foto).
    if (!terbatas) {
      for (const [stepId, items] of await langkah(aset.assetTypeId)) {
        const fotoId = crypto.randomUUID();
        const key = kunciFoto(ins!.id, fotoId, "png");
        if (opsi.simpanFoto) await opsi.simpanFoto(key, opsi.fotoContoh, "image/png");
        await tx.insert(s.inspectionPhotos).values({
          id: fotoId,
          inspectionId: ins!.id,
          storageKey: key,
          sha256: sha256Hex(opsi.fotoContoh),
          contentType: "image/png",
          bytes: opsi.fotoContoh.byteLength,
          width: 192,
          height: 192,
          stepId,
          takenAtDevice: t,
          lat: plat,
          lng: plng,
          gpsAccuracy: sk.akurasi,
        });
        if (items.length) await tx.insert(s.inspectionPhotoItems).values(items.map((checklistItemId) => ({ photoId: fotoId, checklistItemId })));
        TAMBAH(h, "foto");
      }
    }

    for (const x of temuan) {
      const status = sk.status_temuan ?? "terbuka";
      const [issue] = await tx
        .insert(s.issues)
        .values({
          assetId: aset.id,
          inspectionId: ins!.id,
          checklistItemId: x.b.id,
          item: x.item,
          severity: x.severity,
          lokasi: [nyata?.namaArea ?? areaDef?.nama, labelLantai(def.lantai), def.lokasiTeks].filter(Boolean).join(" · "),
          tindakanRekomendasi: (x.b.tindakanBawaan ?? "perbaiki") as TindakanRekomendasi,
          status,
          targetSelesai: hariIniJakarta(new Date(t.getTime() + 7 * 86400_000)),
          selesaiPada: status === "selesai" ? new Date(t.getTime() + 3 * 86400_000) : null,
          createdAt: t,
        })
        .returning({ id: s.issues.id });
      TAMBAH(h, "temuan");
      if (status !== "terbuka") {
        await tx.insert(s.issueEvents).values({
          issueId: issue!.id,
          userId: pengguna.admin,
          aksi: "status",
          dari: { status: "terbuka" },
          ke: { status, catatan: status === "selesai" ? "Sudah diganti/diisi ulang (demo)." : "Diajukan ke vendor (demo)." },
          createdAt: new Date(t.getTime() + 86400_000),
        });
        TAMBAH(h, "riwayat_temuan");
      }
    }

    await tx.insert(s.auditLogs).values({
      userId,
      aksi: "inspeksi.final",
      entitas: "inspeksi",
      entitasId: ins!.id,
      data: { demo: true, assetId: aset.id, gateStatus: sk.gate, gateAlasan: sk.alasan ?? null },
      createdAt: t,
    });
    TAMBAH(h, "audit");
    if (sk.tinjauan) {
      await tx.insert(s.auditLogs).values({
        userId: pengguna[sk.tinjauan.oleh]!,
        aksi: "inspeksi.tinjau",
        entitas: "inspeksi",
        entitasId: ins!.id,
        data: { demo: true, hasil: sk.tinjauan.hasil, catatan: sk.tinjauan.catatan },
        createdAt: new Date(t.getTime() + 2 * 3600_000),
      });
      TAMBAH(h, "audit");
    }
    if (!terakhir.get(aset.id) || terakhir.get(aset.id)! < t) terakhir.set(aset.id, t);
    selesai.set(`${aset.id}|${periodeDari(hariIniJakarta(t))}`, ins!.id);
  }

  for (const [id, t] of terakhir) await tx.update(s.assets).set({ terakhirDicek: hariIniJakarta(t) }).where(eq(s.assets.id, id));

  // Jadwal bulan lalu dan bulan berjalan untuk aset demo yang tidak bergerak.
  for (const a of ASET_DEMO.filter((x) => x.tipe !== "mobil_pemadam")) {
    const aset = idAset[a.kode]!;
    for (const periode of [periodeLalu, periodeKini]) {
      const ins = selesai.get(`${aset.id}|${periode}`);
      await tx
        .insert(s.schedules)
        .values({
          assetId: aset.id,
          periode,
          jatuhTempo: jatuhTempo(periode, tipe[a.tipe]!.periodeHari),
          inspectionId: ins ?? null,
          status: ins ? "selesai" : periode === periodeLalu ? "telat" : "belum",
        })
        .onConflictDoNothing();
      TAMBAH(h, "jadwal");
    }
  }

  // Jejak audit pembuatan denah demo.
  for (const a of AREA_DEMO.filter((x) => x.disetujui)) {
    await tx.insert(s.auditLogs).values({ userId: pengguna.admin, aksi: "area.setujui", entitas: "area", entitasId: String(idArea[a.kode]), data: { demo: true } });
    TAMBAH(h, "audit");
  }
  return h;
}

/* ---------- reset ---------- */

/** Menghapus HANYA baris demo. Mengembalikan hitungan dan kunci foto yang perlu dihapus dari penyimpanan. */
export async function hapusDemo(tx: Tx): Promise<{ hitungan: Hitungan; kunciFoto: string[] }> {
  const h: Hitungan = {};
  const aset = await tx.select({ id: s.assets.id }).from(s.assets).where(like(s.assets.kode, `${AWALAN_DEMO}%`));
  const idAset = aset.map((a) => a.id);
  const kunci: string[] = [];
  // Inspeksi oleh akun sungguhan (bukan akun demo) pada aset demo adalah data nyata: jangan dihapus
  // diam-diam bersama demo (audit 19 Nov 2026, S7). Pindahkan atau hapus manual dulu.
  if (idAset.length) {
    const [{ n }] = (await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(s.inspections)
      .innerJoin(s.users, eq(s.users.id, s.inspections.userId))
      .where(and(inArray(s.inspections.assetId, idAset), eq(s.users.isDemo, false)))) as [{ n: number }];
    if (n > 0) throw new Error(`Ada ${n} inspeksi oleh akun non-demo pada aset demo. Reset demo dibatalkan; tidak ada yang dihapus.`);
  }
  // Pemicu audit_logs_tambah_saja (migrasi 0004) hanya mengizinkan penghapusan baris contoh demo
  // bila sesi ini menyalakannya; berlaku sampai transaksi selesai.
  await tx.execute(sql`select set_config('palk3.hapus_audit_demo', 'ya', true)`);
  if (idAset.length) {
    const ins = await tx.select({ id: s.inspections.id }).from(s.inspections).where(inArray(s.inspections.assetId, idAset));
    const idIns = ins.map((i) => i.id);
    if (idIns.length) {
      const foto = await tx.select({ key: s.inspectionPhotos.storageKey }).from(s.inspectionPhotos).where(inArray(s.inspectionPhotos.inspectionId, idIns));
      kunci.push(...foto.map((f) => f.key));
      h.foto = foto.length;
    }
    // Riwayat temuan, jawaban, foto, dan butir foto ikut terhapus (on delete cascade).
    h.temuan = (await tx.delete(s.issues).where(inArray(s.issues.assetId, idAset)).returning({ id: s.issues.id })).length;
    h.jadwal = (await tx.delete(s.schedules).where(inArray(s.schedules.assetId, idAset)).returning({ id: s.schedules.id })).length;
    if (idIns.length) h.inspeksi = (await tx.delete(s.inspections).where(inArray(s.inspections.id, idIns)).returning({ id: s.inspections.id })).length;
    h.aset = (await tx.delete(s.assets).where(inArray(s.assets.id, idAset)).returning({ id: s.assets.id })).length;
  }
  h.audit = (await tx.delete(s.auditLogs).where(sql`${s.auditLogs.data}->>'demo' = 'true'`).returning({ id: s.auditLogs.id })).length;
  h.area = (await tx.delete(s.areas).where(like(s.areas.kode, `${AWALAN_DEMO}%`)).returning({ id: s.areas.id })).length;
  // Akun demo tambahan: hanya bila sudah tidak punya inspeksi (inspeksi non-demo tidak pernah dihapus).
  const akun = await tx
    .select({ id: s.users.id })
    .from(s.users)
    .where(and(inArray(s.users.nip, AKUN_DEMO.map((a) => a.nip)), eq(s.users.isDemo, true)));
  let nAkun = 0;
  for (const a of akun) {
    const [{ n }] = (await tx.select({ n: sql<number>`count(*)::int` }).from(s.inspections).where(eq(s.inspections.userId, a.id))) as [{ n: number }];
    if (n > 0) continue;
    await tx.delete(s.syncReceipts).where(eq(s.syncReceipts.userId, a.id));
    await tx.delete(s.users).where(and(eq(s.users.id, a.id), ne(s.users.isDemo, false)));
    nAkun++;
  }
  h.akun = nAkun;
  return { hitungan: h, kunciFoto: kunci };
}

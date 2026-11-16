import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { masuk } from "../helpers";
import { aset, q, tutup } from "../db-uji";

/** SPEC §7.5/§7.11 + ACCEPTANCE N8: Idempotency-Key dan finalisasi idempoten di peladen. */
test.afterAll(tutup);

test("Idempotency-Key: ulangan sama → respons tersimpan; isi berbeda → 422; finalize ganda → hasil sama", async ({ page }) => {
  const a = await aset("23D");
  await masuk(page, "inspektur");
  const api = page.request;
  const id = randomUUID();
  const kunci = randomUUID();

  const start = () =>
    api.post("/api/inspections/start", { headers: { "Idempotency-Key": kunci }, data: { inspectionId: id, token: a.token } });
  const r1 = await start();
  expect(r1.status()).toBe(200);
  const r2 = await start();
  expect(r2.headers()["idempotent-replay"]).toBe("true");
  expect(await r2.json()).toEqual(await r1.json());

  const beda = await api.post("/api/inspections/start", {
    headers: { "Idempotency-Key": kunci },
    data: { inspectionId: randomUUID(), token: a.token },
  });
  expect(beda.status()).toBe(422);

  // Token tak dikenal → 410, tanpa membuat draf
  const asing = await api.post("/api/inspections/start", { data: { inspectionId: randomUUID(), token: "PAL-K3-" + "0".repeat(32) } });
  expect(asing.status()).toBe(410);

  // Foto dengan hash salah ditolak; hash benar diterima dua kali tanpa duplikat
  const foto = readFileSync("public/icons/icon-192.png");
  const fotoId = randomUUID();
  const salah = await api.put(`/api/inspections/${id}/photos/${fotoId}`, {
    headers: { "Content-Type": "image/png", "X-Sha256": "0".repeat(64) },
    data: foto,
  });
  expect(salah.status()).toBe(422);
  for (let i = 0; i < 2; i++) {
    const ok = await api.put(`/api/inspections/${id}/photos/${fotoId}`, {
      headers: { "Content-Type": "image/png", "X-Sha256": createHash("sha256").update(foto).digest("hex") },
      data: foto,
    });
    expect(ok.status()).toBe(200);
  }
  expect(await q("select 1 from inspection_photos where inspection_id = $1", [id])).toHaveLength(1);

  const items = await q<{ id: number; answer_type: string; options: string[] | null }>(
    "select i.id, i.answer_type, i.options from checklist_items i join checklist_groups g on g.id = i.checklist_group_id join assets a on a.asset_type_id = g.asset_type_id where a.id = $1 and i.aktif",
    [a.id],
  );
  const body = {
    assetId: a.id,
    token: a.token,
    submittedAtDevice: new Date().toISOString(),
    answers: items.map((i) => ({ checklistItemId: i.id, nilai: i.answer_type === "select" ? i.options![0] : "ok" })),
    photoIds: [fotoId],
    kesimpulan: "layak",
  };
  // Kesimpulan "layak" tanpa satu butir wajib → 422 dengan pesan peladen
  const kurang = await api.post(`/api/inspections/${id}/finalize`, { data: { ...body, answers: body.answers.slice(1) } });
  expect(kurang.status()).toBe(422);
  expect((await kurang.json()).pesan).toContain("Masih ada pemeriksaan yang belum diisi");

  const f1 = await api.post(`/api/inspections/${id}/finalize`, { headers: { "Idempotency-Key": randomUUID() }, data: body });
  expect(f1.status()).toBe(200);
  const f2 = await api.post(`/api/inspections/${id}/finalize`, { headers: { "Idempotency-Key": randomUUID() }, data: body });
  expect(await f2.json()).toEqual(await f1.json());
  expect(await q("select 1 from issues where inspection_id = $1", [id])).toHaveLength(0);

  // Final menolak perubahan foto dan tidak bisa dibuang
  expect((await api.delete(`/api/inspections/${id}/photos/${fotoId}`)).status()).toBe(422);
  expect((await api.delete(`/api/inspections/${id}`)).status()).toBe(403);
});

test("tanpa sesi: 401 JSON, bukan pengalihan", async ({ request }) => {
  const r = await request.get("/api/field/bundle", { maxRedirects: 0 });
  expect(r.status()).toBe(401);
  expect((await r.json()).kode).toBe("sesi_habis");
});

test("paket kerja tidak memuat token mentah", async ({ page }) => {
  const a = await aset("01D");
  await masuk(page, "inspektur");
  const teks = await (await page.request.get("/api/field/bundle")).text();
  expect(teks).not.toContain(a.token);
  expect(JSON.parse(teks).aset.length).toBeGreaterThanOrEqual(35);
});

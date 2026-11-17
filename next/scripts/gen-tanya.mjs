/**
 * Membangkitkan src/features/tanya/pertanyaan.ts dari catatan enowX "PAL-K3 — Pertanyaan untuk
 * Rifaldy (grill-me)" (fd419274265a). Pakai:
 *   "$ENOWX_BIN" notes show fd419274265a > /tmp/tanya.md
 *   node scripts/gen-tanya.mjs /tmp/tanya.md
 */
import { readFileSync, writeFileSync } from "node:fs";

const md = readFileSync(process.argv[2], "utf8").split("\n");
const bersih = (s) =>
    s
        .replace(/:icon\[[^\]]*\]\s*/g, "")
        .replace(/\{\{WAJIB\}\}\s*/g, "")
        .trim();

const caraMenjawab = [];
const bahan = [];
const bagian = [];
const pertanyaan = [];
let mode = null;
let bagianNow = null;
let q = null;

for (const raw of md) {
    const line = raw.replace(/\s+$/, "");
    if (line.startsWith(":::callout") && line.includes("Cara menjawab")) {
        mode = "cara";
        continue;
    }
    if (mode === "cara") {
        if (line === ":::") {
            mode = null;
            continue;
        }
        const m = line.match(/^\d+\.\s+(.*)$/);
        if (m) caraMenjawab.push(m[1]);
        continue;
    }
    if (line.startsWith("::tab ")) {
        q = null;
        const t = line.slice(6).trim();
        const m = t.match(/^(\d+)\.\s+(.*)$/);
        if (m) {
            bagianNow = { nomor: m[1], judul: m[2], ringkasan: "" };
            bagian.push(bagianNow);
            mode = "bagian";
        } else if (t === "Bahan dibawa") {
            mode = "bahan";
            bagianNow = null;
        } else {
            mode = null;
            bagianNow = null;
        }
        continue;
    }
    if (mode === "bahan") {
        const m = line.match(/^- \[[ x]\] (.*)$/);
        if (m) bahan.push(m[1]);
        continue;
    }
    if (mode !== "bagian") continue;
    if (line.startsWith("## ")) continue;
    const mq = line.match(/^- \[[ x]\] \*\*(\d+\.\d+)\*\*\s+(.*)$/);
    if (mq) {
        q = {
            nomor: mq[1],
            bagian: bagianNow.nomor,
            wajib: mq[2].includes("{{WAJIB}}"),
            teks: bersih(mq[2]),
            kenapa: "",
            pilihanTeks: null,
            pilihan: [],
            bawaan: "",
            memblokir: "",
        };
        pertanyaan.push(q);
        continue;
    }
    if (!q && line && !line.startsWith("-") && !bagianNow.ringkasan) {
        bagianNow.ringkasan = line.trim();
        continue;
    }
    if (!q) continue;
    const f = line.match(
        /^\s+- \*(Kenapa penting|Pilihan|Kalau tidak dijawab, kami pakai|Memblokir|Jawaban):\*\s*(.*)$/,
    );
    if (!f) continue;
    const [, kunci, isi] = f;
    if (kunci === "Kenapa penting") q.kenapa = isi;
    if (kunci === "Kalau tidak dijawab, kami pakai") q.bawaan = isi;
    if (kunci === "Memblokir") q.memblokir = isi;
    if (kunci === "Pilihan") {
        q.pilihanTeks = isi;
        // "a) ...; b) ...; c) ..." menjadi pilihan yang bisa diklik.
        if (/^a\)\s/.test(isi)) {
            q.pilihan = isi.split(/;\s*(?=[a-z]\)\s)/).map((p) => {
                const m = p.match(/^([a-z])\)\s*(.*?)\.?$/);
                return { kode: m[1], label: m[2] };
            });
        }
    }
}

if (pertanyaan.length !== 73) throw new Error(`Diharapkan 73 pertanyaan, dapat ${pertanyaan.length}`);
if (pertanyaan.filter((p) => p.wajib).length !== 15) throw new Error("Diharapkan 15 WAJIB");

const out = `/**
 * DIBANGKITKAN oleh scripts/gen-tanya.mjs dari catatan enowX fd419274265a
 * ("PAL-K3 — Pertanyaan untuk Rifaldy (grill-me)"). Jangan disunting tangan: ubah catatannya,
 * lalu bangkitkan ulang.
 */
import type { Bagian, Pertanyaan } from "./types";

export const CARA_MENJAWAB: string[] = ${JSON.stringify(caraMenjawab, null, 2)};

export const BAHAN_DIBAWA: string[] = ${JSON.stringify(bahan, null, 2)};

export const BAGIAN: Bagian[] = ${JSON.stringify(bagian, null, 2)};

export const PERTANYAAN: Pertanyaan[] = ${JSON.stringify(pertanyaan, null, 2)};
`;
writeFileSync(new URL("../src/features/tanya/pertanyaan.ts", import.meta.url), out);
console.log(
    `${pertanyaan.length} pertanyaan, ${bagian.length} bagian, ${bahan.length} bahan, ${caraMenjawab.length} cara`,
);

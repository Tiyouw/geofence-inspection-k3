import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { bacaFoto } from "@/lib/storage/photos";
import { ambilKartu, fotoUntukTemuan, type DataPeriodeLengkap } from "../queries";
import { rakitKartu } from "../rakit";
import { daftarkanFont } from "./dasar";
import { DokumenKartu } from "./kartu";
import { DokumenPms } from "./pms";
import { DokumenProgres, type IsiProgres } from "./progres";
import { DokumenRekap, type FotoLampiran, type IsiRekap } from "./rekap";
import { DokumenRekapP3k } from "./rekap-p3k";
import type { rakitRekapP3k } from "../rekap-p3k";

/** Batas foto di lampiran supaya PDF tetap kecil dan fungsi tidak kehabisan waktu. */
const MAKS_FOTO_LAMPIRAN = 40;

export async function renderPms(data: DataPeriodeLengkap, dicetak: Date): Promise<Buffer> {
  daftarkanFont();
  return renderToBuffer(<DokumenPms data={data} dicetak={dicetak} />);
}

async function keBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  return Buffer.from(await new Response(stream).arrayBuffer());
}

export async function renderRekap(isi: IsiRekap, dicetak: Date, denganFoto: boolean): Promise<Buffer> {
  daftarkanFont();
  const { baris } = isi.rekap;
  let foto: Map<number, FotoLampiran[]> | null = null;
  if (denganFoto && baris.length) {
    foto = new Map();
    const sumber = await fotoUntukTemuan(baris.map((b) => b.temuan.id));
    let sisa = MAKS_FOTO_LAMPIRAN;
    for (const b of baris) {
      for (const f of sumber.get(b.temuan.id) ?? []) {
        // react-pdf hanya membaca JPEG dan PNG; foto lain dilewati.
        const format = f.contentType === "image/png" ? "png" : f.contentType === "image/jpeg" ? "jpg" : null;
        if (!format || sisa <= 0) continue;
        const berkas = await bacaFoto(f.storageKey);
        if (!berkas) continue;
        const list = foto.get(b.temuan.id) ?? [];
        list.push({ data: await keBuffer(berkas.stream), format, diunggah: f.uploadedAt });
        foto.set(b.temuan.id, list);
        sisa--;
      }
    }
  }
  return renderToBuffer(<DokumenRekap isi={isi} dicetak={dicetak} foto={foto} />);
}

export async function renderKartu(assetId: number, tahun: number, dicetak: Date): Promise<{ buffer: Buffer; kode: string } | null> {
  daftarkanFont();
  const kartu = await ambilKartu(assetId, tahun);
  if (!kartu) return null;
  const baris = rakitKartu(tahun, kartu.inspeksi, dicetak);
  const buffer = await renderToBuffer(<DokumenKartu kartu={kartu} tahun={tahun} baris={baris} dicetak={dicetak} />);
  return { buffer, kode: kartu.aset.kode };
}

export async function renderRekapP3k(rekap: ReturnType<typeof rakitRekapP3k>, judulPeriode: string, gedung: string | null, dicetak: Date): Promise<Buffer> {
  daftarkanFont();
  return renderToBuffer(<DokumenRekapP3k rekap={rekap} judulPeriode={judulPeriode} gedung={gedung} dicetak={dicetak} />);
}

export async function renderProgres(isi: IsiProgres, dicetak: Date): Promise<Buffer> {
  daftarkanFont();
  return renderToBuffer(<DokumenProgres isi={isi} dicetak={dicetak} />);
}

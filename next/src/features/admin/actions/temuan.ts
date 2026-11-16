"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { assets, issueEvents, issues, users } from "@/db/schema";
import { hariIniJakarta } from "@/lib/format";
import { skemaPicTemuan, skemaStatusTemuan, skemaTemuanBaru, skemaTenggat } from "../lib/skema";
import { LABEL_STATUS_TEMUAN, bolehTransisi, butuhUraian } from "../lib/temuan";
import { aksiAdmin, catatAudit, dariForm, type HasilAksi } from "../server/aksi";

function segarkan(id?: number) {
  revalidatePath("/admin");
  revalidatePath("/admin/temuan");
  if (id) revalidatePath(`/admin/temuan/${id}`);
}

const TIDAK_ADA: HasilAksi<never> = { ok: false, status: 404, pesan: "Temuan tidak ditemukan." };

/** Tetapkan tenggat (I5): tanggal ≥ hari ini (WIB). Status tidak berubah. */
export async function tetapkanTenggat(_prev: unknown, fd: FormData): Promise<HasilAksi> {
  return aksiAdmin(skemaTenggat, dariForm(fd), async (d, user) => {
    if (d.targetSelesai < hariIniJakarta()) {
      return { ok: false, status: 422, pesan: "Periksa kembali isian yang ditandai.", galat: { targetSelesai: ["Tenggat tidak boleh sebelum hari ini."] } };
    }
    const ok = await db.transaction(async (tx) => {
      const [lama] = await tx.select().from(issues).where(eq(issues.id, d.id)).for("update");
      if (!lama) return false;
      await tx.update(issues).set({ targetSelesai: d.targetSelesai }).where(eq(issues.id, d.id));
      await tx.insert(issueEvents).values({ issueId: d.id, userId: user.id, aksi: "tenggat", dari: lama.targetSelesai, ke: d.targetSelesai });
      return true;
    });
    if (!ok) return TIDAK_ADA;
    segarkan(d.id);
    return { ok: true, pesan: "Tenggat tersimpan." };
  });
}

/**
 * Pindah status (H9, I5): terbuka → proses → selesai, langsung selesai, dikembalikan, dibuka kembali.
 * Menyelesaikan dan membuka kembali wajib uraian ≥ 10 karakter; selesai menyimpan uraian sebagai tindak lanjut.
 */
export async function ubahStatusTemuan(_prev: unknown, fd: FormData): Promise<HasilAksi> {
  return aksiAdmin(skemaStatusTemuan, dariForm(fd), async (d, user) => {
    const hasil = await db.transaction(async (tx): Promise<HasilAksi> => {
      const [lama] = await tx.select().from(issues).where(eq(issues.id, d.id)).for("update");
      if (!lama) return TIDAK_ADA;
      if (!bolehTransisi(lama.status, d.ke)) {
        return { ok: false, status: 409, pesan: `Temuan berstatus ${LABEL_STATUS_TEMUAN[lama.status]} tidak bisa diubah menjadi ${LABEL_STATUS_TEMUAN[d.ke]}.` };
      }
      if (butuhUraian(d.ke, lama.status) && (d.uraian ?? "").length < 10) {
        return { ok: false, status: 422, pesan: "Periksa kembali isian yang ditandai.", galat: { uraian: ["Uraian minimal 10 karakter."] } };
      }
      await tx
        .update(issues)
        .set({
          status: d.ke,
          selesaiPada: d.ke === "selesai" ? new Date() : null,
          ...(d.ke === "selesai" ? { tindakLanjut: d.uraian } : {}),
        })
        .where(eq(issues.id, d.id));
      await tx.insert(issueEvents).values({
        issueId: d.id,
        userId: user.id,
        aksi: "status",
        dari: lama.status,
        ke: { status: d.ke, ...(d.uraian ? { uraian: d.uraian } : {}) },
      });
      return { ok: true, pesan: `Status temuan: ${LABEL_STATUS_TEMUAN[d.ke]}.` };
    });
    if (hasil.ok) segarkan(d.id);
    return hasil;
  });
}

/** PIC opsional: akun aktif mana pun, atau dikosongkan. */
export async function tetapkanPic(_prev: unknown, fd: FormData): Promise<HasilAksi> {
  return aksiAdmin(skemaPicTemuan, dariForm(fd), async (d, user) => {
    const hasil = await db.transaction(async (tx): Promise<HasilAksi> => {
      const [lama] = await tx.select().from(issues).where(eq(issues.id, d.id)).for("update");
      if (!lama) return TIDAK_ADA;
      if (d.picUserId) {
        const [u] = await tx.select({ id: users.id }).from(users).where(and(eq(users.id, d.picUserId), eq(users.aktif, true)));
        if (!u) return { ok: false, status: 422, pesan: "Periksa kembali isian yang ditandai.", galat: { picUserId: ["Penanggung jawab tidak dikenal atau nonaktif."] } };
      }
      await tx.update(issues).set({ picUserId: d.picUserId }).where(eq(issues.id, d.id));
      await tx.insert(issueEvents).values({ issueId: d.id, userId: user.id, aksi: "pic", dari: lama.picUserId, ke: d.picUserId });
      return { ok: true, pesan: "Penanggung jawab tersimpan." };
    });
    if (hasil.ok) segarkan(d.id);
    return hasil;
  });
}

/** Temuan manual dari panel (mis. laporan lisan), dengan pilihan terkontrol (H9). */
export async function buatTemuan(_prev: unknown, fd: FormData): Promise<HasilAksi<{ id: number }>> {
  return aksiAdmin(skemaTemuanBaru, dariForm(fd), async (d, user) => {
    if (d.targetSelesai && d.targetSelesai < hariIniJakarta()) {
      return { ok: false, status: 422, pesan: "Periksa kembali isian yang ditandai.", galat: { targetSelesai: ["Tenggat tidak boleh sebelum hari ini."] } };
    }
    const hasil = await db.transaction(async (tx): Promise<HasilAksi<{ id: number }>> => {
      const [a] = await tx.select({ id: assets.id, kode: assets.kode }).from(assets).where(eq(assets.id, d.assetId));
      if (!a) return { ok: false, status: 422, pesan: "Periksa kembali isian yang ditandai.", galat: { assetId: ["Aset tidak dikenal."] } };
      const [t] = await tx
        .insert(issues)
        .values({
          assetId: d.assetId,
          item: d.item,
          severity: d.severity,
          tindakLanjut: d.tindakLanjut,
          targetSelesai: d.targetSelesai,
          picUserId: d.picUserId,
        })
        .returning({ id: issues.id });
      await tx.insert(issueEvents).values({ issueId: t!.id, userId: user.id, aksi: "buat", ke: { severity: d.severity, item: d.item } });
      await catatAudit(tx, user, "temuan.buat", "issue", t!.id, { kode: a.kode });
      return { ok: true, pesan: "Temuan tersimpan.", data: { id: t!.id } };
    });
    if (hasil.ok) segarkan();
    return hasil;
  });
}

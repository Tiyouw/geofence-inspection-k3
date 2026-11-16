import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/app-shell";
import { buatTemuan } from "@/features/admin/actions/temuan";
import { FormTemuan } from "@/features/admin/components/form-temuan";
import { pilihanTemuan } from "@/features/admin/server/temuan";
import { requireRole } from "@/lib/auth/guards";
import { labelLokasi } from "@/lib/domain/label-aset";
import { hariIniJakarta } from "@/lib/format";

export const metadata: Metadata = { title: "Catat temuan" };

export default async function TemuanBaru() {
  await requireRole("admin");
  const p = await pilihanTemuan();
  return (
    <>
      <PageHeader title="Catat temuan" description="Untuk temuan di luar inspeksi lapangan, mis. laporan langsung dari unit kerja." />
      <FormTemuan
        aksi={buatTemuan}
        aset={p.aset.map((a) => ({ id: a.id, kode: a.kode, lokasi: labelLokasi(a) }))}
        pic={p.pic}
        hariIni={hariIniJakarta()}
      />
    </>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { HalamanPindai } from "@/features/inspeksi/ui/halaman";

export const metadata: Metadata = { title: "Pindai stiker" };

export default function PindaiPage() {
  return (
    <Suspense>
      <HalamanPindai />
    </Suspense>
  );
}

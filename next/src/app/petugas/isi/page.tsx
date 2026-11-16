import type { Metadata } from "next";
import { Suspense } from "react";
import { HalamanIsi } from "@/features/inspeksi/ui/halaman";

export const metadata: Metadata = { title: "Isi inspeksi" };

/** Satu cangkang untuk semua draf (?id=…) supaya bisa disimpan service worker dan dibuka luring. */
export default function IsiPage() {
  return (
    <Suspense>
      <HalamanIsi />
    </Suspense>
  );
}

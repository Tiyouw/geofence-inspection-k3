import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Brand } from "@/components/shell/brand";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/guards";
import { homeFor } from "@/lib/auth/access";

/** Halaman depan publik (stub). Pengguna yang sudah masuk langsung ke beranda perannya. */
export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.role));

  return (
    <main className="flex min-h-dvh flex-col bg-primary text-white">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Brand accentPin />
        <Button asChild variant="brand">
          <Link href="/masuk">Masuk</Link>
        </Button>
      </header>
      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 pb-24">
        <span className="text-[11px] font-semibold tracking-[0.18em] text-[#9eb9c1]">SISTEM INSPEKSI K3 · PT PAL</span>
        <h1 className="mt-5 max-w-3xl text-4xl leading-[1.1] font-medium tracking-tight sm:text-6xl">
          Setiap APAR tercatat, <em className="not-italic text-brand">setiap temuan</em> ditindaklanjuti.
        </h1>
        <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-[#adc2c8]">
          Inspektur memindai QR pada tabung, mengisi checklist dengan dasar hukumnya, dan lokasi diverifikasi otomatis.
          Admin dan pemantau melihat kepatuhan secara langsung.
        </p>
        <div className="mt-10">
          <Button asChild variant="brand" size="lg" className="h-12 px-6">
            <Link href="/masuk">
              Masuk ke aplikasi <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

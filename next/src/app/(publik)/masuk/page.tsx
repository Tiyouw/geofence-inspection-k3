import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/shell/brand";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Masuk" };

const DEMO_ACCOUNTS = [
  { username: "admin", role: "Administrator K3", env: "DEMO_ADMIN_PASSWORD", fallback: "admin123" },
  { username: "pemantau", role: "Pemantau", env: "DEMO_PEMANTAU_PASSWORD", fallback: "pemantau123" },
  { username: "inspektur", role: "Inspektur", env: "DEMO_INSPEKTUR_PASSWORD", fallback: "inspektur123" },
] as const;

export default async function MasukPage({ searchParams }: PageProps<"/masuk">) {
  const { callbackUrl } = await searchParams;
  const demo = process.env.DEMO_MODE === "true";

  return (
    <main className="grid min-h-dvh place-items-center bg-muted px-4 py-6 sm:px-10 sm:py-12">
      <div className="grid w-full max-w-[520px] overflow-hidden rounded-3xl bg-card shadow-[0_18px_70px_#082a3310] md:max-w-[960px] md:grid-cols-[5fr_6fr]">
        <section className="relative flex flex-col overflow-hidden bg-primary p-6 text-primary-foreground md:p-9" aria-hidden="false">
          <Link href="/" className="self-start text-white">
            <Brand accentPin />
          </Link>
          <div className="relative z-10 mt-5 md:mt-14">
            <span className="hidden text-[10px] font-semibold tracking-[0.14em] text-[#9eb9c1] md:block">SISTEM INSPEKSI K3</span>
            <h1 className="text-[28px] leading-tight font-medium tracking-tight md:my-5 md:text-[42px]">
              Setiap APAR <em className="block not-italic text-brand md:inline">siap dipakai.</em>
            </h1>
            <p className="hidden text-[13px] leading-relaxed text-[#adc2c8] md:block">
              Pindai QR di tabung, isi checklist dengan dasar hukumnya, dan bukti lokasi tercatat otomatis.
            </p>
          </div>
          <div aria-hidden className="pointer-events-none absolute -right-28 -bottom-24 hidden size-[340px] rounded-full border border-[#31515a] md:block" />
          <div aria-hidden className="pointer-events-none absolute -right-16 -bottom-10 hidden size-[240px] rounded-full border border-[#31515a] md:block" />
          <div className="mt-auto hidden justify-between gap-4 border-t border-[#29464d] pt-5 text-[10px] text-[#9bb6bd] md:flex">
            <span>Permenaker 4/1980</span>
            <span>NFPA 10</span>
          </div>
        </section>

        <section className="flex flex-col px-6 py-5 md:px-11 md:py-8" aria-labelledby="judul-masuk">
          <Link href="/" className="self-start text-xs text-muted-foreground hover:text-foreground">
            ← Kembali ke beranda
          </Link>
          <div className="my-auto py-4">
            <span className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">PORTAL PETUGAS & PENGELOLA</span>
            <h2 id="judul-masuk" className="mt-3 mb-2 text-[28px] leading-tight font-semibold tracking-tight">
              Siap menjaga keselamatan?
            </h2>
            <p className="mb-6 text-[13px] leading-relaxed text-muted-foreground">
              {demo
                ? "Gunakan salah satu akun demo di bawah untuk mencoba."
                : "Masuk dengan NIP. Anda diarahkan ke halaman sesuai peran Anda."}
            </p>
            <LoginForm callbackUrl={typeof callbackUrl === "string" ? callbackUrl : undefined} demo={demo} />
            {demo ? (
              <aside aria-label="Akun demonstrasi" className="mt-5 rounded-xl border border-[#cbdeda] bg-success-soft p-3.5 text-sm text-[#173f3a]">
                <strong className="mb-2 flex items-baseline justify-between">
                  Akun demo <small className="text-[11px] font-normal text-muted-foreground">nama pengguna / sandi</small>
                </strong>
                {DEMO_ACCOUNTS.map((a) => (
                  <p key={a.username} className="my-1 flex justify-between gap-4">
                    <span>
                      {a.username} <small className="text-muted-foreground">· {a.role}</small>
                    </span>
                    <code className="font-mono text-[13px] select-all">{process.env[a.env] || a.fallback}</code>
                  </p>
                ))}
              </aside>
            ) : (
              <p className="mt-5 text-center text-xs text-muted-foreground">Lupa kata sandi? Hubungi Administrator K3 Divisi K3LH.</p>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">Gunakan akun Anda sendiri untuk setiap pemeriksaan.</p>
        </section>
      </div>
    </main>
  );
}

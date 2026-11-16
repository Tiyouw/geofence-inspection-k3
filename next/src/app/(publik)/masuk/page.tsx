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

/**
 * Satu pintu masuk untuk semua peran (ARCHITECTURE K-01). Tampilan netral: tidak memakai
 * warna peran mana pun; warna peran baru muncul saat peran terdeteksi (login-form.tsx).
 */
export default async function MasukPage({ searchParams }: PageProps<"/masuk">) {
    const { callbackUrl, keluar } = await searchParams;
    const demo = process.env.DEMO_MODE === "true";

    return (
        <main className="grid min-h-dvh place-items-center bg-muted px-4 py-8 sm:px-10">
            <div className="w-full max-w-[440px]">
                <div className="mb-6 flex items-center justify-between">
                    <Link href="/" className="text-foreground" aria-label="Geofencing, halaman depan">
                        <Brand />
                    </Link>
                    <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">
                        ← Kembali ke beranda
                    </Link>
                </div>

                <section
                    className="rounded-2xl border bg-card px-6 py-7 shadow-[0_18px_60px_#0a0a0a0d] sm:px-9 sm:py-9"
                    aria-labelledby="judul-masuk"
                >
                    <span className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">
                        SISTEM INSPEKSI K3 · PT PAL INDONESIA
                    </span>
                    <h1 id="judul-masuk" className="mt-3 mb-2 text-[26px] leading-tight font-semibold tracking-tight">
                        Siap menjaga keselamatan?
                    </h1>
                    <p className="mb-6 text-[13px] leading-relaxed text-muted-foreground">
                        Masuk dengan NIP. Anda diarahkan ke halaman sesuai peran Anda.
                    </p>
                    {keluar === "1" && (
                        <p role="status" className="mb-5 rounded-lg border bg-muted p-3 text-xs">
                            Anda sudah keluar.
                        </p>
                    )}
                    <LoginForm callbackUrl={typeof callbackUrl === "string" ? callbackUrl : undefined} demo={demo} />
                    {demo ? (
                        <aside
                            aria-label="Akun demonstrasi"
                            className="mt-6 rounded-xl border bg-muted/60 p-3.5 text-sm"
                        >
                            <strong className="mb-2 flex items-baseline justify-between font-semibold">
                                Akun demo{" "}
                                <small className="text-[11px] font-normal text-muted-foreground">
                                    nama pengguna / sandi
                                </small>
                            </strong>
                            {DEMO_ACCOUNTS.map((a) => (
                                <p key={a.username} className="my-1 flex justify-between gap-4">
                                    <span>
                                        {a.username} <small className="text-muted-foreground">· {a.role}</small>
                                    </span>
                                    <code className="font-mono text-[13px] select-all">
                                        {process.env[a.env] || a.fallback}
                                    </code>
                                </p>
                            ))}
                        </aside>
                    ) : (
                        <p className="mt-6 text-center text-xs text-muted-foreground">
                            Lupa kata sandi? Hubungi Administrator K3 Divisi K3LH.
                        </p>
                    )}
                </section>
                <p className="mt-4 text-center text-[11px] text-muted-foreground">
                    Gunakan akun Anda sendiri untuk setiap pemeriksaan.
                </p>
            </div>
        </main>
    );
}

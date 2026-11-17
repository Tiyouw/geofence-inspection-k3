"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type CSSProperties, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputSandi } from "@/components/ui/input-sandi";
import { Label } from "@/components/ui/label";
import { PesanMuncul } from "@/components/ui/pesan-muncul";
import { cn } from "@/lib/utils";
import { masuk, type MasukState } from "./actions";
import { DURASI_MEMBUKA_MS, DURASI_TERDETEKSI_MS, PERAN_MASUK } from "./peran";

type Fase = "diam" | "memeriksa" | "terdeteksi" | "membuka";

/**
 * Satu pintu masuk untuk semua peran. Setelah peladen menerima sandi, tampil animasi singkat:
 * "Memeriksa akun…" (selama autentikasi sebenarnya) → "Peran terdeteksi: …" dengan warna peran
 * → "Membuka …" sambil halaman tujuan dimuat. Peran berasal dari jawaban peladen, bukan tebakan
 * klien. Dilewati bila pengguna meminta gerak dikurangi. Galat membuka halus di bawah kolom sandi.
 */
export function LoginForm({ callbackUrl, demo }: { callbackUrl?: string; demo: boolean }) {
    const router = useRouter();
    const [state, setState] = useState<MasukState>({});
    const [fase, setFase] = useState<Fase>("diam");
    const [, mulai] = useTransition();
    const pewaktu = useRef<ReturnType<typeof setTimeout>[]>([]);

    useEffect(() => () => pewaktu.current.forEach(clearTimeout), []);

    const onSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (fase !== "diam") return;
        const fd = new FormData(e.currentTarget);
        fd.set("js", "1");
        const kurangiGerak = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        setFase("memeriksa");
        mulai(async () => {
            const r = await masuk({}, fd);
            if (!r.role || !r.tujuan) {
                setState(r);
                setFase("diam");
                return;
            }
            setState(r);
            if (kurangiGerak) {
                setFase("membuka");
                router.replace(r.tujuan);
                return;
            }
            router.prefetch(r.tujuan);
            setFase("terdeteksi");
            pewaktu.current.push(
                setTimeout(() => {
                    setFase("membuka");
                    router.replace(r.tujuan!);
                }, DURASI_TERDETEKSI_MS),
                // Jaga-jaga bila navigasi klien tertahan: muat penuh halaman tujuan.
                setTimeout(() => window.location.assign(r.tujuan!), DURASI_TERDETEKSI_MS + DURASI_MEMBUKA_MS + 4000),
            );
        });
    };

    const sibuk = fase !== "diam";
    const peran = state.role ? PERAN_MASUK[state.role] : null;

    return (
        <div className="relative">
            <form
                onSubmit={onSubmit}
                noValidate
                aria-hidden={sibuk || undefined}
                className={cn(
                    "space-y-5 transition-opacity duration-(--durasi-lambat) ease-halus",
                    sibuk && "pointer-events-none opacity-0",
                )}
            >
                <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />
                <div className="space-y-2">
                    <Label htmlFor="nip">{demo ? "NIP atau nama pengguna" : "NIP"}</Label>
                    <Input
                        id="nip"
                        name="nip"
                        defaultValue={state.nip}
                        autoComplete="username"
                        autoCapitalize="off"
                        autoCorrect="off"
                        spellCheck={false}
                        required
                        maxLength={32}
                        placeholder={demo ? "Contoh: inspektur" : "Masukkan NIP Anda"}
                        className="h-12"
                        aria-invalid={state.error ? true : undefined}
                        aria-describedby={state.error ? "galat-masuk" : undefined}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="password">Kata sandi</Label>
                    <InputSandi
                        id="password"
                        name="password"
                        autoComplete="current-password"
                        required
                        placeholder="Masukkan kata sandi"
                        className="h-12"
                        aria-invalid={state.error ? true : undefined}
                        aria-describedby={state.error ? "galat-masuk" : undefined}
                    />
                    <PesanMuncul
                        id="galat-masuk"
                        role="alert"
                        pesan={fase === "diam" ? state.error : undefined}
                        isiClassName="pt-1 text-sm text-danger"
                    />
                </div>
                <Button
                    type="submit"
                    size="lg"
                    className="h-12 w-full justify-between bg-foreground px-5 text-background hover:bg-foreground/85"
                    disabled={sibuk}
                >
                    {sibuk ? "Memeriksa…" : "Masuk"}
                    <ArrowRight className="size-4" aria-hidden />
                </Button>
            </form>

            <div
                role="status"
                aria-live="polite"
                style={state.role ? ({ "--aksen": `var(--peran-${state.role})` } as CSSProperties) : undefined}
                className={cn(
                    "absolute inset-0 flex flex-col items-center justify-center gap-4 text-center transition-opacity duration-(--durasi-lambat) ease-halus",
                    sibuk ? "opacity-100" : "pointer-events-none opacity-0",
                )}
            >
                {sibuk && (
                    <>
                        <span
                            aria-hidden
                            className={cn(
                                "size-12 rounded-full border-[3px] border-border transition-colors duration-(--durasi-lambat) ease-halus",
                                fase === "memeriksa" && "animate-spin border-t-foreground motion-reduce:animate-none",
                                fase !== "memeriksa" && "border-[var(--aksen)] bg-[var(--aksen)]/10",
                            )}
                        />
                        <p
                            key={fase}
                            className="animate-in fade-in-0 slide-in-from-bottom-1 text-base font-medium duration-(--durasi-lambat) ease-halus motion-reduce:animate-none"
                        >
                            {fase === "memeriksa" && "Memeriksa akun…"}
                            {fase === "terdeteksi" && peran && (
                                <>
                                    Peran terdeteksi:{" "}
                                    <span className="border-b-2 border-[var(--aksen)] pb-0.5 font-semibold">
                                        {peran.peran}
                                    </span>
                                </>
                            )}
                            {fase === "membuka" && peran?.membuka}
                        </p>
                        <span aria-hidden className="h-1 w-24 overflow-hidden rounded-full bg-border">
                            <span
                                className={cn(
                                    "block h-full rounded-full transition-[width,background-color] duration-700 ease-halus",
                                    fase === "memeriksa" && "w-1/3 bg-foreground/40",
                                    fase === "terdeteksi" && "w-2/3 bg-[var(--aksen)]",
                                    fase === "membuka" && "w-full bg-[var(--aksen)]",
                                )}
                            />
                        </span>
                    </>
                )}
            </div>
        </div>
    );
}

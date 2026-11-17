"use client";

/**
 * Perilaku halaman depan, port dari resources/js/app.js: nav yang berubah saat digulir,
 * menu ponsel, reveal saat gulir, dan video latar hero beserta tombol jedanya.
 * Semua gerak tunduk pada prefers-reduced-motion.
 */
import { useEffect } from "react";

type Bersih = () => void;

function pasangNav(adaPengamat: boolean): Bersih {
    const nav = document.querySelector("[data-nav]");
    if (!nav) return () => {};
    const penanda = document.querySelector("[data-nav-penanda]");
    const setel = (tergulir: boolean) => nav.toggleAttribute("data-tergulir", tergulir);
    if (!penanda) {
        setel(true);
        return () => {};
    }
    if (adaPengamat) {
        const io = new IntersectionObserver(([entri]) => setel(!entri!.isIntersecting));
        io.observe(penanda);
        return () => io.disconnect();
    }
    const periksa = () => setel(penanda.getBoundingClientRect().bottom <= 0);
    periksa();
    window.addEventListener("scroll", periksa, { passive: true });
    return () => window.removeEventListener("scroll", periksa);
}

function pasangMenu(): Bersih {
    const tombol = document.querySelector<HTMLButtonElement>("[data-menu-tombol]");
    const panel = tombol && document.getElementById(tombol.getAttribute("aria-controls") ?? "");
    if (!tombol || !panel) return () => {};
    const nav = tombol.closest("[data-nav]");
    const terbuka = () => tombol.getAttribute("aria-expanded") === "true";
    const atur = (buka: boolean) => {
        tombol.setAttribute("aria-expanded", String(buka));
        tombol.setAttribute("aria-label", buka ? "Tutup menu" : "Buka menu");
        panel.hidden = !buka;
        nav?.toggleAttribute("data-menu-terbuka", buka);
    };
    const klikTombol = () => atur(!terbuka());
    const klikPanel = (e: MouseEvent) => {
        if ((e.target as Element).closest("a")) atur(false);
    };
    const tekan = (e: KeyboardEvent) => {
        if (e.key !== "Escape" || !terbuka()) return;
        atur(false);
        tombol.focus();
    };
    const lebar = window.matchMedia("(min-width: 64rem)");
    const ubahLebar = (e: MediaQueryListEvent) => {
        if (e.matches) atur(false);
    };
    tombol.addEventListener("click", klikTombol);
    panel.addEventListener("click", klikPanel);
    document.addEventListener("keydown", tekan);
    lebar.addEventListener("change", ubahLebar);
    return () => {
        tombol.removeEventListener("click", klikTombol);
        panel.removeEventListener("click", klikPanel);
        document.removeEventListener("keydown", tekan);
        lebar.removeEventListener("change", ubahLebar);
    };
}

function pasangMuncul(kurangiGerak: boolean, adaPengamat: boolean): Bersih {
    const elemen = document.querySelectorAll("[data-muncul]");
    if (!elemen.length) return () => {};
    if (kurangiGerak || !adaPengamat) {
        elemen.forEach((el) => el.classList.add("muncul"));
        return () => {};
    }
    const pengamat = new IntersectionObserver(
        (daftar) => {
            for (const entri of daftar) {
                if (!entri.isIntersecting) continue;
                entri.target.classList.add("muncul");
                pengamat.unobserve(entri.target);
            }
        },
        { rootMargin: "0px 0px -8% 0px" },
    );
    elemen.forEach((el) => pengamat.observe(el));
    return () => pengamat.disconnect();
}

function pasangVideoLatar(kurangiGerak: MediaQueryList, adaPengamat: boolean): Bersih {
    const video = document.querySelector<HTMLVideoElement>("[data-video-latar]");
    if (!video) return () => {};
    const koneksi = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } })
        .connection;
    if (koneksi && (koneksi.saveData || /2g$/.test(koneksi.effectiveType ?? ""))) return () => {};

    const tombol = document.querySelector<HTMLButtonElement>("[data-video-kendali]");
    let siap = document.readyState === "complete";
    let terlihat = true;
    let dijedaPengguna = false;

    const tulisTombol = () => {
        if (tombol) tombol.textContent = dijedaPengguna ? "Putar video" : "Jeda video";
    };

    const perbarui = () => {
        if (!siap) return;
        if (kurangiGerak.matches) {
            if (video.getAttribute("src")) {
                video.pause();
                video.removeAttribute("src");
                video.load();
            }
            if (tombol) tombol.hidden = true;
            dijedaPengguna = false;
            tulisTombol();
            return;
        }
        if (!terlihat || dijedaPengguna) {
            video.pause();
            return;
        }
        if (!video.getAttribute("src")) {
            const tegak = window.matchMedia("(orientation: portrait)").matches;
            video.src = (tegak ? video.dataset.srcTegak : video.dataset.srcLebar) ?? "";
        }
        video.play()?.catch(() => {});
    };

    const diputar = () => {
        if (tombol) tombol.hidden = false;
    };
    const klik = () => {
        dijedaPengguna = !dijedaPengguna;
        tulisTombol();
        perbarui();
    };
    const dimuat = () => {
        siap = true;
        perbarui();
    };
    video.addEventListener("playing", diputar);
    tombol?.addEventListener("click", klik);
    if (!siap) window.addEventListener("load", dimuat, { once: true });
    kurangiGerak.addEventListener("change", perbarui);
    let io: IntersectionObserver | null = null;
    if (adaPengamat) {
        io = new IntersectionObserver(([entri]) => {
            terlihat = entri!.isIntersecting;
            perbarui();
        });
        io.observe(video);
    }
    perbarui();
    return () => {
        video.removeEventListener("playing", diputar);
        tombol?.removeEventListener("click", klik);
        window.removeEventListener("load", dimuat);
        kurangiGerak.removeEventListener("change", perbarui);
        io?.disconnect();
    };
}

/**
 * Tiap pemasang diisolasi. Tanda siap (data-situs-siap) hanya dipasang bila semua yang
 * ditopang kelas js terpasang; bila ada yang gagal, kelas js dicabut dan halaman kembali
 * ke tata letak tanpa JavaScript.
 */
export function PerilakuSitus() {
    useEffect(() => {
        const akar = document.querySelector<HTMLElement>(".situs");
        if (!akar) return;
        const kurangiGerak = window.matchMedia("(prefers-reduced-motion: reduce)");
        const adaPengamat = "IntersectionObserver" in window;
        const bersih: Bersih[] = [];
        let utuh = true;
        const jalankan = (nama: string, pasang: () => Bersih, ditopangKelasJs: boolean) => {
            try {
                bersih.push(pasang());
            } catch (galat) {
                console.error(`[situs] ${nama} gagal:`, galat);
                if (ditopangKelasJs) utuh = false;
            }
        };
        jalankan("pasangMuncul", () => pasangMuncul(kurangiGerak.matches, adaPengamat), true);
        jalankan("pasangNav", () => pasangNav(adaPengamat), true);
        jalankan("pasangMenu", pasangMenu, true);
        jalankan("pasangVideoLatar", () => pasangVideoLatar(kurangiGerak, adaPengamat), false);
        if (utuh) {
            akar.classList.add("js");
            akar.dataset.situsSiap = "1";
        } else {
            akar.classList.remove("js");
        }
        return () => {
            bersih.forEach((b) => b());
            akar.classList.remove("js");
            delete akar.dataset.situsSiap;
        };
    }, []);
    return null;
}

import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { assetTypes, checklistGroups } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/guards";
import { homeFor } from "@/lib/auth/access";
import { Foto } from "./situs/foto";
import { Logo } from "./situs/logo";
import { PerilakuSitus } from "./situs/perilaku";
import "./situs.css";

export const metadata: Metadata = {
    title: { absolute: "Geofencing — Sistem Inspeksi K3 — Perusahaan Galangan Kapal" },
    description:
        "Sistem informasi inspeksi sarana tanggap darurat (APAR, hydrant, kotak P3K, mobil pemadam) untuk perusahaan galangan kapal.",
    icons: { icon: "/geofencing.svg" },
};

/** Keterangan modul yang belum punya penjelasan di data induk (LandingController.php). */
const RINGKASAN: Record<string, string> = {
    apar: "Pemeriksaan alat pemadam api ringan setiap bulan: isi, tekanan, kondisi fisik, mulut pancar, dan penempatan.",
    hydrant_pilar: "Pemeriksaan hydrant pilar di halaman, dermaga, dan dok: akses, katup, siamese connection, dan korosi.",
    hydrant_box: "Pemeriksaan hydrant box di dalam gedung: akses, box dan kaca, selang, nozzle, dan katup.",
    p3k: "Pemeriksaan kotak pertolongan pertama: kelengkapan isi terhadap jumlah baku dan masa kedaluwarsa.",
    mobil_pemadam: "Pemeriksaan mobil pemadam kebakaran: mesin, pompa, tangki, dan kelengkapan perlengkapan.",
};

function labelPeriode(hari: number | null): string {
    if (hari === null) return "Berkala";
    if (hari <= 1) return "Harian";
    if (hari <= 7) return "Mingguan";
    if (hari <= 31) return "Bulanan";
    if (hari <= 93) return "Tiga bulanan";
    if (hari <= 186) return "Enam bulanan";
    return "Tahunan";
}

const TAUTAN: [string, string][] = [
    ["#pengaman", "Pengaman"],
    ["#cara-kerja", "Cara kerja"],
    ["#peran", "Peran"],
    ["#modul", "Modul"],
    ["#tentang", "Tentang"],
];

const ALUR: [string, string][] = [
    [
        "Pasang stiker",
        "Administrator memasukkan data tabung, mencetak stiker QR dari menu Lembar Stiker, lalu menempelkannya di tiap tabung.",
    ],
    [
        "Periksa di lokasi",
        "Petugas memindai stiker dari ponsel, mengisi sepuluh butir pemeriksaan, memotret kondisi tabung, lalu mengirim.",
    ],
    [
        "Temuan ditindaklanjuti",
        "Butir yang bermasalah otomatis menjadi temuan lengkap dengan lokasi, tingkat, dan tindakan yang direkomendasikan.",
    ],
    ["Rekap bulanan", "Akhir bulan, administrator membuka menu laporan dan mengunduh rekap PDF."],
];

const PERAN: [string, string, string][] = [
    ["Inspektur", "Ponsel", "Memindai stiker QR, mengisi daftar periksa, dan melihat riwayat pemeriksaannya sendiri."],
    [
        "Administrator",
        "Komputer",
        "Mengelola data tabung dan petugas, mencetak stiker, menerbitkan laporan, dan meninjau hasil.",
    ],
    ["Pemantau", "Komputer", "Melihat papan pantau dan laporan, serta meninjau inspeksi yang perlu tinjauan, tanpa mengubah data."],
];

const ANGKA: [string, string, string | null][] = [
    ["4", "Jenis sarana tanggap darurat", null],
    ["3", "Lapis bukti: QR, lokasi, foto", null],
    ["30 m", "Toleransi tepi gedung", null],
    ["0", "Perubahan setelah final", null],
];

/**
 * Kelas js dipasang pada pembungkus .situs sebelum isi dilukis supaya elemen reveal tidak berkedip
 * (bukan pada <html>, yang dimiliki layout akar dan akan memicu galat hidrasi). Gagal-terbuka:
 * bila perilaku halaman tidak menandai siap dalam ±3 detik, kelas dicabut lagi.
 */
const SKRIP_JS = `(function(a){a.classList.add('js');setTimeout(function(){if(!a.dataset.situsSiap)a.classList.remove('js')},3000)})(document.currentScript.parentElement);`;

const TOMBOL_NAV_MASUK =
    "s:tombol s:tombol-terang s:px-4 s:py-3.5 s:group-data-tergulir:tombol-gelap s:group-data-menu-terbuka:tombol-gelap";
const LABEL_SIAP = "s:label-meta s:text-charcoal";
const LABEL_BELUM = "s:label-meta s:text-charcoal/60";

/**
 * Halaman depan publik, salinan 1:1 resources/views/landing.blade.php. Terbuka tanpa masuk,
 * jadi TIDAK memuat data aset: tanpa daftar tabung, koordinat, maupun token QR. Kartu modul
 * dibaca dari asset_types. Ilustrasi dan video dibuat khusus untuk aplikasi ini (public/media/situs/SUMBER.md).
 */
export default async function HalamanDepan() {
    const [user, tipe] = await Promise.all([
        getCurrentUser(),
        db
            .select({
                slug: assetTypes.slug,
                nama: assetTypes.nama,
                periodeHari: assetTypes.periodeHari,
                aktif: assetTypes.aktif,
                adaChecklist: sql<boolean>`exists (select 1 from ${checklistGroups} where ${eq(checklistGroups.assetTypeId, assetTypes.id)})`,
            })
            .from(assetTypes)
            .where(eq(assetTypes.aktif, true))
            .orderBy(asc(assetTypes.urut)),
    ]);
    const masuk = user !== null;
    const tujuan = user ? homeFor(user.role) : "/masuk";
    const modul = tipe.map((t) => ({
        slug: t.slug,
        nama: t.nama,
        periode: labelPeriode(t.periodeHari),
        ringkas: RINGKASAN[t.slug] ?? "",
        // Modul tanpa checklist ditandai tahap berikutnya, bukan disembunyikan.
        siap: t.aktif && t.adaChecklist,
    }));

    return (
        <div className="situs" suppressHydrationWarning>
            <script dangerouslySetInnerHTML={{ __html: SKRIP_JS }} />
            <link rel="preload" as="image" type="image/webp" fetchPriority="high" href="/media/situs/hero-poster.webp" />
            <a
                href="#isi"
                className="s:label-meta s:fixed s:left-4 s:top-4 s:z-[60] s:-translate-y-24 s:rounded-md s:bg-paper s:px-4 s:py-3 s:text-charcoal s:focus-visible:translate-y-0"
            >
                Langsung ke isi
            </a>

            <header
                data-nav=""
                data-masuk="pudar"
                className="s:group s:absolute s:inset-x-0 s:top-0 s:z-50 s:border-b s:border-transparent s:text-paper s:transition-[background-color,color,border-color] s:duration-300 s:ease-halus s:js:fixed s:data-tergulir:border-bone s:data-tergulir:bg-paper s:data-tergulir:text-charcoal s:data-menu-terbuka:border-bone s:data-menu-terbuka:bg-paper s:data-menu-terbuka:text-charcoal"
            >
                <div className="s:bingkai s:flex s:h-16 s:items-center s:justify-between s:gap-4 s:lg:h-18">
                    <Link href="/" className="s:shrink-0" aria-label="Geofencing, halaman depan">
                        <Logo />
                    </Link>

                    <nav aria-label="Utama" className="s:hidden s:lg:block">
                        <ul className="s:flex s:items-center s:gap-11">
                            {TAUTAN.map(([alamat, label]) => (
                                <li key={alamat}>
                                    <a href={alamat} className="s:tautan s:text-label s:font-medium s:uppercase">
                                        {label}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </nav>

                    <div className="s:flex s:items-center s:gap-2">
                        <a href={tujuan} className={masuk ? `${TOMBOL_NAV_MASUK} s:max-sm:hidden` : TOMBOL_NAV_MASUK}>
                            {masuk ? "Buka aplikasi" : "Masuk"}
                        </a>

                        <button
                            type="button"
                            data-menu-tombol=""
                            aria-expanded="false"
                            aria-controls="menu-ponsel"
                            aria-label="Buka menu"
                            className="s:relative s:-mr-3 s:hidden s:size-11 s:items-center s:justify-center s:js:max-lg:flex"
                        >
                            <span className="s:absolute s:h-px s:w-[18px] s:-translate-y-[3px] s:rounded-sm s:bg-current s:transition-transform s:duration-200 s:ease-halus s:group-data-menu-terbuka:translate-y-0 s:group-data-menu-terbuka:rotate-45" />
                            <span className="s:absolute s:h-px s:w-[18px] s:translate-y-[3px] s:rounded-sm s:bg-current s:transition-transform s:duration-200 s:ease-halus s:group-data-menu-terbuka:translate-y-0 s:group-data-menu-terbuka:-rotate-45" />
                        </button>
                    </div>
                </div>

                <div
                    id="menu-ponsel"
                    data-menu-panel=""
                    hidden
                    className="s:max-h-[calc(100svh-4rem)] s:scroll-py-2 s:overflow-y-auto s:overscroll-contain s:border-t s:border-bone s:bg-paper s:text-charcoal s:lg:hidden"
                >
                    <nav aria-label="Menu ponsel" className="s:bingkai s:pt-2 s:pb-6">
                        <ul>
                            {TAUTAN.map(([alamat, label]) => (
                                <li key={alamat} className="s:border-b s:border-bone">
                                    <a
                                        href={alamat}
                                        className="s:flex s:min-h-14 s:items-center s:text-subheading s:font-light"
                                    >
                                        {label}
                                    </a>
                                </li>
                            ))}
                        </ul>
                        <a
                            href={tujuan}
                            className="s:tombol s:tombol-gelap s:mt-6 s:flex s:w-full s:px-6 s:py-[1.125rem]"
                        >
                            {masuk ? "Buka aplikasi" : "Masuk petugas"}
                        </a>
                    </nav>
                </div>
            </header>

            <main id="isi">
                <section
                    data-hero=""
                    aria-labelledby="judul-hero"
                    className="s:relative s:isolate s:flex s:min-h-svh s:items-end s:overflow-hidden s:bg-deep-current s:text-paper"
                >
                    <div
                        data-nav-penanda=""
                        aria-hidden="true"
                        className="s:pointer-events-none s:absolute s:inset-x-0 s:top-0 s:h-2"
                    />
                    <div className="s:absolute s:inset-0 s:-z-10" data-masuk-media="">
                        <video
                            data-video-latar=""
                            autoPlay
                            muted
                            loop
                            playsInline
                            preload="none"
                            disablePictureInPicture
                            disableRemotePlayback
                            aria-hidden="true"
                            poster="/media/situs/hero-poster.webp"
                            data-src-lebar="/media/situs/hero-lebar.mp4"
                            data-src-tegak="/media/situs/hero-tegak.mp4"
                            className="s:size-full s:object-cover"
                        />
                        <div className="s:selubung-gelap s:absolute s:inset-0" />
                    </div>

                    <div className="s:bingkai s:pt-36 s:pb-10 s:md:pb-14">
                        <p
                            data-masuk=""
                            style={{ "--urutan": 1 } as CSSProperties}
                            className="s:label-meta s:text-paper"
                        >
                            Perusahaan Galangan Kapal &middot; K3
                        </p>
                        <h1
                            id="judul-hero"
                            data-masuk=""
                            style={{ "--urutan": 2 } as CSSProperties}
                            className="s:mt-5 s:max-w-[15ch] s:text-display s:font-light"
                        >
                            Inspeksi APAR yang terbukti dilakukan di tempatnya.
                        </h1>
                        <p
                            data-masuk=""
                            style={{ "--urutan": 3 } as CSSProperties}
                            className="s:mt-6 s:max-w-[36rem] s:text-body-lg s:text-paper"
                        >
                            Stiker QR, titik lokasi, dan foto bukti menggantikan kartu periksa kertas yang gampang
                            hilang.
                        </p>
                        <div
                            data-masuk=""
                            style={{ "--urutan": 4 } as CSSProperties}
                            className="s:mt-10 s:flex s:flex-col s:gap-3 s:sm:flex-row"
                        >
                            <a href={tujuan} className="s:tombol s:tombol-terang s:px-6 s:py-[1.125rem]">
                                {masuk ? "Lanjutkan pekerjaan" : "Masuk petugas"}
                            </a>
                            <a href="#cara-kerja" className="s:tombol s:tombol-terang s:px-6 s:py-[1.125rem]">
                                Cara kerja
                            </a>
                        </div>
                    </div>

                    <div className="s:pointer-events-none s:absolute s:inset-x-0 s:top-18 s:sm:top-auto s:sm:bottom-0">
                        <div className="s:bingkai s:flex s:justify-end s:sm:pb-10 s:md:pb-14">
                            <button
                                type="button"
                                data-video-kendali=""
                                hidden
                                className="s:tautan s:pointer-events-auto s:-mr-3 s:inline-flex s:items-center s:rounded-md s:border s:border-transparent s:px-3 s:py-[1.125rem] s:text-label s:font-medium s:whitespace-nowrap s:uppercase"
                            >
                                Jeda video
                            </button>
                        </div>
                    </div>
                </section>

                <div className="s:bg-paper s:py-pita">
                    <div className="s:bingkai">
                        <p
                            data-muncul=""
                            className="s:mx-auto s:max-w-[45rem] s:text-center s:text-heading-lg s:font-light"
                        >
                            Setiap tabung tercatat. Setiap pemeriksaan bisa dibuktikan.
                        </p>
                    </div>
                </div>

                <section
                    id="pengaman"
                    aria-labelledby="judul-pengaman"
                    className="s:bg-deep-current s:py-pita s:text-paper"
                >
                    <div className="s:bingkai">
                        <div className="s:grid s:gap-6 s:md:grid-cols-12 s:md:items-end s:md:gap-x-5">
                            <div className="s:md:col-span-7">
                                <p data-muncul="" className="s:label-meta s:text-paper/70">
                                    Tiga pengaman
                                </p>
                                <h2
                                    id="judul-pengaman"
                                    data-muncul=""
                                    className="s:mt-4 s:max-w-[20ch] s:text-heading-lg s:font-light"
                                >
                                    Bukti bahwa petugas benar-benar datang ke tabung.
                                </h2>
                            </div>
                            <p data-muncul="" className="s:text-body s:text-paper/70 s:md:col-span-5">
                                Kartu periksa kertas yang digantung di tabung gampang hilang, tulisannya sulit dibaca,
                                dan tidak bisa memastikan petugas datang ke lokasi. Tiga pengaman ini menggantikannya.
                            </p>
                        </div>

                        <ul className="s:mt-12 s:grid s:gap-x-5 s:gap-y-10 s:md:mt-16 s:md:grid-cols-3">
                            {(
                                [
                                    [
                                        "stiker-qr",
                                        "Ilustrasi garis tabung APAR dengan stiker QR dan kartu data aset.",
                                        "Stiker QR per tabung",
                                        "Tiap tabung punya kode acak sendiri. Formulir pemeriksaan baru terbuka setelah stiker di tabung itu dipindai.",
                                    ],
                                    [
                                        "denah-lokasi",
                                        "Ilustrasi denah galangan dengan poligon gedung yang disorot dan titik posisi ponsel di dalamnya.",
                                        "Pencocokan lokasi",
                                        "Ponsel merekam titik GPS saat pengisian dan mencocokkannya dengan poligon gedung aset. Di luar gedung ditandai perlu tinjauan; di luar galangan ditolak.",
                                    ],
                                    [
                                        "foto-bukti",
                                        "Ilustrasi bingkai kamera yang membidik tabung APAR.",
                                        "Foto bukti",
                                        "Kamera terpandu meminta foto per langkah langsung dari aplikasi, tanpa galeri, dan menautkannya ke butir pemeriksaan.",
                                    ],
                                ] as const
                            ).map(([berkas, alt, judul, uraian], i) => (
                                <li key={berkas} data-muncul="" style={{ "--urutan": i } as CSSProperties}>
                                    <div className="s:bingkai-foto s:aspect-[4/3] s:bg-paper/5">
                                        <Foto
                                            berkas={berkas}
                                            sizes="(min-width: 80rem) 387px, (min-width: 48rem) 31vw, 100vw"
                                            alt={alt}
                                        />
                                    </div>
                                    <div className="s:p-5">
                                        <h3 className="s:text-subheading">{judul}</h3>
                                        <p className="s:mt-3 s:text-body s:text-paper/70">{uraian}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>

                        <p
                            data-muncul=""
                            className="s:mt-10 s:border-t s:border-paper/15 s:pt-6 s:text-body s:text-paper/70 s:md:mt-14"
                        >
                            Butir yang gagal otomatis menjadi temuan dan masuk daftar tindak lanjut sampai dinyatakan
                            selesai.
                        </p>
                    </div>
                </section>

                <section id="cara-kerja" aria-labelledby="judul-cara-kerja" className="s:bg-paper s:py-pita">
                    <div className="s:bingkai">
                        <p data-muncul="" className="s:label-meta">
                            Alur harian
                        </p>
                        <h2
                            id="judul-cara-kerja"
                            data-muncul=""
                            className="s:mt-4 s:max-w-[20ch] s:text-heading-lg s:font-light"
                        >
                            Dari stiker sampai rekap bulanan.
                        </h2>

                        <ol className="s:mt-12 s:grid s:border-t s:border-bone s:md:mt-16 s:md:grid-cols-2 s:lg:grid-cols-4">
                            {ALUR.map(([judul, uraian], i) => (
                                <li
                                    key={judul}
                                    data-muncul=""
                                    style={{ "--urutan": i } as CSSProperties}
                                    className="s:border-b s:border-bone s:py-8 s:md:odd:pr-5 s:md:even:border-l s:md:even:pl-5 s:lg:border-b-0 s:lg:border-l s:lg:px-5 s:lg:first:border-l-0 s:lg:first:pl-0 s:lg:last:pr-0"
                                >
                                    <span
                                        aria-hidden="true"
                                        className="s:block s:text-heading s:font-light s:tabular-nums"
                                    >
                                        {String(i + 1).padStart(2, "0")}
                                    </span>
                                    <h3 className="s:mt-8 s:text-subheading">{judul}</h3>
                                    <p className="s:mt-3 s:text-body s:text-charcoal/70">{uraian}</p>
                                </li>
                            ))}
                        </ol>
                    </div>
                </section>

                <section id="peran" aria-labelledby="judul-peran" className="s:bg-bone s:py-pita">
                    <div className="s:bingkai s:grid s:gap-12 s:md:grid-cols-12 s:md:gap-x-5">
                        <div data-muncul="" className="s:order-last s:md:order-first s:md:col-span-5">
                            <div className="s:bingkai-foto s:aspect-[4/5] s:bg-paper">
                                <Foto
                                    berkas="ponsel-periksa"
                                    lebar={[600, 1000]}
                                    sizes="(min-width: 80rem) 484px, (min-width: 48rem) 40vw, 100vw"
                                    alt="Ilustrasi ponsel yang menampilkan daftar periksa dengan satu butir bertanda temuan."
                                />
                            </div>
                        </div>

                        <div className="s:md:col-span-6 s:md:col-start-7 s:md:self-center">
                            <p data-muncul="" className="s:label-meta">
                                Tiga peran
                            </p>
                            <h2 id="judul-peran" data-muncul="" className="s:mt-4 s:text-heading-lg s:font-light">
                                Satu sistem, tiga cara memakainya.
                            </h2>

                            <ul className="s:mt-10 s:grid s:gap-px">
                                {PERAN.map(([nama, alat, uraian], i) => (
                                    <li
                                        key={nama}
                                        data-muncul=""
                                        style={{ "--urutan": i } as CSSProperties}
                                        className="s:grid s:gap-3 s:bg-paper s:p-5 s:sm:grid-cols-[10rem_1fr] s:sm:gap-5"
                                    >
                                        <div>
                                            <h3 className="s:text-subheading">{nama}</h3>
                                            <p className="s:mt-2 s:label-meta s:text-charcoal/60">{alat}</p>
                                        </div>
                                        <p className="s:text-body s:text-charcoal/70">{uraian}</p>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </section>

                <section id="dasar-hukum" aria-labelledby="judul-dasar-hukum" className="s:bg-paper s:py-pita">
                    <div className="s:bingkai s:grid s:gap-10 s:md:grid-cols-12 s:md:gap-x-5">
                        <div className="s:md:col-span-5">
                            <p data-muncul="" className="s:label-meta">
                                Dasar hukum
                            </p>
                            <h2 id="judul-dasar-hukum" data-muncul="" className="s:mt-4 s:text-heading-lg s:font-light">
                                Setiap butir menyimpan rujukannya.
                            </h2>
                            <p data-muncul="" className="s:mt-6 s:text-body s:text-charcoal/70">
                                Butir pemeriksaan tidak disusun sendiri, tetapi mengikuti ketentuan yang berlaku.
                                Rujukan dasar hukum tersimpan di tiap butir, sehingga laporan bisa dipertanggungjawabkan
                                saat audit.
                            </p>
                        </div>

                        <ul className="s:border-t s:border-bone s:md:col-span-6 s:md:col-start-7 s:md:self-end">
                            <li data-muncul="" className="s:border-b s:border-bone s:py-6">
                                <h3 className="s:text-subheading">Permenaker No. 04/MEN/1980</h3>
                                <p className="s:mt-2 s:text-body s:text-charcoal/70">
                                    Syarat pemasangan dan pemeliharaan alat pemadam api ringan.
                                </p>
                            </li>
                            <li
                                data-muncul=""
                                style={{ "--urutan": 1 } as CSSProperties}
                                className="s:border-b s:border-bone s:py-6"
                            >
                                <h3 className="s:text-subheading">NFPA 10</h3>
                                <p className="s:mt-2 s:text-body s:text-charcoal/70">
                                    Pemeriksaan berkala setiap 30 hari.
                                </p>
                            </li>
                        </ul>
                    </div>
                </section>

                <section id="modul" aria-labelledby="judul-modul" className="s:bg-bone s:py-pita">
                    <div className="s:bingkai">
                        <div className="s:grid s:gap-6 s:md:grid-cols-12 s:md:items-end s:md:gap-x-5">
                            <div className="s:md:col-span-7">
                                <p data-muncul="" className="s:label-meta">
                                    Modul
                                </p>
                                <h2 id="judul-modul" data-muncul="" className="s:mt-4 s:text-heading-lg s:font-light">
                                    Objek yang diperiksa.
                                </h2>
                            </div>
                            <p data-muncul="" className="s:text-body s:text-charcoal/70 s:md:col-span-5">
                                Daftar modul dibaca langsung dari data induk aplikasi, sehingga objek pemeriksaan
                                berikutnya cukup ditambahkan lewat data tanpa mengubah halaman ini.
                            </p>
                        </div>

                        <ul className="s:mt-12 s:grid s:gap-px s:sm:grid-cols-2 s:md:mt-16 s:lg:grid-cols-4">
                            {modul.length === 0 ? (
                                <li className="s:bg-paper s:p-5 s:text-body s:text-charcoal/70 s:sm:col-span-2 s:lg:col-span-4">
                                    Data induk objek inspeksi belum terisi.
                                </li>
                            ) : (
                                modul.map((m, i) => (
                                    <li
                                        key={m.slug}
                                        data-muncul=""
                                        style={{ "--urutan": i } as CSSProperties}
                                        className="s:flex s:flex-col s:bg-paper s:p-5"
                                    >
                                        <p className={m.siap ? LABEL_SIAP : LABEL_BELUM}>
                                            {m.siap ? "Sudah beroperasi" : "Tahap berikutnya"}
                                        </p>
                                        <h3 className="s:mt-10 s:text-subheading">{m.nama}</h3>
                                        <p className="s:mt-3 s:flex-1 s:text-body-sm s:text-charcoal/70">{m.ringkas}</p>
                                        <p className="s:mt-8 s:border-t s:border-bone s:pt-4 s:label-meta s:text-charcoal/60">
                                            Periode {m.periode}
                                        </p>
                                    </li>
                                ))
                            )}
                        </ul>
                    </div>
                </section>

                <section id="tentang" aria-labelledby="judul-tentang" className="s:bg-slate-depth s:text-paper">
                    <div className="s:relative s:isolate s:flex s:min-h-[70svh] s:items-end s:overflow-hidden">
                        <div className="s:absolute s:inset-0 s:-z-10">
                            <Foto
                                berkas="kapal-laut"
                                sizes="100vw"
                                zoomPelan
                                alt="Ilustrasi garis rencana lambung kapal di laut, tampak atas."
                            />
                            <div className="s:selubung-gelap s:absolute s:inset-0" />
                        </div>

                        <div className="s:bingkai s:pt-40 s:pb-10 s:md:pb-14">
                            <p data-muncul="" className="s:label-meta s:text-paper/80">
                                Perusahaan Galangan Kapal
                            </p>
                            <h2
                                id="judul-tentang"
                                data-muncul=""
                                className="s:mt-4 s:max-w-[16ch] s:text-heading-lg s:font-light"
                            >
                                Dibangun untuk sarana tanggap darurat di galangan.
                            </h2>
                        </div>
                    </div>

                    <div className="s:bingkai s:py-pita">
                        <div className="s:grid s:gap-10 s:md:grid-cols-12 s:md:gap-x-5">
                            <div className="s:space-y-5 s:text-body s:text-paper/70 s:md:col-span-6">
                                <p data-muncul="">
                                    Galangan kapal bekerja dengan bengkel beratap baja, dok, dan dermaga yang luas. Sarana
                                    tanggap darurat seperti APAR, hydrant, kotak P3K, dan mobil pemadam tersebar di
                                    semuanya dan diperiksa oleh unit yang berbeda.
                                </p>
                                <p data-muncul="">
                                    Aplikasi ini menyatukan pemeriksaan itu: setiap hasil membawa bukti kehadiran di
                                    lokasi, terkunci setelah dikirim, dan tersaji sebagai laporan.
                                </p>
                            </div>
                            <div className="s:md:col-span-5 s:md:col-start-8">
                                <p data-muncul="" className="s:text-body s:text-paper/70">
                                    Kesehatan dan keselamatan kerja selalu ditekankan dalam sistem manajemen perusahaan.
                                </p>
                                <a
                                    data-muncul=""
                                    href="#cara-kerja"
                                    className="s:tombol s:tombol-terang s:mt-8 s:px-6 s:py-[1.125rem]"
                                >
                                    Lihat cara kerja
                                </a>
                            </div>
                        </div>

                        <dl className="s:mt-16 s:grid s:grid-cols-2 s:gap-x-5 s:gap-y-10 s:md:mt-24 s:lg:grid-cols-4">
                            {ANGKA.map(([angka, keterangan, rentang], i) => (
                                <div
                                    key={angka}
                                    data-muncul=""
                                    style={{ "--urutan": i } as CSSProperties}
                                    className="s:flex s:flex-col-reverse s:border-t s:border-paper/15 s:pt-5"
                                >
                                    <dt className="s:mt-3 s:text-body-sm s:text-paper/70">
                                        {keterangan}
                                        {rentang && (
                                            <>
                                                , <span className="s:whitespace-nowrap">{rentang}</span>
                                            </>
                                        )}
                                    </dt>
                                    <dd className="s:text-display s:font-light s:proportional-nums">{angka}</dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                </section>
            </main>

            <footer className="s:bg-paper">
                <div className="s:bingkai s:py-12 s:md:py-16">
                    <div className="s:flex s:flex-col s:gap-10 s:md:flex-row s:md:items-end s:md:justify-between">
                        <div>
                            <Logo />
                            <p className="s:mt-4 s:max-w-[28rem] s:text-body-sm s:text-charcoal/70">
                                Sistem inspeksi K3 Perusahaan Galangan Kapal. Akses terbatas bagi petugas
                                berwenang.
                            </p>
                        </div>

                        <nav aria-label="Kaki halaman">
                            <ul className="s:flex s:flex-wrap s:gap-x-5 s:gap-y-3">
                                <li>
                                    <a href={tujuan} className="s:tautan s:text-label s:font-medium s:uppercase">
                                        {masuk ? "Buka aplikasi" : "Masuk petugas"}
                                    </a>
                                </li>
                                <li>
                                    <a href="#cara-kerja" className="s:tautan s:text-label s:font-medium s:uppercase">
                                        Cara kerja
                                    </a>
                                </li>
                                <li>
                                    <a href="#modul" className="s:tautan s:text-label s:font-medium s:uppercase">
                                        Modul
                                    </a>
                                </li>
                            </ul>
                        </nav>
                    </div>

                    <p className="s:mt-12 s:border-t s:border-bone s:pt-6 s:text-body-sm s:text-charcoal/60">
                        Ilustrasi dan video: dibuat khusus untuk aplikasi ini.
                    </p>
                </div>
            </footer>
            <PerilakuSitus />
        </div>
    );
}

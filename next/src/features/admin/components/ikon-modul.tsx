/**
 * Ikon per modul (jenis objek K3), garis tunggal ala Lucide supaya tetap terbaca dicetak hitam-putih
 * di stiker. Lucide tidak punya hydrant, jadi dua ikon hydrant digambar dengan kisi dan tebal garis yang sama.
 */
import type { SVGProps } from "react";
import { BriefcaseMedical, FireExtinguisher, ShieldCheck, Truck, type LucideIcon } from "lucide-react";

type Ikon = (p: SVGProps<SVGSVGElement>) => React.ReactElement;

const dasar = {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
} as const;

/** Hydrant pilar: kepala kubah, badan, dua mulut samping, alas. */
const HydrantPilar: Ikon = (p) => (
    <svg {...dasar} {...p}>
        <path d="M12 2v2" />
        <path d="M7 9a5 5 0 0 1 10 0" />
        <path d="M6 9h12" />
        <path d="M8 9v11" />
        <path d="M16 9v11" />
        <path d="M5 13h3v3H5z" />
        <path d="M16 13h3v3h-3z" />
        <path d="M5 20h14" />
        <circle cx="12" cy="14.5" r="1.5" />
    </svg>
);

/** Hydrant box: lemari dengan gulungan selang dan nosel. */
const HydrantBox: Ikon = (p) => (
    <svg {...dasar} {...p}>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="11" cy="12" r="5" />
        <circle cx="11" cy="12" r="1.5" />
        <path d="M16 12h2.5v4" />
    </svg>
);

const IKON: Record<string, LucideIcon | Ikon> = {
    apar: FireExtinguisher,
    p3k: BriefcaseMedical,
    hydrant_pilar: HydrantPilar,
    hydrant_box: HydrantBox,
    hydrant: HydrantPilar,
    mobil_pemadam: Truck,
    damkar: Truck,
};

export function IkonModul({ slug, ...p }: { slug: string | null | undefined } & SVGProps<SVGSVGElement>) {
    const Komponen = (slug && IKON[slug]) || ShieldCheck;
    return <Komponen aria-hidden {...(p as object)} />;
}

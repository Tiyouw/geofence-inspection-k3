import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * Ilustrasi modul bersama (arah desain A "Terang & Ramah"): gambar datar berwarna modul di atas
 * lingkaran rona lembut, dengan bayangan elips dan garis detail gelap. Dipakai kerangka admin,
 * pemantau, dan inspektur (kartu, kepala formulir, keadaan kosong).
 *
 * Warna dari token `--modul-*` dan `--modul-*-rona` (next/src/app/tema.css); nilai cadangan di
 * bawah sama dengan token supaya gambar tetap benar sebelum tema dimuat.
 */
export type ModulIlustrasi = "apar" | "p3k" | "hydrant_pilar" | "hydrant_box" | "mobil_pemadam";

const WARNA: Record<ModulIlustrasi, { utama: string; rona: string }> = {
  apar: { utama: "var(--modul-apar, #C8432B)", rona: "var(--modul-apar-rona, #FBE7E2)" },
  p3k: { utama: "var(--modul-p3k, #23845A)", rona: "var(--modul-p3k-rona, #E0F1E8)" },
  hydrant_pilar: { utama: "var(--modul-hydrant, #2C64A6)", rona: "var(--modul-hydrant-rona, #E2EBF6)" },
  hydrant_box: { utama: "var(--modul-hydrant, #2C64A6)", rona: "var(--modul-hydrant-rona, #E2EBF6)" },
  mobil_pemadam: { utama: "var(--modul-damkar, #B7790A)", rona: "var(--modul-damkar-rona, #F8EDD3)" },
};

/** Warna utama dan rona modul (CSS var), mis. untuk batang progres atau tanda di kalender. */
export function warnaModul(m: ModulIlustrasi): { utama: string; rona: string } {
  return WARNA[m];
}

export const LABEL_MODUL_ILUSTRASI: Record<ModulIlustrasi, string> = {
  apar: "APAR",
  p3k: "Kotak P3K",
  hydrant_pilar: "Hydrant pilar",
  hydrant_box: "Hydrant box",
  mobil_pemadam: "Mobil pemadam",
};

/** Slug tipe aset (juga slug lama `hydrant`/`damkar`) atau nama tipe → ilustrasi. */
export function modulDari(slugAtauNama: string | null | undefined): ModulIlustrasi {
  const s = (slugAtauNama ?? "").toLowerCase();
  if (s.includes("p3k")) return "p3k";
  if (s.includes("pemadam") || s.includes("damkar")) return "mobil_pemadam";
  if (s.includes("box")) return "hydrant_box";
  if (s.includes("hydrant") || s.includes("pilar")) return "hydrant_pilar";
  return "apar";
}

const DETAIL = "#2B2F36";
const garis = { stroke: DETAIL, strokeWidth: 2.2, strokeLinejoin: "round", strokeLinecap: "round" } as const;

function Gambar({ m, utama }: { m: ModulIlustrasi; utama: string }) {
  switch (m) {
    case "apar":
      return (
        <g>
          <path d="M37 27c-9 0-12 8-12 18v15" fill="none" {...garis} />
          <path d="M21 60h8l-1.5 9h-5z" fill={DETAIL} {...garis} />
          <rect x="35" y="27" width="26" height="55" rx="11" fill={utama} {...garis} />
          <rect x="35" y="46" width="26" height="13" fill="#fff" {...garis} />
          <path d="M41 27v-6h14v6" fill="#D9D6CF" {...garis} />
          <path d="M43 19h15l7-4" fill="none" {...garis} />
          <circle cx="55" cy="15" r="4.5" fill="#fff" {...garis} />
        </g>
      );
    case "p3k":
      return (
        <g>
          <path d="M38 30v-6a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v6" fill="none" {...garis} />
          <rect x="19" y="30" width="58" height="46" rx="8" fill={utama} {...garis} />
          <path d="M44 40h8v9h9v8h-9v9h-8v-9h-9v-8h9z" fill="#fff" {...garis} />
        </g>
      );
    case "hydrant_pilar":
      return (
        <g>
          <rect x="29" y="76" width="38" height="6" rx="2" fill="#D9D6CF" {...garis} />
          <path d="M36 76V40h24v36z" fill={utama} {...garis} />
          <path d="M33 40a15 12 0 0 1 30 0z" fill={utama} {...garis} />
          <rect x="44" y="20" width="8" height="8" rx="2" fill="#D9D6CF" {...garis} />
          <rect x="21" y="50" width="15" height="11" rx="3" fill="#D9D6CF" {...garis} />
          <rect x="60" y="50" width="15" height="11" rx="3" fill="#D9D6CF" {...garis} />
          <path d="M36 67h24" {...garis} />
        </g>
      );
    case "hydrant_box":
      return (
        <g>
          <rect x="21" y="17" width="54" height="66" rx="6" fill={utama} {...garis} />
          <rect x="27" y="23" width="42" height="42" rx="3" fill="#fff" {...garis} />
          <circle cx="48" cy="44" r="14" fill="none" {...garis} />
          <circle cx="48" cy="44" r="7.5" fill="#D9D6CF" {...garis} />
          <circle cx="48" cy="44" r="2" fill={DETAIL} />
          <path d="M27 71h42" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
          <rect x="56" y="69" width="10" height="6" rx="1.5" fill="#fff" {...garis} />
        </g>
      );
    case "mobil_pemadam":
      return (
        <g>
          <path d="M16 34h36M20 34v6M48 34v6M24 34l4-6h20" fill="none" {...garis} />
          <path d="M11 67V45a4 4 0 0 1 4-4h41v26z" fill={utama} {...garis} />
          <path d="M56 41h14l13 13v13H56z" fill={utama} {...garis} />
          <path d="M60 45h9l8 8H60z" fill="#fff" {...garis} />
          <rect x="62" y="34" width="10" height="6" rx="1.5" fill="#fff" {...garis} />
          <path d="M17 53h31" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          <circle cx="26" cy="69" r="8" fill="#D9D6CF" {...garis} />
          <circle cx="69" cy="69" r="8" fill="#D9D6CF" {...garis} />
        </g>
      );
  }
}

/**
 * Satu ilustrasi modul. `latar` false = tanpa lingkaran rona (mis. di atas kartu berwarna).
 * Berikan `judul` bila gambar menyampaikan arti sendiri; tanpa judul gambar disembunyikan dari pembaca layar.
 */
export function IlustrasiModul({
  modul,
  ukuran = 48,
  latar = true,
  judul,
  className,
  style,
}: {
  modul: ModulIlustrasi;
  ukuran?: number;
  latar?: boolean;
  judul?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const w = WARNA[modul];
  return (
    <svg
      viewBox="0 0 96 96"
      width={ukuran}
      height={ukuran}
      className={cn("shrink-0", className)}
      style={style}
      role={judul ? "img" : undefined}
      aria-label={judul}
      aria-hidden={judul ? undefined : true}
      data-modul={modul}
    >
      {latar && (
        <>
          <ellipse cx="48" cy="89" rx="24" ry="4" fill={DETAIL} opacity="0.12" />
          <circle cx="48" cy="46" r="43" fill={w.rona} />
        </>
      )}
      <g transform={latar ? "translate(10 8) scale(0.79)" : undefined}>
        <Gambar m={modul} utama={w.utama} />
      </g>
    </svg>
  );
}

/** Keadaan kosong bergambar: ilustrasi, judul, dan satu kalimat. */
export function KosongModul({
  modul,
  judul,
  isi,
  children,
  className,
}: {
  modul: ModulIlustrasi;
  judul: string;
  isi?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2 px-4 py-8 text-center", className)}>
      <IlustrasiModul modul={modul} ukuran={96} />
      <p className="mt-2 font-semibold">{judul}</p>
      {isi && <p className="max-w-xs text-sm text-muted-foreground">{isi}</p>}
      {children}
    </div>
  );
}

import { cn } from "@/lib/utils";

/** Tanda Geofencing: bingkai sudut + pin. Warna mengikuti currentColor; pin memakai warna merek. */
export function BrandMark({ className, accentPin = false }: { className?: string; accentPin?: boolean }) {
  return (
    <svg viewBox="0 0 36 36" fill="none" aria-hidden="true" focusable="false" className={cn("size-8 shrink-0", className)}>
      <path
        d="M11 3H3v8M25 3h8v8M33 25v8h-8M11 33H3v-8"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g stroke={accentPin ? "var(--brand)" : "currentColor"} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M26 15c0 6-8 13-8 13s-8-7-8-13a8 8 0 1 1 16 0Z" />
        <circle cx="18" cy="15" r="2.75" />
      </g>
    </svg>
  );
}

export function Brand({ className, accentPin, compact }: { className?: string; accentPin?: boolean; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 leading-tight", className)}>
      <BrandMark accentPin={accentPin} />
      {!compact && (
        <span>
          <b className="block text-[17px] font-semibold tracking-tight">Geofencing</b>
          <small className="block text-[9px] uppercase tracking-[0.14em] opacity-70">Inspeksi K3 APAR</small>
        </span>
      )}
    </span>
  );
}

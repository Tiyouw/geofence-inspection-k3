"use client";

/**
 * Pilihan: satu-satunya kontrol pilih (select/combobox) di aplikasi. Pengganti <select> asli.
 *
 * - Pengganti langsung: menerima anak <option> (dan <optgroup>), `name`, `value`/`defaultValue`,
 *   `onChange(e)` dengan `e.target.value`, `disabled`, `required`, `id`, atribut aria.
 * - Nilai dikirim lewat <input> tersembunyi, jadi formulir GET dan Server Action tetap jalan.
 * - Papan ketik: Enter/Spasi/Panah bawah membuka, panah memilih, Enter menetapkan, Esc menutup.
 * - Kotak cari muncul bila pilihan lebih dari 8 (atau `cari`).
 * - Warna dari token semantik (primary, ring, accent), jadi ikut tema tiap peran.
 */
import * as React from "react";
import { cn } from "cn";
import { ChevronsUpDownIcon } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type OpsiPilihan = { value: string; label: string; disabled?: boolean; grup?: string };

/** Ambang jumlah pilihan sebelum kotak cari ditampilkan. */
export const AMBANG_CARI = 8;

function teks(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(teks).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return teks(node.props.children);
  return "";
}

/** Membaca <option>/<optgroup> (termasuk fragmen dan larik) menjadi daftar pilihan. */
export function bacaOpsi(children: React.ReactNode, grup?: string): OpsiPilihan[] {
  const hasil: OpsiPilihan[] = [];
  React.Children.forEach(children, (anak) => {
    if (!React.isValidElement(anak)) return;
    const p = anak.props as { value?: string | number; children?: React.ReactNode; disabled?: boolean; label?: string };
    if (anak.type === React.Fragment) {
      hasil.push(...bacaOpsi(p.children, grup));
    } else if (anak.type === "optgroup") {
      hasil.push(...bacaOpsi(p.children, p.label));
    } else if (anak.type === "option") {
      const label = teks(p.children);
      hasil.push({ value: p.value === undefined ? label : String(p.value), label, disabled: p.disabled, grup });
    }
  });
  return hasil;
}

/** Kunci unik item cmdk (juga bahan pencarian): label lalu nilai, tanpa spasi tepi (cmdk memangkas kunci item, tidak memangkas defaultValue). */
const kunciItem = (o: OpsiPilihan) => `${o.label.trim()}|${o.value.trim()}`;

type PerubahanPilihan = { target: { value: string; name?: string }; currentTarget: { value: string; name?: string } };

export type PilihanProps = {
  children?: React.ReactNode;
  /** Alternatif anak <option>. */
  opsi?: OpsiPilihan[];
  name?: string;
  id?: string;
  value?: string | number | null;
  defaultValue?: string | number | null;
  onChange?: (e: PerubahanPilihan) => void;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  /** Paksa kotak cari tampil/sembunyi; bawaan: tampil bila pilihan > 8. */
  cari?: boolean;
  placeholder?: string;
  className?: string;
  form?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "data-testid"?: string;
};

export function Pilihan({
  children,
  opsi: opsiProp,
  name,
  id,
  value,
  defaultValue,
  onChange,
  onValueChange,
  disabled,
  required,
  cari,
  placeholder = "Pilih…",
  className,
  form,
  ...aria
}: PilihanProps) {
  const opsi = React.useMemo(() => opsiProp ?? bacaOpsi(children), [opsiProp, children]);
  const terkendali = value !== undefined;
  const awal = defaultValue ?? (opsi.find((o) => !o.disabled)?.value ?? "");
  const [nilaiSendiri, setNilaiSendiri] = React.useState(String(awal ?? ""));
  const nilai = terkendali ? String(value ?? "") : nilaiSendiri;
  const [buka, setBuka] = React.useState(false);
  const akar = React.useRef<HTMLDivElement>(null);
  const idOtomatis = React.useId();
  const idDaftar = `${id ?? idOtomatis}-daftar`;
  const terpilih = opsi.find((o) => o.value === nilai);
  const pakaiCari = cari ?? opsi.length > AMBANG_CARI;

  const grup = React.useMemo(() => {
    const peta = new Map<string, OpsiPilihan[]>();
    for (const o of opsi) {
      const k = o.grup ?? "";
      if (!peta.has(k)) peta.set(k, []);
      peta.get(k)!.push(o);
    }
    return [...peta.entries()];
  }, [opsi]);

  function tetapkan(v: string) {
    if (!terkendali) setNilaiSendiri(v);
    const e = { target: { value: v, name }, currentTarget: { value: v, name } };
    onChange?.(e);
    onValueChange?.(v);
    setBuka(false);
  }

  return (
    <>
      <Popover open={buka} onOpenChange={(b) => !disabled && setBuka(b)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            role="combobox"
            aria-expanded={buka}
            aria-controls={idDaftar}
            aria-haspopup="listbox"
            aria-required={required || undefined}
            disabled={disabled}
            data-slot="pilihan"
            data-nilai={nilai}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                setBuka(true);
              }
            }}
            className={cn(
              "flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-background px-2.5 text-left text-sm transition-colors duration-(--durasi) ease-halus outline-none",
              "hover:border-foreground/25 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              "disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
              "data-[state=open]:border-ring",
              className,
            )}
            {...aria}
          >
            <span className={cn("truncate", !terpilih && "text-muted-foreground")}>{terpilih?.label ?? placeholder}</span>
            <ChevronsUpDownIcon aria-hidden className="size-3.5 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-(--radix-popover-trigger-width) min-w-48 p-0"
          onOpenAutoFocus={(e) => {
            if (!pakaiCari) {
              // Tanpa kotak cari, fokus ke akar cmdk supaya panah dan Enter langsung berfungsi.
              e.preventDefault();
              akar.current?.focus();
            }
          }}
        >
          <Command
            ref={akar}
            tabIndex={-1}
            defaultValue={terpilih ? kunciItem(terpilih) : undefined}
            loop
            className="rounded-lg outline-none"
          >
            {pakaiCari && <CommandInput placeholder="Cari…" aria-label="Cari pilihan" />}
            <CommandList id={idDaftar} tabIndex={-1} label={aria["aria-label"] ?? "Pilihan"} className="max-h-72 outline-none">
              <CommandEmpty>Tidak ada yang cocok.</CommandEmpty>
              {grup.map(([g, daftar]) => (
                <CommandGroup key={g || "_"} heading={g || undefined}>
                  {daftar.map((o) => (
                    <CommandItem
                      key={o.value}
                      value={kunciItem(o)}
                      keywords={[o.label]}
                      disabled={o.disabled}
                      onSelect={() => tetapkan(o.value)}
                      data-checked={o.value === nilai}
                      className="min-h-9 sm:min-h-8"
                    >
                      <span className="truncate">{o.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {name !== undefined &&
        (required ? (
          // Bisa divalidasi browser (hidden tidak bisa `required`), tapi tidak terlihat dan tidak dapat difokus.
          <input
            tabIndex={-1}
            aria-hidden
            className="pointer-events-none absolute size-px opacity-0"
            name={name}
            value={nilai}
            required
            form={form}
            onChange={() => {}}
            onInvalid={() => setBuka(false)}
          />
        ) : (
          <input type="hidden" name={name} value={nilai} form={form} />
        ))}
    </>
  );
}

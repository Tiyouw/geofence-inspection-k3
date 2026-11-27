"use client"

import * as React from "react"
import { Eye, EyeOff } from "lucide-react"
import { cn } from "cn"

import { Input } from "@/components/ui/input"

/**
 * Kolom kata sandi dengan tombol mata untuk menampilkan atau menyembunyikannya. Tombol bisa
 * dijangkau papan ketik (Tab, lalu Enter/Spasi), labelnya mengikuti keadaan, dan ikonnya
 * berganti dengan pudar + putar kecil.
 */
function InputSandi({
  className,
  wadahClassName,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type"> & { wadahClassName?: string }) {
  const [lihat, setLihat] = React.useState(false)
  const ikon = "absolute inset-0 m-auto size-4 transition-[opacity,transform] duration-(--durasi) ease-halus"

  return (
    <div data-slot="input-sandi" className={cn("relative", wadahClassName)}>
      <Input {...props} type={lihat ? "text" : "password"} className={cn("pr-11", className)} />
      <button
        type="button"
        onClick={() => setLihat((v) => !v)}
        aria-label={lihat ? "Sembunyikan sandi" : "Tampilkan sandi"}
        aria-pressed={lihat}
        aria-controls={props.id}
        disabled={props.disabled}
        className="absolute inset-y-0 right-0 w-11 rounded-r-lg text-muted-foreground transition-colors duration-(--durasi-cepat) outline-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
      >
        <span className="relative block size-full" aria-hidden>
          <Eye className={cn(ikon, lihat ? "scale-75 -rotate-45 opacity-0" : "scale-100 rotate-0 opacity-100")} />
          <EyeOff className={cn(ikon, lihat ? "scale-100 rotate-0 opacity-100" : "scale-75 rotate-45 opacity-0")} />
        </span>
      </button>
    </div>
  )
}

export { InputSandi }

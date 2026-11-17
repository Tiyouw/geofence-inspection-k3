"use client"

import * as React from "react"
import { cn } from "cn"

/**
 * Pesan (galat, validasi) yang membuka dan menutup halus: tinggi dan opasitas bertransisi,
 * isi di bawahnya bergeser pelan, tidak melompat. Teks terakhir tetap tampil selama menutup.
 *
 * `celah` = jarak `gap` wadah flex/grid induknya (mis. "1rem"). Saat tertutup, pesan tidak
 * memakan celah itu; saat terbuka, jaraknya sama seperti anak lain. Di wadah `space-y-*`
 * tambahkan `className="my-0!"` dengan `celah` sebesar jarak itu.
 */
function PesanMuncul({
  pesan,
  id,
  role,
  celah = "0px",
  className,
  isiClassName,
  testId,
}: {
  pesan?: React.ReactNode
  id?: string
  role?: "alert" | "status"
  celah?: string
  className?: string
  isiClassName?: string
  testId?: string
}) {
  const buka = pesan != null && pesan !== false && pesan !== ""
  const [terakhir, setTerakhir] = React.useState<React.ReactNode>(pesan)
  if (buka && pesan !== terakhir) setTerakhir(pesan)

  return (
    <div
      data-slot="pesan-muncul"
      data-buka={buka || undefined}
      style={{ "--celah": celah } as React.CSSProperties}
      className={cn(
        "my-[calc(var(--celah)/-2)] grid transition-[grid-template-rows,opacity] duration-(--durasi) ease-halus",
        buka ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        className
      )}
    >
      <div className="min-h-0 overflow-hidden" aria-hidden={!buka || undefined}>
        <div className="py-[calc(var(--celah)/2)]">
          <div id={buka ? id : undefined} role={role} data-testid={testId} className={isiClassName}>
            {buka ? pesan : terakhir}
          </div>
        </div>
      </div>
    </div>
  )
}

export { PesanMuncul }

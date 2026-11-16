"use client";

import { useSearchParams } from "next/navigation";
import { Formulir } from "./formulir";
import { Pemindai } from "./pemindai";

export function HalamanPindai() {
  const token = useSearchParams().get("token") ?? undefined;
  return <Pemindai tokenAwal={token} />;
}

export function HalamanIsi() {
  const id = useSearchParams().get("id");
  if (!id) return <p className="text-sm">Draf tidak dipilih.</p>;
  return <Formulir key={id} inspectionId={id} />;
}

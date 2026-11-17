"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/** Leaflet butuh `window`: dimuat hanya di klien. */
export const PetaArea = dynamic(() => import("./peta-area-leaflet"), {
    ssr: false,
    loading: () => <Skeleton className="h-[620px] w-full rounded-lg" />,
});

export type { PoligonTampil, TitikAset } from "./peta-area-leaflet";

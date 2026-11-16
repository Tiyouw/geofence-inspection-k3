"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/** Leaflet butuh `window`: dimuat hanya di klien. */
export const Peta = dynamic(() => import("./peta-leaflet"), {
    ssr: false,
    loading: () => <Skeleton className="h-[360px] w-full rounded-lg" />,
});

export type { TitikTampil } from "./peta-leaflet";

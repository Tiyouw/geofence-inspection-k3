"use client";

import { Check, RotateCcw } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { tandaiMasukan } from "./aksi";

export function TombolSelesai({ id, selesai }: { id: string; selesai: boolean }) {
    const [sibuk, mulai] = useTransition();
    return (
        <Button
            size="sm"
            variant={selesai ? "outline" : "default"}
            className="ml-auto"
            disabled={sibuk}
            onClick={() =>
                mulai(async () => {
                    const r = await tandaiMasukan(id, !selesai);
                    if (!r.ok) toast.error("Gagal menyimpan. Coba lagi.");
                })
            }
        >
            {selesai ? <RotateCcw className="size-4" aria-hidden /> : <Check className="size-4" aria-hidden />}
            {selesai ? "Buka lagi" : "Tandai selesai"}
        </Button>
    );
}

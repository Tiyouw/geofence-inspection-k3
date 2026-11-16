"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TombolCetak() {
    return (
        <Button type="button" variant="brand" onClick={() => window.print()}>
            <Printer aria-hidden /> Cetak
        </Button>
    );
}

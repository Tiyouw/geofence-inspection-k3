"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function SalinMarkdown({ teks }: { teks: string }) {
    const [tersalin, setTersalin] = useState(false);
    return (
        <Button
            variant="brand"
            onClick={async () => {
                await navigator.clipboard.writeText(teks);
                setTersalin(true);
                setTimeout(() => setTersalin(false), 2000);
            }}
        >
            {tersalin ? "Tersalin" : "Salin Markdown"}
        </Button>
    );
}

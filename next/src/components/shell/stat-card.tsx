import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TONES = {
  default: "",
  success: "border-l-4 border-l-success",
  warning: "border-l-4 border-l-brand",
  danger: "border-l-4 border-l-danger",
} as const;

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: keyof typeof TONES;
}) {
  return (
    <Card className={cn("gap-0 py-0", TONES[tone])}>
      <CardContent className="p-5">
        <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{label}</p>
        <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

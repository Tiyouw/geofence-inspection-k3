/** Label tingkat temuan di panel admin. Temuan tanpa alur tindak lanjut (ADR-4). */
import type { Severity } from "@/lib/domain/constants";

export const LABEL_SEVERITY: Record<Severity, string> = { berat: "Berat", sedang: "Sedang", ringan: "Ringan" };

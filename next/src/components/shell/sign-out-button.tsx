import { LogOut } from "lucide-react";
import { keluar } from "@/app/(publik)/masuk/actions";
import { cn } from "@/lib/utils";

/** `ringkas`: hanya ikon; label "Keluar" tetap terbaca pembaca layar. */
export function SignOutButton({ className, ringkas = false }: { className?: string; ringkas?: boolean }) {
  return (
    <form action={keluar}>
      <button type="submit" title={ringkas ? "Keluar" : undefined} className={cn("inline-flex items-center gap-2 text-sm", className)}>
        <LogOut className="size-4" aria-hidden />
        <span className={cn(ringkas && "sr-only")}>Keluar</span>
      </button>
    </form>
  );
}

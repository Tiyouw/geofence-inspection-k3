import { LogOut } from "lucide-react";
import { keluar } from "@/app/(publik)/masuk/actions";
import { cn } from "@/lib/utils";

export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={keluar}>
      <button type="submit" className={cn("inline-flex items-center gap-2 text-sm", className)}>
        <LogOut className="size-4" aria-hidden />
        Keluar
      </button>
    </form>
  );
}

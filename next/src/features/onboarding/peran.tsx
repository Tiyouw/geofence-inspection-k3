import type { SessionUser } from "@/lib/auth/guards";
import { Onboarding } from "./onboarding";
import { perluSambutan } from "./server";

/** Sambutan + tur untuk peran akun ini; status "sudah selesai" dibaca dari server. */
export async function OnboardingPeran({ user, beranda }: { user: SessionUser; beranda: string }) {
    return <Onboarding peran={user.role} userId={user.id} sambut={await perluSambutan(user)} beranda={beranda} />;
}

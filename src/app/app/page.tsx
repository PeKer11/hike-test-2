import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import {
  getProfileDefaults,
  type ProfileDefaults,
} from "@/lib/preferences/preference-store";
import { AppShell } from "@/components/shell/AppShell";

export const metadata: Metadata = {
  title: "Home — Traike",
};

// Post-login landing *and* the planner, in one page: the shell keeps the planner mounted and switches screens
// with ?view= (home, plan, walk, walks, social, me) so GPS, chat and timers never reset.
export default async function AppHubPage() {
  let greetingName: string | null = null;
  // What the walk form below opens on for a returning walker. Stays null for a
  // logged-out visitor and for anyone with nothing saved yet, and the form falls
  // back to its own defaults.
  let profileDefaults: ProfileDefaults | null = null;

  // Auth is optional — without Supabase configured the app must still run.
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    greetingName = user?.email?.split("@")[0] ?? null;
    if (user) {
      profileDefaults = await getProfileDefaults(supabase, user.id);
    }
  }

  return (
    <AppShell
      greetingName={greetingName}
      suggestedPace={profileDefaults?.walkingPaceMinPerKm ?? null}
      suggestedCategories={profileDefaults?.preferredCategories ?? null}
    />
  );
}

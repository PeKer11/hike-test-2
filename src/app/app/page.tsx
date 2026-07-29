import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { PlannerFrame } from "@/components/planner/PlannerFrame";

export const metadata: Metadata = {
  title: "Home — Traike",
};

// Post-login landing *and* the planner. There is no second route: the planner
// renders here inside a small frame that expands to fill the viewport, the way
// a video embed goes fullscreen without navigating anywhere.
export default async function AppHubPage() {
  let greetingName: string | null = null;

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
  }

  return (
    <main className="min-h-screen bg-cream font-brand text-charcoal">
      <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-8 sm:px-6">
        <header className="max-w-2xl space-y-2 pr-40">
          <span className="font-display text-sm font-bold tracking-wide text-terra">
            Traike
          </span>
          <h1 className="font-display text-3xl font-bold leading-tight text-forest">
            {greetingName ? `Welcome back, ${greetingName}.` : "Welcome back."}
          </h1>
          <p className="text-sm leading-relaxed text-charcoal/70">
            Your walk planner is right here — use it as it sits, or expand it to
            fill the screen. Walks are the first thing Traike plans for you;
            other kinds of outings will get their own space here later.
          </p>
        </header>

        <PlannerFrame />
      </div>
    </main>
  );
}

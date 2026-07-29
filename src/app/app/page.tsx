import type { Metadata } from "next";
import Image from "next/image";

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
    <main className="relative min-h-screen overflow-hidden bg-cream font-brand text-charcoal">
      {/* Same blurred-photo + cream-scrim treatment as /login and the planner
          sidebar, but scoped to the page's own chrome: it lives on <main>, and
          the PlannerFrame below paints its own opaque bg-cream, so the photo
          reads around the tool (header band, margins, the strip under the
          frame) and never behind the map or sidebar. Two differences from
          /login: the blur goes to blur-lg because the greeting sits *directly*
          on the photo rather than on an opaque Card, and this source is much
          busier (blazing sun, near-black trees) than the auth gradient; and the
          scrim is stepped rather than even — 84% behind the header so
          text-charcoal/70 body copy clears WCAG AA against the darkest tree
          mass, opening to 66% through the middle where only margins show (that
          band is where the landscape actually gets to be a landscape), then
          back to 90% at the foot so the page settles into cream instead of
          fighting the frame's bottom edge. */}
      <Image
        src="/images/hub-mountain-lake-sunset.png"
        alt=""
        fill
        priority
        sizes="100vw"
        aria-hidden
        className="scale-105 object-cover object-center blur-lg"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-cream/62 via-cream/44 to-cream/74"
      />
      {/* Second, local scrim over the header band only. The page-wide wash above
          is deliberately light so the landscape survives, but that leaves the
          terracotta wordmark at ~2.4:1 against the photo's grey-lavender haze —
          below AA. This band pushes the text zone to ~92% cream at the crown,
          fading out by 14rem, which is where the header ends and the frame
          begins. Net effect: legible copy at the top, real photograph
          everywhere else. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-cream/80 via-cream/55 to-transparent"
      />
      <div className="relative mx-auto w-full max-w-6xl space-y-5 px-4 py-8 sm:px-6">
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

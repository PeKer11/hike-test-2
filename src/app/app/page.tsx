import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";

export const metadata: Metadata = {
  title: "Home — Traike",
};

// Post-login landing. Deliberately does one thing: greet the signed-in walker
// and hand them into the planner at /app/plan.
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cream p-4 font-brand text-charcoal">
      {/* Same blurred-photo + cream-scrim treatment as /login and the planner
          sidebar. This source is far more saturated and far busier than either
          (blazing sun, near-black trees), so the blur goes up to blur-md to
          kill the high-frequency detail that would otherwise fight the card
          edge, and the cream scrim runs 48–66% to pull the extremes toward the
          brand surface. All copy sits on the opaque white Card rather than
          directly on the photo, which is what keeps every contrast pair well
          past WCAG AA regardless of what's behind it — so the wash only has to
          calm the image, not carry text. Landscape still reads: orange sky
          top, teal water bottom. */}
      <Image
        src="/images/hub-mountain-lake-sunset.png"
        alt=""
        fill
        priority
        sizes="100vw"
        aria-hidden
        className="scale-105 object-cover object-center blur-md"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-cream/58 via-cream/48 to-cream/66" />

      <Card className="relative w-full max-w-md space-y-6 p-8 text-center">
        <div className="space-y-2">
          <span className="font-display text-sm font-bold tracking-wide text-terra">
            Traike
          </span>
          <h1 className="font-display text-3xl font-bold leading-tight text-forest">
            {greetingName ? `Welcome back, ${greetingName}.` : "Welcome back."}
          </h1>
          <p className="text-sm leading-relaxed text-charcoal/70">
            You&apos;re signed in. Tell Traike how long you have and it&apos;ll
            shape a walk around your pace and the city in front of you.
          </p>
        </div>

        <Link
          href="/app/plan"
          className="inline-flex h-12 w-full items-center justify-center rounded-[10px] bg-terra px-7 text-base font-bold text-cream shadow-[0_4px_20px_rgba(30,61,47,0.2)] transition-colors hover:bg-terra/90"
        >
          Start planning your walk
        </Link>
      </Card>
    </main>
  );
}

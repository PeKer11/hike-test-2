import Image from "next/image";
import Link from "next/link";

import { LogoutButton } from "@/components/auth/LogoutButton";
import { TraikeLockup } from "@/components/ui/TraikeMark";
import { createClient } from "@/lib/supabase/server";

// Server component: reads the session from request cookies, which the proxy
// (src/proxy.ts) has already refreshed by the time this renders.
export async function SiteHeader({ variant = "landing" }: { /** "app": the round 13 type and controls (pricing). "landing": the marketing page's own look. */ variant?: "landing" | "app" } = {}) {
  const isSupabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  const user = isSupabaseConfigured
    ? (await (await createClient()).auth.getUser()).data.user
    : null;

  if (variant === "app") {
    return (
      <header className="sticky top-0 z-40 border-b-[1.5px] border-[var(--tk-ctl)] bg-cream font-app-sans text-tk-ink">
        <div className="tk-page flex items-center justify-between gap-3 px-4 py-2.5">
          <Link href="/" className="flex items-center" aria-label="Traike home">
            <TraikeLockup />
          </Link>
          <nav className="flex items-center gap-1 sm:gap-4">
            <Link href="/#how-it-works" className="hidden min-h-11 items-center px-2 text-[16px] font-semibold hover:underline sm:flex">
              How it works
            </Link>
            <Link href="/pricing" className="flex min-h-11 items-center px-2 text-[16px] font-semibold hover:underline">
              Pricing
            </Link>
            {user ? (
              <LogoutButton className="flex min-h-11 items-center px-2 text-[16px] font-semibold hover:underline disabled:opacity-50" />
            ) : (
              <Link href="/login" className="flex min-h-11 items-center px-2 text-[16px] font-semibold hover:underline">
                Log in
              </Link>
            )}
            <Link href="/app" className="tk-btn tk-btn-primary tk-btn-sm hidden sm:inline-flex">
              Start your walk
            </Link>
          </nav>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 bg-cream/90 backdrop-blur-sm shadow-[0_2px_16px_rgba(30,61,47,0.08)]">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center" aria-label="Traike home">
          <Image
            src="/traike-lockup.png"
            alt="Traike"
            width={163}
            height={36}
            priority
            className="h-8 w-auto mix-blend-multiply sm:h-9"
          />
        </Link>
        <nav className="flex items-center gap-4 sm:gap-8">
          <Link
            href="/#how-it-works"
            className="hidden text-sm font-semibold text-forest hover:text-terra sm:block"
          >
            How it works
          </Link>
          <Link
            href="/pricing"
            className="text-sm font-semibold text-forest hover:text-terra"
          >
            Pricing
          </Link>
          {user ? (
            <LogoutButton className="text-sm font-semibold text-forest hover:text-terra disabled:text-forest/50" />
          ) : (
            <Link
              href="/login"
              className="text-sm font-semibold text-forest hover:text-terra"
            >
              Log in
            </Link>
          )}
          <Link
            href="/app"
            className="rounded-[10px] bg-terra px-4 py-2 text-sm font-bold text-cream shadow-[0_4px_20px_rgba(30,61,47,0.12)] transition-colors hover:bg-terra/90 sm:px-5 sm:py-2.5"
          >
            Start your walk
          </Link>
        </nav>
      </div>
    </header>
  );
}

import Image from "next/image";
import Link from "next/link";

import { TraikeLockup } from "@/components/ui/TraikeMark";

export function SiteFooter({ variant = "landing" }: { /** "app": the round 13 type and colours (pricing). "landing": the marketing page's own look. */ variant?: "landing" | "app" } = {}) {
  if (variant === "app") {
    return (
      <footer className="border-t-[1.5px] border-[var(--tk-ctl)] bg-tk-bar font-app-sans text-tk-ink">
        <div className="tk-page flex flex-col gap-6 px-4 py-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs">
            <TraikeLockup />
            <p className="mt-3 text-[14px] leading-[1.45] text-tk-sage">Your Personal Hiking Companion. A walk built around your pace, your interests, and the time you actually have.</p>
          </div>
          <nav aria-label="Explore" className="flex flex-col text-[16px] font-semibold">
            <Link href="/#how-it-works" className="flex min-h-11 items-center hover:underline">How it works</Link>
            <Link href="/pricing" className="flex min-h-11 items-center hover:underline">Pricing</Link>
            <Link href="/app" className="flex min-h-11 items-center hover:underline">Open Traike</Link>
            <Link href="/privacy" className="flex min-h-11 items-center hover:underline">Privacy</Link>
          </nav>
        </div>
        <p className="border-t border-tk-hair py-4 text-center text-[13px] text-tk-sage">© {new Date().getFullYear()} Traike. Made for people who wander.</p>
      </footer>
    );
  }
  return (
    <footer className="bg-forest text-cream">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:items-start md:justify-between md:py-16">
        <div className="max-w-xs">
          <Image
            src="/traike-lockup.png"
            alt="Traike"
            width={163}
            height={36}
            className="h-9 w-auto rounded-md bg-cream px-2 py-1"
          />
          <p className="mt-4 text-sm leading-relaxed text-cream/80">
            Your Personal Hiking Companion. A walk built around your pace, your
            interests, and the time you actually have.
          </p>
        </div>
        <nav className="flex gap-16 text-sm">
          <div className="flex flex-col gap-3">
            <span className="font-bold text-cream/60">Explore</span>
            <Link href="/#how-it-works" className="hover:text-skysoft">
              How it works
            </Link>
            <Link href="/pricing" className="hover:text-skysoft">
              Pricing
            </Link>
            <Link href="/app" className="hover:text-skysoft">
              Open Traike
            </Link>
          </div>
        </nav>
      </div>
      <div className="border-t border-cream/10 py-5 text-center text-xs text-cream/60">
        © {new Date().getFullYear()} Traike. Made for people who wander.
      </div>
    </footer>
  );
}

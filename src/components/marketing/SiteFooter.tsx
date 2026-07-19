import Image from "next/image";
import Link from "next/link";

export function SiteFooter() {
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

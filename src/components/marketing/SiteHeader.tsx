import Image from "next/image";
import Link from "next/link";

export function SiteHeader() {
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

import Image from "next/image";
import Link from "next/link";

import styles from "./landing.module.css";
import { RouteMap } from "./RouteMap";

/* Phase 1: static hero. Phase 3 turns this into the scroll-driven story
   (camera push into the phone, cloud cover, full-bleed map). */
export function LandingHero() {
  return (
    <section className="relative isolate overflow-hidden">
      <Image
        src="/images/hero-tent-sunrise-new.png"
        alt=""
        fill
        fetchPriority="high"
        sizes="100vw"
        aria-hidden
        className="-z-20 object-cover object-[50%_40%]"
      />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_75%_at_22%_45%,rgba(251,248,244,0.88),transparent_72%)]" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-b from-transparent to-cream" />

      <div className="mx-auto grid min-h-[680px] max-w-[1200px] items-center gap-10 px-4 pb-20 pt-14 sm:px-6 md:min-h-[calc(100svh-60px)] md:grid-cols-[1.15fr_0.85fr] md:pb-28">
        <div>
          <h1 className="max-w-xl font-display text-5xl font-normal leading-[1.05] text-forest md:text-[clamp(44px,6vw,88px)]">
            A walk built around you
          </h1>
          <p className="mt-6 max-w-md text-xl leading-relaxed text-forest/85">
            Tell Traike how much time you have. It shapes the walk around you.
          </p>
          <Link
            href="/app"
            className="mt-9 inline-block rounded-full bg-terra px-8 py-4 text-lg font-bold text-cream shadow-[0_8px_24px_rgba(193,95,60,0.45)] transition-colors hover:bg-terra/90"
          >
            Start a free walk
          </Link>
        </div>

        <div className="flex justify-center md:justify-end md:pe-6">
          <div className="md:-rotate-[4deg]">
            <div className={styles.bob}>
              <div className="relative h-[440px] aspect-[0.49] rounded-[44px] bg-tk-ink p-[10px] shadow-[0_40px_80px_-20px_rgba(7,42,31,0.55),inset_0_0_0_1px_rgba(255,255,255,0.12)] md:h-[min(62svh,600px)]">
                <div className="relative h-full w-full overflow-hidden rounded-[34px] bg-cream">
                  <RouteMap variant="portrait" className="absolute inset-0 h-full w-full" />
                  <span className="absolute left-1/2 top-2.5 h-5 w-20 -translate-x-1/2 rounded-full bg-tk-ink" />
                  <span className="absolute bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-cream/95 px-4 py-2 text-[15px] font-semibold text-forest shadow-[0_6px_18px_rgba(30,61,47,0.25)]">
                    90 min · 4.2 km · 3 stops
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

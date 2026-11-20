import type { ReactNode } from "react";

/** Cream type that sits on the sunset art; a soft shadow keeps it readable where the sky is light. */
const ON_ART = "text-[#FFF7EC] [text-shadow:0_1px_10px_rgba(60,20,6,0.55)]";

/**
 * The top of a hub screen (Walks, Me): sunset art, the Traike mark, and whatever the screen puts on it. The art
 * melts into the cream sheet below, so there is no seam and no strip. "walks" is the Jaffa scene; "sky" is the
 * plain sunset gradient. Mirrored in Hebrew so the open sky stays on the side the text starts from.
 */
export function ScreenBand({ art, children }: { art: "walks" | "sky"; children: ReactNode }) {
  return (
    <header className={`relative isolate overflow-hidden bg-cream ${art === "walks" ? "min-h-[250px]" : "min-h-[230px]"}`}>
      {art === "walks" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/images/traike/band-walks.svg" alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full object-cover object-bottom rtl:-scale-x-100 dark:brightness-[0.55] dark:saturate-[0.85]" />
      ) : (
        <div aria-hidden className="absolute inset-0 -z-10 [background:var(--tk-sky)]" />
      )}
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-[32%] bg-gradient-to-b from-transparent to-cream" />
      <div className="relative mx-auto max-w-[560px] px-4 pb-11 pt-[max(18px,env(safe-area-inset-top))]">
        <span dir="ltr" className={`flex w-fit items-center gap-2.5 ${ON_ART}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/traike-icon.png" alt="" width={30} height={30} className="h-[30px] w-[30px] rounded-lg" />
          <span className="font-app-serif text-[24px] font-bold leading-none tracking-tight">Traike</span>
        </span>
        {children}
      </div>
    </header>
  );
}

export function BandTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h1 className={`max-w-[260px] font-display text-[32px] leading-[1.1] ${ON_ART} ${className}`}>{children}</h1>;
}

/** A designed number: soft Fraunces numerals, the label small beside it. */
export function BandStat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <p className={`mt-3 flex items-baseline gap-2 ${ON_ART}`}>
      <bdi className="font-app-serif text-[44px] font-semibold leading-none [font-variation-settings:'SOFT'_100,'WONK'_1]">{value}</bdi>
      <span className="text-[15px] font-semibold">{label}</span>
    </p>
  );
}

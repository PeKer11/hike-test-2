import type { ReactNode } from "react";

/** Cream type that sits on the sunset art; a soft shadow keeps it readable where the sky is light. */
const ON_ART = "text-[#FFF7EC] [text-shadow:0_1px_10px_rgba(60,20,6,0.55)]";

/** The painted scenes of the hub screens. Each is a 390x300 sunset in the same palette as the Home photo bands. */
const SCENES = {
  walks: "/images/traike/band-walks.svg",
  me: "/images/traike/band-me.svg",
  friends: "/images/traike/band-friends.svg",
} as const;

export type BandArt = keyof typeof SCENES;

/**
 * The top of a hub screen (Walks, Friends, Me): a painted sunset scene, the Traike mark, and whatever the screen
 * puts on it. The art melts into the cream sheet below, so there is no seam and no strip. Mirrored in Hebrew so the
 * open sky stays on the side the text starts from.
 */
export function ScreenBand({ art, actions, children }: { art: BandArt; /** Controls at the end of the brand row (an invite pill, an avatar). */ actions?: ReactNode; children: ReactNode }) {
  return (
    <header className="relative isolate min-h-[260px] overflow-hidden bg-cream">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={SCENES[art]} alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full object-cover object-bottom rtl:-scale-x-100 dark:brightness-[0.55] dark:saturate-[0.85]" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-[32%] bg-gradient-to-b from-transparent to-cream" />
      <div className="relative mx-auto max-w-[560px] px-4 pb-11 pt-[max(18px,env(safe-area-inset-top))]">
        {/* The mark stays on the left in Hebrew too. */}
        <div dir="ltr" className="flex items-center justify-between gap-3">
          <span className={`flex w-fit items-center gap-2.5 ${ON_ART}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/traike-icon.png" alt="" width={30} height={30} className="h-[30px] w-[30px] rounded-lg" />
            <span className="font-app-serif text-[24px] font-bold leading-none tracking-tight">Traike</span>
          </span>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
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

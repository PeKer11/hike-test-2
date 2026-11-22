import type { ReactNode } from "react";

/** Cream type that sits on the sunset art; a soft shadow keeps it readable where the sky is light. */
const ON_ART = "text-[#FFF7EC] [text-shadow:0_1px_10px_rgba(60,20,6,0.55)]";

/** The painted scenes of the hub screens. Each is a 390x300 sunset in the same palette as the Home photo bands. */
const SCENES = {
  walks: "/images/traike/band-walks.svg",
  me: "/images/traike/band-me.svg",
  friends: "/images/traike/band-friends.svg",
} as const;

export type BandArt = keyof typeof SCENES | "sky";

/**
 * The top of a hub screen (Walks, Friends, Me): a painted sunset scene, the Traike mark, and whatever the screen
 * puts on it. The art melts into the cream sheet below, so there is no seam and no strip. Mirrored in Hebrew so the
 * open sky stays on the side the text starts from.
 */
export function ScreenBand({ art, actions, tall = false, children }: { art: BandArt; /** Controls at the end of the brand row (the start chip, an avatar). */ actions?: ReactNode; /** The Walks / Friends band is 310px; Me is a compact band. */ tall?: boolean; children: ReactNode }) {
  return (
    <header className={`relative isolate overflow-hidden bg-cream ${tall ? "min-h-[310px]" : "min-h-[192px]"}`}>
      {/* The painted sky is always behind the band; the scene sits on it. */}
      <div aria-hidden className="absolute inset-0 -z-10" style={{ background: "var(--tk-sky)" }} />
      {art === "sky" ? null : (
        <>
          {/* The scene is a 390x300 composition with the sun and boat under the title. On a wide screen it keeps that size
              at the start of the content column (never stretched to the viewport, which slid the sun and boat under the
              text) and melts into the sky on its far side (and on its near side once the column no longer touches the screen edge). It is mirrored in Hebrew, so "start" follows the language. */}
          <div aria-hidden className="absolute inset-x-0 inset-y-0 -z-10 mx-auto max-w-[560px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={SCENES[art]} alt="" className="absolute inset-y-0 start-0 h-full w-full object-cover object-bottom rtl:-scale-x-100 min-[430px]:w-[403px] min-[430px]:[mask-image:linear-gradient(to_right,#000_82%,transparent)] min-[600px]:[mask-image:linear-gradient(to_right,transparent,#000_10%,#000_82%,transparent)] dark:brightness-[0.55] dark:saturate-[0.85]" />
          </div>
          <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-[32%] bg-gradient-to-b from-transparent to-cream" />
        </>
      )}
      <div className="relative mx-auto max-w-[560px] px-4 pb-4 pt-[max(14px,env(safe-area-inset-top))]">
        {/* The mark stays on the left in Hebrew too. */}
        <div dir="ltr" className="flex h-9 items-center justify-between gap-2">
          <span className={`flex w-fit items-center gap-2 ${ON_ART}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/traike-icon.png" alt="" width={30} height={30} className="h-[30px] w-[30px] rounded-lg" />
            <span className="font-app-serif text-[24px] font-bold leading-none">Traike</span>
          </span>
          {actions ? <div className="flex min-w-0 max-w-[64%] items-center justify-end gap-2">{actions}</div> : null}
        </div>
        {children}
      </div>
    </header>
  );
}

export function BandTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  // <bdi>, not dir="auto": the line keeps the language's direction (a Latin name in Hebrew still starts on the right).
  return <h1 className={`max-w-[230px] font-display text-[28px] font-normal leading-[1.12] ${ON_ART} ${className}`}><bdi>{children}</bdi></h1>;
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

/** One quiet line under the title (the mockup's "12 walks · 48.4 km"). */
export function BandMeta({ children }: { children: ReactNode }) {
  return <p className={`mt-[10px] text-[14px] font-semibold leading-5 ${ON_ART}`}>{children}</p>;
}

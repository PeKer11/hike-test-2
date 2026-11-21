import { WalkIcon } from "@/components/shell/icons";

/** The clock time `minutes` from now, as 24-hour HH:MM (digits only, so it reads the same in Hebrew). */
export function etaClock(minutes: number, now = Date.now()): string {
  const at = new Date(now + minutes * 60_000);
  return `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
}

/**
 * The live walk's deck (round 13 mockup C): the pine-to-sunset band at the top of the sheet. A big
 * number of minutes to the next stop with the 3D pin, then one line naming the stop with its arrival
 * time. The app has no turn-by-turn data, so there is no turn arrow: the glyph is the walker.
 */
export function WalkTurnDeck({
  label,
  name,
  minutes,
  minUnit,
}: {
  /** "Next stop" in the walker's language. */
  label: string;
  name: string;
  /** Minutes to the stop; null when the distance is not known yet. */
  minutes: number | null;
  minUnit: string;
}) {
  return (
    <div data-testid="walk-turn-deck" className="tk-turn-deck -mx-4 flex flex-col gap-2.5 px-4 pb-3.5 pt-8">
      {minutes !== null ? (
        <div className="grid grid-cols-[48px_1fr_48px] items-center gap-3">
          <span aria-hidden className="grid h-12 w-12 place-items-center rounded-[6px] border border-[var(--tk-hair)] bg-[var(--tk-cream)] text-[var(--tk-tk-ink)] shadow-[0_2px_0_var(--tk-lip)]">
            <WalkIcon className="h-6 w-6" />
          </span>
          <p className="flex min-w-0 items-baseline gap-1.5">
            <bdi className="font-app-serif text-[54px] font-semibold leading-[0.88] tracking-[-0.03em] tabular-nums [font-variation-settings:'SOFT'_100,'WONK'_1]">{minutes}</bdi>
            <span className="text-[18px] font-semibold leading-none">{minUnit}</span>
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/traike/3d/pin.png" alt="" aria-hidden className="h-[46px] w-[46px] justify-self-end object-contain drop-shadow-[0_6px_10px_rgba(27,38,32,0.32)]" />
        </div>
      ) : null}
      <div
        data-testid="walk-next-stop"
        dir="auto"
        className={`flex items-center justify-between gap-2 text-[16px] font-semibold ${minutes !== null ? "border-t border-[rgba(255,245,232,0.22)] pt-2" : ""}`}
      >
        <span className="min-w-0 truncate">
          {label} · <bdi>{name}</bdi>
        </span>
        {minutes !== null ? (
          <span className="tk-time-tag">
            <bdi dir="ltr">{etaClock(minutes)}</bdi>
          </span>
        ) : null}
      </div>
    </div>
  );
}

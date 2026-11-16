import { paceBarTone, type PaceTone } from "@/lib/walk/walk-stats";
import { walkCopy } from "@/lib/walk/walk-copy";
import type { SpeedState } from "@/lib/walk/speed-estimator";

export interface WalkStatsData {
  /** Measured speed; null until known. */
  kmh: number | null;
  speedState: SpeedState;
  plannedPaceMinPerKm: number;
  timeToFinishMin: number | null;
  elapsedMin: number;
  /** True when elapsed + remaining overshoots the time the walker allowed. */
  overBudget: boolean;
  distanceToFinishKm: number | null;
  walkedM: number;
  remainingM: number;
  /** The minutes the walker allowed in total, when known (for the "over plan" line). */
  allowedMin?: number;
}

const TONE_DOT: Record<PaceTone, string> = {
  good: "bg-forest",
  warn: "bg-amber-500",
  bad: "bg-terra",
};

function Stat({
  label,
  value,
  unit,
  dot,
  tone,
}: {
  label: string;
  value: string;
  unit?: string;
  /** A coloured dot before the number (pace). */
  dot?: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0 flex-1 px-2 text-center">
      <p className={`flex items-center justify-center gap-1.5 text-[28px] font-light leading-[30px] tabular-nums ${tone ?? "text-tk-ink"}`}>
        {dot ? <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} /> : null}
        <span dir="ltr">
          {value}
          {unit ? <span className="ms-1 text-[13px] font-medium text-charcoal/60">{unit}</span> : null}
        </span>
      </p>
      <p className="truncate text-[13px] font-medium leading-[18px] text-charcoal/60">{label}</p>
    </div>
  );
}

/**
 * The three live numbers (distance left, time left, speed), one progress bar (walked of the whole walk),
 * and a single line only when the walk is running over its time.
 */
export function WalkStatsBar({ stats, lang = "en" }: { stats: WalkStatsData; lang?: "he" | "en" }) {
  const t = lang === "he" ? walkCopy.statsHe : walkCopy.stats;
  const sheet = walkCopy.hud.sheet[lang];
  const tone = paceBarTone(stats.kmh, stats.plannedPaceMinPerKm);
  const paceValue =
    stats.speedState === "paused" ? t.paused : stats.kmh === null ? t.unknown : stats.kmh.toFixed(1);
  const showPaceUnit = stats.speedState === "moving" && stats.kmh !== null;
  const totalM = stats.walkedM + stats.remainingM;
  const pct = totalM > 0 ? Math.round(Math.min(1, Math.max(0, stats.walkedM / totalM)) * 100) : 0;
  const overBy = stats.overBudget && stats.timeToFinishMin !== null ? Math.max(1, Math.round(stats.elapsedMin + stats.timeToFinishMin - plannedTotalMin(stats))) : null;

  return (
    <div data-testid="walk-stats" className="space-y-2">
      <div className="flex divide-x divide-charcoal/10 rtl:divide-x-reverse">
        <Stat
          label={t.distanceToFinish}
          value={stats.distanceToFinishKm === null ? t.unknown : stats.distanceToFinishKm.toFixed(1)}
          unit={stats.distanceToFinishKm === null ? undefined : t.distanceUnit}
        />
        <Stat
          label={t.timeToFinish}
          value={stats.timeToFinishMin === null ? t.unknown : String(Math.max(0, Math.round(stats.timeToFinishMin)))}
          unit={stats.timeToFinishMin === null ? undefined : t.timeUnit}
          tone={stats.overBudget ? "text-terra" : undefined}
        />
        <Stat label={t.pace} value={paceValue} unit={showPaceUnit ? t.paceUnit : undefined} dot={TONE_DOT[tone]} />
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-charcoal/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-forest" style={{ width: `${pct}%` }} />
      </div>
      {overBy !== null ? <p className="text-center text-[13px] font-medium text-terra">{sheet.overBudget(overBy)}</p> : null}
    </div>
  );
}

/** The time the walker allowed is not carried on the stats; the overshoot is what overBudget already means. */
function plannedTotalMin(stats: WalkStatsData): number {
  return stats.allowedMin ?? stats.elapsedMin + (stats.timeToFinishMin ?? 0) - 1;
}

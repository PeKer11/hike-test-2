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
}

const TONE_FILL: Record<PaceTone, string> = {
  good: "bg-forest",
  warn: "bg-amber-500",
  bad: "bg-red-500",
};

function Tile({
  label,
  value,
  unit,
  fraction,
  fill,
}: {
  label: string;
  value: string;
  unit?: string;
  /** 0..1 — how full the little bar is. */
  fraction: number;
  fill: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
  return (
    <div className="min-w-0 flex-1 px-2">
      <p className="truncate text-[10px] font-medium uppercase tracking-wide text-charcoal/60">
        {label}
      </p>
      <p className="font-display text-xl font-bold leading-tight text-forest">
        {value}
        {unit ? (
          <span className="ms-1 text-[11px] font-medium text-charcoal/60">{unit}</span>
        ) : null}
      </p>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-charcoal/10">
        <div className={`h-full rounded-full ${fill}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** The three live tiles: how fast, how long still, how far still. */
export function WalkStatsBar({ stats }: { stats: WalkStatsData }) {
  const plannedKmh = 60 / stats.plannedPaceMinPerKm;
  const tone = paceBarTone(stats.kmh, stats.plannedPaceMinPerKm);
  const paceValue =
    stats.speedState === "paused"
      ? walkCopy.stats.paused
      : stats.kmh === null
        ? walkCopy.stats.unknown
        : stats.kmh.toFixed(1);
  const showPaceUnit = stats.speedState === "moving" && stats.kmh !== null;

  const totalMin = stats.elapsedMin + (stats.timeToFinishMin ?? 0);
  const timeFraction =
    stats.timeToFinishMin === null || totalMin <= 0 ? 0 : stats.elapsedMin / totalMin;
  const totalM = stats.walkedM + stats.remainingM;

  return (
    <div
      data-testid="walk-stats"
      className="pointer-events-auto flex divide-x divide-charcoal/10 rounded-2xl bg-cream/95 py-2 shadow-[0_4px_20px_rgba(30,61,47,0.12)] backdrop-blur rtl:divide-x-reverse"
    >
      <Tile
        label={walkCopy.stats.pace}
        value={paceValue}
        unit={showPaceUnit ? walkCopy.stats.paceUnit : undefined}
        fraction={stats.kmh === null ? 0 : stats.kmh / (plannedKmh * 1.5)}
        fill={TONE_FILL[tone]}
      />
      <Tile
        label={walkCopy.stats.timeToFinish}
        value={
          stats.timeToFinishMin === null
            ? walkCopy.stats.unknown
            : String(Math.max(0, Math.round(stats.timeToFinishMin)))
        }
        unit={stats.timeToFinishMin === null ? undefined : walkCopy.stats.timeUnit}
        fraction={timeFraction}
        fill={stats.overBudget ? "bg-red-500" : "bg-forest"}
      />
      <Tile
        label={walkCopy.stats.distanceToFinish}
        value={
          stats.distanceToFinishKm === null
            ? walkCopy.stats.unknown
            : stats.distanceToFinishKm.toFixed(1)
        }
        unit={stats.distanceToFinishKm === null ? undefined : walkCopy.stats.distanceUnit}
        fraction={totalM > 0 ? stats.walkedM / totalM : 0}
        fill="bg-terra"
      />
    </div>
  );
}

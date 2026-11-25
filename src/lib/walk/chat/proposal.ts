import type { Coordinates } from "@/lib/types";
import { haversineDistance } from "@/lib/utils/geo";
import { detourMinutes } from "@/lib/walk/walk-stats";

import type { ChatLang } from "./reply";

/** One place the proposal adds. `afterName` is the stop it would come after, when known. */
export interface ProposalPlace {
  name: string;
  coordinates: Coordinates;
  afterName?: string;
  /** Straight-line distance from the walker, metres. */
  distM?: number;
}

/**
 * What the card shows under the changes. "ready" is a real dry-run route, "estimate" a rough local figure
 * (shown with a "~"), "computing" is still waiting, "failed" and "nofit" end the card with no buttons.
 */
export type ProposalPreview =
  | { status: "computing" }
  | {
      status: "ready" | "estimate";
      minDelta: number;
      distDeltaM: number;
      /** Wall-clock finish, "17:40". */
      endClock: string;
      /** True when the new total is more than the time the walker allowed. */
      overTime?: boolean;
      /** Dry-run truth: the added places that made it onto the route, and those that did not. Absent = as asked. */
      placed?: string[];
      unplaced?: string[];
      /** The stops that are off the route in the dry run (asked for, or squeezed out). Absent = as asked. */
      dropNames?: string[];
    }
  | { status: "failed" }
  | { status: "nofit"; name: string }
  /** Every place the card would add is already a stop of the walk. */
  | { status: "present"; name: string };

const T = {
  en: {
    back: "Head back to the start",
    after: (x: string) => `after ${x}`,
    min: "min",
    km: "km",
    end: "ends",
    over: "over your time",
    computing: "Calculating route…",
    failed: "I couldn't build a route with that change.",
    nofit: (n: string) => `${n} doesn't fit in the time left.`,
    present: (n: string) => `${n} is already on the walk.`,
  },
  he: {
    back: "חזרה להתחלה",
    after: (x: string) => `אחרי ${x}`,
    min: "דק׳",
    km: "ק״מ",
    end: "סיום",
    over: "מעבר לזמן",
    computing: "מחשב מסלול…",
    failed: "לא הצלחתי לבנות מסלול עם השינוי הזה.",
    nofit: (n: string) => `${n} לא נכנס בזמן שנשאר.`,
    present: (n: string) => `${n} כבר במסלול.`,
  },
} as const;

const signed = (n: number, text: string) => `${n < 0 ? "−" : "+"}${text}`;

/** Line 1: what changes. Line 2: the numbers, or the reason there is no card to approve. */
export function proposalLines(
  p: { adds: ProposalPlace[]; dropNames: string[]; headBack: boolean },
  preview: ProposalPreview | undefined,
  lang: ChatLang,
): { line1: string; line2: string | null; actionable: boolean } {
  const t = T[lang];
  // A numbered dry run is the truth: only what it placed and what it dropped is on the card.
  const real = preview && (preview.status === "ready" || preview.status === "estimate") ? preview : null;
  const adds = real?.placed ? p.adds.filter((a) => real.placed!.includes(a.name)) : p.adds;
  const dropNames = real?.dropNames ?? p.dropNames;
  const parts = p.headBack
    ? [t.back]
    : [
        ...adds.map((a) => `+ ${a.name}${a.afterName ? ` (${t.after(a.afterName)})` : ""}`),
        ...dropNames.map((n) => `− ${n}`),
      ];
  const line1 = parts.join(" · ");
  // No preview at all (no way to compute one): the card still works, it just has no numbers.
  if (!preview) return { line1, line2: null, actionable: true };
  if (preview.status === "computing") return { line1, line2: t.computing, actionable: false };
  if (preview.status === "failed") return { line1: t.failed, line2: null, actionable: false };
  if (preview.status === "nofit") return { line1: t.nofit(preview.name), line2: null, actionable: false };
  if (preview.status === "present") return { line1: t.present(preview.name), line2: null, actionable: false };
  const approx = preview.status === "estimate" ? "~" : "";
  const min = Math.round(Math.abs(preview.minDelta));
  const km = (Math.abs(preview.distDeltaM) / 1000).toFixed(1);
  const bits = [
    `${approx}${signed(preview.minDelta, `${min} ${t.min}`)}`,
    `${approx}${signed(preview.distDeltaM, `${km} ${t.km}`)}`,
    `${t.end} ${preview.endClock}`,
    ...(preview.overTime ? [t.over] : []),
  ];
  const line2 = [bits.join(" · "), ...(real?.unplaced ?? []).map((n) => t.nofit(n))].join(" · ");
  return { line1, line2, actionable: true };
}

type NumberedPreview = Extract<ProposalPreview, { status: "ready" | "estimate" }>;

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Wall-clock time `plusMin` minutes after `nowMs`, local, "17:40". */
export function endClock(nowMs: number, plusMin: number): string {
  const d = new Date(nowMs + Math.round(plusMin) * 60_000);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** The card's numbers from a real dry-run plan: what it costs against what is left now, on the same clock. */
export function previewFromPlan(a: {
  planMinutes: number;
  planDistM: number;
  baselineMin: number;
  baselineDistM: number;
  nowMs: number;
  allowedRemainingMin: number | null;
}): NumberedPreview {
  return {
    status: "ready",
    minDelta: Math.round(a.planMinutes - a.baselineMin),
    distDeltaM: Math.round(a.planDistM - a.baselineDistM),
    endClock: endClock(a.nowMs, a.planMinutes),
    overTime: a.allowedRemainingMin !== null && a.planMinutes > a.allowedRemainingMin,
  };
}

/** Minutes a skipped stop is assumed to save when there is no route to measure (the planner's own visit allowance). */
const SKIP_SAVES_MIN = 20;
const WINDING = 1.25;

/**
 * A rough figure for when the route could not be computed in time: each add is an out-and-back at the planned pace
 * plus a visit, each skip saves a visit. Null when there is nothing to price (head back) or no clock to add it to.
 */
export function estimatePreview(a: {
  addDistancesM: number[];
  dropCount: number;
  plannedMinPerKm: number;
  nowMs: number;
  remainingMin: number | null;
  allowedRemainingMin: number | null;
}): NumberedPreview | null {
  if (a.remainingMin === null || (a.addDistancesM.length === 0 && a.dropCount === 0)) return null;
  const minDelta =
    a.addDistancesM.reduce((sum, d) => sum + detourMinutes(d, a.plannedMinPerKm, 20), 0) - a.dropCount * SKIP_SAVES_MIN;
  const distDeltaM = Math.round(a.addDistancesM.reduce((sum, d) => sum + 2 * d * WINDING, 0));
  const total = a.remainingMin + minDelta;
  return {
    status: "estimate",
    minDelta,
    distDeltaM,
    endClock: endClock(a.nowMs, total),
    overTime: a.allowedRemainingMin !== null && total > a.allowedRemainingMin,
  };
}

/** What a card's numbers were computed against. */
export interface ProposalBasis {
  /** The ids of the stops still ahead, in order. */
  stopIds: string[];
  /** Bumps whenever any rebuild starts: a different route is a different question. */
  planRev: number;
  position: Coordinates;
  at: number;
}

const BASIS_MOVED_M = 60;
const BASIS_AGE_MS = 120_000;

/**
 * fresh: the preview still holds, apply it as shown. replanned: a stop was reached or a rebuild ran, so the
 * numbers are for another route (re-preview and ask again). relocated: same route, but the walker has moved on,
 * so the preview's line no longer starts under their feet (build again from here, same stops).
 */
export function basisCheck(basis: ProposalBasis, now: ProposalBasis): "fresh" | "replanned" | "relocated" {
  if (basis.planRev !== now.planRev || basis.stopIds.length !== now.stopIds.length || basis.stopIds.some((id, i) => id !== now.stopIds[i])) return "replanned";
  if (haversineDistance(basis.position, now.position) > BASIS_MOVED_M || now.at - basis.at > BASIS_AGE_MS) return "relocated";
  return "fresh";
}

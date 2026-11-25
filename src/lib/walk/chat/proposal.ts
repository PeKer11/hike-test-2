import type { Coordinates } from "@/lib/types";

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
    }
  | { status: "failed" }
  | { status: "nofit"; name: string };

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
  const parts = p.headBack
    ? [t.back]
    : [
        ...p.adds.map((a) => `+ ${a.name}${a.afterName ? ` (${t.after(a.afterName)})` : ""}`),
        ...p.dropNames.map((n) => `− ${n}`),
      ];
  const line1 = parts.join(" · ");
  // No preview at all (no way to compute one): the card still works, it just has no numbers.
  if (!preview) return { line1, line2: null, actionable: true };
  if (preview.status === "computing") return { line1, line2: t.computing, actionable: false };
  if (preview.status === "failed") return { line1: t.failed, line2: null, actionable: false };
  if (preview.status === "nofit") return { line1: t.nofit(preview.name), line2: null, actionable: false };
  const approx = preview.status === "estimate" ? "~" : "";
  const min = Math.round(Math.abs(preview.minDelta));
  const km = (Math.abs(preview.distDeltaM) / 1000).toFixed(1);
  const bits = [
    `${approx}${signed(preview.minDelta, `${min} ${t.min}`)}`,
    `${approx}${signed(preview.distDeltaM, `${km} ${t.km}`)}`,
    `${t.end} ${preview.endClock}`,
    ...(preview.overTime ? [t.over] : []),
  ];
  return { line1, line2: bits.join(" · "), actionable: true };
}

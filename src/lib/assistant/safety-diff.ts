import { cleanUntrustedText } from "@/lib/llm/sanitize";
import { haversineDistance } from "@/lib/utils/geo";

import type { AssistantState } from "./state";

/** A safety rule or the start point the assistant loosened during a turn. */
export type Relaxation =
  | { rule: "access"; from: string }
  | { rule: "avoid_dangerous" }
  | { rule: "max_grade"; from: number; to?: number }
  | { rule: "stay_in_area"; from: string; to?: string }
  | { rule: "start_moved"; km: number; to?: string };

export const isHebrew = (t: string): boolean => /[֐-׿]/.test(t);

/** Rules and start point that `after` loosened compared with `before`. Tightening is not reported. */
export function relaxations(before: AssistantState, after: AssistantState, startName?: string): Relaxation[] {
  const b = before.params;
  const a = after.params;
  const out: Relaxation[] = [];
  if (b.access && a.access !== b.access) out.push({ rule: "access", from: b.access });
  if (b.avoidDangerous === true && a.avoidDangerous !== true) out.push({ rule: "avoid_dangerous" });
  if (b.maxGradePct !== undefined && (a.maxGradePct === undefined || a.maxGradePct > b.maxGradePct)) {
    out.push({ rule: "max_grade", from: b.maxGradePct, to: a.maxGradePct });
  }
  if (b.stayInArea && a.stayInArea !== b.stayInArea) out.push({ rule: "stay_in_area", from: b.stayInArea, to: a.stayInArea });
  if (before.origin && after.origin) {
    const moved = haversineDistance(before.origin, after.origin);
    if (moved > 50) out.push({ rule: "start_moved", km: Math.round(moved / 100) / 10, to: startName });
  }
  return out;
}

const clean = (s: string) => cleanUntrustedText(s, 80);

function part(r: Relaxation, he: boolean): string {
  switch (r.rule) {
    case "access": {
      const label = r.from === "wheelchair" ? (he ? "כיסא גלגלים" : "wheelchair") : he ? "עגלה" : "stroller";
      return he ? `ניתוב ללא מדרגות (${label}) כבוי` : `step-free routing for a ${label} is off`;
    }
    case "avoid_dangerous":
      return he ? "כבר לא נמנעים מכבישים מסוכנים" : "dangerous roads are no longer avoided";
    case "max_grade":
      return r.to === undefined
        ? he ? `מגבלת השיפוע ${r.from}% הוסרה` : `the ${r.from}% slope limit was removed`
        : he ? `מגבלת השיפוע השתנתה מ-${r.from}% ל-${r.to}%` : `the slope limit went from ${r.from}% to ${r.to}%`;
    case "stay_in_area":
      return he
        ? `ההליכה יכולה לצאת מ${clean(r.from)}${r.to ? ` (האזור עכשיו ${clean(r.to)})` : ""}`
        : `the walk may now leave ${clean(r.from)}${r.to ? ` (area is now ${clean(r.to)})` : ""}`;
    case "start_moved":
      return he
        ? `נקודת ההתחלה זזה ${r.km} ק"מ${r.to ? ` אל ${clean(r.to)}` : ""}`
        : `the start moved ${r.km} km${r.to ? ` to ${clean(r.to)}` : ""}`;
  }
}

/** The server-written line that tells the walker what the assistant changed; empty when nothing was loosened. */
export function warningLine(list: Relaxation[], hebrew: boolean): string {
  if (list.length === 0) return "";
  const parts = list.map((r) => part(r, hebrew)).join("; ");
  return hebrew
    ? `⚠ שינוי שהעוזר ביצע: ${parts}. אם לא ביקשתם את זה, כתבו לי ואחזיר.`
    : `⚠ Changed by the assistant: ${parts}. If you did not ask for this, tell me and I will put it back.`;
}

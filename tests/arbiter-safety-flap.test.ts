import { describe, expect, it } from "vitest";

import { arbitrate } from "@/lib/walk/companion/companion-arbiter";
import type { ArbiterCtx, AskHistory, Candidate } from "@/lib/walk/companion/companion-types";

const MIN = 60_000;
const T0 = Date.UTC(2026, 6, 15, 8, 0, 0);
const ctx: ArbiterCtx = { level: "normal", questionOnScreen: false, nearTurn: false };

function heat(urgency: 2 | 3, t: number): Candidate {
  return {
    kind: "heat-water",
    urgency,
    value: 0.9,
    answers: [{ id: "fine", label: "answer.fine", operator: null }],
    expiresAtMs: t + 10 * MIN,
    context: { t: 36 },
  };
}

describe("safety gap vs threshold flapping", () => {
  // urgency-3 ask at T0, then a urgency-2 ask 13 min later (heat dipped), then
  // heat is back above the threshold at +26 min: still inside 45 min of the
  // last urgency-3 ask, so it must wait.
  const history: AskHistory = {
    records: [
      { kind: "heat-water", askedAt: T0, outcome: "answered", urgency: 3, heatC: 36, dismissed: true },
      { kind: "heat-water", askedAt: T0 + 13 * MIN, outcome: "answered", urgency: 2, dismissed: true },
    ],
  };
  it("waits when the last record is urgency 2 but an urgency-3 ask was < 45 min ago", () => {
    const now = T0 + 26 * MIN;
    expect(arbitrate([heat(3, now)], ctx, history, now)).toBeNull();
  });
  it("asks again after 45 min from the last urgency-3 ask", () => {
    const now = T0 + 46 * MIN;
    expect(arbitrate([heat(3, now)], ctx, history, now)).not.toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import {
  arbitrate,
  ASK_FLOOR_MS,
  GLOBAL_GAP_MS,
  MAX_PER_HOUR,
  pAct,
  recordAsk,
  SAME_KIND_GAP_MS,
  scoreCandidate,
} from "@/lib/walk/companion/companion-arbiter";
import type {
  ArbiterCtx,
  AskHistory,
  Candidate,
  QuestionKind,
} from "@/lib/walk/companion/companion-types";

const T0 = 1_000_000_000_000;
const MIN = 60_000;

function cand(over: Partial<Candidate> = {}): Candidate {
  return {
    kind: "pace-slow",
    urgency: 1,
    value: 1,
    answers: [{ id: "dismiss", label: "answer.notNow", operator: { op: "dismiss" } }],
    expiresAtMs: T0 + 100 * MIN,
    context: {},
    ...over,
  };
}
const ctx = (over: Partial<ArbiterCtx> = {}): ArbiterCtx => ({
  level: "normal",
  questionOnScreen: false,
  nearTurn: false,
  ...over,
});
const empty: AskHistory = { records: [] };
const ask = (kind: QuestionKind, at: number, outcome: "answered" | "ignored" = "answered") => ({
  kind,
  askedAt: at,
  outcome,
});

describe("arbitrate gates", () => {
  it("returns the candidate when nothing blocks it", () => {
    expect(arbitrate([cand()], ctx(), empty, T0)).not.toBeNull();
  });

  it("shows at most one question: null while one is on screen", () => {
    expect(arbitrate([cand()], ctx({ questionOnScreen: true }), empty, T0)).toBeNull();
  });

  it("never asks near a turn, even for safety", () => {
    expect(arbitrate([cand()], ctx({ nearTurn: true }), empty, T0)).toBeNull();
    expect(arbitrate([cand({ urgency: 3 })], ctx({ nearTurn: true }), empty, T0)).toBeNull();
  });

  it("drops expired candidates", () => {
    expect(arbitrate([cand({ expiresAtMs: T0 })], ctx(), empty, T0)).toBeNull();
  });

  it("applies the global gap per level", () => {
    for (const level of ["quiet", "normal", "chatty"] as const) {
      const h: AskHistory = { records: [ask("rain", T0)] };
      const c = cand({ kind: "sunset", value: 1 });
      const justBefore = T0 + GLOBAL_GAP_MS[level] - 1;
      // chatty's 2 min gap is shorter than the 3 min floor, which then governs
      const justAfter = T0 + Math.max(GLOBAL_GAP_MS[level], ASK_FLOOR_MS);
      expect(arbitrate([c], ctx({ level }), h, justBefore)).toBeNull();
      expect(arbitrate([c], ctx({ level }), h, justAfter)).not.toBeNull();
    }
  });

  it("applies the same-kind gap", () => {
    const h: AskHistory = { records: [ask("sunset", T0)] };
    const c = cand({ kind: "sunset" });
    expect(arbitrate([c], ctx({ level: "chatty" }), h, T0 + SAME_KIND_GAP_MS - 1)).toBeNull();
    expect(arbitrate([c], ctx({ level: "chatty" }), h, T0 + SAME_KIND_GAP_MS)).not.toBeNull();
  });

  it("caps questions per walk-hour by level", () => {
    const kinds: QuestionKind[] = ["pace-slow", "pace-fast", "toward-green", "sunset", "rain", "rest"];
    const records = kinds.map((k, i) => ask(k, T0 + i * 5 * MIN));
    const now = T0 + 58 * MIN; // all six inside the trailing hour
    const c = cand({ kind: "heat-water" });
    expect(records.length).toBe(MAX_PER_HOUR.normal);
    expect(arbitrate([c], ctx(), { records }, now)).toBeNull();
    expect(arbitrate([c], ctx({ level: "chatty" }), { records }, now)).not.toBeNull();
    expect(arbitrate([c], ctx({ level: "quiet" }), { records }, now)).toBeNull();
  });

  it("requires score above theta for non-safety, per level", () => {
    const weak = cand({ value: 0.4 }); // pAct 0.5 -> 0.2
    expect(arbitrate([weak], ctx({ level: "normal" }), empty, T0)).toBeNull();
    expect(arbitrate([weak], ctx({ level: "chatty" }), empty, T0)).toBeNull(); // 0.2 <= 0.2
    const mid = cand({ value: 0.7 }); // 0.35
    expect(arbitrate([mid], ctx({ level: "normal" }), empty, T0)).not.toBeNull();
    expect(arbitrate([mid], ctx({ level: "quiet" }), empty, T0)).toBeNull();
  });

  it("prefers higher urgency, then higher score", () => {
    const a = cand({ kind: "sunset", urgency: 2, value: 0.8 });
    const b = cand({ kind: "rain", urgency: 1, value: 1 });
    expect(arbitrate([b, a], ctx(), empty, T0)?.kind).toBe("sunset");
    const c = cand({ kind: "rain", urgency: 2, value: 1 });
    expect(arbitrate([a, c], ctx(), empty, T0)?.kind).toBe("rain");
  });
});

describe("brand-new user (no priors, no history) per level", () => {
  const high = cand({ kind: "sunset", urgency: 2, value: 1 }); // 0.5
  const mid = cand({ kind: "sunset", urgency: 2, value: 0.7 }); // 0.35
  const low = cand({ kind: "sunset", urgency: 2, value: 0.3 }); // 0.15
  const safety = cand({ kind: "heat-water", urgency: 3, value: 0.01 });

  it("a high-value question is asked at every level", () => {
    for (const level of ["quiet", "normal", "chatty"] as const) {
      expect(arbitrate([high], ctx({ level }), empty, T0)).not.toBeNull();
    }
  });

  it("mid value: normal and chatty ask, quiet does not", () => {
    expect(arbitrate([mid], ctx({ level: "quiet" }), empty, T0)).toBeNull();
    expect(arbitrate([mid], ctx({ level: "normal" }), empty, T0)).not.toBeNull();
    expect(arbitrate([mid], ctx({ level: "chatty" }), empty, T0)).not.toBeNull();
  });

  it("low value is never asked; safety is asked at every level", () => {
    for (const level of ["quiet", "normal", "chatty"] as const) {
      expect(arbitrate([low], ctx({ level }), empty, T0)).toBeNull();
      expect(arbitrate([safety], ctx({ level }), empty, T0)).not.toBeNull();
    }
  });

  it("a non-finite clock asks nothing", () => {
    expect(arbitrate([high], ctx(), empty, Number.NaN)).toBeNull();
    expect(arbitrate([safety], ctx(), empty, Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("safety (urgency 3)", () => {
  const safety = cand({ urgency: 3, value: 0.01, kind: "heat-water" });

  it("bypasses theta, global gap and hour cap", () => {
    const records = [
      ask("sunset", T0 - ASK_FLOOR_MS),
      ...Array.from({ length: 6 }, (_, i) =>
        ask("rain" as QuestionKind, T0 - ASK_FLOOR_MS - (i + 1) * MIN),
      ),
    ];
    expect(arbitrate([safety], ctx({ level: "quiet" }), { records }, T0)).not.toBeNull();
  });

  it("does not repeat within the same-kind gap, even for safety", () => {
    const h: AskHistory = { records: [ask("heat-water", T0)] };
    expect(arbitrate([safety], ctx(), h, T0 + SAME_KIND_GAP_MS - 1)).toBeNull();
    expect(arbitrate([safety], ctx(), h, T0 + SAME_KIND_GAP_MS)).not.toBeNull();
  });

  it("does not bypass the 3-minute floor", () => {
    const h: AskHistory = { records: [ask("rain", T0)] };
    expect(arbitrate([safety], ctx(), h, T0 + ASK_FLOOR_MS - 1)).toBeNull();
    expect(arbitrate([safety], ctx(), h, T0 + ASK_FLOOR_MS)).not.toBeNull();
  });
});

describe("pAct learning", () => {
  it("starts at 0.5 and rises with answers", () => {
    expect(pAct("sunset", empty)).toBe(0.5);
    const h: AskHistory = { records: [ask("sunset", T0), ask("sunset", T0 + 1)] };
    expect(pAct("sunset", h)).toBeCloseTo(3 / 4);
  });

  it("is x0.3 once 3 of the last 5 were ignored", () => {
    const records = [
      ask("sunset", 1, "ignored"),
      ask("sunset", 2, "ignored"),
      ask("sunset", 3, "ignored"),
    ];
    expect(pAct("sunset", { records })).toBeCloseTo(0.06); // 0.2 x 0.3
    expect(pAct("sunset", { records: records.slice(0, 2) })).toBeCloseTo(1 / 4);
  });

  it("uses cross-walk priors from memory", () => {
    const h: AskHistory = { records: [], priors: { rain: { asked: 8, answered: 0 } } };
    expect(pAct("rain", h)).toBeCloseTo(0.1);
  });

  it("a repeatedly ignored kind stops being asked at the same value", () => {
    const c = cand({ kind: "sunset", value: 0.7 });
    const ignored = [1, 2, 3].map((i) => ask("sunset", T0 - 100 * MIN * i, "ignored"));
    expect(arbitrate([c], ctx(), empty, T0)).not.toBeNull();
    expect(arbitrate([c], ctx(), { records: ignored }, T0)).toBeNull();
  });
});

describe("interrupt cost", () => {
  const base = cand({ value: 0.7, context: { stopId: "a" } }); // 0.35 baseline

  it("crossing, low battery and pause at another stop lower the score", () => {
    const s0 = scoreCandidate(base, ctx(), empty);
    expect(scoreCandidate(base, ctx({ crossing: true }), empty)).toBeCloseTo(s0 - 0.3);
    expect(scoreCandidate(base, ctx({ lowBattery: true }), empty)).toBeCloseTo(s0 - 0.2);
    expect(scoreCandidate(base, ctx({ pausedStopId: "b" }), empty)).toBeCloseTo(s0 - 0.5);
  });

  it("a pause at the stop the question is about costs nothing", () => {
    const s0 = scoreCandidate(base, ctx(), empty);
    expect(scoreCandidate(base, ctx({ pausedStopId: "a" }), empty)).toBeCloseTo(s0);
  });

  it("breakpoints discount the cost but never below zero", () => {
    const s0 = scoreCandidate(base, ctx(), empty);
    expect(scoreCandidate(base, ctx({ atBreakpoint: true }), empty)).toBeCloseTo(s0);
    expect(scoreCandidate(base, ctx({ atBreakpoint: true, crossing: true }), empty)).toBeCloseTo(
      s0 - 0.2,
    );
  });

  it("blocks a borderline candidate while crossing", () => {
    expect(arbitrate([base], ctx(), empty, T0)).not.toBeNull();
    expect(arbitrate([base], ctx({ crossing: true }), empty, T0)).toBeNull();
  });
});

describe("recordAsk", () => {
  it("appends without mutating", () => {
    const h = recordAsk(empty, ask("rain", T0));
    expect(h.records).toHaveLength(1);
    expect(empty.records).toHaveLength(0);
  });
});

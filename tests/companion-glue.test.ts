import { describe, expect, it } from "vitest";

import { parseMemoryWire, toMemoryWire } from "@/lib/preferences/companion-memory-wire";
import { CompanionEngine } from "@/lib/walk/companion/companion-engine";
import {
  amenityItemsFromPlaces,
  buildCandidates,
  conditionsDue,
  CONDITIONS_REFRESH_MS,
  detectUiLang,
  interactionsFromItems,
  pickAddPlace,
  pickGreenTarget,
  questionCard,
  questionEntries,
  TowardGreenTracker,
  type TickInput,
} from "@/lib/walk/companion/companion-glue";
import type { Candidate } from "@/lib/walk/companion/companion-types";
import { at, item } from "./helpers/discovery";
import type { NearbyPlace } from "@/lib/types";

const MIN = 60_000;
// 18:00 in Israel in July: sunset is about 19:40 local.
const T0 = Date.UTC(2026, 6, 15, 15, 0, 0);
const POS = at(0, 0);

function tick(over: Partial<TickInput> = {}): TickInput {
  return {
    nowMs: T0,
    position: POS,
    environment: "urban",
    speedMpm: 80,
    remainingWalkMin: 20,
    remainingStops: [],
    pace: null,
    addPlace: null,
    conditions: null,
    amenities: [],
    walkerAlongM: null,
    green: null,
    ...over,
  };
}

const quiet = { level: "quiet" as const, nearTurn: false };
const normal = { level: "normal" as const, nearTurn: false };

describe("small helpers", () => {
  it("polls conditions at start and then hourly", () => {
    expect(conditionsDue(null, T0)).toBe(true);
    expect(conditionsDue(T0, T0 + CONDITIONS_REFRESH_MS - 1)).toBe(false);
    expect(conditionsDue(T0, T0 + CONDITIONS_REFRESH_MS)).toBe(true);
  });
  it("picks Hebrew for he / iw, else English", () => {
    expect(detectUiLang("he-IL", "en")).toBe("en"); // the browser wins over the layout / written lang
    expect(detectUiLang("en", "he-IL")).toBe("he");
    expect(detectUiLang("he", null)).toBe("he");
    expect(detectUiLang("", "iw")).toBe("he");
    expect(detectUiLang(null, "en-US")).toBe("en");
    expect(detectUiLang(undefined, undefined)).toBe("en");
  });
});

describe("buildCandidates", () => {
  const stops = [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
  ];
  it("sunset: sends the cap and passes remainingStopCount (a lone stop is not droppable)", () => {
    const two = buildCandidates(tick({ remainingWalkMin: 150, remainingStops: stops }));
    const s = two.find((c) => c.kind === "sunset")!;
    expect(s.urgency).toBe(3);
    expect(s.answers[0].operator).toMatchObject({ op: "shorten", dropStopIds: ["b"] });
    const one = buildCandidates(tick({ remainingWalkMin: 150, remainingStops: [stops[0]] }));
    expect(one.find((c) => c.kind === "sunset")!.answers[0].operator).toMatchObject({
      op: "shorten",
      dropStopIds: undefined,
    });
  });
  it("heat needs conditions and a water source that passes the detour rule", () => {
    const water = [{ id: "w", kind: "drinking_water" as const, coordinates: at(0, 60), name: "Fountain" }];
    const hot = { apparentTempC: 37, precipProbabilityPct: 10 };
    expect(buildCandidates(tick({ amenities: water }))).toEqual([]);
    expect(buildCandidates(tick({ conditions: hot })).some((c) => c.kind === "heat-water")).toBe(false);
    const heat = buildCandidates(tick({ conditions: hot, amenities: water })).find((c) => c.kind === "heat-water")!;
    expect(heat.urgency).toBe(3);
    expect(heat.context.place).toBe("Fountain");
  });
  it("heat ignores water that is behind the walker along the route", () => {
    const behind = [{ id: "w", kind: "drinking_water" as const, coordinates: at(0, 60), alongM: 100 }];
    const hot = { apparentTempC: 37, precipProbabilityPct: 10 };
    expect(buildCandidates(tick({ conditions: hot, amenities: behind, walkerAlongM: 400 }))).toEqual([]);
    expect(buildCandidates(tick({ conditions: hot, amenities: behind, walkerAlongM: 90 })).map((c) => c.kind)).toEqual(["heat-water"]);
  });
  it("rain comes from conditions", () => {
    const c = buildCandidates(tick({ conditions: { apparentTempC: 20, precipProbabilityPct: 90 } }));
    expect(c.map((x) => x.kind)).toContain("rain");
  });
  it("toward-green needs 60 m of heading toward it", () => {
    const green = { parkName: "Park", score: 2, headingTowardM: 80 };
    expect(buildCandidates(tick({ green })).map((c) => c.kind)).toContain("toward-green");
    expect(buildCandidates(tick({ green: { ...green, headingTowardM: 30 } }))).toEqual([]);
  });
});

describe("green targets never include detected finds", () => {
  const park = item("park", at(0, 200), { kind: "scenery", category: "park", score: 2 });
  const sat = item("detected:1", at(0, 150), { kind: "scenery", tier: "detected", sources: ["worldcover"], score: 3 });
  it("ignores a detected item even when it scores higher and is closer", () => {
    expect(pickGreenTarget([sat, park], POS, 0)?.item.id).toBe("park");
    expect(pickGreenTarget([sat], POS, 0)).toBeNull();
  });
  it("needs a heading toward it and a close place", () => {
    expect(pickGreenTarget([park], POS, 180)).toBeNull();
    expect(pickGreenTarget([park], POS, null)).toBeNull();
    expect(pickGreenTarget([item("far", at(0, 900), { kind: "scenery" })], POS, 0)).toBeNull();
  });
  it("tracks metres walked toward the same target and resets when it changes", () => {
    const t = new TowardGreenTracker();
    expect(t.update({ id: "p", distanceM: 300 })).toBe(0);
    expect(t.update({ id: "p", distanceM: 230 })).toBe(70);
    expect(t.update({ id: "q", distanceM: 200 })).toBe(0);
    // Turning away (distance grows) starts the count again.
    expect(t.update({ id: "q", distanceM: 230 })).toBe(0);
    expect(t.update({ id: "q", distanceM: 180 })).toBe(50);
    expect(t.update(null)).toBe(0);
    expect(t.update({ id: "q", distanceM: 150 })).toBe(0);
  });
});

describe("pickAddPlace", () => {
  it("offers only registered, new, framed places that pass the detour rule", () => {
    const frame = { alongM: 100, lateralM: 40, side: "left" as const, segIdx: 0 };
    const good = item("g", at(40, 100), { frame, detourMin: 2, score: 2 });
    const sat = item("d", at(40, 100), { frame, tier: "detected", score: 9 });
    const seen = item("s", at(40, 100), { frame, state: "dismissed", score: 9 });
    const out = pickAddPlace([sat, seen, good], { speedMpm: 80, remainingWalkMin: 60, environment: "urban" });
    expect(out?.name).toBe("g");
  });
});

describe("amenities", () => {
  it("maps water and toilets with their place along the route", () => {
    const water: NearbyPlace = {
      id: "osm-node-9", name: "Drinking water", coordinates: at(0, 50), category: "other",
      avgVisitMinutes: 0, tags: { amenity: "drinking_water" }, source: "osm",
      verification: "mapped-unnamed", kind: "scenery",
    };
    const cafe = { ...water, id: "c", tags: { amenity: "cafe" } };
    const out = amenityItemsFromPlaces([water, cafe], () => ({ alongM: 50, lateralM: 3 }));
    expect(out).toEqual([
      expect.objectContaining({ id: "osm-node-9", kind: "drinking_water", alongM: 50, lateralM: 3 }),
    ]);
  });
});

describe("question card", () => {
  const cand: Candidate = {
    kind: "pace-slow", urgency: 1, value: 1, expiresAtMs: T0 + MIN,
    context: { stop: "Old Port", n: 12 },
    answers: [
      { id: "keep-all", label: "answer.keepAll", operator: { op: "keep-all-extend" } },
      { id: "dismiss", label: "answer.notNow", operator: { op: "dismiss" } },
    ],
  };
  it("renders EN and HE with context", () => {
    const en = questionCard(cand, "en", T0);
    expect(en.title).toContain("Old Port");
    expect(en.answers[0].label).toBe("Keep all, add 12 min");
    const he = questionCard(cand, "he", T0);
    expect(he.title).toContain("Old Port");
    expect(he.answers[0].label).toContain("12");
    expect(he.answers[1].label).toBe("לא עכשיו");
  });
});

describe("CompanionEngine", () => {
  const sunset = () => buildCandidates(tick({ nowMs: T0, remainingWalkMin: 150, remainingStops: [{ id: "a", name: "A" }, { id: "b", name: "B" }] })).find((c) => c.kind === "sunset")!;

  it("shows a question, resolves the operator with the cap, and logs the answer", () => {
    const e = new CompanionEngine();
    expect(e.tick([sunset()], normal, T0)).toBe(true);
    expect(e.question?.cand.kind).toBe("sunset");
    const r = e.answer("shorten")!;
    expect(r.action).toMatchObject({ run: "drop-stops", dropStopIds: ["b"], capMin: expect.any(Number) });
    expect(e.question).toBeNull();
    expect(e.records).toHaveLength(1);
    expect(e.records[0]).toMatchObject({ kind: "sunset", outcome: "answered", answerId: "shorten", urgency: 3, askedAt: T0 });
  });

  it("logs a timeout as ignored and keeps one question on screen at a time", () => {
    const e = new CompanionEngine();
    const c = sunset();
    e.tick([c], normal, T0);
    expect(e.tick([c], normal, T0 + 10_000)).toBe(false); // already up
    e.tick([], normal, c.expiresAtMs + 1);
    expect(e.question).toBeNull();
    expect(e.records[0]).toMatchObject({ outcome: "ignored", dismissed: true });
  });

  it("a dismissed safety question is not re-asked for 45 minutes (the history is really kept)", () => {
    const e = new CompanionEngine();
    e.tick([sunset()], normal, T0);
    e.answer("continue");
    const later = (m: number) => buildCandidates(tick({ nowMs: T0 + m * MIN, remainingWalkMin: 150 - m, remainingStops: [{ id: "a", name: "A" }, { id: "b", name: "B" }] })).find((c) => c.kind === "sunset")!;
    expect(e.tick([later(20)], normal, T0 + 20 * MIN)).toBe(false);
    expect(e.question).toBeNull();
    expect(e.tick([later(50)], normal, T0 + 50 * MIN)).toBe(true);
  });

  it("priors feed the arbiter", () => {
    const e = new CompanionEngine({ rain: { asked: 40, answered: 0 } });
    const rain = buildCandidates(tick({ conditions: { apparentTempC: 20, precipProbabilityPct: 80 } }))[0];
    expect(e.tick([rain], quiet, T0)).toBe(false);
    const fresh = new CompanionEngine();
    expect(fresh.tick([rain], normal, T0)).toBe(true);
  });

  it("cancel logs an ignored ask; unknown answers are refused", () => {
    const e = new CompanionEngine();
    e.tick([sunset()], normal, T0);
    expect(e.answer("nope")).toBeNull();
    e.cancel();
    expect(e.records[0].outcome).toBe("ignored");
    expect(e.answer("shorten")).toBeNull();
  });
});

describe("walk end data", () => {
  it("turns records into question entries", () => {
    expect(
      questionEntries([
        { kind: "rain", askedAt: 1, outcome: "answered", answerId: "head-back" },
        { kind: "sunset", askedAt: 2, outcome: "ignored" },
      ]),
    ).toEqual([
      { kind: "rain", answer: "head-back" },
      { kind: "sunset", answer: "ignored" },
    ]);
  });
  it("lists visited / dismissed / added places, never detected finds", () => {
    const rows = interactionsFromItems([
      item("osm-node-1", at(0, 0), { state: "visited" }),
      item("osm-node-2", at(0, 10), { state: "dismissed" }),
      item("osm-node-3", at(0, 20), { state: "new" }),
      item("detected:1", at(0, 30), { state: "dismissed", tier: "detected" }),
    ]);
    expect(rows.map((r) => [r.poiKey, r.kind])).toEqual([
      ["osm-node-1", "visited"],
      ["osm-node-2", "dismissed"],
    ]);
  });
});

describe("memory wire", () => {
  it("round-trips and drops garbage", () => {
    const wire = toMemoryWire({
      sessionCount: 3, paceByEnv: { urban: { minPerKm: 12, n: 2 } }, calloutLevel: null, uiLanguage: null,
      typicalWalkMinutes: null, priors: { rain: { asked: 3, answered: 1 } },
      interactions: [{ poi_key: "k", kind: "visited", count: 1, last_session: 2 }],
    });
    expect(parseMemoryWire(wire)).toEqual(wire);
    const bad = parseMemoryWire({
      sessionCount: -4, paceByEnv: "x",
      interactions: [{ poi_key: 5 }, { poi_key: "k", kind: "evil", count: 1, last_session: 1 }, { poi_key: "ok", kind: "dismissed", count: 1, last_session: 1 }],
      priors: { rain: { asked: 2, answered: 9 }, bogus: { asked: 1, answered: 1 } },
    })!;
    expect(bad.sessionCount).toBe(0);
    expect(bad.interactions.map((i) => i.poi_key)).toEqual(["ok"]);
    expect(bad.priors).toEqual({ rain: { asked: 2, answered: 2 } });
    expect(parseMemoryWire(null)).toBeNull();
  });
});

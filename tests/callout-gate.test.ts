import { describe, expect, it } from "vitest";

import type { DiscoveryItem } from "@/lib/types/discovery";
import {
  eligibleForCallout,
  isNearTurn,
  type CalloutContext,
} from "@/lib/walk/callout-gate";
import { reframe } from "@/lib/walk/discovery-collection";
import { cumulativeDistances } from "@/lib/walk/walk-stats";
import { at, collectionOf, item } from "./helpers/discovery";

const route = [at(0, 0), at(0, 2000)];
const cum = cumulativeDistances(route);
const NOW = 10_000_000;

function framed(items: DiscoveryItem[]) {
  return reframe(collectionOf(items), route, cum, 80);
}

const ctx = (over: Partial<CalloutContext> = {}): CalloutContext => ({
  nearTurn: false,
  nearStop: false,
  cardVisible: false,
  paused: false,
  offRoute: false,
  onScreen: 0,
  history: [],
  planStopIds: new Set(),
  preferred: [],
  ...over,
});

const run = (
  items: DiscoveryItem[],
  env: "urban" | "park" | "rural",
  level: "quiet" | "normal" | "chatty",
  c: CalloutContext = ctx(),
  along = 480,
) => eligibleForCallout(framed(items), along, 1.35, env, level, c, NOW).map((i) => i.id);

describe("eligibleForCallout", () => {
  it("rejects a place 60 m aside in urban mode but accepts it in a park", () => {
    const p = item("p", at(60, 500));
    expect(run([p], "urban", "normal")).toEqual([]);
    expect(run([p], "park", "normal")).toEqual(["p"]);
  });

  it("uses the wider see-it distance for notable places in urban mode", () => {
    expect(run([item("n", at(70, 500), { notable: true })], "urban", "normal")).toEqual(["n"]);
    expect(run([item("n", at(90, 500), { notable: true })], "urban", "normal")).toEqual([]);
  });

  it("applies the level lateral multiplier (quiet x0.6, chatty x1.25)", () => {
    const p = item("p", at(30, 500), { notable: true });
    expect(run([p], "urban", "quiet")).toEqual(["p"]); // 48 m limit
    expect(run([item("q", at(55, 500), { notable: true })], "urban", "quiet")).toEqual([]);
    expect(run([item("q", at(95, 500), { notable: true })], "urban", "chatty")).toEqual(["q"]);
  });

  it("only offers places ahead within the look-ahead window", () => {
    const p = item("p", at(10, 500));
    expect(run([p], "urban", "normal", ctx(), 480)).toEqual(["p"]); // 20 m ahead
    expect(run([p], "urban", "normal", ctx(), 300)).toEqual([]); // 200 m ahead > 61 m
    expect(run([p], "urban", "normal", ctx(), 540)).toEqual([]); // passed
  });

  it("blocks crowd-signal below chatty, and detected below chatty", () => {
    const crowd = item("c", at(10, 500), { tier: "crowd-signal", sources: ["commons"] });
    expect(run([crowd], "urban", "quiet")).toEqual([]);
    expect(run([crowd], "urban", "normal")).toEqual([]);
    expect(run([crowd], "urban", "chatty")).toEqual(["c"]);
  });

  it("quiet allows only notable or preferred registered places, plus plan stops", () => {
    const plain = item("plain", at(10, 500));
    const notable = item("notable", at(10, 505), { notable: true });
    expect(run([plain, notable], "urban", "quiet")).toEqual(["notable"]);
    expect(
      run([plain], "urban", "quiet", ctx({ preferred: ["food"] })),
    ).toEqual(["plain"]);
    expect(
      run([plain], "urban", "quiet", ctx({ planStopIds: new Set(["plain"]) })),
    ).toEqual(["plain"]);
  });

  it("limits mapped-unnamed callouts to one per 10 minutes at normal", () => {
    const wood = item("w", at(10, 500), { tier: "mapped-unnamed", kind: "scenery" });
    expect(run([wood], "urban", "normal")).toEqual(["w"]);
    const recent = [{ atMs: NOW - 5 * 60_000, category: "other" as const, tier: "mapped-unnamed" as const }];
    expect(run([wood], "urban", "normal", ctx({ history: recent }))).toEqual([]);
  });

  it("is silent near a turn, off route, and while paused", () => {
    const p = item("p", at(10, 500));
    expect(run([p], "urban", "normal", ctx({ nearTurn: true }))).toEqual([]);
    expect(run([p], "urban", "normal", ctx({ offRoute: true }))).toEqual([]);
    expect(run([p], "urban", "normal", ctx({ paused: true }))).toEqual([]);
  });

  it("is silent within 100 m of an unvisited stop, except for the stop itself", () => {
    const stop = item("stop", at(10, 500));
    const other = item("other", at(10, 510), { category: "park" });
    const c = ctx({ nearStop: true, planStopIds: new Set(["stop"]) });
    expect(run([stop, other], "urban", "normal", c)).toEqual(["stop"]);
  });

  it("only announces places in state 'new'", () => {
    expect(run([item("a", at(10, 500), { state: "announced" })], "urban", "normal")).toEqual([]);
  });

  it("enforces the global gap, per level", () => {
    const p = item("p", at(10, 500));
    const hist = (agoMs: number) => [{ atMs: NOW - agoMs, category: "park" as const, tier: "registered" as const }];
    expect(run([p], "urban", "normal", ctx({ history: hist(60_000) }))).toEqual([]);
    expect(run([p], "urban", "normal", ctx({ history: hist(100_000) }))).toEqual(["p"]);
    expect(run([p], "urban", "quiet", ctx({ history: hist(200_000) }))).toEqual([]);
    expect(run([p], "urban", "chatty", ctx({ history: hist(50_000) }))).toEqual(["p"]);
  });

  it("multiplies the gap by 1.5 when the walker is fast", () => {
    const p = item("p", at(10, 500));
    const history = [{ atMs: NOW - 100_000, category: "park" as const, tier: "registered" as const }];
    const fast = eligibleForCallout(framed([p]), 480, 1.9, "urban", "normal", ctx({ history }), NOW);
    expect(fast).toEqual([]); // 100 s < 135 s
  });

  it("caps callouts per 10 minutes and on screen", () => {
    const p = item("p", at(10, 500));
    const four = Array.from({ length: 4 }, (_, i) => ({
      atMs: NOW - 200_000 - i * 60_000,
      category: "other" as const,
      tier: "registered" as const,
    }));
    expect(run([p], "urban", "normal", ctx({ history: four }))).toEqual([]);
    expect(run([p], "urban", "normal", ctx({ onScreen: 2 }))).toEqual([]);
    expect(run([p], "urban", "normal", ctx({ onScreen: 1, cardVisible: true }))).toEqual([]);
    expect(run([p], "urban", "quiet", ctx({ onScreen: 1, preferred: ["food"] }))).toEqual([]);
  });

  it("applies a per-category cooldown", () => {
    const p = item("p", at(10, 500), { category: "food" });
    const history = [{ atMs: NOW - 4 * 60_000, category: "food" as const, tier: "registered" as const }];
    expect(run([p], "urban", "chatty", ctx({ history }))).toEqual([]); // 5 min
    expect(run([p], "urban", "chatty", ctx({ history: [{ ...history[0], atMs: NOW - 6 * 60_000 }] }))).toEqual(["p"]);
  });

  it("ranks plan stop > preferred > notable > score and trims to capacity", () => {
    const items = [
      item("score", at(10, 500), { score: 9, category: "other" }),
      item("notable", at(10, 502), { notable: true, category: "shopping" }),
      item("pref", at(10, 504), { category: "park" }),
      item("stop", at(10, 506), { category: "religious" }),
    ];
    const c = ctx({ preferred: ["park"], planStopIds: new Set(["stop"]) });
    // reframe recomputes scores, so compare order of the top two only.
    const out = run(items, "urban", "chatty", c);
    expect(out.slice(0, 2)).toEqual(["stop", "pref"]);
    expect(out).toHaveLength(2); // chatty on-screen cap
  });

  it("limits Wikipedia-only places to 150 m even in rural mode", () => {
    const w = item("w", at(200, 500), { sources: ["wikipedia"], notable: true });
    const osm = item("o", at(200, 500), { notable: true });
    expect(run([w], "rural", "normal")).toEqual([]);
    expect(run([osm], "rural", "normal")).toEqual(["o"]);
  });
});

describe("isNearTurn", () => {
  const bent = [at(0, 0), at(0, 200), at(200, 200)];
  const bentCum = cumulativeDistances(bent);

  it("is true within 30 m of a >45 degree corner", () => {
    expect(isNearTurn(bent, bentCum, 185)).toBe(true);
    expect(isNearTurn(bent, bentCum, 215)).toBe(true);
  });

  it("is false on a straight stretch and well clear of the corner", () => {
    expect(isNearTurn(bent, bentCum, 100)).toBe(false);
    expect(isNearTurn(bent, bentCum, 150)).toBe(false);
    expect(isNearTurn(route, cum, 500)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import type { DiscoveryCollection } from "@/lib/types/discovery";
import {
  emptyCollection,
  isCovered,
  markState,
  mergeItems,
  nearby,
  reframe,
  scoreItem,
} from "@/lib/walk/discovery-collection";
import { cumulativeDistances } from "@/lib/walk/walk-stats";
import { at, collectionOf, item } from "./helpers/discovery";

describe("mergeItems", () => {
  it("merges by the same Wikidata QID", () => {
    const a = item("osm:1", at(0, 0), { tags: { wikidata: "Q1" }, name: "Old Mill" });
    const b = item("wiki:1", at(300, 300), {
      tags: { wikidata: "Q1" },
      name: "The Mill",
      sources: ["wikipedia"],
    });
    const out = mergeItems(collectionOf([a]), [b]);
    expect(out.items.size).toBe(1);
    expect([...out.items.values()][0].sources).toEqual(["osm", "wikipedia"]);
  });

  it("merges the same normalised name within 50 m, not beyond", () => {
    const a = item("a", at(0, 0), { name: "Café  Nola!" });
    const near = item("b", at(30, 0), { name: "cafe nola" });
    const far = item("c", at(200, 0), { name: "cafe nola" });
    expect(mergeItems(collectionOf([a]), [near]).items.size).toBe(1);
    expect(mergeItems(collectionOf([a]), [far]).items.size).toBe(2);
  });

  it("absorbs a crowd-signal cluster beside a registered place", () => {
    const reg = item("osm:1", at(0, 0), { name: "Viewpoint" });
    const crowd = item("commons:1", at(20, 10), {
      name: "Photo spot",
      tier: "crowd-signal",
      sources: ["commons"],
      photoCount: 40,
    });
    const out = mergeItems(collectionOf([reg]), [crowd]);
    expect(out.items.size).toBe(1);
    const merged = out.items.get("osm:1")!;
    expect(merged.tier).toBe("registered");
    expect(merged.photoCount).toBe(40);
    expect(merged.sources).toContain("commons");
    // ...and a crowd cluster far from anything stays its own item.
    const lone = item("commons:2", at(500, 500), { tier: "crowd-signal", sources: ["commons"] });
    expect(mergeItems(out, [lone]).items.size).toBe(2);
  });

  it("upgrades a crowd item when the registered twin arrives later, keeping its state", () => {
    const crowd = item("commons:1", at(0, 0), {
      tier: "crowd-signal",
      sources: ["commons"],
      state: "announced",
    });
    const reg = item("osm:9", at(10, 0), { name: "Fountain" });
    const merged = [...mergeItems(collectionOf([crowd]), [reg]).items.values()];
    expect(merged).toHaveLength(1);
    expect(merged[0].tier).toBe("registered");
    expect(merged[0].state).toBe("announced");
    expect(merged[0].attraction.name).toBe("Fountain");
  });

  it("never downgrades a tier", () => {
    const reg = item("x", at(0, 0));
    const weaker = item("x", at(0, 0), { tier: "detected", sources: ["worldcover"] });
    expect(mergeItems(collectionOf([reg]), [weaker]).items.get("x")!.tier).toBe("registered");
  });

  it("keeps a dismissed item dismissed through a merge", () => {
    const dismissed = item("x", at(0, 0), { state: "dismissed" });
    const fresh = item("x", at(0, 0), { state: "new" });
    expect(mergeItems(collectionOf([dismissed]), [fresh]).items.get("x")!.state).toBe("dismissed");
  });

  it("does not mutate the input collection", () => {
    const col = emptyCollection();
    mergeItems(col, [item("a", at(0, 0))]);
    expect(col.items.size).toBe(0);
  });
});

describe("markState", () => {
  it("advances but never regresses", () => {
    const col = collectionOf([item("a", at(0, 0), { state: "announced" })]);
    expect(markState(col, "a", "new").items.get("a")!.state).toBe("announced");
    expect(markState(col, "a", "visited").items.get("a")!.state).toBe("visited");
  });
});

describe("scoreItem", () => {
  it("orders registered > mapped-unnamed > crowd > detected at equal evidence", () => {
    const s = (tier: "registered" | "mapped-unnamed" | "crowd-signal" | "detected") =>
      scoreItem(item("a", at(0, 0), { tier }));
    expect(s("registered")).toBeGreaterThan(s("mapped-unnamed"));
    expect(s("mapped-unnamed")).toBeGreaterThan(s("crowd-signal"));
    expect(s("crowd-signal")).toBeGreaterThan(s("detected"));
  });

  it("rewards preferred, notable and photos, and penalises detours", () => {
    const base = item("a", at(0, 0), { category: "park" });
    expect(scoreItem(base, ["park"])).toBeGreaterThan(scoreItem(base));
    expect(scoreItem({ ...base, notable: true })).toBeGreaterThan(scoreItem(base));
    expect(scoreItem({ ...base, photoCount: 99 })).toBeGreaterThan(scoreItem(base));
    expect(scoreItem({ ...base, detourMin: 5 })).toBeCloseTo(scoreItem(base) - 0.4, 5);
    // photo bonus is capped
    expect(scoreItem({ ...base, photoCount: 1e9 })).toBeCloseTo(scoreItem(base) + 0.6, 5);
  });
});

describe("reframe", () => {
  it("sets frame, detour minutes and score from the route", () => {
    const route = [at(0, 0), at(0, 500)];
    const col = collectionOf([item("a", at(60, 250))]);
    const out = reframe(col, route, cumulativeDistances(route), 80);
    const a = out.items.get("a")!;
    expect(a.frame?.side).toBe("right");
    expect(a.detourMin).toBeCloseTo((2 * 60 * 1.25) / 80, 1);
    expect(out.routeVersion).toBe(1);
  });
});

describe("isCovered", () => {
  const scanned: DiscoveryCollection = {
    ...emptyCollection(),
    coverage: [[at(0, 0), at(0, 1000)]],
  };

  it("is true for a splice inside the scanned buffer", () => {
    const splice = [at(0, 100), at(120, 300), at(0, 500)];
    expect(isCovered(scanned, splice)).toBe(true);
  });

  it("is false when the path leaves the buffer (ring 600 - 150 = 450 m)", () => {
    expect(isCovered(scanned, [at(600, 100), at(600, 600)])).toBe(false);
    expect(isCovered(emptyCollection(), [at(0, 0), at(0, 100)])).toBe(false);
  });

  it("tolerates up to 10% uncovered", () => {
    const mostly = [at(0, 0), at(0, 900), at(1000, 900)];
    expect(isCovered(scanned, mostly)).toBe(false);
    const slight = [at(0, 0), at(0, 950), at(0, 1000), at(80, 1000)];
    expect(isCovered(scanned, slight)).toBe(true);
  });
});

describe("nearby", () => {
  it("returns items within the radius nearest first, minus exclusions", () => {
    const col = collectionOf([
      item("far", at(400, 0)),
      item("near", at(50, 0)),
      item("mid", at(150, 0)),
    ]);
    expect(nearby(col, at(0, 0), 200).map((i) => i.id)).toEqual(["near", "mid"]);
    expect(nearby(col, at(0, 0), 200, new Set(["near"])).map((i) => i.id)).toEqual(["mid"]);
  });
});

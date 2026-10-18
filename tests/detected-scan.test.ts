import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetAllCircuitBreakers } from "@/lib/api/circuit-breaker";

import { calloutHtml } from "@/components/map/PoiCallouts";
import {
  DETECTED_TIMEOUT_MS,
  ENCLOSING_BEGIN,
  ENCLOSING_SEPARATOR,
  buildHazardQuery,
  componentToItem,
  parseHazardResponse,
  runDetectedScan,
  runDetectedScanCounted,
} from "@/lib/places/detected-scan";
import type { LandcoverComponent } from "@/lib/types/landcover";
import { detectedNote, mayAddToWalk } from "@/lib/walk/detected-note";
import { itemToPlace } from "@/lib/walk/discovery-loader";
import { discoveryCopy } from "@/lib/walk/discovery-copy";

const C = { lat: 31.9, lng: 34.85 };
const D = 0.001;
const comp: LandcoverComponent = {
  cls: "tree",
  areaM2: 20_000,
  centroid: C,
  bbox: { south: C.lat - D, north: C.lat + D, west: C.lng - D, east: C.lng + D },
  canopyShare: 0.6,
};
const DAY = new Date("2026-03-15T09:00:00Z");
/**
 * Mimics Overpass 0.7.57+: the bbox part returns `elements` as given (a big ring
 * that merely surrounds the patch is NOT among them), then the begin marker; then,
 * for each `is_in(lat,lng)->.aN` in the query, the `enclosing` tag sets followed
 * by the separator. Since 0.7.57 `is_in` yields closed ways as {"type":"way",
 * "id","tags"} WITHOUT geometry; only relation-built areas are type "area".
 * `shape` picks which. If the query has no is_in, nothing comes back.
 */
const overpass = (
  elements: unknown[],
  enclosing: Array<Record<string, string>> = [],
  extra: Record<string, unknown> = {},
  shape: "way" | "area" | "relation" = "way",
) =>
  vi.fn(async (_url: unknown, init?: { body?: string }) => {
    const q = decodeURIComponent((init?.body ?? "").replace(/^data=/, "").replace(/\+/g, " "));
    const out: unknown[] = [...elements];
    const ins = [...q.matchAll(/is_in\(([\d.]+),([\d.]+)\)->\.a(\d+)/g)];
    if (ins.length > 0) out.push({ type: ENCLOSING_BEGIN, tags: { x: "1" } });
    for (const m of ins) {
      for (const tags of enclosing) out.push({ type: shape, id: 1, tags });
      out.push({ type: ENCLOSING_SEPARATOR, tags: { idx: m[3] } });
    }
    return new Response(JSON.stringify({ elements: out, ...extra }), { status: 200 });
  }) as unknown as typeof fetch;
const pathEl = {
  type: "way",
  tags: { highway: "path" },
  geometry: [
    { lat: C.lat + 0.0015, lon: C.lng - 0.002 },
    { lat: C.lat + 0.0015, lon: C.lng + 0.002 },
  ],
};
const store = (spy = vi.fn(async () => [comp])) => ({ get: spy });

beforeEach(() => resetAllCircuitBreakers());
afterEach(() => vi.unstubAllEnvs());

describe("flag", () => {
  it("off (default): zero store reads and zero fetches", async () => {
    const get = vi.fn(async () => [comp]);
    const f = overpass([pathEl]);
    const out = await runDetectedScan([C], 600, { store: { get }, fetchImpl: f, now: DAY });
    expect(out).toEqual([]);
    expect(get).not.toHaveBeenCalled();
    expect(f).not.toHaveBeenCalled();
  });

  it("on: produces a detected item", async () => {
    vi.stubEnv("NEXT_PUBLIC_DETECTED_TIER", "1");
    const out = await runDetectedScan([C], 600, { store: store(), fetchImpl: overpass([pathEl]), now: DAY });
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].tier).toBe("detected");
    expect(out[0].attraction.tags["detected:hazards"]).toContain("private");
    expect(Number(out[0].attraction.tags["detected:confidence"])).toBeLessThanOrEqual(0.8);
  });
});

describe("graceful degradation (flag forced on)", () => {
  const base = { force: true, now: DAY };
  it("Overpass down / non-200 / garbage / no store data -> no items", async () => {
    expect(await runDetectedScan([C], 600, { ...base, store: store(), fetchImpl: vi.fn(async () => { throw new Error("offline"); }) as unknown as typeof fetch })).toEqual([]);
    expect(await runDetectedScan([C], 600, { ...base, store: store(), fetchImpl: vi.fn(async () => new Response("x", { status: 504 })) as unknown as typeof fetch })).toEqual([]);
    expect(await runDetectedScan([C], 600, { ...base, store: store(), fetchImpl: vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch })).toEqual([]);
    expect(await runDetectedScan([C], 600, { ...base, store: { get: async () => null }, fetchImpl: overpass([pathEl]) })).toEqual([]);
    expect(await runDetectedScan([C], 600, { ...base, store: { get: async () => { throw new Error("db"); } }, fetchImpl: overpass([pathEl]) })).toEqual([]);
  });

  it("restricted-zone candidates never reach Overpass", async () => {
    const g = { lat: 31.45, lng: 34.4 };
    const inGaza = { ...comp, centroid: g, bbox: { south: g.lat - D, north: g.lat + D, west: g.lng - D, east: g.lng + D } };
    const f = overpass([pathEl]);
    const out = await runDetectedScan([g], 600, { ...base, store: store(vi.fn(async () => [inGaza])), fetchImpl: f });
    expect(out).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });

  it("a military polygon returned by the bbox query suppresses the item", async () => {
    const mil = { type: "way", tags: { landuse: "military" }, geometry: [
      { lat: C.lat - 0.01, lon: C.lng - 0.01 }, { lat: C.lat - 0.01, lon: C.lng + 0.01 },
      { lat: C.lat + 0.01, lon: C.lng + 0.01 }, { lat: C.lat + 0.01, lon: C.lng - 0.01 },
      { lat: C.lat - 0.01, lon: C.lng - 0.01 } ] };
    expect(await runDetectedScan([C], 600, { ...base, store: store(), fetchImpl: overpass([pathEl, mil]) })).toEqual([]);
  });

  it("a patch fully INSIDE a big military / private / reserve-closed area (only is_in returns it) is suppressed, for every is_in shape", async () => {
    for (const shape of ["way", "area", "relation"] as const) {
      for (const tags of [
        { landuse: "military" } as Record<string, string>,
        { military: "range" },
        { hazard: "minefield" },
        { landuse: "farmland" },
        { landuse: "aquaculture" },
        { landuse: "salt_pond" },
        { man_made: "wastewater_plant" },
        { access: "private" },
      ]) {
        expect(
          await runDetectedScan([C], 600, { ...base, store: store(), fetchImpl: overpass([pathEl], [tags], {}, shape) }),
          `${shape} ${JSON.stringify(tags)}`,
        ).toEqual([]);
      }
    }
    // control: with no enclosing area the same world shows the item
    expect((await runDetectedScan([C], 600, { ...base, store: store(), fetchImpl: overpass([pathEl]) })).length).toBeGreaterThan(0);
  });

  it("an enclosing nature reserve is shown with the reserve warning, not suppressed (way and area shapes)", async () => {
    for (const shape of ["way", "area"] as const) {
      const out = await runDetectedScan([C], 600, { ...base, store: store(), fetchImpl: overpass([pathEl], [{ leisure: "nature_reserve" }], {}, shape) });
      expect(out[0].attraction.tags["detected:hazards"]).toContain("reserve");
    }
  });

  it("an unrelated tagged way in the is_in section (not a hazard key) does not suppress", async () => {
    expect((await runDetectedScan([C], 600, { ...base, store: store(), fetchImpl: overpass([pathEl], [{ name: "x", highway: "path" }]) })).length).toBeGreaterThan(0);
  });

  it("a recorded-shape `out geom` relation (members with geometry, inner role ignored) parses and suppresses", async () => {
    const fixture = JSON.parse(readFileSync("tests/fixtures/overpass-relation-out-geom.json", "utf8")) as { elements: unknown[] };
    const f = parseHazardResponse({ elements: fixture.elements });
    expect(f).toHaveLength(1);
    expect(f?.[0].closed).toBe(true);
    expect(f?.[0].tags.landuse).toBe("military");
    expect(await runDetectedScan([C], 600, { ...base, store: store(), fetchImpl: overpass([pathEl, ...fixture.elements]) })).toEqual([]);
  });

  it("multi-piece military relation (open outer pieces near the patch) suppresses", async () => {
    const piece = (dlat: number) => ({ type: "way", role: "outer", geometry: [
      { lat: C.lat + dlat, lon: C.lng - 0.01 }, { lat: C.lat + dlat, lon: C.lng + 0.01 } ] });
    const rel = { type: "relation", tags: { landuse: "military" }, members: [piece(0.0022), piece(-0.0022)] };
    expect(await runDetectedScan([C], 600, { ...base, store: store(), fetchImpl: overpass([pathEl, rel]) })).toEqual([]);
  });

  it("a minefield way or landmine node near the patch suppresses", async () => {
    const mine = { type: "way", tags: { hazard: "minefield" }, geometry: [
      { lat: C.lat + 0.001, lon: C.lng + 0.002 }, { lat: C.lat + 0.001, lon: C.lng + 0.003 } ] };
    const node = { type: "node", lat: C.lat, lon: C.lng + 0.002, tags: { hazard: "landmine" } };
    for (const el of [mine, node]) {
      expect(await runDetectedScan([C], 600, { ...base, store: store(), fetchImpl: overpass([pathEl, el]) })).toEqual([]);
    }
  });

  it("an Overpass 200 with a remark (partial result) is unknown -> no items", async () => {
    expect(await runDetectedScan([C], 600, { ...base, store: store(), fetchImpl: overpass([pathEl], [], { remark: "runtime error: Query timed out" }) })).toEqual([]);
  });

  it("missing enclosing-area answers (cut-off output) -> no items", async () => {
    const noSep = vi.fn(async () => new Response(JSON.stringify({ elements: [pathEl] }), { status: 200 })) as unknown as typeof fetch;
    expect(await runDetectedScan([C], 600, { ...base, store: store(), fetchImpl: noSep })).toEqual([]);
  });

  it("sends the app User-Agent and counts one Overpass call; an open breaker makes no call", async () => {
    vi.stubEnv("APP_CONTACT", "ops@example.test");
    const f = overpass([pathEl]);
    const r = await runDetectedScanCounted([C], 600, { ...base, store: store(), fetchImpl: f });
    expect(r.overpassCalls).toBe(1);
    expect((f as unknown as { mock: { calls: Array<[unknown, { headers: Record<string, string> }]> } }).mock.calls[0][1].headers["User-Agent"]).toContain("ops@example.test");
    const bad = vi.fn(async () => new Response("x", { status: 429 })) as unknown as typeof fetch;
    for (let i = 0; i < 3; i += 1) await runDetectedScan([C], 600, { ...base, store: store(), fetchImpl: bad });
    const after = await runDetectedScanCounted([C], 600, { ...base, store: store(), fetchImpl: bad });
    expect(after).toEqual({ items: [], overpassCalls: 0 });
    expect(bad).toHaveBeenCalledTimes(3);
  });

  it("flag off or no candidates: zero Overpass calls reported", async () => {
    expect((await runDetectedScanCounted([C], 600, { store: store(), now: DAY })).overpassCalls).toBe(0);
  });

  it("a water patch whose coastline is 150 m away is sea: suppressed even with a promenade nearby", async () => {
    const sea: LandcoverComponent = { ...comp, cls: "water" };
    const coast = { type: "way", tags: { natural: "coastline" }, geometry: [
      { lat: C.lat + 0.0023, lon: C.lng - 0.01 }, { lat: C.lat + 0.0023, lon: C.lng + 0.01 } ] };
    const promenade = { type: "way", tags: { highway: "footway" }, geometry: [
      { lat: C.lat + 0.0015, lon: C.lng - 0.002 }, { lat: C.lat + 0.0015, lon: C.lng + 0.002 } ] };
    const run = (els: unknown[]) => runDetectedScan([C], 600, { ...base, store: store(vi.fn(async () => [sea])), fetchImpl: overpass(els) });
    expect(await run([promenade, coast])).toEqual([]);
    expect((await run([promenade])).length).toBeGreaterThan(0); // control: no coastline -> shown
  });

  it("the patch name follows lang", async () => {
    const he = await runDetectedScan([C], 600, { ...base, lang: "he", store: store(), fetchImpl: overpass([pathEl]) });
    expect(he[0].attraction.name).toBe(discoveryCopy.he["detected.nameGreen"]);
    expect(discoveryCopy.he["detected.nameWater"]).toBe("מים (לא מאומתים)");
  });
});

describe("overpass parsing and query", () => {
  it("parses ways and relation members; null on bad shape", () => {
    expect(parseHazardResponse({})).toBeNull();
    const f = parseHazardResponse({ elements: [pathEl, { type: "relation", tags: { military: "range" }, members: [{ type: "way", role: "outer", geometry: [{ lat: 1, lon: 1 }, { lat: 1, lon: 2 }, { lat: 2, lon: 2 }, { lat: 1, lon: 1 }] }] }] });
    expect(f).toHaveLength(2);
    expect(f?.[0].closed).toBe(false);
    expect(f?.[1].closed).toBe(true);
  });
  it("query uses `out geom;` (not `out geom tags;`, which returns relations without members)", () => {
    const q = buildHazardQuery([comp]);
    expect(q).toContain(");out geom;");
    expect(q).not.toContain("out geom tags");
  });
  it("parser: a tagged way without geometry after the begin marker is an enclosing area; before it, it is ignored", () => {
    const bare = { type: "way", tags: { landuse: "military" } };
    const sep = { type: ENCLOSING_SEPARATOR, tags: { idx: "0" } };
    const hit = parseHazardResponse({ elements: [pathEl, { type: ENCLOSING_BEGIN }, bare, sep] }, 1);
    expect(hit?.some((x) => x.encloses === 0 && x.tags.landuse === "military")).toBe(true);
    const miss = parseHazardResponse({ elements: [pathEl, bare, { type: ENCLOSING_BEGIN }, sep] }, 1);
    expect(miss?.some((x) => x.encloses === 0)).toBe(false);
    expect(parseHazardResponse({ elements: [pathEl, bare, sep] }, 1)).toBeNull(); // no begin marker -> fail closed
  });
  it("the query's own timeout is under the client's, so Overpass does not keep working after we gave up", () => {
    const m = /\[timeout:(\d+)\]/.exec(buildHazardQuery([comp]));
    expect(Number(m![1]) * 1000).toBeLessThan(DETECTED_TIMEOUT_MS);
    expect(buildHazardQuery([comp])).not.toMatch(/\|secondary|\|primary/);
  });
  it("query asks for each hazard key independently", () => {
    const q = buildHazardQuery([comp]);
    for (const needle of [
      'way["landuse"](',
      'relation["landuse"~"^(military|farmland|orchard|vineyard|aquaculture|salt_pond|landfill|quarry|industrial)$"](',
      'relation["man_made"~"^(wastewater_plant|works|water_works|storage_tank)$"](',
      'way["military"](',
      'relation["military"](',
      'nwr["hazard"~"^(minefield|landmine|mine|danger_area)$"](',
      'nwr["landmine"](',
      'nwr["danger_area"](',
      'way["military"="danger_area"](',
      'relation["leisure"="nature_reserve"](',
      'way["boundary"~"^(protected_area|national_park)$"](',
      'way["access"~"^(private|no)$"]',
      'way["waterway"~',
      'natural"~"^(wood|water|grassland|scrub|wetland|cliff|coastline)$"',
      'way["highway"~',
      'is_in(31.90000,34.85000)->.a0',
      'area.a0["landuse"~"^(military|farmland|orchard|vineyard|aquaculture|salt_pond|landfill|quarry|industrial)$"]',
      'area.a0["man_made"~"^(wastewater_plant|works|water_works|storage_tank)$"]',
      'area.a0["military"]',
      'area.a0["hazard"]',
      'way.a0["hazard"]',
      'relation.a0["military"]',
      'area.a0["access"~"^(private|no)$"]',
      'area.a0["leisure"="nature_reserve"]',
      'area.a0["boundary"~"^(protected_area|national_park)$"]',
    ]) {
      expect(q, needle).toContain(needle);
    }
  });
  it("fences are fetched across the whole patch bbox, not 60 m around the centre", () => {
    const wide = { ...comp, bbox: { south: C.lat - 0.005, north: C.lat + 0.005, west: C.lng - 0.005, east: C.lng + 0.005 } };
    const q = buildHazardQuery([wide]);
    const fence = q.split("\n").join("").match(/way\["barrier"[^;]*\(([\d.,-]+)\);/);
    expect(fence).not.toBeNull();
    const [s0, w0, n0, e0] = fence![1].split(",").map(Number);
    expect(s0).toBeLessThan(C.lat - 0.005);
    expect(n0).toBeGreaterThan(C.lat + 0.005);
    expect(w0).toBeLessThan(C.lng - 0.005);
    expect(e0).toBeGreaterThan(C.lng + 0.005);
    expect(q).not.toContain("around:60");
  });
  it("parser: remark -> null; trailing areas without separator -> null; separator count must match", () => {
    expect(parseHazardResponse({ elements: [pathEl], remark: "x" })).toBeNull();
    expect(parseHazardResponse({ elements: [{ type: "area", tags: { landuse: "military" } }] })).toBeNull();
    expect(parseHazardResponse({ elements: [pathEl] }, 1)).toBeNull();
    expect(parseHazardResponse({ elements: [pathEl, { type: ENCLOSING_BEGIN }, { type: ENCLOSING_SEPARATOR, tags: { idx: "0" } }] }, 1)).toHaveLength(1);
  });
});

describe("detected places cannot be added to the walk", () => {
  it("mayAddToWalk is false for detected even when the distance rule allows it", () => {
    expect(mayAddToWalk("detected", true)).toBe(false);
    expect(mayAddToWalk("crowd-signal", true)).toBe(true);
    expect(mayAddToWalk(undefined, false)).toBe(false);
  });
  it("HUD note carries lead + every hazard + check signs in both languages", () => {
    const note = detectedNote({ "detected:hazards": "private,flood,fire" });
    for (const lang of ["en", "he"] as const) {
      const c = discoveryCopy[lang];
      for (const k of ["detected.lead", "hazard.private", "hazard.flood", "hazard.fire", "detected.checkSigns"] as const) {
        expect(note).toContain(c[k]);
      }
    }
    expect(detectedNote({})).toContain(discoveryCopy.en["hazard.private"]);
  });
});

describe("card copy", () => {
  const item = componentToItem(comp, { action: "show", confidence: 0.6, hazards: ["private", "fire", "flood"] }, 0);
  const html = calloutHtml({ place: itemToPlace(item), relation: "right", distanceM: 50, announcedAt: 0, isPlanStop: false });
  it("shows HE and EN: lead, every hazard, check signs, footer with 100/101/102", () => {
    for (const lang of ["en", "he"] as const) {
      const c = discoveryCopy[lang];
      for (const k of ["detected.lead", "hazard.private", "hazard.fire", "hazard.flood", "detected.checkSigns", "detected.footer"] as const) {
        expect(html).toContain(c[k].replace(/&/g, "&amp;").replace(/'/g, "&#39;"));
      }
    }
    expect(html).toContain("101");
  });
  it("never claims safe or verified, never prints a confidence number", () => {
    expect(html).not.toMatch(/(?<!un)verified|\bis safe\b|0\.6/i);
    expect(discoveryCopy.en["detected.lead"]).toContain("not a registered place");
    expect(discoveryCopy.he["detected.lead"]).toContain("לא מקום רשום");
  });
  it("a detected place without hazard tags still carries the private warning", () => {
    const bare = { ...itemToPlace(item), tags: {} };
    const h = calloutHtml({ place: bare, relation: "right", distanceM: 5, announcedAt: 0, isPlanStop: false });
    expect(h).toContain(discoveryCopy.en["hazard.private"].replace(/'/g, "&#39;"));
  });
});

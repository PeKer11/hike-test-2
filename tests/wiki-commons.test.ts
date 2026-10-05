import { afterEach, describe, expect, it, vi } from "vitest";

import {
  binCommonsFiles,
  fetchPhotoClusters,
  parseCommonsResponse,
} from "@/lib/places/commons-density";
import {
  fetchWikiPlaces,
  isInIsrael,
  parseWikiResponse,
  sampleScanPoints,
  wikiPlaceToItem,
} from "@/lib/places/wiki-geosearch";
import { at } from "./helpers/discovery";

afterEach(() => vi.unstubAllGlobals());

const wikiBody = {
  query: {
    pages: {
      "101": {
        pageid: 101,
        title: "Old Mill",
        coordinates: [{ lat: 32.08, lon: 34.78 }],
        pageprops: { wikibase_item: "Q42" },
      },
      "102": { pageid: 102, title: "No coords" },
      "103": { pageid: 103, title: "No QID", coordinates: [{ lat: 32.09, lon: 34.79 }] },
    },
  },
};

function stubFetch(body: unknown = wikiBody) {
  const spy = vi.fn(async () => new Response(JSON.stringify(body)));
  vi.stubGlobal("fetch", spy);
  return spy;
}

describe("wiki geosearch", () => {
  it("parses pages with coordinates and the Wikidata QID", () => {
    const places = parseWikiResponse(wikiBody, "en");
    expect(places).toHaveLength(2);
    expect(places[0]).toMatchObject({ title: "Old Mill", qid: "Q42", coordinates: { lat: 32.08, lng: 34.78 } });
    expect(places[1].qid).toBeUndefined();
    expect(parseWikiResponse({}, "en")).toEqual([]);
  });

  it("searches he + en inside the Israel bbox, en only outside", async () => {
    const spy = stubFetch();
    await fetchWikiPlaces([at(0, 0)]);
    const urls = spy.mock.calls.map((c) => (c as unknown as [string])[0]);
    expect(urls.some((u) => u.startsWith("https://he.wikipedia.org"))).toBe(true);
    expect(urls.some((u) => u.startsWith("https://en.wikipedia.org"))).toBe(true);
    expect(urls[0]).toContain("ggsradius=800");
    expect(urls[0]).toContain("ggslimit=50");
    // coordinates sent to Wikipedia are rounded to 3 decimals (about 100 m)
    expect(decodeURIComponent(urls[0])).toMatch(/ggscoord=-?\d+\.\d{3}\|-?\d+\.\d{3}(&|$)/);

    spy.mockClear();
    await fetchWikiPlaces([{ lat: 48.85, lng: 2.35 }]);
    expect(spy).toHaveBeenCalledTimes(1);
    expect((spy.mock.calls[0] as unknown as [string])[0]).toContain("en.wikipedia.org");
    expect(isInIsrael({ lat: 48.85, lng: 2.35 })).toBe(false);
  });

  it("sends a User-Agent and never exceeds 8 calls", async () => {
    const spy = stubFetch();
    const many = Array.from({ length: 10 }, (_, i) => at(i * 1000, 0));
    const { calls } = await fetchWikiPlaces(many);
    expect(calls).toBeLessThanOrEqual(8);
    expect(spy.mock.calls.length).toBe(calls);
    const init = (spy.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>)["User-Agent"]).toContain("HikingRoutePlanner/1.0");
  });

  it("de-duplicates by QID and survives a failed call", async () => {
    let n = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      n += 1;
      if (n === 1) throw new Error("boom");
      return new Response(JSON.stringify(wikiBody));
    }));
    const { places } = await fetchWikiPlaces([at(0, 0)]);
    expect(places.filter((p) => p.qid === "Q42")).toHaveLength(1);
  });

  it("samples at most 4 points along a long route", () => {
    expect(sampleScanPoints([at(0, 0), at(0, 20_000)])).toHaveLength(4);
    expect(sampleScanPoints([at(0, 0), at(0, 2_000)]).length).toBeLessThanOrEqual(2);
  });

  it("turns an article into a registered, notable item keyed by QID", () => {
    const [withQid] = parseWikiResponse(wikiBody, "he");
    const it = wikiPlaceToItem(withQid);
    expect(it).toMatchObject({ id: "wikidata:Q42", tier: "registered", notable: true });
    expect(it.attraction.tags.wikidata).toBe("Q42");
    expect(it.sources).toEqual(["wikipedia", "wikidata"]);
  });
});

describe("commons density", () => {
  const files = (n: number, base = at(0, 0), start = 0) =>
    Array.from({ length: n }, (_, i) => ({
      pageid: start + i,
      coordinates: { lat: base.lat + i * 1e-7, lng: base.lng },
    }));

  it("bins ~50 m cells and keeps those with >= 8 files", () => {
    const clusters = binCommonsFiles([...files(8), ...files(7, at(500, 500), 100)]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].photoCount).toBe(8);
  });

  it("counts a file once even when two scan points both return it", () => {
    expect(binCommonsFiles([...files(5), ...files(5)])).toEqual([]);
  });

  it("parses geosearch hits and caps calls at 4", async () => {
    expect(parseCommonsResponse({ query: { geosearch: [{ pageid: 1, lat: 1, lon: 2 }, { pageid: 2 }] } })).toHaveLength(1);
    const spy = stubFetch({ query: { geosearch: [] } });
    const { calls } = await fetchPhotoClusters(Array.from({ length: 9 }, (_, i) => at(i * 900, 0)));
    expect(calls).toBe(4);
    expect(spy).toHaveBeenCalledTimes(4);
    const first = (spy.mock.calls[0] as unknown as [string])[0];
    expect(first).toContain("gsnamespace=6");
    expect(decodeURIComponent(first)).toMatch(/gscoord=-?\d+\.\d{3}\|-?\d+\.\d{3}(&|$)/);
  });
});

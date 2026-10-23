import { describe, expect, it } from "vitest";
import { parseRecommendation, validPoiKey } from "@/lib/social/recommendations";

describe("parseRecommendation", () => {
  const ok = { poiKey: "osm-node-123", category: "park", tags: ["view", "shade"] };
  it("accepts an OSM place and a Google place id", () => {
    expect(parseRecommendation(ok)?.tags).toEqual(["view", "shade"]);
    expect(parseRecommendation({ ...ok, poiKey: "google-ChIJN1t_tDeuEmsRUsoyG83frY4" })).not.toBeNull();
  });
  it("rejects name@coords keys and other shapes", () => {
    expect(parseRecommendation({ ...ok, poiKey: "my home@32.0,34.8" })).toBeNull();
    expect(parseRecommendation({ ...ok, poiKey: "node/123" })).toBeNull();
    expect(parseRecommendation(null)).toBeNull();
  });
  it("drops unknown tags, dedupes and keeps at most three", () => {
    const r = parseRecommendation({ ...ok, tags: ["view", "view", "x", "quiet", "kids", "coffee"] });
    expect(r?.tags).toEqual(["view", "quiet", "kids"]);
  });
  it("rejects an unknown category", () => {
    expect(parseRecommendation({ ...ok, category: "other" })).toBeNull();
  });
  it("validates a bare key", () => {
    expect(validPoiKey("osm-way-9")).toBe(true);
    expect(validPoiKey(5)).toBe(false);
  });
});

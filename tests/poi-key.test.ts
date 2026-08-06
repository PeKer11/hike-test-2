import { describe, expect, it } from "vitest";

import { poiIdentityKeys, poiKey } from "@/lib/preferences/poi-key";

// This module is a reimplementation of a generated SQL column
// (`attraction_feedback.poi_key` in 20260728120000_initial_schema.sql). A
// mismatch is silent — a downvoted place simply reappears — so each clause of
// the SQL gets its own case here rather than one round-trip test.
describe("poiKey — the osm_id branch", () => {
  it("uses the OSM element id when there is one", () => {
    expect(
      poiKey({ osmId: "node/1234567", name: "Tel Aviv Museum", lat: 32.08, lng: 34.78 }),
    ).toBe("node/1234567");
  });

  // `nullif(osm_id, '')` — an empty id is not an id.
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["an empty string", ""],
  ])("falls through to name and coordinates when the id is %s", (_label, osmId) => {
    expect(poiKey({ osmId, name: "Gordon Beach", lat: 32.08, lng: 34.78 })).toBe(
      "gordon beach@32.0800,34.7800",
    );
  });

  // The `case when poi_name is null then ''` arm: the shape the column stores
  // for category-level feedback, which is not an identity anything matches on.
  it("is the empty string when there is neither an id nor a name", () => {
    expect(poiKey({ osmId: null, name: null, lat: 32.08, lng: 34.78 })).toBe("");
  });
});

describe("poiKey — coordinate text", () => {
  it("lowercases the name and joins with @ and a comma", () => {
    expect(
      poiKey({ osmId: null, name: "Sarona MARKET", lat: 32.0713, lng: 34.7873 }),
    ).toBe("sarona market@32.0713,34.7873");
  });

  // `round(lat, 4)::text` on a numeric keeps the scale — 32.08 is `32.0800`.
  it("pads to exactly four decimal places", () => {
    expect(poiKey({ osmId: null, name: "a", lat: 32.1, lng: 34 })).toBe(
      "a@32.1000,34.0000",
    );
  });

  // ~11 m: the same POI re-fetched from Overpass with nudged geometry matches.
  it("rounds a fifth decimal place away", () => {
    expect(poiKey({ osmId: null, name: "a", lat: 32.08004, lng: 34.78001 })).toBe(
      "a@32.0800,34.7800",
    );
  });

  // Postgres numerics round half away from zero, not to even.
  it("rounds a half up rather than to even", () => {
    expect(poiKey({ osmId: null, name: "a", lat: 32.08005, lng: 32.08015 })).toBe(
      "a@32.0801,32.0802",
    );
  });

  it("rounds a negative half away from zero too", () => {
    expect(poiKey({ osmId: null, name: "a", lat: -32.08005, lng: -34.78 })).toBe(
      "a@-32.0801,-34.7800",
    );
  });

  it("carries a rounded 9 into the whole part", () => {
    expect(poiKey({ osmId: null, name: "a", lat: 31.99998, lng: 9.99995 })).toBe(
      "a@32.0000,10.0000",
    );
  });

  // Postgres numeric has no negative zero.
  it("does not sign a value that rounds to zero", () => {
    expect(poiKey({ osmId: null, name: "a", lat: -0.00001, lng: 0 })).toBe(
      "a@0.0000,0.0000",
    );
  });

  // The column is `numeric(9, 6)`, so a coordinate is rounded to six places on
  // the way in and only then to four — which is not the same as rounding once.
  it("rounds through the column's own scale first", () => {
    // Direct to 4dp this is 32.0800; via numeric(9,6) it is 32.080050 -> 32.0801.
    expect(poiKey({ osmId: null, name: "a", lat: 32.0800499999, lng: 34.78 })).toBe(
      "a@32.0801,34.7800",
    );
  });
});

describe("poiIdentityKeys", () => {
  // A downvote on a stop the walker named themselves is stored with no OSM id,
  // so the same place rediscovered through Overpass has to be matched by name.
  it("returns both the id and the name identity when an id exists", () => {
    expect(
      poiIdentityKeys({
        osmId: "node/42",
        name: "Carmel Market",
        lat: 32.0685,
        lng: 34.7689,
      }),
    ).toEqual(["node/42", "carmel market@32.0685,34.7689"]);
  });

  it("returns the name identity alone when there is no id", () => {
    expect(
      poiIdentityKeys({ osmId: null, name: "Carmel Market", lat: 32.0685, lng: 34.7689 }),
    ).toEqual(["carmel market@32.0685,34.7689"]);
  });

  it("returns nothing to match on for a category-level row", () => {
    expect(poiIdentityKeys({ osmId: null, name: null, lat: 0, lng: 0 })).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";

import { parseSparql, sparqlFor } from "@/lib/places/notable";

const row = (qid: string, name: string, type: string, sl: number, lat = 32.5, lon = 34.9) => ({
  item: { value: `http://www.wikidata.org/entity/${qid}` },
  name: { value: name },
  type: { value: `http://www.wikidata.org/entity/${type}` },
  sl: { value: String(sl) },
  lat: { value: String(lat) },
  lon: { value: String(lon) },
});

describe("notable places", () => {
  it("merges rows per place, prefers the Hebrew name and the most specific kind, ranks by fame", () => {
    const places = parseSparql({
      results: {
        bindings: [
          row("Q1", "Caesarea", "Q839954", 57),
          row("Q1", "קיסריה", "Q839954", 57),
          row("Q2", "Kabara Cave", "Q839954", 24),
          row("Q2", "מערת כבארה", "Q35509", 24),
        ],
      },
    });
    expect(places.map((p) => p.id)).toEqual(["Q1", "Q2"]);
    expect(places[0].name).toBe("קיסריה");
    expect(places[1]).toMatchObject({ name: "מערת כבארה", kind: "Cave" });
  });

  it("drops types that are not on the walking allowlist and malformed rows", () => {
    const places = parseSparql({ results: { bindings: [row("Q3", "Road 653", "Q34442", 5), { item: { value: "x" } }] } });
    expect(places).toEqual([]);
  });

  it("returns nothing for a bad response", () => {
    expect(parseSparql(null)).toEqual([]);
    expect(parseSparql({})).toEqual([]);
  });

  it("builds the box query with longitude first", () => {
    const q = sparqlFor({ south: 32.45, west: 34.85, north: 32.6, east: 35.05 });
    expect(q).toContain('"Point(34.85 32.45)"');
    expect(q).toContain('"Point(35.05 32.6)"');
  });
});

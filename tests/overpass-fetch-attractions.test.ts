import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchAttractions } from "@/lib/attractions/overpass-client";

const PRIMARY = "https://overpass-api.de/api/interpreter";
const MIRROR = "https://overpass.kumi.systems/api/interpreter";

function ok(payload: unknown) {
  return { ok: true, status: 200, json: async () => payload, text: async () => "" };
}

function httpError(status: number, statusText = "Error", body = "") {
  return {
    ok: false,
    status,
    statusText,
    json: async () => ({}),
    text: async () => body,
  };
}

function stubOverpass(...responses: unknown[]) {
  const fetchMock = vi.fn();
  for (const response of responses) {
    fetchMock.mockResolvedValueOnce(response);
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const CENTER = { lat: 32.0736, lng: 34.7811 };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchAttractions request", () => {
  it("POSTs a form-encoded Overpass query around the requested point", async () => {
    const fetchMock = stubOverpass(ok({ elements: [] }));

    await fetchAttractions(CENTER, 1500);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(PRIMARY);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/x-www-form-urlencoded",
    );

    const query = decodeURIComponent((init.body as string).replace(/^data=/, ""));
    expect(query).toContain("(around:1500,32.0736,34.7811)");
    expect(query).toContain("out center;");
  });

  it("asks for both point and footprint POIs", async () => {
    const fetchMock = stubOverpass(ok({ elements: [] }));

    await fetchAttractions(CENTER, 1500);

    const query = decodeURIComponent(
      ((fetchMock.mock.calls[0][1] as RequestInit).body as string).replace(
        /^data=/,
        "",
      ),
    );
    expect(query).toContain('node["tourism"~');
    expect(query).toContain('way["historic"]');
  });
});

describe("fetchAttractions endpoint failover", () => {
  it("retries the same endpoint as a GET before moving to the next mirror", async () => {
    const fetchMock = stubOverpass(httpError(400, "Bad Request"), ok({ elements: [] }));

    await fetchAttractions(CENTER, 1500);

    const [secondUrl, secondInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(secondUrl.startsWith(`${PRIMARY}?data=`)).toBe(true);
    expect(secondInit.method).toBe("GET");
  });

  it("moves to the next mirror once both methods on the first one fail", async () => {
    const fetchMock = stubOverpass(
      httpError(500, "Server Error"),
      httpError(500, "Server Error"),
      ok({ elements: [] }),
    );

    await fetchAttractions(CENTER, 1500);

    expect(fetchMock.mock.calls[2][0]).toBe(MIRROR);
  });

  it("reports the status and body of the last failure when every mirror fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(httpError(500, "Server Error", "rate limited, slow down"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchAttractions(CENTER, 1500)).rejects.toThrow(
      "Overpass API error: 500 Server Error - rate limited, slow down",
    );
    // Three endpoints, POST then GET on each.
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it("translates a 403 into advice the walker can act on", async () => {
    // Status code only — no mirror is guaranteed to say "Forbidden" in words.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(httpError(403, "Rate Limited")));

    await expect(fetchAttractions(CENTER, 1500)).rejects.toThrow(
      "Public map data service temporarily rejected the walk request",
    );
  });

  it("gives the same advice for a mirror that only says forbidden in words", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(httpError(429, "Too Many Requests", "Forbidden")),
    );

    await expect(fetchAttractions(CENTER, 1500)).rejects.toThrow(
      "Public map data service temporarily rejected the walk request",
    );
  });

  it("surfaces a transport failure rather than the 403 advice", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("socket hang up")));

    await expect(fetchAttractions(CENTER, 1500)).rejects.toThrow("socket hang up");
  });
});

describe("fetchAttractions element parsing", () => {
  async function attractionsFrom(elements: unknown[]) {
    stubOverpass(ok({ elements }));
    return fetchAttractions(CENTER, 1500);
  }

  it("reads coordinates straight off a node", async () => {
    const [attraction] = await attractionsFrom([
      {
        type: "node",
        id: 42,
        lat: 32.07,
        lon: 34.78,
        tags: { tourism: "museum", name: "Eretz Israel Museum" },
      },
    ]);

    expect(attraction).toMatchObject({
      id: "osm-node-42",
      name: "Eretz Israel Museum",
      coordinates: { lat: 32.07, lng: 34.78 },
      category: "museum",
    });
  });

  it("uses the computed centre for a way that has no point of its own", async () => {
    const [attraction] = await attractionsFrom([
      {
        type: "way",
        id: 7,
        center: { lat: 32.06, lon: 34.77 },
        tags: { leisure: "park", name: "Hayarkon Park" },
      },
    ]);

    expect(attraction.coordinates).toEqual({ lat: 32.06, lng: 34.77 });
    expect(attraction.id).toBe("osm-way-7");
  });

  it("drops an element with no coordinates anywhere", async () => {
    const attractions = await attractionsFrom([
      { type: "way", id: 7, tags: { leisure: "park", name: "Ghost Park" } },
    ]);

    expect(attractions).toEqual([]);
  });

  it("drops an unnamed element rather than showing a blank stop", async () => {
    const attractions = await attractionsFrom([
      { type: "node", id: 1, lat: 32.07, lon: 34.78, tags: { tourism: "museum" } },
      { type: "node", id: 2, lat: 32.07, lon: 34.78 },
    ]);

    expect(attractions).toEqual([]);
  });

  it("falls back to a localised name when there is no default one", async () => {
    const attractions = await attractionsFrom([
      {
        type: "node",
        id: 1,
        lat: 32.07,
        lon: 34.78,
        tags: { tourism: "museum", "name:en": "Design Museum" },
      },
      {
        type: "node",
        id: 2,
        lat: 32.07,
        lon: 34.78,
        tags: { tourism: "museum", "name:he": "מוזיאון העיצוב" },
      },
    ]);

    expect(attractions.map((a) => a.name)).toEqual([
      "Design Museum",
      "מוזיאון העיצוב",
    ]);
  });

  it("keeps only the first of two elements sharing a type and id", async () => {
    const attractions = await attractionsFrom([
      { type: "node", id: 9, lat: 32.07, lon: 34.78, tags: { name: "First" } },
      { type: "node", id: 9, lat: 32.07, lon: 34.78, tags: { name: "Second" } },
    ]);

    expect(attractions.map((a) => a.name)).toEqual(["First"]);
  });

  it("keeps a node and a way that happen to share a numeric id", async () => {
    const attractions = await attractionsFrom([
      { type: "node", id: 9, lat: 32.07, lon: 34.78, tags: { name: "Node" } },
      {
        type: "way",
        id: 9,
        center: { lat: 32.07, lon: 34.78 },
        tags: { name: "Way" },
      },
    ]);

    expect(attractions.map((a) => a.id)).toEqual(["osm-node-9", "osm-way-9"]);
  });

  it("carries the raw OSM tags through for downstream ranking", async () => {
    const [attraction] = await attractionsFrom([
      {
        type: "node",
        id: 1,
        lat: 32.07,
        lon: 34.78,
        tags: { historic: "castle", name: "Citadel", wikidata: "Q123" },
      },
    ]);

    expect(attraction.tags.wikidata).toBe("Q123");
  });

  it("estimates a visit length per element rather than per category alone", async () => {
    const [statue, castle] = await attractionsFrom([
      {
        type: "node",
        id: 1,
        lat: 32.07,
        lon: 34.78,
        tags: { historic: "monument", name: "Statue" },
      },
      {
        type: "way",
        id: 2,
        center: { lat: 32.07, lon: 34.78 },
        tags: { historic: "castle", name: "Castle" },
      },
    ]);

    expect(statue.category).toBe("landmark");
    expect(castle.category).toBe("landmark");
    expect(statue.avgVisitMinutes).toBeLessThan(castle.avgVisitMinutes);
  });
});

describe("fetchAttractions category inference", () => {
  async function categoryOf(tags: Record<string, string>) {
    stubOverpass(
      ok({
        elements: [
          { type: "node", id: 1, lat: 32.07, lon: 34.78, tags: { name: "X", ...tags } },
        ],
      }),
    );
    const [attraction] = await fetchAttractions(CENTER, 1500);
    return attraction.category;
  }

  it("separates museums and viewpoints from generic landmarks", async () => {
    expect(await categoryOf({ tourism: "museum" })).toBe("museum");
    expect(await categoryOf({ tourism: "viewpoint" })).toBe("viewpoint");
    expect(await categoryOf({ tourism: "zoo" })).toBe("landmark");
    expect(await categoryOf({ historic: "ruins" })).toBe("landmark");
  });

  it("ranks tourism above a competing amenity tag on the same element", async () => {
    expect(await categoryOf({ tourism: "museum", amenity: "cafe" })).toBe("museum");
  });

  it("classifies amenities the walker stops at", async () => {
    expect(await categoryOf({ amenity: "place_of_worship" })).toBe("religious");
    expect(await categoryOf({ amenity: "restaurant" })).toBe("food");
    expect(await categoryOf({ amenity: "cafe" })).toBe("food");
    expect(await categoryOf({ amenity: "theatre" })).toBe("entertainment");
  });

  it("splits leisure between green space and indoor entertainment", async () => {
    expect(await categoryOf({ leisure: "garden" })).toBe("park");
    expect(await categoryOf({ leisure: "bowling_alley" })).toBe("entertainment");
  });

  it("classifies natural features and shops", async () => {
    expect(await categoryOf({ natural: "waterfall" })).toBe("nature");
    expect(await categoryOf({ shop: "bakery" })).toBe("shopping");
  });

  it("falls back to other for something it does not recognise", async () => {
    expect(await categoryOf({ man_made: "water_tower" })).toBe("other");
    expect(await categoryOf({ natural: "tree" })).toBe("other");
  });
});

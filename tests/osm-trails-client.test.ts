import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchOsmHikingTrails } from "@/lib/api/osm-trails-client";

const PRIMARY = "https://overpass-api.de/api/interpreter";
const MIRROR = "https://overpass.kumi.systems/api/interpreter";

function ok(payload: unknown) {
  return { ok: true, status: 200, json: async () => payload };
}

function httpError(status: number) {
  return { ok: false, status, json: async () => ({}) };
}

interface RelationOverrides {
  id?: number;
  tags?: Record<string, string>;
  members?: Array<{ type: string; ref: number; role: string; geometry: unknown }>;
}

/** A relation whose geometry is a ~220 m north-running line of three points. */
function relation(overrides: RelationOverrides = {}) {
  return {
    type: "relation",
    id: overrides.id ?? 1,
    tags: overrides.tags ?? { route: "hiking", name: "Israel National Trail" },
    members: overrides.members ?? [
      {
        type: "way",
        ref: 10,
        role: "",
        geometry: [
          { lat: 31.0, lon: 35.0 },
          { lat: 31.001, lon: 35.0 },
          { lat: 31.002, lon: 35.0 },
        ],
      },
    ],
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchOsmHikingTrails request", () => {
  it("asks Overpass for hiking relations around the given point and radius", async () => {
    const fetchMock = stubOverpass(ok({ elements: [] }));

    await fetchOsmHikingTrails({ lat: 31.77, lng: 35.21 }, 4200);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(PRIMARY);
    expect(init.method).toBe("POST");

    const query = decodeURIComponent((init.body as string).replace(/^data=/, ""));
    expect(query).toContain('relation["route"="hiking"](around:4200,31.77,35.21)');
    expect(query).toContain("out geom;");
  });

  it("defaults to a 10 km search radius", async () => {
    const fetchMock = stubOverpass(ok({ elements: [] }));

    await fetchOsmHikingTrails({ lat: 31.77, lng: 35.21 });

    const body = (fetchMock.mock.calls[0][1] as RequestInit).body as string;
    expect(decodeURIComponent(body)).toContain("around:10000,");
  });
});

describe("fetchOsmHikingTrails mirror failover", () => {
  it("falls through to the next mirror when the first returns an HTTP error", async () => {
    const fetchMock = stubOverpass(
      httpError(504),
      ok({ elements: [relation({ tags: { name: "Yam el Yam" } })] }),
    );

    const trails = await fetchOsmHikingTrails({ lat: 31.0, lng: 35.0 });

    expect(fetchMock.mock.calls[1][0]).toBe(MIRROR);
    expect(trails.map((t) => t.name)).toEqual(["Yam el Yam"]);
  });

  it("falls through to the next mirror when the request itself throws", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(ok({ elements: [relation()] }));
    vi.stubGlobal("fetch", fetchMock);

    const trails = await fetchOsmHikingTrails({ lat: 31.0, lng: 35.0 });

    expect(trails).toHaveLength(1);
  });

  it("reports the last failure once every mirror is exhausted", async () => {
    stubOverpass(httpError(429), httpError(429), httpError(503));

    await expect(fetchOsmHikingTrails({ lat: 31.0, lng: 35.0 })).rejects.toThrow(
      "Overpass error: 503",
    );
  });

  it("stops after the first mirror that answers", async () => {
    const fetchMock = stubOverpass(ok({ elements: [] }));

    await fetchOsmHikingTrails({ lat: 31.0, lng: 35.0 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("fetchOsmHikingTrails relation parsing", () => {
  async function trailsFrom(elements: unknown[]) {
    stubOverpass(ok({ elements }));
    return fetchOsmHikingTrails({ lat: 31.0, lng: 35.0 });
  }

  it("keys the trail by its OSM relation id", async () => {
    const [trail] = await trailsFrom([relation({ id: 987 })]);

    expect(trail.id).toBe("osm-relation-987");
    expect(trail.source).toBe("osm-hiking");
    expect(trail.metadata).toMatchObject({ osmId: 987 });
  });

  it("drops a relation with no name in any language", async () => {
    const trails = await trailsFrom([relation({ tags: { route: "hiking" } })]);

    expect(trails).toEqual([]);
  });

  it("falls back through name:en, name:he and ref for the trail name", async () => {
    const [en] = await trailsFrom([
      relation({ tags: { "name:en": "Snake Path", "name:he": "שביל הנחש" } }),
    ]);
    expect(en.name).toBe("Snake Path");

    const [he] = await trailsFrom([relation({ tags: { "name:he": "שביל הנחש" } })]);
    expect(he.name).toBe("שביל הנחש");

    const [ref] = await trailsFrom([relation({ tags: { ref: "INT" } })]);
    expect(ref.name).toBe("INT");
  });

  it("drops a relation whose assembled geometry is barely a line", async () => {
    const trails = await trailsFrom([
      relation({
        members: [
          {
            type: "way",
            ref: 10,
            role: "",
            geometry: [
              { lat: 31.0, lon: 35.0 },
              { lat: 31.001, lon: 35.0 },
            ],
          },
        ],
      }),
    ]);

    expect(trails).toEqual([]);
  });

  it("drops a relation with no usable way members at all", async () => {
    const trails = await trailsFrom([relation({ members: [] })]);

    expect(trails).toEqual([]);
  });

  it("reads OSM's distance tag as kilometres, not metres", async () => {
    // The 1000x inflation bug this guards is documented in the client itself:
    // `distance` on a route relation is km, `length` is metres.
    const [trail] = await trailsFrom([
      relation({ tags: { name: "Golan Trail", distance: "125" } }),
    ]);

    expect(trail.lengthMeters).toBe(125_000);
  });

  it("computes the length from geometry when the distance tag is not a number", async () => {
    const [trail] = await trailsFrom([
      relation({ tags: { name: "Golan Trail", distance: "about 125 km" } }),
    ]);

    // ~222 m of geometry, not 125 km.
    expect(trail.lengthMeters).toBeGreaterThan(150);
    expect(trail.lengthMeters).toBeLessThan(400);
  });

  it("computes the length from geometry when there is no distance tag", async () => {
    const [trail] = await trailsFrom([relation()]);

    expect(trail.lengthMeters).toBeGreaterThan(150);
    expect(trail.lengthMeters).toBeLessThan(400);
  });

  it("drops a relation whose length works out as zero", async () => {
    const trails = await trailsFrom([
      relation({ tags: { name: "Nowhere", distance: "0" } }),
    ]);

    expect(trails).toEqual([]);
  });

  it("keeps only the first relation when Overpass repeats an id", async () => {
    const trails = await trailsFrom([
      relation({ id: 5, tags: { name: "First" } }),
      relation({ id: 5, tags: { name: "Second" } }),
    ]);

    expect(trails.map((t) => t.name)).toEqual(["First"]);
  });

  it("ignores non-relation elements in the response", async () => {
    const trails = await trailsFrom([
      { type: "way", id: 3, tags: { name: "A way" }, members: [] },
      relation({ id: 4, tags: { name: "A relation" } }),
    ]);

    expect(trails.map((t) => t.name)).toEqual(["A relation"]);
  });
});

describe("fetchOsmHikingTrails geometry assembly", () => {
  async function geometryOf(members: RelationOverrides["members"]) {
    stubOverpass(ok({ elements: [relation({ members })] }));
    const [trail] = await fetchOsmHikingTrails({ lat: 31.0, lng: 35.0 });
    return trail.geometry;
  }

  it("chains a following way forward without repeating the shared point", async () => {
    const geometry = await geometryOf([
      {
        type: "way",
        ref: 1,
        role: "",
        geometry: [
          { lat: 31.0, lon: 35.0 },
          { lat: 31.001, lon: 35.0 },
        ],
      },
      {
        type: "way",
        ref: 2,
        role: "",
        geometry: [
          { lat: 31.001, lon: 35.0 },
          { lat: 31.002, lon: 35.0 },
        ],
      },
    ]);

    expect(geometry).toEqual([
      { lat: 31.0, lng: 35.0 },
      { lat: 31.001, lng: 35.0 },
      { lat: 31.002, lng: 35.0 },
    ]);
  });

  it("reverses a way that OSM stored end-first so the trail stays continuous", async () => {
    const geometry = await geometryOf([
      {
        type: "way",
        ref: 1,
        role: "",
        geometry: [
          { lat: 31.0, lon: 35.0 },
          { lat: 31.001, lon: 35.0 },
        ],
      },
      {
        // Same segment as above continued, but drawn from far end back to the join.
        type: "way",
        ref: 2,
        role: "",
        geometry: [
          { lat: 31.002, lon: 35.0 },
          { lat: 31.001, lon: 35.0 },
        ],
      },
    ]);

    expect(geometry).toEqual([
      { lat: 31.0, lng: 35.0 },
      { lat: 31.001, lng: 35.0 },
      { lat: 31.002, lng: 35.0 },
    ]);
  });

  it("skips a way member with fewer than two points", async () => {
    const geometry = await geometryOf([
      {
        type: "way",
        ref: 1,
        role: "",
        geometry: [
          { lat: 31.0, lon: 35.0 },
          { lat: 31.001, lon: 35.0 },
          { lat: 31.002, lon: 35.0 },
        ],
      },
      { type: "way", ref: 2, role: "", geometry: [{ lat: 31.5, lon: 35.5 }] },
    ]);

    expect(geometry).toHaveLength(3);
  });
});

describe("fetchOsmHikingTrails tag interpretation", () => {
  async function trailFrom(tags: Record<string, string>, lat = 31.0) {
    stubOverpass(
      ok({
        elements: [
          {
            type: "relation",
            id: 1,
            tags: { name: "T", ...tags },
            members: [
              {
                type: "way",
                ref: 1,
                role: "",
                geometry: [
                  { lat, lon: 35.0 },
                  { lat: lat + 0.001, lon: 35.0 },
                  { lat: lat + 0.002, lon: 35.0 },
                ],
              },
            ],
          },
        ],
      }),
    );
    const [trail] = await fetchOsmHikingTrails({ lat: 31.0, lng: 35.0 });
    return trail;
  }

  it("maps sac_scale onto a walker-facing difficulty", async () => {
    expect((await trailFrom({ sac_scale: "hiking" })).difficulty).toBe("easy");
    expect((await trailFrom({ sac_scale: "mountain_hiking" })).difficulty).toBe(
      "moderate",
    );
    expect((await trailFrom({ sac_scale: "alpine_hiking" })).difficulty).toBe("hard");
    expect(
      (await trailFrom({ sac_scale: "demanding_alpine_hiking" })).difficulty,
    ).toBe("moderate");
  });

  it("leaves difficulty unknown when OSM says nothing about it", async () => {
    expect((await trailFrom({})).difficulty).toBeUndefined();
  });

  it("prefers an OSM region tag over guessing from coordinates", async () => {
    const trail = await trailFrom({ region: "Judean Desert" }, 33.2);

    expect(trail.region).toBe("Judean Desert");
  });

  it("guesses an Israeli region from latitude when OSM has no region tag", async () => {
    expect((await trailFrom({}, 33.2)).region).toBe("Upper Galilee");
    expect((await trailFrom({}, 32.8)).region).toBe("Lower Galilee");
    expect((await trailFrom({}, 32.2)).region).toBe("Carmel & Sharon");
    expect((await trailFrom({}, 31.4)).region).toBe("Judean Foothills");
    expect((await trailFrom({}, 30.9)).region).toBe("Negev");
    expect((await trailFrom({}, 29.8)).region).toBe("Eilat & Arava");
  });
});

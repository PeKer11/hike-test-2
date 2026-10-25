import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getMatrix, optimizeRoute } from "@/lib/api/ors-client";

function mockFetchOnce(
  payload: unknown,
  init?: { ok?: boolean; status?: number; text?: string },
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: async () => payload,
    text: async () => init?.text ?? "",
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.stubEnv("ORS_API_KEY", "test-key");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("getMatrix", () => {
  const locations: Array<[number, number]> = [
    [34.78, 32.08],
    [34.781, 32.081],
  ];

  it("returns the distance matrix ORS sent back", async () => {
    mockFetchOnce({ distances: [[0, 240], [230, 0]] });

    const result = await getMatrix({ locations });

    expect(result.distances).toEqual([[0, 240], [230, 0]]);
  });

  it("posts to the foot-walking matrix endpoint asking for metres", async () => {
    const fetchMock = mockFetchOnce({ distances: [[0, 0], [0, 0]] });

    await getMatrix({ locations });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.heigit.org/openrouteservice/v2/matrix/foot-walking");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      // ORS coordinate order is [lng, lat] — passed through untouched.
      locations: [[34.78, 32.08], [34.781, 32.081]],
      metrics: ["distance"],
      units: "m",
    });
  });

  it("uses the requested profile when one is given", async () => {
    const fetchMock = mockFetchOnce({ distances: [[0, 0], [0, 0]] });

    await getMatrix({ locations, profile: "foot-hiking" });

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.heigit.org/openrouteservice/v2/matrix/foot-hiking",
    );
  });

  it("throws a readable error when ORS rejects the key", async () => {
    mockFetchOnce(null, { ok: false, status: 403, text: "forbidden" });

    await expect(getMatrix({ locations })).rejects.toThrow(
      "API key is missing or invalid.",
    );
  });
});

describe("optimizeRoute", () => {
  it("orders jobs by walking distance from the matrix, start to end", async () => {
    // locations: 0 start, 1 jobA, 2 jobB, 3 end. B is nearer the start; A is nearer the end.
    mockFetchOnce({
      distances: [
        [0, 900, 100, 1000],
        [900, 0, 800, 100],
        [100, 800, 0, 900],
        [1000, 100, 900, 0],
      ],
    });
    const res = await optimizeRoute({
      jobs: [
        { id: 11, location: [34.78, 32.08] },
        { id: 22, location: [34.79, 32.09] },
      ],
      vehicles: [{ id: 1, profile: "foot-walking", start: [34.7, 32.0], end: [34.8, 32.1] }],
    });
    expect(res.routes[0].steps.map((s) => (s.type === "job" ? s.id : s.type))).toEqual(["start", 22, 11, "end"]);
    expect(res.unassigned).toEqual([]);
  });

  it("retries once on a 429 and then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429, headers: { get: () => "0" }, json: async () => ({}), text: async () => "slow down" })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ distances: [[0, 5], [5, 0]] }), text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);
    const result = await getMatrix({ locations: [[34.78, 32.08], [34.781, 32.081]] });
    expect(result.distances[0][1]).toBe(5);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

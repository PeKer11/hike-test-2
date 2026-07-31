import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getMatrix } from "@/lib/api/ors-client";

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
    expect(url).toBe("https://api.openrouteservice.org/v2/matrix/foot-walking");
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
      "https://api.openrouteservice.org/v2/matrix/foot-hiking",
    );
  });

  it("throws a readable error when ORS rejects the key", async () => {
    mockFetchOnce(null, { ok: false, status: 403, text: "forbidden" });

    await expect(getMatrix({ locations })).rejects.toThrow(
      "API key is missing or invalid.",
    );
  });
});

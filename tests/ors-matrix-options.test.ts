import { afterEach, describe, expect, it, vi } from "vitest";

import { getMatrix } from "@/lib/api/ors-client";

describe("getMatrix options", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("sends the access options so a stroller matrix avoids steps", async () => {
    vi.stubEnv("ORS_API_KEY", "k");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ distances: [[0]] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await getMatrix({ locations: [[0, 0]], options: { avoid_features: ["steps"] } });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).options).toEqual({ avoid_features: ["steps"] });
  });
  it("sends no options key when none are given", async () => {
    vi.stubEnv("ORS_API_KEY", "k");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ distances: [[0]] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await getMatrix({ locations: [[0, 0]] });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty("options");
  });
});

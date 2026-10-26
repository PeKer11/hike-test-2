import { afterEach, describe, expect, it, vi } from "vitest";

import { getDirections } from "@/lib/api/ors-client";
import { OrsNoRouteError } from "@/lib/walk/ors-errors";

describe("ORS 404 route-not-found", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("a real 404 with code 2010 is a no-route error, not an outage", async () => {
    vi.stubEnv("ORS_API_KEY", "k");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 2010, message: "Could not find routable point" } }), { status: 404 })));
    await expect(getDirections({ coordinates: [[0, 0], [1, 1]], profile: "wheelchair" })).rejects.toBeInstanceOf(OrsNoRouteError);
  });
});

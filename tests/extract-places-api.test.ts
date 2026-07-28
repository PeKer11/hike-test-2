import { describe, expect, it, vi } from "vitest";

const mockExtractPlaceNames = vi.fn();
const mockSearchPlaces = vi.fn();

vi.mock("@/lib/api/gemini-client", () => ({
  extractPlaceNames: (...args: unknown[]) => mockExtractPlaceNames(...args),
}));

vi.mock("@/lib/api/nominatim-client", () => ({
  searchPlaces: (...args: unknown[]) => mockSearchPlaces(...args),
}));

import { POST } from "@/app/api/extract-places/route";

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/extract-places", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/extract-places", () => {
  it("reports a name with no in-box match as unresolved", async () => {
    mockExtractPlaceNames.mockResolvedValueOnce(["מדרחוב"]);
    mockSearchPlaces.mockResolvedValueOnce([]);

    const response = await POST(
      postRequest({
        prompt: "אני רוצה ללכת למדרחוב בזכרון יעקב",
        nearLocation: { lat: 32.585, lng: 34.952 },
      }),
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockSearchPlaces).toHaveBeenCalledWith("מדרחוב", 1, {
      lat: 32.585,
      lng: 34.952,
    });
    expect(body.attractions).toEqual([]);
    expect(body.unresolvedNames).toEqual(["מדרחוב"]);
  });

  it("geocodes without a bias when no location is given", async () => {
    mockExtractPlaceNames.mockResolvedValueOnce(["Habima Square"]);
    mockSearchPlaces.mockResolvedValueOnce([{ lat: "32.0736", lon: "34.7811" }]);

    const response = await POST(
      postRequest({ prompt: "I want to go to Habima Square" }),
    );

    const body = await response.json();

    expect(mockSearchPlaces).toHaveBeenCalledWith("Habima Square", 1, undefined);
    expect(body.unresolvedNames).toEqual([]);
    expect(body.attractions[0].coordinates).toEqual({
      lat: 32.0736,
      lng: 34.7811,
    });
  });
});

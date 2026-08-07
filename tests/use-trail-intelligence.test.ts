import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useTrailIntelligence } from "@/lib/hooks/useTrailIntelligence";
import type { CalculatedRoute, TrailIntelligenceReport } from "@/lib/types";

function makeRoute(distance: number): CalculatedRoute {
  return {
    orderedWaypoints: [],
    segments: [],
    geometry: [],
    totalDistanceMeters: distance,
    totalDurationSeconds: distance,
    warnings: [],
  };
}

function makeReport(regionLabel: string): TrailIntelligenceReport {
  const item = {
    title: regionLabel,
    summary: regionLabel,
    details: [],
    sourceStatus: "live" as const,
  };
  return {
    generatedAt: "2026-01-01T00:00:00.000Z",
    regionLabel,
    routeSummary: item,
    bestTime: item,
    currentConditions: item,
    safety: item,
    recommendation: {
      level: "go",
      title: regionLabel,
      summary: regionLabel,
      reasons: [],
    },
    sourceNotes: [],
  };
}

/** Let every pending microtask and the React state update after it settle. */
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function jsonResponse(payload: unknown, status = 200) {
  return {
    ok: status < 400,
    status,
    json: async () => payload,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useTrailIntelligence", () => {
  it("posts the route and exposes the briefing it gets back", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(makeReport("Jerusalem Hills")));
    vi.stubGlobal("fetch", fetchMock);

    const route = makeRoute(1000);
    const { result } = renderHook(() =>
      useTrailIntelligence(route, { lat: 31.77, lng: 35.21 }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.report?.regionLabel).toBe("Jerusalem Hills");
    expect(result.current.error).toBeNull();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/trail-intelligence");
    expect(JSON.parse(init.body as string).userLocation).toEqual({
      lat: 31.77,
      lng: 35.21,
    });
  });

  it("omits userLocation entirely when the walker's position is unknown", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(makeReport("Negev")));
    vi.stubGlobal("fetch", fetchMock);

    const route = makeRoute(1000);
    const { result } = renderHook(() => useTrailIntelligence(route));

    await waitFor(() => expect(result.current.report).not.toBeNull());

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).userLocation).toBeUndefined();
  });

  it("does not call the API at all without a route", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useTrailIntelligence(null));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.report).toBeNull();
  });

  it("surfaces the API's own error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: "Weather feed is down." }, 503)),
    );

    const route = makeRoute(1000);
    const { result } = renderHook(() => useTrailIntelligence(route));

    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(result.current.error).toBe("Weather feed is down.");
    expect(result.current.report).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("falls back to a generic message when the error body is unreadable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error("not json");
        },
      }),
    );

    const route = makeRoute(1000);
    const { result } = renderHook(() => useTrailIntelligence(route));

    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(result.current.error).toBe("Failed to generate trail briefing.");
  });

  it("ignores a slow briefing for a route the user has already replaced", async () => {
    const first = deferred<unknown>();
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(jsonResponse(makeReport("second")));
    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = renderHook(
      ({ route }: { route: CalculatedRoute }) => useTrailIntelligence(route),
      { initialProps: { route: makeRoute(1000) } },
    );

    rerender({ route: makeRoute(2000) });
    await waitFor(() => expect(result.current.report?.regionLabel).toBe("second"));

    first.resolve(jsonResponse(makeReport("first")));
    await flush();

    expect(result.current.report?.regionLabel).toBe("second");
  });

  it("drops an in-flight briefing after clear()", async () => {
    const pending = deferred<unknown>();
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending.promise));

    const route = makeRoute(1000);
    const { result } = renderHook(() => useTrailIntelligence(route));

    expect(result.current.isLoading).toBe(true);

    act(() => {
      result.current.clear();
    });
    expect(result.current.isLoading).toBe(false);

    pending.resolve(jsonResponse(makeReport("late")));
    await flush();

    expect(result.current.report).toBeNull();
    expect(result.current.error).toBeNull();
  });
});

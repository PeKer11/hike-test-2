import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { HikeSearchResult } from "@/lib/types";

const mockSearchBestHike = vi.fn();

vi.mock("@/lib/optimization/hike-search", () => ({
  searchBestHike: (...args: unknown[]) => mockSearchBestHike(...args),
}));

import { useHikeSearch } from "@/lib/hooks/useHikeSearch";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useHikeSearch", () => {
  it("does not apply stale results after cancelSearch", async () => {
    const pending = deferred<HikeSearchResult>();
    mockSearchBestHike.mockReturnValueOnce(pending.promise);

    const { result } = renderHook(() => useHikeSearch());

    await act(async () => {
      void result.current.findHike({
        origin: { lat: 31.7683, lng: 35.2137 },
      });
    });

    act(() => {
      result.current.cancelSearch();
    });

    await act(async () => {
      pending.resolve({
        selected: {
          trail: null,
          source: "fallback",
          geometry: [],
          distanceMeters: 0,
          score: 0,
        },
        route: {
          orderedWaypoints: [],
          segments: [],
          geometry: [],
          totalDistanceMeters: 0,
          totalDurationSeconds: 0,
          warnings: [],
          source: "fallback",
          sourceLabel: "Suggested route (no official RTG trail found)",
        },
      });
      await pending.promise;
    });

    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isSearching).toBe(false);
  });
});

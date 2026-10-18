import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getDirections, ORS_TIMEOUT_MS } from "@/lib/api/ors-client";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("ORS_API_KEY", "test-key");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("ORS requests", () => {
  it("give up after ORS_TIMEOUT_MS instead of hanging the walk build", async () => {
    // A server that never answers: the fetch settles only when it is aborted.
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = getDirections({
      coordinates: [
        [34.78, 32.08],
        [34.79, 32.09],
      ],
    }).then(
      () => "resolved",
      () => "rejected",
    );

    await vi.advanceTimersByTimeAsync(ORS_TIMEOUT_MS - 1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);

    expect(await result).toBe("rejected");
  });
});

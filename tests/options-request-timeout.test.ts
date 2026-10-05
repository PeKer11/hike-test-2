import { afterEach, describe, expect, it, vi } from "vitest";

import {
  OPTIONS_REQUEST_TIMEOUT_MS,
  planDirectionOptions,
  routeDirectionOptions,
  type OptionsContext,
} from "@/lib/walk/options-request";
import { at, item } from "./helpers/discovery";

afterEach(() => vi.useRealTimers());

const ctx: OptionsContext = {
  origin: at(0, 0),
  endAnchor: at(500, -300),
  walked: [at(0, -900), at(0, -300), at(0, 0)],
  remainingMin: 60,
  speedMpm: 80,
  items: [item("n1", at(200, 1000), { category: "nature", score: 2 })],
  excludeIds: new Set(),
  abandonedPlan: [],
};

describe("routeDirectionOptions timeout", () => {
  it("treats a request that never answers as nothing to offer", async () => {
    vi.useFakeTimers();
    const built = planDirectionOptions(ctx);
    expect(built.length).toBeGreaterThan(0);
    // A fetch that only ends when it is aborted.
    const hung = (_url: string, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    const pending = routeDirectionOptions(ctx, built, hung);
    await vi.advanceTimersByTimeAsync(OPTIONS_REQUEST_TIMEOUT_MS + 1);
    await expect(pending).resolves.toEqual([]);
  });
});

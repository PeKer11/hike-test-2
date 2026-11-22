import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCollapseFlow } from "@/lib/hooks/useCollapseFlow";
import { COLLAPSE_COOLDOWN_MS } from "@/lib/walk/discovery-cadence";
import type { OptionsContext } from "@/lib/walk/options-request";
import { at, item } from "./helpers/discovery";

const ORIGIN = at(0, 0);
const ctx: OptionsContext = {
  origin: ORIGIN,
  endAnchor: at(500, -300),
  walked: [at(0, -900), at(0, -600), at(0, -300), ORIGIN],
  remainingMin: 60,
  speedMpm: 80,
  items: [
    item("n1", at(200, 1000), { category: "nature", score: 2 }),
    item("f1", at(-900, -100), { category: "food", score: 2 }),
  ],
  excludeIds: new Set(),
  abandonedPlan: [],
};

let release: (() => void) | null;
let fetchCalls: number;

beforeEach(() => {
  release = null;
  fetchCalls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          fetchCalls += 1;
          release = () =>
            resolve(
              new Response(
                JSON.stringify({
                  options: [
                    {
                      theme: "nature",
                      geometry: [ORIGIN, at(200, 1000)],
                      distanceM: 1000,
                      minutes: 12,
                      overlapWalked: 0,
                    },
                  ],
                }),
              ),
            );
        }),
    ),
  );
});
afterEach(() => vi.unstubAllGlobals());

function setup() {
  const onShown = vi.fn();
  const onNoOptions = vi.fn();
  const hook = renderHook(() =>
    useCollapseFlow({ getContext: () => ctx, onShown, onNoOptions }),
  );
  return { hook, onShown, onNoOptions };
}

/** 500 m off route for longer than the sustain window: the machine collapses. */
function strayUntilCollapse(result: { current: ReturnType<typeof useCollapseFlow> }, t0 = 0) {
  act(() => result.current.feed({ atMs: t0, deviationM: 500, accuracyM: 10 }));
  act(() => result.current.feed({ atMs: t0 + 61_000, deviationM: 500, accuracyM: 10 }));
}

describe("useCollapseFlow", () => {
  it("shows the options when the request is answered", async () => {
    const { hook, onShown } = setup();
    strayUntilCollapse(hook.result);
    expect(fetchCalls).toBe(1);
    await act(async () => release!());
    expect(hook.result.current.offer?.options).toHaveLength(1);
    expect(onShown).toHaveBeenCalledTimes(1);
  });

  it("drops an answer that arrives after clear()", async () => {
    const { hook, onShown } = setup();
    strayUntilCollapse(hook.result);
    expect(fetchCalls).toBe(1);
    act(() => hook.result.current.clear());
    await act(async () => release!());
    expect(hook.result.current.offer).toBeNull();
    expect(onShown).not.toHaveBeenCalled();
  });

  it("clear() frees a pending collapse but keeps the cooldown", () => {
    const { hook } = setup();
    strayUntilCollapse(hook.result);
    expect(hook.result.current.isCollapsed()).toBe(true);
    act(() => hook.result.current.clear());
    expect(hook.result.current.isCollapsed()).toBe(false);
    // The collapse still counts: no second one inside the 10-minute cooldown.
    expect(hook.result.current.canCollapse(61_000 + COLLAPSE_COOLDOWN_MS - 1_000)).toBe(false);
    expect(hook.result.current.canCollapse(61_000 + COLLAPSE_COOLDOWN_MS)).toBe(true);
  });

  it("a manual request that supersedes a loading collapse and comes back empty does not leave the walk collapsed", async () => {
    const { hook, onNoOptions } = setup();
    strayUntilCollapse(hook.result);
    expect(hook.result.current.isCollapsed()).toBe(true);
    // The collapse request hangs; the next request (manual) is answered with nothing.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ options: [] }))),
    );
    await act(async () => hook.result.current.offerDifferent());
    expect(onNoOptions).not.toHaveBeenCalled(); // manual: no full re-plan fallback
    expect(hook.result.current.isCollapsed()).toBe(false);
    expect(hook.result.current.offer).toBeNull();
    // The cooldown from the collapse still holds.
    expect(hook.result.current.canCollapse(61_000 + COLLAPSE_COOLDOWN_MS - 1)).toBe(false);
  });

  describe("rejoinSucceeded", () => {
    const off = { deviationM: 90, accuracyM: 10 };

    it("settles an off-route walker, so earlier failures no longer count towards a collapse", () => {
      const { hook } = setup();
      act(() => hook.result.current.feed({ atMs: 0, ...off }));
      // One failed way back, then a drawn one: the episode is answered.
      expect(hook.result.current.rejoinFailed(1_000)).toBe(false);
      act(() => hook.result.current.rejoinSucceeded(2_000));
      // The walker is still off the new line: a new episode starts, and its first failure is only the first.
      act(() => hook.result.current.feed({ atMs: 3_000, ...off }));
      expect(hook.result.current.rejoinFailed(4_000)).toBe(false);
      expect(hook.result.current.isCollapsed()).toBe(false);
      expect(fetchCalls).toBe(0);
    });

    it("without it the second failure collapses (the counter this resets)", () => {
      const { hook } = setup();
      act(() => hook.result.current.feed({ atMs: 0, ...off }));
      expect(hook.result.current.rejoinFailed(1_000)).toBe(false);
      expect(hook.result.current.rejoinFailed(2_000)).toBe(true);
      expect(hook.result.current.isCollapsed()).toBe(true);
    });

    it("restarts the 8-minute off-route clock", () => {
      const { hook } = setup();
      act(() => hook.result.current.feed({ atMs: 0, ...off }));
      act(() => hook.result.current.rejoinSucceeded(60_000));
      // Seven minutes later, still off: the episode began again at the drawn line, so no collapse yet.
      act(() => hook.result.current.feed({ atMs: 61_000, ...off }));
      act(() => hook.result.current.feed({ atMs: 61_000 + 7 * 60_000, ...off }));
      expect(hook.result.current.isCollapsed()).toBe(false);
      expect(fetchCalls).toBe(0);
    });

    it("leaves a collapse that is already under way alone", () => {
      const { hook } = setup();
      strayUntilCollapse(hook.result);
      act(() => hook.result.current.rejoinSucceeded(62_000));
      expect(hook.result.current.isCollapsed()).toBe(true);
    });
  });
});

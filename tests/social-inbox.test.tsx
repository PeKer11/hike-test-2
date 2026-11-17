import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ n: 0 }));
vi.mock("@/lib/walks/walk-history", () => ({
  withWalkClient: async (fn: (c: unknown, u: string) => Promise<unknown>) =>
    fn({ rpc: async () => { calls.n += 1; return { data: [], error: null }; } }, "u1"),
}));

import { useSocialInbox } from "@/lib/hooks/useSocialInbox";

const setVisibility = (v: "visible" | "hidden") => {
  Object.defineProperty(document, "visibilityState", { value: v, configurable: true });
};

beforeEach(() => {
  vi.useFakeTimers();
  calls.n = 0;
  setVisibility("visible");
  vi.stubEnv("NEXT_PUBLIC_SOCIAL_PRESENCE", "1");
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  setVisibility("visible");
});

describe("useSocialInbox", () => {
  it("polls every 30 s while the page is visible", async () => {
    renderHook(() => useSocialInbox(true));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(calls.n).toBe(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(calls.n).toBe(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(calls.n).toBe(4);
  });

  it("does not poll while the page is hidden, and catches up when it is shown again", async () => {
    renderHook(() => useSocialInbox(true));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    const before = calls.n;
    setVisibility("hidden");
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
    expect(calls.n).toBe(before);
    setVisibility("visible");
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); await vi.advanceTimersByTimeAsync(0); });
    expect(calls.n).toBe(before + 1);
  });

  it("makes no call with the flag off or when signed out", async () => {
    vi.stubEnv("NEXT_PUBLIC_SOCIAL_PRESENCE", "");
    const { result } = renderHook(() => useSocialInbox(true));
    renderHook(() => useSocialInbox(false));
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
    expect(calls.n).toBe(0);
    expect(result.current.available).toBe(false);
  });

  it("stops when unmounted", async () => {
    const { unmount } = renderHook(() => useSocialInbox(true));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    unmount();
    const n = calls.n;
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
    expect(calls.n).toBe(n);
  });
});

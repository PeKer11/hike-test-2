import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FOLLOW_RESUME_MS, useFollowPause } from "@/lib/hooks/useFollowPause";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useFollowPause", () => {
  it("follows until the walker drags, and stays off while they are still dragging", () => {
    const { result } = renderHook(() => useFollowPause());
    expect(result.current.paused).toBe(false);
    act(() => result.current.pause());
    expect(result.current.paused).toBe(true);
    act(() => void vi.advanceTimersByTime(10 * FOLLOW_RESUME_MS));
    expect(result.current.paused).toBe(true); // no drag end yet: still holding the map
  });

  it("follows again a while after the drag ends, and a new drag restarts the wait", () => {
    const { result } = renderHook(() => useFollowPause());
    act(() => result.current.pause());
    act(() => result.current.scheduleResume());
    act(() => void vi.advanceTimersByTime(FOLLOW_RESUME_MS - 1));
    expect(result.current.paused).toBe(true);

    act(() => result.current.pause()); // touched again
    act(() => result.current.scheduleResume());
    act(() => void vi.advanceTimersByTime(FOLLOW_RESUME_MS - 1));
    expect(result.current.paused).toBe(true);
    act(() => void vi.advanceTimersByTime(1));
    expect(result.current.paused).toBe(false);
  });

  it("the re-centre tap follows at once and cancels the wait", () => {
    const { result } = renderHook(() => useFollowPause());
    act(() => result.current.pause());
    act(() => result.current.scheduleResume());
    act(() => result.current.resume());
    expect(result.current.paused).toBe(false);
    act(() => result.current.pause());
    act(() => void vi.advanceTimersByTime(FOLLOW_RESUME_MS * 2));
    expect(result.current.paused).toBe(true); // the cancelled timer did not fire
  });

  it("follows again when the page comes back to the front", () => {
    const { result } = renderHook(() => useFollowPause());
    act(() => result.current.pause());
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    expect(result.current.paused).toBe(true);
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    expect(result.current.paused).toBe(false);
  });

  it("unmounting clears the timer", () => {
    const { result, unmount } = renderHook(() => useFollowPause());
    act(() => result.current.pause());
    act(() => result.current.scheduleResume());
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

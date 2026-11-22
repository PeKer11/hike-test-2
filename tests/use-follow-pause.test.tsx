import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FOLLOW_RESUME_MS, useFollowPause } from "@/lib/hooks/useFollowPause";
import { OVERVIEW_HOLD_MS } from "@/lib/map/route-overview";

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

describe("useFollowPause.hold (the whole-route view)", () => {
  it("holds the map off the walker, and `held` says so", () => {
    const { result } = renderHook(() => useFollowPause());
    expect(result.current.held).toBe(false);
    act(() => result.current.hold());
    expect(result.current.paused).toBe(true);
    expect(result.current.held).toBe(true);
  });

  it("is not cut at 15 s like a drag: it holds for a minute, then follows again", () => {
    const { result } = renderHook(() => useFollowPause());
    act(() => result.current.hold());
    act(() => void vi.advanceTimersByTime(FOLLOW_RESUME_MS + 1));
    expect(result.current.paused).toBe(true);
    act(() => void vi.advanceTimersByTime(OVERVIEW_HOLD_MS - FOLLOW_RESUME_MS - 2));
    expect(result.current.paused).toBe(true);
    act(() => void vi.advanceTimersByTime(1));
    expect(OVERVIEW_HOLD_MS).toBe(60_000);
    expect(result.current.paused).toBe(false);
    expect(result.current.held).toBe(false);
  });

  it("takes an explicit duration", () => {
    const { result } = renderHook(() => useFollowPause());
    act(() => result.current.hold(5_000));
    act(() => void vi.advanceTimersByTime(4_999));
    expect(result.current.paused).toBe(true);
    act(() => void vi.advanceTimersByTime(1));
    expect(result.current.paused).toBe(false);
  });

  it("ends at once on the re-centre tap, and the cancelled timer does not fire later", () => {
    const { result } = renderHook(() => useFollowPause());
    act(() => result.current.hold());
    act(() => result.current.resume());
    expect(result.current.paused).toBe(false);
    expect(result.current.held).toBe(false);
    act(() => result.current.pause());
    act(() => void vi.advanceTimersByTime(OVERVIEW_HOLD_MS * 2));
    expect(result.current.paused).toBe(true); // a plain drag hold: the old overview timer is gone
  });

  it("ends when the page comes back to the front", () => {
    const { result } = renderHook(() => useFollowPause());
    act(() => result.current.hold());
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    expect(result.current.paused).toBe(false);
    expect(result.current.held).toBe(false);
  });

  it("a drag during the overview hands over to the normal drag rules (15 s after it ends)", () => {
    const { result } = renderHook(() => useFollowPause());
    act(() => result.current.hold());
    act(() => result.current.pause()); // dragstart
    expect(result.current.held).toBe(false); // the walker took the map: no longer "the whole route" view
    act(() => result.current.scheduleResume()); // dragend
    act(() => void vi.advanceTimersByTime(FOLLOW_RESUME_MS));
    expect(result.current.paused).toBe(false);
  });

  it("a second hold restarts the minute", () => {
    const { result } = renderHook(() => useFollowPause());
    act(() => result.current.hold(10_000));
    act(() => void vi.advanceTimersByTime(8_000));
    act(() => result.current.hold(10_000));
    act(() => void vi.advanceTimersByTime(8_000));
    expect(result.current.paused).toBe(true);
    act(() => void vi.advanceTimersByTime(2_000));
    expect(result.current.paused).toBe(false);
  });

  it("unmounting clears the hold timer", () => {
    const { unmount, result } = renderHook(() => useFollowPause());
    act(() => result.current.hold());
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});


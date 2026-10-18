import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WalkAlertCard } from "@/components/walk/WalkAlertCard";
import { useWalkCompanion, type CompanionSnapshot } from "@/lib/hooks/useWalkCompanion";
import { COMPANION_TICK_MS } from "@/lib/walk/companion/companion-glue";
import { at } from "./helpers/discovery";

const T0 = Date.UTC(2026, 6, 15, 15, 0, 0); // 18:00 Israel: sunset ~19:40

function snapshot(nowMs: number, over: Partial<CompanionSnapshot["tick"]> = {}): CompanionSnapshot {
  return {
    tick: {
      nowMs,
      position: at(0, 0),
      environment: "urban",
      speedMpm: 80,
      remainingWalkMin: 150,
      remainingStops: [
        { id: "a", name: "A" },
        { id: "b", name: "B" },
      ],
      pace: null,
      addPlace: null,
      amenities: [],
      walkerAlongM: 0,
      green: null,
      ...over,
    },
    ctx: { level: "normal", nearTurn: false },
  };
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockReset().mockResolvedValue({
    ok: true,
    json: async () => ({ apparentTempC: 20, precipProbabilityPct: 10, attribution: "Weather data by Open-Meteo.com (CC BY 4.0)" }),
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useWalkCompanion", () => {
  function setup(active = true, snap: () => CompanionSnapshot | null = () => snapshot(T0)) {
    const onAnswered = vi.fn();
    const onShown = vi.fn();
    const hook = renderHook(
      (p: { active: boolean }) =>
        useWalkCompanion({ active: p.active, lang: "en", voice: false, getSnapshot: snap, onAnswered, onShown }),
      { initialProps: { active } },
    );
    return { ...hook, onAnswered, onShown };
  }

  it("asks nothing while the walk is not active", () => {
    const { result, onShown } = setup(false);
    act(() => void vi.advanceTimersByTime(COMPANION_TICK_MS * 3));
    expect(result.current.card).toBeNull();
    expect(onShown).not.toHaveBeenCalled();
  });

  it("shows the sunset question on the first tick, polls weather once, and answers with the operator", async () => {
    const { result, onAnswered, onShown } = setup();
    await act(async () => void vi.advanceTimersByTime(COMPANION_TICK_MS));
    expect(result.current.card?.kind).toBe("sunset");
    expect(result.current.card?.title).toMatch(/Sunset in/);
    expect(onShown).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/conditions?lat=32.08&lng=34.78");
    expect(result.current.attribution).toMatch(/Open-Meteo/);

    act(() => result.current.answer("shorten"));
    expect(result.current.card).toBeNull();
    expect(onAnswered).toHaveBeenCalledTimes(1);
    const [answered] = onAnswered.mock.calls[0];
    expect(answered.action).toMatchObject({ run: "drop-stops", dropStopIds: ["b"] });
    expect(answered.action.capMin).toBeGreaterThan(0);
    expect(result.current.records()).toHaveLength(1);
    expect(result.current.records()[0]).toMatchObject({ kind: "sunset", outcome: "answered", answerId: "shorten" });
  });

  it("does not poll weather again within the hour", async () => {
    const { result } = setup(true, () => snapshot(T0));
    await act(async () => void vi.advanceTimersByTime(COMPANION_TICK_MS * 4));
    void result;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a card left unanswered past its TTL is logged as ignored", async () => {
    let now = T0;
    const { result } = setup(true, () => snapshot(now));
    await act(async () => void vi.advanceTimersByTime(COMPANION_TICK_MS));
    expect(result.current.card).not.toBeNull();
    now = T0 + 10 * 60_000;
    await act(async () => void vi.advanceTimersByTime(COMPANION_TICK_MS));
    expect(result.current.records()[0]).toMatchObject({ kind: "sunset", outcome: "ignored" });
  });

  it("ending the walk takes the card down and logs it as ignored", async () => {
    const { result, rerender } = setup();
    await act(async () => void vi.advanceTimersByTime(COMPANION_TICK_MS));
    expect(result.current.card).not.toBeNull();
    rerender({ active: false });
    expect(result.current.card).toBeNull();
    expect(result.current.records()[0].outcome).toBe("ignored");
  });

  it("reset clears the history and the cached weather", async () => {
    const { result } = setup();
    await act(async () => void vi.advanceTimersByTime(COMPANION_TICK_MS));
    act(() => result.current.reset());
    expect(result.current.card).toBeNull();
    expect(result.current.records()).toEqual([]);
    expect(result.current.attribution).toBeNull();
  });
});

describe("WalkAlertCard question variant", () => {
  it("is a polite group (not an alert), shows answers and a credit footnote", () => {
    const onClick = vi.fn();
    render(
      <WalkAlertCard
        alert={{
          id: "q",
          tone: "info",
          variant: "question",
          title: "It's 37°C. Water 100 m away?",
          footnote: "Weather data by Open-Meteo.com (CC BY 4.0)",
          actions: [
            { label: "Take me there", primary: true, onClick },
            { label: "I'm fine", onClick },
            { label: "Later", onClick },
          ],
        }}
      />,
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("group").getAttribute("aria-live")).toBe("polite");
    expect(screen.getByText(/Open-Meteo/)).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("other cards stay role=alert", () => {
    render(<WalkAlertCard alert={{ id: "x", tone: "alert", title: "Off route", actions: [] }} />);
    expect(screen.getByRole("alert")).toBeTruthy();
  });
});

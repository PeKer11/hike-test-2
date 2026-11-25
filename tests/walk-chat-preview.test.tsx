import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useWalkChat } from "@/lib/hooks/useWalkChat";
import type { ProposalPreview } from "@/lib/walk/chat/proposal";
import type { ChatContext } from "@/lib/walk/chat/reply";

const ctx: ChatContext = {
  stops: [{ id: "a", name: "Old Port", pinned: false }],
  amenities: [],
  position: { lat: 32, lng: 34.8 },
  timing: { elapsedMin: 10, remainingMin: 30, availableMin: 60, overBudget: false, plannedKmh: 5 },
};
const answer = (name = "Erez") => ({ reply: "", proposal: { adds: [{ name, coordinates: { lat: 32.001, lng: 34.801 }, distM: 400 }], skipStopIndexes: [], headBack: false } });
const READY: ProposalPreview = { status: "ready", minDelta: 12, distDeltaM: 800, endClock: "17:40" };

type Preview = (action: unknown, signal: AbortSignal) => Promise<ProposalPreview>;
function setup(previewProposal: Preview, onActionResult?: () => "busy" | "recheck" | void) {
  const doFetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => answer() }) as unknown as Response) as unknown as typeof fetch;
  const onAction = vi.fn(() => onActionResult?.());
  const hook = renderHook(() =>
    useWalkChat({ lang: "en", isSignedIn: true, freeChat: true, getContext: () => ctx, onAction, doFetch, previewProposal: previewProposal as never }),
  );
  return { ...hook, onAction, doFetch };
}
const ask = async (h: ReturnType<typeof setup>, text = "add something") => {
  act(() => h.result.current.send(text));
  await waitFor(() => expect(h.result.current.messages.some((m) => m.actions.length > 0)).toBe(true));
};
const card = (h: ReturnType<typeof setup>) => h.result.current.messages.filter((m) => m.actions.length > 0).at(-1)!;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("the card's numbers", () => {
  it("shows computing, then the real preview", async () => {
    let resolve!: (p: ProposalPreview) => void;
    const h = setup(() => new Promise((r) => (resolve = r)));
    await ask(h);
    expect(card(h).preview).toEqual({ status: "computing" });
    await act(async () => resolve(READY));
    expect(card(h).preview).toEqual(READY);
  });

  it("a preview that fails shows the failure state", async () => {
    const h = setup(async () => {
      throw new Error("boom");
    });
    await ask(h);
    await waitFor(() => expect(card(h).preview).toEqual({ status: "failed" }));
  });

  it("a preview the planner calls a failure also shows the failure state", async () => {
    const h = setup(async () => ({ status: "failed" }));
    await ask(h);
    await waitFor(() => expect(card(h).preview).toEqual({ status: "failed" }));
  });

  it("a nofit answer is kept as is", async () => {
    const h = setup(async () => ({ status: "nofit", name: "Erez" }));
    await ask(h);
    await waitFor(() => expect(card(h).preview).toEqual({ status: "nofit", name: "Erez" }));
  });

  it("after 6 seconds without an answer the card shows a ~ estimate and the request is aborted", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let signal!: AbortSignal;
    const h = setup((_a, s) => {
      signal = s;
      return new Promise(() => undefined);
    });
    await ask(h);
    expect(card(h).preview?.status).toBe("computing");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6_001);
    });
    const p = card(h).preview;
    expect(p?.status).toBe("estimate");
    // 400 m at 12 min/km (5 km/h): out and back with winding = 12 min + 20 visit
    expect(p).toMatchObject({ minDelta: 32, distDeltaM: 1000 });
    expect(signal.aborted).toBe(true);
  });

  it("a newer proposal aborts the older one's preview", async () => {
    const signals: AbortSignal[] = [];
    const h = setup((_a, s) => {
      signals.push(s);
      return new Promise(() => undefined);
    });
    await ask(h);
    act(() => h.result.current.send("and a cafe"));
    await waitFor(() => expect(signals).toHaveLength(2));
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
  });

  it("declining aborts the preview", async () => {
    let signal!: AbortSignal;
    const h = setup((_a, s) => {
      signal = s;
      return new Promise(() => undefined);
    });
    await ask(h);
    act(() => h.result.current.decline(card(h).id));
    expect(signal.aborted).toBe(true);
  });
});

describe("approving", () => {
  it("busy keeps the card active, so a tap is not lost", async () => {
    const h = setup(async () => READY, () => "busy");
    await ask(h);
    await waitFor(() => expect(card(h).preview).toEqual(READY));
    act(() => h.result.current.runAction(card(h).id, 0));
    expect(h.onAction).toHaveBeenCalledTimes(1);
    expect(card(h).used).toBe(false);
    act(() => h.result.current.runAction(card(h).id, 0)); // can tap again
    expect(h.onAction).toHaveBeenCalledTimes(2);
  });

  it("recheck keeps the card active and computes the numbers again", async () => {
    const preview = vi.fn(async () => READY);
    const h = setup(preview, () => "recheck");
    await ask(h);
    await waitFor(() => expect(card(h).preview).toEqual(READY));
    act(() => h.result.current.runAction(card(h).id, 0));
    await waitFor(() => expect(preview).toHaveBeenCalledTimes(2));
    expect(card(h).used).toBe(false);
  });

  it("started uses the card up", async () => {
    const h = setup(async () => READY);
    await ask(h);
    await waitFor(() => expect(card(h).preview).toEqual(READY));
    act(() => h.result.current.runAction(card(h).id, 0));
    expect(card(h).used).toBe(true);
  });
});

beforeEach(() => undefined);

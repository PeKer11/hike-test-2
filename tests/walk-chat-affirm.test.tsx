import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useWalkChat } from "@/lib/hooks/useWalkChat";
import { isAffirm } from "@/lib/walk/chat/affirm";
import type { ChatContext } from "@/lib/walk/chat/reply";

const ctx: ChatContext = {
  stops: [{ id: "a", name: "Old Port", pinned: false }, { id: "b", name: "Carmel Market", pinned: false }],
  amenities: [],
  position: { lat: 32, lng: 34.8 },
};

const CAFE = { kind: "add-place", name: "Café Ahead", coordinates: { lat: 32.001, lng: 34.801 } };
const BAKERY = { kind: "add-place", name: "Bakery", coordinates: { lat: 32.002, lng: 34.802 } };

function setup(actions: unknown[]) {
  const doFetch = vi.fn(
    async () => ({ ok: true, status: 200, json: async () => ({ reply: "I suggest this. Does it fit?", actions }) }) as unknown as Response,
  ) as unknown as typeof fetch;
  const onAction = vi.fn();
  const hook = renderHook(() =>
    useWalkChat({ lang: "en", isSignedIn: true, freeChat: true, getContext: () => ctx, onAction, doFetch }),
  );
  return { ...hook, onAction, doFetch };
}

async function propose(h: ReturnType<typeof setup>) {
  act(() => h.result.current.send("add a stop"));
  await waitFor(() => expect(h.result.current.messages.at(-1)?.actions.length ?? 0).toBeGreaterThan(0));
}

afterEach(cleanup);

describe("a typed yes after a proposal", () => {
  it("runs the single proposed action with zero fetches and uses the message up", async () => {
    const h = setup([CAFE]);
    await propose(h);
    const fetches = vi.mocked(h.doFetch).mock.calls.length;
    act(() => h.result.current.send("כן"));
    expect(h.onAction).toHaveBeenCalledTimes(1);
    expect(h.onAction.mock.calls[0][0]).toMatchObject({ kind: "add-place", name: "Café Ahead" });
    expect(vi.mocked(h.doFetch).mock.calls.length).toBe(fetches);
    expect(h.result.current.messages.find((m) => m.actions.length > 0)?.used).toBe(true);
  });

  it("does nothing the second time", async () => {
    const h = setup([CAFE]);
    await propose(h);
    act(() => h.result.current.send("yes"));
    const fetches = vi.mocked(h.doFetch).mock.calls.length;
    act(() => h.result.current.send("yes"));
    expect(h.onAction).toHaveBeenCalledTimes(1);
    // The second yes is not an action, so it falls through to the assistant like any other sentence.
    expect(vi.mocked(h.doFetch).mock.calls.length).toBe(fetches + 1);
  });

  it("sends a no to the server", async () => {
    const h = setup([CAFE]);
    await propose(h);
    const fetches = vi.mocked(h.doFetch).mock.calls.length;
    act(() => h.result.current.send("לא"));
    expect(h.onAction).not.toHaveBeenCalled();
    expect(vi.mocked(h.doFetch).mock.calls.length).toBe(fetches + 1);
  });

  it("runs apply-all when there are several proposals", async () => {
    const h = setup([CAFE, BAKERY]);
    await propose(h);
    act(() => h.result.current.send("yes please"));
    expect(h.onAction).toHaveBeenCalledTimes(1);
    expect(h.onAction.mock.calls[0][0]).toMatchObject({ kind: "apply-changes" });
  });

  it("asks which one when several actions have no apply-all", async () => {
    const h = setup([{ kind: "head-back" }, { kind: "skip-stop", stopIndex: 0 }]);
    await propose(h);
    const fetches = vi.mocked(h.doFetch).mock.calls.length;
    act(() => h.result.current.send("yes"));
    expect(h.onAction).not.toHaveBeenCalled();
    expect(vi.mocked(h.doFetch).mock.calls.length).toBe(fetches);
    expect(h.result.current.messages.at(-1)!.text).toContain("Which one");
  });

  it("matches only short exact phrases", () => {
    expect(isAffirm("  כן!  ")).toBe(true);
    expect(isAffirm("Sounds good.")).toBe(true);
    expect(isAffirm("yes but not a café")).toBe(false);
    expect(isAffirm("")).toBe(false);
  });
});

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useWalkChat } from "@/lib/hooks/useWalkChat";
import { isAffirm, isDecline } from "@/lib/walk/chat/affirm";
import type { ChatContext } from "@/lib/walk/chat/reply";

const ctx: ChatContext = {
  stops: [{ id: "a", name: "Old Port", pinned: false }, { id: "b", name: "Carmel Market", pinned: false }],
  amenities: [],
  position: { lat: 32, lng: 34.8 },
};

const CAFE = { name: "Café Ahead", coordinates: { lat: 32.001, lng: 34.801 }, distM: 120 };
const BAKERY = { name: "Bakery", coordinates: { lat: 32.002, lng: 34.802 }, distM: 200 };

/** The server's answer: a proposal when there are places, otherwise a plain text reply. */
function setup(adds: unknown[]) {
  const doFetch = vi.fn(
    async () =>
      ({
        ok: true,
        status: 200,
        json: async () => (adds.length > 0 ? { reply: "", proposal: { adds, skipStopIndexes: [], headBack: false } } : { reply: "I suggest this. Does it fit?" }),
      }) as unknown as Response,
  ) as unknown as typeof fetch;
  const onAction = vi.fn();
  const hook = renderHook(() =>
    useWalkChat({ lang: "en", isSignedIn: true, freeChat: true, getContext: () => ctx, onAction, doFetch }),
  );
  return { ...hook, onAction, doFetch };
}

async function propose(h: ReturnType<typeof setup>) {
  act(() => h.result.current.send("anything nice nearby?"));
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
    expect(h.onAction.mock.calls[0][0]).toMatchObject({ kind: "proposal", adds: [expect.objectContaining({ name: "Café Ahead" })] });
    expect(vi.mocked(h.doFetch).mock.calls.length).toBe(fetches);
    expect(h.result.current.messages.find((m) => m.actions.length > 0)?.used).toBe(true);
  });

  it("treats a second yes as a true no-op: no fetch, no second action", async () => {
    const h = setup([CAFE]);
    await propose(h);
    act(() => h.result.current.send("yes"));
    const fetches = vi.mocked(h.doFetch).mock.calls.length;
    act(() => h.result.current.send("yes"));
    act(() => h.result.current.send("כן"));
    expect(h.onAction).toHaveBeenCalledTimes(1);
    expect(vi.mocked(h.doFetch).mock.calls.length).toBe(fetches);
    expect(h.result.current.messages.at(-1)!.text).toBe("Already on it");
  });

  it("only confirms the newest reply: an older proposal is not what 'ok' answers", async () => {
    const h = setup([CAFE]);
    await propose(h);
    // The walker asks something else; the next reply has no buttons.
    vi.mocked(h.doFetch).mockImplementationOnce(
      async () => ({ ok: true, status: 200, json: async () => ({ reply: "No rain expected." }) }) as unknown as Response,
    );
    act(() => h.result.current.send("will it rain?"));
    await waitFor(() => expect(h.result.current.messages.at(-1)?.text).toBe("No rain expected."));
    const fetches = vi.mocked(h.doFetch).mock.calls.length;
    act(() => h.result.current.send("ok"));
    expect(h.onAction).not.toHaveBeenCalled();
    expect(vi.mocked(h.doFetch).mock.calls.length).toBe(fetches + 1);
  });

  it("a typed no with an open proposal declines it locally: no fetch, no action", async () => {
    for (const phrase of ["לא", "לא תודה", "no", "No thanks", "ביטול"]) {
      const h = setup([CAFE]);
      await propose(h);
      const fetches = vi.mocked(h.doFetch).mock.calls.length;
      act(() => h.result.current.send(phrase));
      expect(h.onAction, phrase).not.toHaveBeenCalled();
      expect(vi.mocked(h.doFetch).mock.calls.length, phrase).toBe(fetches);
      const card = h.result.current.messages.find((m) => m.actions.length > 0)!;
      expect(card.used).toBe(true);
      expect(card.declined).toBe(true);
      cleanup();
    }
  });

  it("a typed no with nothing to decline still goes to the server", async () => {
    const h = setup([]);
    act(() => h.result.current.send("anything nice nearby?"));
    await waitFor(() => expect(h.result.current.messages.at(-1)?.text).toBe("I suggest this. Does it fit?"));
    const fetches = vi.mocked(h.doFetch).mock.calls.length;
    act(() => h.result.current.send("לא"));
    expect(vi.mocked(h.doFetch).mock.calls.length).toBe(fetches + 1);
  });

  it("matches only short exact no phrases", () => {
    expect(isDecline(" לא! ")).toBe(true);
    expect(isDecline("Nope")).toBe(true);
    expect(isDecline("no, add a cafe instead")).toBe(false);
    expect(isDecline("")).toBe(false);
  });

  it("a yes of any kind approves one card that holds several places, with no fetch", async () => {
    for (const phrase of ["yes please", "תוסיף אותם", "תוסיף את שניהם", "שניהם", "add them", "add both", "both"]) {
      const h = setup([CAFE, BAKERY]);
      await propose(h);
      const fetches = vi.mocked(h.doFetch).mock.calls.length;
      act(() => h.result.current.send(phrase));
      expect(h.onAction, phrase).toHaveBeenCalledTimes(1);
      expect(h.onAction.mock.calls[0][0]).toMatchObject({ kind: "proposal", adds: [expect.anything(), expect.anything()] });
      expect(vi.mocked(h.doFetch).mock.calls.length).toBe(fetches);
      cleanup();
    }
  });

  it("matches only short exact phrases", () => {
    expect(isAffirm("  כן!  ")).toBe(true);
    expect(isAffirm("Sounds good.")).toBe(true);
    expect(isAffirm("yes but not a café")).toBe(false);
    expect(isAffirm("")).toBe(false);
  });
});

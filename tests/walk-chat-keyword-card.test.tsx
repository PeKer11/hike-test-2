import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useWalkChat } from "@/lib/hooks/useWalkChat";
import type { ChatContext } from "@/lib/walk/chat/reply";

const ctx: ChatContext = {
  stops: [{ id: "a", name: "Old Port", pinned: false }, { id: "b", name: "Carmel Market", pinned: false }],
  amenities: [],
  position: { lat: 32, lng: 34.8 },
};
const setup = (stops = ctx.stops) => {
  const preview = vi.fn(() => new Promise<never>(() => undefined));
  const hook = renderHook(() =>
    useWalkChat({ lang: "en", isSignedIn: false, getContext: () => ({ ...ctx, stops }), onAction: vi.fn(), doFetch: vi.fn() as unknown as typeof fetch, previewProposal: preview as never }),
  );
  return { ...hook, preview };
};
afterEach(cleanup);

describe("the keyword chat: a single route change is the same card", () => {
  it("'skip Carmel Market' is one proposal card, with its dry run started", () => {
    const h = setup();
    act(() => h.result.current.send("skip Carmel Market"));
    const m = h.result.current.messages.at(-1)!;
    expect(m.actions).toHaveLength(1);
    expect(m.actions[0]).toMatchObject({ kind: "proposal", dropStopIds: ["b"], dropNames: ["Carmel Market"], headBack: false });
    expect(m.text).toBe("");
    expect(h.preview).toHaveBeenCalledTimes(1);
  });

  it("'head back' is a card with no dry run", () => {
    const h = setup();
    act(() => h.result.current.send("head back"));
    const m = h.result.current.messages.at(-1)!;
    expect(m.actions[0]).toMatchObject({ kind: "proposal", headBack: true });
    expect(h.preview).not.toHaveBeenCalled();
  });

  it("'which stop to skip' stays a list of chips: it is a choice, not a proposal", () => {
    const h = setup([
      { id: "a", name: "Old Port", pinned: false },
      { id: "b", name: "Carmel Market", pinned: false },
      { id: "c", name: "Bahai Gardens", pinned: false },
    ]);
    act(() => h.result.current.send("shorter"));
    const m = h.result.current.messages.at(-1)!;
    expect(m.actions.length).toBeGreaterThan(1);
    expect(m.actions.every((a) => a.kind === "drop")).toBe(true);
  });

  it("water still offers its own detour chip", () => {
    const h = renderHook(() =>
      useWalkChat({
        lang: "en", isSignedIn: false, onAction: vi.fn(), doFetch: vi.fn() as unknown as typeof fetch,
        getContext: () => ({ ...ctx, amenities: [{ id: "w", kind: "drinking_water", name: "Fountain", coordinates: { lat: 32.001, lng: 34.8 } } as never] }),
      }),
    );
    act(() => h.result.current.send("water"));
    expect(h.result.current.messages.at(-1)!.actions[0].kind).toBe("detour");
  });
});

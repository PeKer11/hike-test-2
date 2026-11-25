import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useWalkChat } from "@/lib/hooks/useWalkChat";
import type { ChatContext } from "@/lib/walk/chat/reply";

const ctx: ChatContext = {
  stops: [{ id: "a", name: "Old Port", pinned: false }, { id: "b", name: "Carmel Market", pinned: false }],
  amenities: [],
  position: { lat: 32, lng: 34.8 },
};
const add = (name: string, distM = 400) => ({ name, coordinates: { lat: 32.001, lng: 34.801 }, distM });
type Answer = { reply: string; proposal?: unknown; noMatch?: string };

function setup(answer: Answer, lang: "en" | "he" = "he") {
  const doFetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => answer }) as unknown as Response) as unknown as typeof fetch;
  const onAction = vi.fn();
  const hook = renderHook(() => useWalkChat({ lang, isSignedIn: true, freeChat: true, getContext: () => ctx, onAction, doFetch }));
  return { ...hook, onAction, doFetch };
}
const sent = (h: ReturnType<typeof setup>) => JSON.parse((vi.mocked(h.doFetch).mock.calls[0][1] as { body: string }).body);
const done = (h: ReturnType<typeof setup>) => waitFor(() => expect(h.result.current.pending).toBe(false));

afterEach(cleanup);

describe("a command no longer runs on its own: it yields one proposal card", () => {
  it("'תוסיף שני מקומות' with two adds: one card, nothing applied, no autoApply sent", async () => {
    const h = setup({ reply: "", proposal: { adds: [add("מצפה ארז"), add("חאן זרוניה")], skipStopIndexes: [], headBack: false } });
    act(() => h.result.current.send("תוסיף שני מקומות"));
    await done(h);
    expect("autoApply" in sent(h)).toBe(false);
    expect(h.onAction).not.toHaveBeenCalled();
    const msg = h.result.current.messages.at(-1)!;
    expect(msg.text).toBe("");
    expect(msg.actions).toHaveLength(1);
    expect(msg.actions[0]).toMatchObject({ kind: "proposal", headBack: false, dropStopIds: [] });
    expect(msg.actions[0].kind === "proposal" && msg.actions[0].adds.map((a) => a.name)).toEqual(["מצפה ארז", "חאן זרוניה"]);
  });

  it("'תוריד את השוק': the skip becomes a card naming the stop, not a drop", async () => {
    const h = setup({ reply: "", proposal: { adds: [], skipStopIndexes: [1], headBack: false } });
    act(() => h.result.current.send("תוריד את השוק"));
    await done(h);
    expect(h.onAction).not.toHaveBeenCalled();
    expect(h.result.current.messages.at(-1)!.actions[0]).toMatchObject({ kind: "proposal", dropStopIds: ["b"], dropNames: ["Carmel Market"] });
  });

  it("several changes in one proposal are one card (add + skip)", async () => {
    const h = setup({ reply: "", proposal: { adds: [add("A")], skipStopIndexes: [0, 1], headBack: false } }, "en");
    act(() => h.result.current.send("swap things"));
    await done(h);
    const actions = h.result.current.messages.at(-1)!.actions;
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ kind: "proposal", dropStopIds: ["a", "b"] });
  });

  it("head back is a card too", async () => {
    const h = setup({ reply: "", proposal: { adds: [], skipStopIndexes: [], headBack: true } }, "en");
    act(() => h.result.current.send("take me back"));
    await done(h);
    expect(h.result.current.messages.at(-1)!.actions[0]).toMatchObject({ kind: "proposal", headBack: true });
  });

  it("a plain answer stays a text bubble with no card", async () => {
    const h = setup({ reply: "It is an old khan." }, "en");
    act(() => h.result.current.send("what is that building"));
    await done(h);
    const msg = h.result.current.messages.at(-1)!;
    expect(msg.text).toBe("It is an old khan.");
    expect(msg.actions).toEqual([]);
  });

  it("nothing_found shows fixed text, in both languages, and no buttons", async () => {
    const he = setup({ reply: "", noMatch: "none_near" });
    act(() => he.result.current.send("תוסיף קפה"));
    await done(he);
    expect(he.result.current.messages.at(-1)).toMatchObject({ text: "לא מצאתי מקום מתאים קרוב.", actions: [] });
    cleanup();
    const en = setup({ reply: "", noMatch: "search_limit" }, "en");
    act(() => en.result.current.send("add a cafe"));
    await done(en);
    expect(en.result.current.messages.at(-1)).toMatchObject({ text: "I've hit today's search limit.", actions: [] });
  });

  it("nothing_found outside the typed radius names that distance", async () => {
    const h = setup({ reply: "", noMatch: "outside_radius" });
    act(() => h.result.current.send("תוסיף אטרקציה עד חצי ק״מ"));
    await done(h);
    expect(h.result.current.messages.at(-1)!.text).toBe("לא מצאתי מקום מתאים בטווח 500 מ׳.");
  });

  it("sends the open card's names so a new request builds on it", async () => {
    const h = setup({ reply: "", proposal: { adds: [add("Erez")], skipStopIndexes: [1], headBack: false } }, "en");
    act(() => h.result.current.send("add something"));
    await done(h);
    vi.mocked(h.doFetch).mockClear();
    act(() => h.result.current.send("and a cafe too"));
    await done(h);
    expect(sent(h).pending).toEqual({ adds: ["Erez"], drops: ["Carmel Market"], headBack: false });
  });
});

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useWalkChat } from "@/lib/hooks/useWalkChat";
import type { ChatContext } from "@/lib/walk/chat/reply";

const ctx: ChatContext = {
  stops: [{ id: "a", name: "Old Port", pinned: false }, { id: "b", name: "Carmel Market", pinned: false }],
  amenities: [],
  position: { lat: 32, lng: 34.8 },
};
const add = (name: string) => ({ kind: "add-place", name, coordinates: { lat: 32.001, lng: 34.801 } });

function setup(actions: unknown[], lang: "en" | "he" = "he") {
  const doFetch = vi.fn(
    async () => ({ ok: true, status: 200, json: async () => ({ reply: "כי זה קרוב ויפה.", actions }) }) as unknown as Response,
  ) as unknown as typeof fetch;
  const onAction = vi.fn();
  const hook = renderHook(() => useWalkChat({ lang, isSignedIn: true, freeChat: true, getContext: () => ctx, onAction, doFetch }));
  return { ...hook, onAction, doFetch };
}
const sent = (h: ReturnType<typeof setup>) => JSON.parse((vi.mocked(h.doFetch).mock.calls[0][1] as { body: string }).body);
const done = (h: ReturnType<typeof setup>) => waitFor(() => expect(h.result.current.pending).toBe(false));

afterEach(cleanup);

describe("an explicit command runs at once", () => {
  it("'תוסיף שני מקומות' with two adds: one apply-changes, no chips, a line built from the actions", async () => {
    const h = setup([add("מצפה ארז"), add("חאן זרוניה")]);
    act(() => h.result.current.send("תוסיף שני מקומות"));
    await done(h);
    expect(sent(h).autoApply).toBe("add");
    expect(h.onAction).toHaveBeenCalledTimes(1);
    const action = h.onAction.mock.calls[0][0];
    expect(action).toMatchObject({ kind: "apply-changes", dropStopIds: [] });
    expect(action.adds.map((a: { name: string }) => a.name)).toEqual(["מצפה ארז", "חאן זרוניה"]);
    const msg = h.result.current.messages.at(-1)!;
    expect(msg.actions).toEqual([]);
    expect(msg.text).toContain("מוסיפים: מצפה ארז, חאן זרוניה");
    expect(msg.text).toContain("כי זה קרוב ויפה.");
  });

  it("a single add runs as that add", async () => {
    const h = setup([add("Cafe")], "en");
    act(() => h.result.current.send("add a cafe"));
    await done(h);
    expect(h.onAction).toHaveBeenCalledTimes(1);
    expect(h.onAction.mock.calls[0][0]).toMatchObject({ kind: "add-place", name: "Cafe" });
    expect(h.result.current.messages.at(-1)!.text).toContain("Adding: Cafe");
  });

  it("caps an auto-applied add at three", async () => {
    const h = setup([add("A1"), add("A2"), add("A3"), add("A4")], "en");
    act(() => h.result.current.send("add four places"));
    await done(h);
    expect(h.onAction.mock.calls[0][0].adds).toHaveLength(3);
  });

  it("'תוריד את המוזיאון' runs the drop, with the stop named", async () => {
    const h = setup([{ kind: "skip-stop", stopIndex: 1 }]);
    act(() => h.result.current.send("תוריד את השוק"));
    await done(h);
    expect(sent(h).autoApply).toBe("drop");
    expect(h.onAction.mock.calls[0][0]).toMatchObject({ kind: "drop", stopId: "b" });
    expect(h.result.current.messages.at(-1)!.text).toContain("מורידים: Carmel Market");
  });

  it("a question with two adds stays chips only", async () => {
    const h = setup([add("A"), add("B")]);
    act(() => h.result.current.send("מה יש פה יפה?"));
    await done(h);
    expect(sent(h).autoApply).toBeUndefined();
    expect(h.onAction).not.toHaveBeenCalled();
    expect(h.result.current.messages.at(-1)!.actions.length).toBeGreaterThan(0);
  });

  it("an add command whose reply also skips a stop: the add runs, the skip stays a button", async () => {
    const h = setup([add("A"), { kind: "skip-stop", stopIndex: 0 }], "en");
    act(() => h.result.current.send("add a place"));
    await done(h);
    expect(h.onAction).toHaveBeenCalledTimes(1);
    expect(h.onAction.mock.calls[0][0]).toMatchObject({ kind: "add-place" });
    const msg = h.result.current.messages.at(-1)!;
    expect(msg.actions).toHaveLength(1);
    expect(msg.actions[0]).toMatchObject({ kind: "drop", stopId: "a" });
  });
});

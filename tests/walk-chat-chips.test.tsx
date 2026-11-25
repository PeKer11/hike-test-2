import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useWalkChat } from "@/lib/hooks/useWalkChat";
import type { ChatContext } from "@/lib/walk/chat/reply";

const ctx: ChatContext = {
  stops: [{ id: "a", name: "Old Port", pinned: false }, { id: "b", name: "Carmel Market", pinned: false }],
  amenities: [],
  position: { lat: 32, lng: 34.8 },
};
const plan = (...names: string[]) => ({ adds: names.map((name) => ({ name, coordinates: { lat: 32.001, lng: 34.801 }, distM: 300 })), skipStopIndexes: [], headBack: false });

function setup(replies: Array<{ reply: string; proposal?: unknown }>, lang: "en" | "he" = "en") {
  let n = 0;
  const doFetch = vi.fn(
    async () => ({ ok: true, status: 200, json: async () => replies[Math.min(n++, replies.length - 1)] }) as unknown as Response,
  ) as unknown as typeof fetch;
  return renderHook(() => useWalkChat({ lang, isSignedIn: true, freeChat: true, getContext: () => ctx, onAction: vi.fn(), doFetch }));
}
const ask = async (h: ReturnType<typeof setup>, text: string, count: number) => {
  act(() => h.result.current.send(text));
  await waitFor(() => expect(h.result.current.messages.filter((m) => m.actions.length > 0)).toHaveLength(count));
};

afterEach(cleanup);

describe("one card for several places", () => {
  it("holds every place by name, in both languages, as a single action", async () => {
    const en = setup([{ reply: "", proposal: plan("Mitzpe Erez", "Han Zeruniya") }]);
    await ask(en, "what is nice", 1);
    const a = en.result.current.messages.at(-1)!.actions;
    expect(a).toHaveLength(1);
    expect(a[0].kind === "proposal" && a[0].adds.map((x) => x.name)).toEqual(["Mitzpe Erez", "Han Zeruniya"]);
    cleanup();
    const he = setup([{ reply: "", proposal: plan("מצפה ארז", "חאן זרוניה") }], "he");
    await ask(he, "מה יפה", 1);
    expect(he.result.current.messages.at(-1)!.actions).toHaveLength(1);
  });
});

describe("stale cards", () => {
  it("a newer proposal supersedes the older card", async () => {
    const h = setup([
      { reply: "", proposal: plan("A") },
      { reply: "", proposal: plan("B") },
    ]);
    await ask(h, "one", 1);
    const first = h.result.current.messages.find((m) => m.actions.length > 0)!.id;
    expect(h.result.current.messages.find((m) => m.id === first)!.superseded).toBeFalsy();
    act(() => h.result.current.send("another"));
    await waitFor(() => expect(h.result.current.messages.filter((m) => m.actions.length > 0)).toHaveLength(2));
    expect(h.result.current.messages.find((m) => m.id === first)!.superseded).toBe(true);
    expect(h.result.current.messages.at(-1)!.superseded).toBeFalsy();
  });
});

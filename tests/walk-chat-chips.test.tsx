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

function setup(replies: Array<{ reply: string; actions: unknown[] }>, lang: "en" | "he" = "en") {
  let n = 0;
  const doFetch = vi.fn(
    async () => ({ ok: true, status: 200, json: async () => replies[Math.min(n++, replies.length - 1)] }) as unknown as Response,
  ) as unknown as typeof fetch;
  const hook = renderHook(() =>
    useWalkChat({ lang, isSignedIn: true, freeChat: true, getContext: () => ctx, onAction: vi.fn(), doFetch }),
  );
  return hook;
}
const ask = async (h: ReturnType<typeof setup>, text: string, count: number) => {
  act(() => h.result.current.send(text));
  await waitFor(() => expect(h.result.current.messages.filter((m) => m.actions.length > 0)).toHaveLength(count));
};

afterEach(cleanup);

describe("named chips", () => {
  it("the combined chip names the places (EN and HE), drops with a minus", async () => {
    const en = setup([{ reply: "ok", actions: [add("Mitzpe Erez"), add("Han Zeruniya")] }]);
    await ask(en, "what is nice", 1);
    expect(en.result.current.messages.at(-1)!.actions[0].label).toBe("Add: Mitzpe Erez + Han Zeruniya");
    cleanup();
    const he = setup([{ reply: "ok", actions: [add("מצפה ארז"), add("חאן זרוניה"), { kind: "skip-stop", stopIndex: 1 }] }], "he");
    await ask(he, "מה יפה", 1);
    expect(he.result.current.messages.at(-1)!.actions[0].label).toBe("להוסיף: מצפה ארז + חאן זרוניה, −Carmel Market");
  });

  it("falls back to a count when the names are long", async () => {
    const long = "A very long place name indeed number ";
    const en = setup([{ reply: "ok", actions: [add(long + "one"), add(long + "two")] }]);
    await ask(en, "what is nice", 1);
    expect(en.result.current.messages.at(-1)!.actions[0].label).toBe("Add both places");
    cleanup();
    const he = setup([{ reply: "ok", actions: [add(long + "one"), add(long + "two")] }], "he");
    await ask(he, "מה יפה", 1);
    expect(he.result.current.messages.at(-1)!.actions[0].label).toBe("להוסיף את 2 המקומות");
  });
});

describe("stale chips", () => {
  it("a newer proposal supersedes the buttons of the older reply", async () => {
    const h = setup([
      { reply: "first", actions: [add("A")] },
      { reply: "second", actions: [add("B")] },
    ]);
    await ask(h, "one", 1);
    expect(h.result.current.messages.find((m) => m.text === "first")!.superseded).toBeFalsy();
    act(() => h.result.current.send("another"));
    await waitFor(() => expect(h.result.current.messages.some((m) => m.text === "second")).toBe(true));
    expect(h.result.current.messages.find((m) => m.text === "first")!.superseded).toBe(true);
    expect(h.result.current.messages.find((m) => m.text === "second")!.superseded).toBeFalsy();
  });
});

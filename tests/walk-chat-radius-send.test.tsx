import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useWalkChat } from "@/lib/hooks/useWalkChat";
import type { ChatContext } from "@/lib/walk/chat/reply";

const ctx: ChatContext = { stops: [{ id: "a", name: "Old Port", pinned: false }], amenities: [], position: { lat: 32, lng: 34.8 } };
afterEach(cleanup);

function bodyOf(doFetch: ReturnType<typeof vi.fn>) {
  return JSON.parse((doFetch.mock.calls[0][1] as { body: string }).body) as Record<string, unknown>;
}

describe("the free chat sends the radius the walker typed", () => {
  const run = async (text: string) => {
    const doFetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ reply: "ok", actions: [] }) }) as unknown as Response);
    const { result } = renderHook(() =>
      useWalkChat({ lang: "he", isSignedIn: true, freeChat: true, getContext: () => ctx, onAction: vi.fn(), doFetch: doFetch as unknown as typeof fetch }),
    );
    act(() => result.current.send(text));
    await waitFor(() => expect(doFetch).toHaveBeenCalled());
    return bodyOf(doFetch);
  };

  it("'עד חצי ק״מ' goes as radiusM 500", async () => {
    expect((await run("בעצם בא לי עד חצי ק״מ רדיוס ותוסיף אטרקציה")).radiusM).toBe(500);
  });
  it("'עוד אטרקציה או שניים' goes as maxAdds 1 (a range is the smallest)", async () => {
    expect((await run("תגדיל את זה תעשה עוד אטרקציה או שניים")).maxAdds).toBe(1);
  });
  it("'תוסיף שתי אטרקציות' goes as maxAdds 2; a question sends none", async () => {
    expect((await run("תוסיף שתי אטרקציות")).maxAdds).toBe(2);
    expect("maxAdds" in (await run("מה יש פה יפה"))).toBe(false);
  });
  it("an explore request goes as explore: true; a plain add does not", async () => {
    expect((await run("תפתיע אותי")).explore).toBe(true);
    expect("explore" in (await run("תוסיף אטרקציה"))).toBe(false);
  });
  it("no distance in the words, no radiusM", async () => {
    expect("radiusM" in (await run("מה יש פה יפה"))).toBe(false);
  });
});

describe("the keyword chat's add-a-stop button carries the typed radius", () => {
  it("'תוסיף עצירה עד 300 מטר' offers add-stop with radiusM 300", () => {
    const { result } = renderHook(() =>
      useWalkChat({ lang: "he", isSignedIn: false, getContext: () => ctx, onAction: vi.fn(), doFetch: vi.fn() as unknown as typeof fetch }),
    );
    act(() => result.current.send("תוסיף עצירה עד 300 מטר"));
    expect(result.current.messages.at(-1)?.actions).toEqual([expect.objectContaining({ kind: "add-stop", radiusM: 300 })]);
  });
});

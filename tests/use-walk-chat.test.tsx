import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MAX_CHAT_LLM_PER_WALK, useWalkChat } from "@/lib/hooks/useWalkChat";
import type { ChatContext } from "@/lib/walk/chat/reply";

const ctx: ChatContext = {
  stops: [{ id: "a", name: "Old Port", pinned: false }, { id: "b", name: "Carmel Market", pinned: false }],
  amenities: [],
  position: { lat: 32, lng: 34.8 },
};

function setup(doFetch: typeof fetch, over: { isSignedIn?: boolean } = {}) {
  const onAction = vi.fn();
  const hook = renderHook(() =>
    useWalkChat({ lang: "en", isSignedIn: over.isSignedIn ?? true, getContext: () => ctx, onAction, doFetch }),
  );
  return { ...hook, onAction };
}
const reply = (status: number, body: unknown) =>
  vi.fn(async () => ({ ok: status < 400, status, json: async () => body }) as unknown as Response) as unknown as typeof fetch;
const last = (r: { current: { messages: { text: string }[] } }) => r.current.messages.at(-1)?.text ?? "";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useWalkChat", () => {
  it("answers a keyword command on the device without a fetch", () => {
    const doFetch = reply(200, {});
    const { result } = setup(doFetch);
    act(() => result.current.send("make it shorter"));
    expect(doFetch).not.toHaveBeenCalled();
    expect(last(result)).toContain("Which stop");
  });

  it("runs an action once and then uses it up", () => {
    const { result, onAction } = setup(reply(200, {}));
    act(() => result.current.send("shorter"));
    const msg = result.current.messages.at(-1)!;
    act(() => result.current.runAction(msg.id, 1));
    act(() => result.current.runAction(msg.id, 1));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction.mock.calls[0][0]).toMatchObject({ kind: "drop", stopId: "b" });
    expect(result.current.messages.at(-1)!.used).toBe(true);
  });

  it("never fetches for an anonymous walker and points to sign-in", () => {
    const doFetch = reply(200, {});
    const { result } = setup(doFetch, { isSignedIn: false });
    act(() => result.current.send("what is that building"));
    expect(doFetch).not.toHaveBeenCalled();
    expect(last(result)).toContain("Sign in for free-form questions.");
  });

  it("sends the free-form question and resolves the model's intent into a reply", async () => {
    const doFetch = reply(200, { intent: "skip", amenity: null, stopIndex: 1 });
    const { result } = setup(doFetch);
    act(() => result.current.send("what is that building"));
    expect(last(result)).toBe("Thinking…");
    await waitFor(() => expect(last(result)).toContain("Carmel Market"));
    const body = JSON.parse((vi.mocked(doFetch).mock.calls[0][1] as { body: string }).body);
    expect(body).toEqual({ text: "what is that building", stops: ["Old Port", "Carmel Market"], lang: "en" });
    expect(result.current.pending).toBe(false);
  });

  it("makes no fetch for question 16 and shows the cap message", async () => {
    const doFetch = reply(200, { intent: "unknown", amenity: null, stopIndex: null });
    const { result } = setup(doFetch);
    for (let i = 0; i < MAX_CHAT_LLM_PER_WALK; i++) {
      act(() => result.current.send(`what is thing ${i}`));
      await waitFor(() => expect(result.current.pending).toBe(false));
    }
    expect(doFetch).toHaveBeenCalledTimes(15);
    act(() => result.current.send("what is thing 15"));
    expect(doFetch).toHaveBeenCalledTimes(15);
    expect(last(result)).toContain("15 questions");
  });

  it("shows a reply for a 401, a budget 429, a plain 429, a failed fetch and a timeout", async () => {
    const cases: [typeof fetch, string][] = [
      [reply(401, { code: "signin" }), "Sign in"],
      [reply(429, { code: "budget" }), "resting for today"],
      [reply(429, {}), "Too many questions"],
      [vi.fn(async () => { throw new TypeError("network"); }) as unknown as typeof fetch, "couldn't reach"],
    ];
    for (const [doFetch, expected] of cases) {
      const { result } = setup(doFetch);
      act(() => result.current.send("what is that"));
      await waitFor(() => expect(last(result).toLowerCase()).toContain(expected.toLowerCase()));
      expect(result.current.pending).toBe(false);
      cleanup();
    }

    vi.useFakeTimers({ shouldAdvanceTime: true });
    const hang = vi.fn(
      (_u: unknown, init?: RequestInit) =>
        new Promise<Response>((_res, rej) =>
          init?.signal?.addEventListener("abort", () => rej(new DOMException("a", "AbortError"))),
        ),
    ) as unknown as typeof fetch;
    const { result } = setup(hang);
    act(() => result.current.send("what is that"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(last(result)).toContain("took too long");
    expect(result.current.pending).toBe(false);
  });

  it("keeps only the last six messages and reset clears the count", () => {
    const { result } = setup(reply(200, {}));
    for (let i = 0; i < 5; i++) act(() => result.current.send("shorter"));
    expect(result.current.messages).toHaveLength(6);
    act(() => result.current.reset());
    expect(result.current.messages).toHaveLength(0);
    expect(result.current.llmUsed).toBe(0);
  });
});

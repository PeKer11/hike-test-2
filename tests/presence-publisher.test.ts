import { afterEach, describe, expect, it, vi } from "vitest";

import {
  decidePresence, PresencePublisher, cellOf, HEARTBEAT_MS, QUIET_START_MS,
  type PublishInput, type PublishState,
} from "@/lib/social/presence-publisher";

const START = { lat: 32.08, lng: 34.78 };
// ~1.5 km east of the start: outside the 800 m home radius.
const FAR = { lat: 32.08, lng: 34.795 };
const T0 = 1_000_000_000_000;

const base = (over: Partial<PublishInput> = {}): PublishInput => ({
  nowMs: T0 + QUIET_START_MS + 60_000,
  walking: true,
  startedAtMs: T0,
  startPoint: START,
  position: FAR,
  accuracyM: 20,
  pageVisible: true,
  hiddenSinceMs: null,
  ghost: false,
  audience: "friends",
  zoneAllowed: true,
  ...over,
});
const fresh: PublishState = { published: false, lastPublishAtMs: null, lastCell: null };
const published = (atMs: number, pos = FAR): PublishState => ({ published: true, lastPublishAtMs: atMs, lastCell: cellOf(pos) });

describe("decidePresence", () => {
  it("publishes the first time away from home, as a new walk", () => {
    expect(decidePresence(base(), fresh)).toEqual({ action: "publish", newWalk: true });
  });
  it("waits in the first 10 minutes", () => {
    expect(decidePresence(base({ nowMs: T0 + QUIET_START_MS - 1 }), fresh)).toEqual({ action: "wait" });
  });
  it("waits within 800 m of the start (home protection)", () => {
    expect(decidePresence(base({ position: { lat: 32.0835, lng: 34.78 } }), fresh)).toEqual({ action: "wait" });
  });
  it("clears in a deny zone, for ghost, when the audience is off, and when the walk ended", () => {
    for (const over of [{ zoneAllowed: false }, { ghost: true }, { audience: "off" as const }, { walking: false }]) {
      expect(decidePresence(base(over), published(T0))).toEqual({ action: "clear" });
    }
  });
  it("heartbeats every 5 minutes, not before", () => {
    const at = T0 + QUIET_START_MS;
    expect(decidePresence(base({ nowMs: at + HEARTBEAT_MS - 1 }), published(at))).toEqual({ action: "wait" });
    expect(decidePresence(base({ nowMs: at + HEARTBEAT_MS }), published(at))).toEqual({ action: "publish", newWalk: false });
  });
  it("publishes on a cell change, but not twice within 60 s", () => {
    const at = T0 + QUIET_START_MS;
    const moved = { lat: 32.08, lng: 34.81 }; // another 1 km cell
    expect(cellOf(moved)).not.toBe(cellOf(FAR));
    expect(decidePresence(base({ nowMs: at + 30_000, position: moved }), published(at))).toEqual({ action: "wait" });
    expect(decidePresence(base({ nowMs: at + 60_000, position: moved }), published(at))).toEqual({ action: "publish", newWalk: false });
  });
  it("clears after the page was hidden for over 5 minutes; waits while hidden before that", () => {
    const now = T0 + QUIET_START_MS + 10 * 60_000;
    expect(decidePresence(base({ nowMs: now, pageVisible: false, hiddenSinceMs: now - 2 * 60_000 }), published(now - 60_000))).toEqual({ action: "wait" });
    expect(decidePresence(base({ nowMs: now, pageVisible: false, hiddenSinceMs: now - 6 * 60_000 }), published(now - 60_000))).toEqual({ action: "clear" });
  });
  it("does not publish a weak fix", () => {
    expect(decidePresence(base({ accuracyM: 250 }), fresh)).toEqual({ action: "wait" });
  });
});

describe("PresencePublisher", () => {
  const ok = () => new Response(JSON.stringify({ shared: true }));
  afterEach(() => vi.unstubAllEnvs());

  it("sends nothing at all when the flag is off", async () => {
    const doFetch = vi.fn(async () => ok());
    const p = new PresencePublisher(doFetch as unknown as typeof fetch, () => T0 + QUIET_START_MS + 1000, () => false);
    await p.tick({ ...base(), nowMs: undefined } as never);
    await p.clear();
    expect(doFetch).not.toHaveBeenCalled();
    expect(p.sharing).toBe(false);
  });

  it("publishes, shows `sharing`, and End walk (clear) sends one DELETE; a second clear sends none", async () => {
    let now = T0 + QUIET_START_MS + 1000;
    const doFetch = vi.fn(async () => ok());
    const p = new PresencePublisher(doFetch as unknown as typeof fetch, () => now, () => true);
    const { nowMs: _unused, ...input } = base();
    void _unused;
    await p.tick(input);
    expect(doFetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String((doFetch.mock.calls[0] as unknown[])[1] && ((doFetch.mock.calls[0] as unknown[])[1] as RequestInit).body))).toMatchObject({ newWalk: true });
    expect(p.sharing).toBe(true);
    now += 30_000;
    await p.tick(input); // inside the heartbeat window: nothing
    expect(doFetch).toHaveBeenCalledTimes(1);
    await p.clear();
    expect(p.sharing).toBe(false);
    expect(doFetch).toHaveBeenCalledTimes(2);
    expect(((doFetch.mock.calls[1] as unknown[])[1] as RequestInit).method).toBe("DELETE");
    await p.clear();
    expect(doFetch).toHaveBeenCalledTimes(2);
  });

  it("going ghost clears at once", async () => {
    const doFetch = vi.fn(async () => ok());
    const p = new PresencePublisher(doFetch as unknown as typeof fetch, () => T0 + QUIET_START_MS + 1000, () => true);
    const { nowMs: _u, ...input } = base();
    void _u;
    await p.tick(input);
    await p.tick({ ...input, ghost: true });
    expect(((doFetch.mock.calls[1] as unknown[])[1] as RequestInit).method).toBe("DELETE");
    expect(p.sharing).toBe(false);
  });

  it("a refused publish (server said not shared) is not shown as sharing", async () => {
    const doFetch = vi.fn(async () => new Response(JSON.stringify({ shared: false })));
    const p = new PresencePublisher(doFetch as unknown as typeof fetch, () => T0 + QUIET_START_MS + 1000, () => true);
    const { nowMs: _u, ...input } = base();
    void _u;
    await p.tick(input);
    expect(p.sharing).toBe(false);
  });
});

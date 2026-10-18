import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useShortcutOffer, type ShortcutContext } from "@/lib/hooks/useShortcutOffer";
import { at } from "./helpers/discovery";

const U = [at(0, 0), at(0, 800), at(600, 800), at(600, 0)];
const CONNECTOR = [at(0, 0), at(300, 0), at(600, 0)];

function setup(over: Partial<ShortcutContext> = {}, distanceMeters = 650) {
  const ctx: ShortcutContext = {
    geometry: U,
    segmentIndex: 0,
    matchedPoint: U[0],
    position: at(0, 0),
    atMs: 1_000_000,
    walkedM: 200,
    stops: [{ id: "s1", point: at(600, 5), label: "Cafe" }],
    speedMps: 1.3,
    blocked: false,
    ...over,
  };
  const doFetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({ geometry: CONNECTOR, distanceMeters }),
  })) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
  const onApply = vi.fn();
  const hook = renderHook(() =>
    useShortcutOffer({ getContext: () => ({ ...ctx }), onApply, doFetch }),
  );
  const feed = () => act(async () => { await hook.result.current.feed(); });
  return { ctx, doFetch, onApply, hook, feed };
}

afterEach(() => vi.restoreAllMocks());

describe("useShortcutOffer", () => {
  it("offers a shorter way, asking /api/reroute once for the target point", async () => {
    const { doFetch, hook, feed } = setup();
    await feed();
    expect(hook.result.current.offer).toMatchObject({ stopName: "Cafe", savingMin: 20 });
    expect(Math.abs(hook.result.current.offer!.savingM - 1550)).toBeLessThan(15);
    expect(doFetch).toHaveBeenCalledTimes(1);
    const [url, init] = doFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/reroute");
    const body = JSON.parse(init.body as string);
    expect(body.from).toEqual(at(0, 0));
    expect(body.candidates).toHaveLength(1);
  });

  it("makes no request while something else owns the walker", async () => {
    const { doFetch, feed } = setup({ blocked: true });
    await feed();
    expect(doFetch).not.toHaveBeenCalled();
  });

  it("shows nothing when the connector saves too little", async () => {
    const { hook, feed } = setup({}, 2100);
    await feed();
    expect(hook.result.current.offer).toBeNull();
  });

  it("withdraws the offer after 41 m of drift and does not ask again", async () => {
    const { ctx, doFetch, hook, feed } = setup();
    await feed();
    ctx.position = at(0, 39);
    ctx.atMs += 1_000;
    await feed();
    expect(hook.result.current.offer).not.toBeNull();
    act(() => hook.result.current.markShown());
    ctx.position = at(0, 41);
    ctx.atMs += 1_000;
    await feed();
    expect(hook.result.current.offer).toBeNull();
    // Cooldown and progress are clear again, but the decline sticks.
    ctx.atMs += 300_000;
    ctx.walkedM += 1_000;
    await feed();
    expect(doFetch).toHaveBeenCalledTimes(1);
    expect(hook.result.current.offer).toBeNull();
  });

  it("withdraws the offer after the 45 s TTL", async () => {
    const { ctx, hook, feed } = setup();
    await feed();
    ctx.atMs += 45_001;
    await feed();
    expect(hook.result.current.offer).toBeNull();
  });

  it("accept hands back a route that starts with the connector and keeps the rest", async () => {
    const { onApply, hook, feed } = setup();
    await feed();
    let ok = false;
    act(() => { ok = hook.result.current.accept(); });
    expect(ok).toBe(true);
    const spliced = onApply.mock.calls[0][0];
    expect(spliced.slice(0, CONNECTOR.length)).toEqual(CONNECTOR);
    expect(spliced[spliced.length - 1]).toEqual(U[3]);
    expect(onApply.mock.calls[0][1]).toBe(1_000_000);
    expect(hook.result.current.offer).toBeNull();
  });

  it("accept refuses when the walker has moved on since the last fix", async () => {
    const { ctx, onApply, hook, feed } = setup();
    await feed();
    ctx.position = at(0, 60);
    let ok = true;
    act(() => { ok = hook.result.current.accept(); });
    expect(ok).toBe(false);
    expect(onApply).not.toHaveBeenCalled();
    expect(hook.result.current.offer).toBeNull();
  });

  it("no offer when the route changed while the check was in flight", async () => {
    const { ctx, doFetch, hook } = setup();
    let release: (v: unknown) => void = () => {};
    doFetch.mockImplementationOnce(
      () => new Promise((r) => { release = r; }) as never,
    );
    let p: Promise<void> = Promise.resolve();
    act(() => { p = hook.result.current.feed(); });
    ctx.geometry = [...U];
    await act(async () => {
      release({ ok: true, json: async () => ({ geometry: CONNECTOR, distanceMeters: 650 }) });
      await p;
    });
    expect(hook.result.current.offer).toBeNull();
  });

  it("clear() during a check drops its answer", async () => {
    const { doFetch, hook } = setup();
    let release: (v: unknown) => void = () => {};
    doFetch.mockImplementationOnce(
      () => new Promise((r) => { release = r; }) as never,
    );
    let p: Promise<void> = Promise.resolve();
    act(() => { p = hook.result.current.feed(); });
    act(() => hook.result.current.clear());
    await act(async () => {
      release({ ok: true, json: async () => ({ geometry: CONNECTOR, distanceMeters: 650 }) });
      await p;
    });
    expect(hook.result.current.offer).toBeNull();
  });

  it("is silent when the request fails", async () => {
    const { doFetch, hook, feed } = setup();
    doFetch.mockRejectedValueOnce(new Error("offline"));
    await feed();
    expect(hook.result.current.offer).toBeNull();
  });

  it("dismiss declines: no second request for the same stop", async () => {
    const { ctx, doFetch, hook, feed } = setup();
    await feed();
    act(() => hook.result.current.dismiss());
    ctx.atMs += 300_000;
    ctx.walkedM += 1_000;
    await feed();
    expect(doFetch).toHaveBeenCalledTimes(1);
  });

  it("accept rejects an offer older than 45 s on the wall clock, even with no new fix", async () => {
    const { onApply, hook, feed } = setup();
    await feed();
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now + 45_001);
    let ok = true;
    act(() => { ok = hook.result.current.accept(); });
    expect(ok).toBe(false);
    expect(onApply).not.toHaveBeenCalled();
    expect(hook.result.current.offer).toBeNull();
  });

  it("expire() withdraws a stale offer without a fix, and leaves a fresh one", async () => {
    const { hook, feed } = setup();
    await feed();
    act(() => hook.result.current.expire());
    expect(hook.result.current.offer).not.toBeNull();
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now + 45_001);
    act(() => hook.result.current.expire());
    expect(hook.result.current.offer).toBeNull();
  });

  it("an offer that lapsed while hidden is not a decline: the stop can be offered again", async () => {
    const { ctx, doFetch, hook, feed } = setup();
    await feed();
    ctx.atMs += 45_001; // lapses, never markShown()
    await feed();
    expect(hook.result.current.offer).toBeNull();
    ctx.atMs += 300_000;
    ctx.walkedM += 1_000;
    await feed();
    expect(doFetch).toHaveBeenCalledTimes(2);
  });

  it("a lapsed offer that was shown is a decline (expire path)", async () => {
    const { ctx, doFetch, hook, feed } = setup();
    await feed();
    act(() => hook.result.current.markShown());
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 45_001);
    act(() => hook.result.current.expire());
    ctx.atMs += 300_000;
    ctx.walkedM += 1_000;
    await feed();
    expect(doFetch).toHaveBeenCalledTimes(1);
  });

  it("does not look up a target while the cooldown/progress gate is closed", async () => {
    // No progress yet: a stop list that would throw proves shortcutTarget never ran.
    const trap = new Proxy([] as never[], {
      get() { throw new Error("target looked up"); },
    });
    const { doFetch, feed } = setup({ walkedM: 10, stops: trap });
    await feed();
    expect(doFetch).not.toHaveBeenCalled();
  });
});

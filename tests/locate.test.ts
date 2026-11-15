import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LAST_FIX_KEY, locate, type LocateFix, type LocateState } from "@/lib/geo/locate";

type Ok = (pos: GeolocationPosition) => void;
type Fail = (err: GeolocationPositionError) => void;

function pos(acc: number, lat = 32.08, lng = 34.77): GeolocationPosition {
  return {
    coords: { latitude: lat, longitude: lng, accuracy: acc, speed: null },
    timestamp: Date.now(),
  } as unknown as GeolocationPosition;
}
const err = (code: number) => ({ code, message: `e${code}`, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }) as GeolocationPositionError;

/** A fake `navigator.geolocation` the test drives by hand. */
function fakeGeo() {
  const quick: Array<{ ok: Ok; fail: Fail; opts: PositionOptions }> = [];
  const watches: Array<{ ok: Ok; fail: Fail; opts: PositionOptions }> = [];
  const geo = {
    getCurrentPosition: vi.fn((ok: Ok, fail: Fail, opts: PositionOptions) => void quick.push({ ok, fail, opts })),
    watchPosition: vi.fn((ok: Ok, fail: Fail, opts: PositionOptions) => watches.push({ ok, fail, opts })),
    clearWatch: vi.fn(),
  };
  vi.stubGlobal("navigator", { geolocation: geo });
  return { geo, quick, watches };
}

function run(purpose: "start" | "walk") {
  const fixes: LocateFix[] = [];
  const states: LocateState[] = [];
  const errors: number[] = [];
  const handle = locate({
    purpose,
    onUpdate: (f) => fixes.push(f),
    onState: (s) => states.push(s),
    onError: (e) => errors.push(e.code),
  });
  return { handle, fixes, states, errors };
}

beforeEach(() => {
  vi.useFakeTimers();
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("locate", () => {
  it("shows a fresh last fix at once, as coarse, for a start", () => {
    localStorage.setItem(LAST_FIX_KEY, JSON.stringify({ lat: 32.1, lng: 34.8, acc: 10, ts: Date.now() - 60_000 }));
    fakeGeo();
    const r = run("start");
    expect(r.fixes[0]).toMatchObject({ source: "cache", coordinates: { lat: 32.1, lng: 34.8 } });
    expect(r.states).toEqual(["searching", "coarse"]);
  });

  it("ignores a last fix older than 10 minutes, and never uses it for a walk", () => {
    localStorage.setItem(LAST_FIX_KEY, JSON.stringify({ lat: 32.1, lng: 34.8, acc: 10, ts: Date.now() - 11 * 60_000 }));
    fakeGeo();
    expect(run("start").fixes).toEqual([]);
    localStorage.setItem(LAST_FIX_KEY, JSON.stringify({ lat: 32.1, lng: 34.8, acc: 10, ts: Date.now() }));
    expect(run("walk").fixes).toEqual([]);
  });

  it("goes coarse then good, using a cheap quick fix and a high-accuracy watch together", () => {
    const { quick, watches } = fakeGeo();
    const r = run("start");
    expect(quick[0].opts).toMatchObject({ enableHighAccuracy: false, timeout: 4000, maximumAge: 120000 });
    expect(watches[0].opts).toMatchObject({ enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });

    quick[0].ok(pos(400));
    expect(r.states.at(-1)).toBe("coarse");
    watches[0].ok(pos(20));
    expect(r.states.at(-1)).toBe("good");
    expect(r.fixes.map((f) => f.accuracyMeters)).toEqual([400, 20]);
  });

  it("stops the watch once a start is good, but keeps it for a walk", () => {
    const start = fakeGeo();
    run("start");
    start.watches[0].ok(pos(20));
    expect(start.geo.clearWatch).toHaveBeenCalledTimes(1);

    const walk = fakeGeo();
    run("walk");
    walk.watches[0].ok(pos(20));
    expect(walk.geo.clearWatch).not.toHaveBeenCalled();
  });

  it("a walk gets every fix, so the tracker can decide", () => {
    const { watches } = fakeGeo();
    const r = run("walk");
    watches[0].ok(pos(300));
    watches[0].ok(pos(500));
    expect(r.fixes).toHaveLength(2);
  });

  it("retries the quick fix with backoff, at most 3 times, and keeps the watch alive", () => {
    const { geo, quick } = fakeGeo();
    run("walk");
    quick[0].fail(err(3));
    expect(geo.getCurrentPosition).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(3_000);
    quick[1].fail(err(3));
    vi.advanceTimersByTime(6_000);
    quick[2].fail(err(3));
    vi.advanceTimersByTime(12_000);
    quick[3].fail(err(3));
    vi.advanceTimersByTime(60_000);
    expect(geo.getCurrentPosition).toHaveBeenCalledTimes(4); // first + 3 retries
    expect(geo.clearWatch).not.toHaveBeenCalled();
  });

  it("reports a timeout to the UI only when there is still no fix after 12 s", () => {
    const { watches } = fakeGeo();
    const r = run("walk");
    watches[0].fail(err(3));
    vi.advanceTimersByTime(11_000);
    expect(r.states).toEqual(["searching"]);
    vi.advanceTimersByTime(1_500);
    expect(r.states.at(-1)).toBe("timeout");
    expect(r.errors).toEqual([3]);
  });

  it("does not report an error state when a fix did arrive", () => {
    const { watches } = fakeGeo();
    const r = run("walk");
    watches[0].fail(err(2));
    watches[0].ok(pos(30));
    vi.advanceTimersByTime(20_000);
    expect(r.states).not.toContain("unavailable");
  });

  it("goes denied at once, and resumes on visibilitychange when permission is back", async () => {
    const { geo, watches } = fakeGeo();
    let permission = "denied";
    (navigator as unknown as { permissions: unknown }).permissions = { query: async () => ({ state: permission }) };
    const doc = new EventTarget() as unknown as Document & { visibilityState: string };
    doc.visibilityState = "visible";
    vi.stubGlobal("document", doc);

    const r = run("start");
    watches[0].fail(err(1));
    expect(r.states.at(-1)).toBe("denied");

    doc.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(geo.watchPosition).toHaveBeenCalledTimes(1); // still blocked: no restart

    permission = "prompt";
    doc.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(geo.watchPosition).toHaveBeenCalledTimes(2);
    expect(r.states.at(-1)).toBe("searching");
  });

  it("falls back to the IP city for a start after 6 s of nothing, never for a walk", async () => {
    fakeGeo();
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ lat: 32.07, lng: 34.78, city: "Tel Aviv" }) }));
    vi.stubGlobal("fetch", fetchMock);

    const start = run("start");
    await vi.advanceTimersByTimeAsync(6_100);
    expect(fetchMock).toHaveBeenCalledWith("/api/geo/ip", expect.anything());
    expect(start.fixes[0]).toMatchObject({ source: "ip", city: "Tel Aviv" });
    expect(start.states.at(-1)).toBe("coarse");

    fetchMock.mockClear();
    const walk = run("walk");
    await vi.advanceTimersByTimeAsync(6_100);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(walk.fixes).toEqual([]);
  });

  it("does not use the IP city when a real fix has already answered", async () => {
    const { quick } = fakeGeo();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    run("start");
    quick[0].ok(pos(300));
    await vi.advanceTimersByTimeAsync(7_000);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says unavailable when the browser has no geolocation, and stop() clears the watch", () => {
    vi.stubGlobal("navigator", {});
    expect(run("start").states).toEqual(["unavailable"]);

    const { geo } = fakeGeo();
    const r = run("walk");
    r.handle.stop();
    expect(geo.clearWatch).toHaveBeenCalledTimes(1);
  });

  it("remembers a real fix for next time", () => {
    const { watches } = fakeGeo();
    run("start");
    watches[0].ok(pos(15, 32.5, 34.9));
    expect(JSON.parse(localStorage.getItem(LAST_FIX_KEY)!)).toMatchObject({ lat: 32.5, lng: 34.9, acc: 15 });
  });
});

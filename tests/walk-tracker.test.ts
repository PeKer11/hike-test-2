import { afterEach, describe, expect, it, vi } from "vitest";

import type { LocateState } from "@/lib/geo/locate";

import { WalkTracker, type PaceUpdateHandler } from "@/lib/walk/walk-tracker";

describe("WalkTracker", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports timeout errors without throwing", () => {
    const onUpdate = vi.fn();
    const onError = vi.fn();
    let errorCallback:
      | ((error: GeolocationPositionError) => void)
      | undefined;

    vi.stubGlobal("navigator", {
      geolocation: {
        watchPosition: vi.fn(
          (
            _success: (position: GeolocationPosition) => void,
            error?: (error: GeolocationPositionError) => void,
          ) => {
            errorCallback = error;
            return 1;
          },
        ),
        clearWatch: vi.fn(),
      },
    });

    const tracker = new WalkTracker(onUpdate, onError);
    tracker.start();

    expect(() =>
      errorCallback?.({
        code: 3,
        message: "Timeout expired",
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      } as GeolocationPositionError),
    ).not.toThrow();

    expect(onError).toHaveBeenCalledWith({
      code: 3,
      message: "Timeout expired",
      isTimeout: true,
    });
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("accepts reasonable mobile GPS accuracy updates", () => {
    const onUpdate = vi.fn();
    let successCallback:
      | ((position: GeolocationPosition) => void)
      | undefined;

    vi.stubGlobal("navigator", {
      geolocation: {
        watchPosition: vi.fn(
          (
            success: (position: GeolocationPosition) => void,
            _error?: (error: GeolocationPositionError) => void,
          ) => {
            successCallback = success;
            return 1;
          },
        ),
        clearWatch: vi.fn(),
      },
    });

    const tracker = new WalkTracker(onUpdate);
    tracker.start();

    successCallback?.({
      coords: {
        latitude: 31.7683,
        longitude: 35.2137,
        accuracy: 75,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
      toJSON: () => ({}),
    } as GeolocationPosition);

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate.mock.calls[0]?.[0]?.currentPosition).toEqual({
      lat: 31.7683,
      lng: 35.2137,
    });
  });

  describe("accuracy handling", () => {
    function startWith(onUpdate: PaceUpdateHandler, onState?: (state: LocateState) => void) {
      let success: ((position: GeolocationPosition) => void) | undefined;
      vi.stubGlobal("navigator", {
        geolocation: {
          watchPosition: vi.fn((ok: (position: GeolocationPosition) => void) => {
            success = ok;
            return 1;
          }),
          clearWatch: vi.fn(),
        },
      });
      const tracker = new WalkTracker(onUpdate, undefined, [], [], onState);
      tracker.start();
      return (accuracy: number, lat = 32.08, ts = Date.now()) =>
        success?.({
          coords: { latitude: lat, longitude: 34.77, accuracy, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
          timestamp: ts,
          toJSON: () => ({}),
        } as GeolocationPosition);
    }

    it("shows the very first fix even when coarse (300 m), with its accuracy, and no pace", () => {
      const onUpdate = vi.fn<PaceUpdateHandler>();
      const fix = startWith(onUpdate);
      fix(300);
      expect(onUpdate).toHaveBeenCalledTimes(1);
      expect(onUpdate.mock.calls[0][0]).toMatchObject({ accuracyMeters: 300, paceMinPerKm: null, bearing: undefined });
    });

    it("after that, drops fixes worse than 150 m but keeps 50-150 m ones for the dot", () => {
      const onUpdate = vi.fn<PaceUpdateHandler>();
      const fix = startWith(onUpdate);
      fix(300);
      fix(400); // dropped
      fix(120); // dot only
      expect(onUpdate.mock.calls.map((c) => c[0].accuracyMeters)).toEqual([300, 120]);
    });

    it("keeps poor fixes out of the pace samples: pace needs fixes within 50 m", () => {
      const onUpdate = vi.fn<PaceUpdateHandler>();
      const fix = startWith(onUpdate);
      const t = Date.now();
      fix(120, 32.08, t);
      fix(120, 32.0805, t + 10_000);
      fix(120, 32.081, t + 20_000);
      expect(onUpdate.mock.calls.every((c) => c[0].paceMinPerKm === null)).toBe(true);
      fix(30, 32.0815, t + 30_000);
      fix(30, 32.0816, t + 40_000);
      expect(onUpdate.mock.calls.at(-1)?.[0].paceMinPerKm).not.toBeNull();
    });

    it("passes the GPS lock-on state through", () => {
      const onState = vi.fn<(state: LocateState) => void>();
      const fix = startWith(vi.fn<PaceUpdateHandler>(), onState);
      expect(onState).toHaveBeenCalledWith("searching");
      fix(20);
      expect(onState).toHaveBeenLastCalledWith("good");
    });
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

import { WalkTracker } from "@/lib/walk/walk-tracker";

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
});

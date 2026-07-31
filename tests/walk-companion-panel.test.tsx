import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WalkCompanionPanel } from "@/components/route/WalkCompanionPanel";
import { DEFAULT_WALK_SETTINGS } from "@/lib/types/walk-settings";
import type { Coordinates } from "@/lib/types";

function renderPanel(suggestedOrigin: Coordinates | null) {
  return render(
    <WalkCompanionPanel
      isLoading={false}
      onBuildWalk={vi.fn()}
      walkSettings={DEFAULT_WALK_SETTINGS}
      onWalkSettingsChange={vi.fn()}
      suggestedOrigin={suggestedOrigin}
    />,
  );
}

function coordinateFields() {
  return {
    lat: screen.getByPlaceholderText("Latitude") as HTMLInputElement,
    lng: screen.getByPlaceholderText("Longitude") as HTMLInputElement,
  };
}

afterEach(cleanup);

describe("WalkCompanionPanel", () => {
  it("fills the coordinate fields from the area named in the prompt", () => {
    renderPanel({ lat: 32.5736, lng: 34.9522 });

    const { lat, lng } = coordinateFields();
    expect(lat.value).toBe("32.573600");
    expect(lng.value).toBe("34.952200");
  });

  it("leaves the coordinate fields empty when no area was located", () => {
    renderPanel(null);

    const { lat, lng } = coordinateFields();
    expect(lat.value).toBe("");
    expect(lng.value).toBe("");
  });

  it("keeps what the walker typed when the prompt resolves to the same area again", () => {
    const { rerender } = renderPanel({ lat: 32.5736, lng: 34.9522 });

    fireEvent.change(coordinateFields().lat, { target: { value: "31.7683" } });
    fireEvent.change(coordinateFields().lng, { target: { value: "35.2137" } });

    // A second extraction of the same place — a new object, same coordinates.
    rerender(
      <WalkCompanionPanel
        isLoading={false}
        onBuildWalk={vi.fn()}
        walkSettings={DEFAULT_WALK_SETTINGS}
        onWalkSettingsChange={vi.fn()}
        suggestedOrigin={{ lat: 32.5736, lng: 34.9522 }}
      />,
    );

    const { lat, lng } = coordinateFields();
    expect(lat.value).toBe("31.7683");
    expect(lng.value).toBe("35.2137");
  });
});

// A real GPS fix is where the walker IS; an area parsed out of a sentence is
// only where the sentence sounded like. The first must never be replaced by the
// second, whichever order they arrive in.
describe("WalkCompanionPanel — GPS outranks the prompt's area", () => {
  function mockGeolocation(coords: Coordinates) {
    const getCurrentPosition = vi.fn(
      (onSuccess: PositionCallback) => {
        onSuccess({
          coords: { latitude: coords.lat, longitude: coords.lng },
        } as GeolocationPosition);
      },
    );
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: { getCurrentPosition },
    });
    return getCurrentPosition;
  }

  function panel(suggestedOrigin: Coordinates | null) {
    return (
      <WalkCompanionPanel
        isLoading={false}
        onBuildWalk={vi.fn()}
        walkSettings={DEFAULT_WALK_SETTINGS}
        onWalkSettingsChange={vi.fn()}
        suggestedOrigin={suggestedOrigin}
      />
    );
  }

  function detect() {
    act(() => {
      fireEvent.click(screen.getByText("Use my current location"));
    });
  }

  afterEach(() => vi.unstubAllGlobals());

  it("keeps the detected position when the prompt later names somewhere else", () => {
    mockGeolocation({ lat: 32.0853, lng: 34.7818 });
    const { rerender } = render(panel(null));

    detect();
    rerender(panel({ lat: 31.7683, lng: 35.2137 }));

    const { lat, lng } = coordinateFields();
    expect(lat.value).toBe("32.085300");
    expect(lng.value).toBe("34.781800");
  });

  it("keeps the detected position even after the walker edits the fields by hand", () => {
    mockGeolocation({ lat: 32.0853, lng: 34.7818 });
    const { rerender } = render(panel(null));

    detect();
    // Typing coordinates is an explicit choice too — the lock is about free
    // text never outranking explicit input again, so it does not release here.
    fireEvent.change(coordinateFields().lat, { target: { value: "30.0000" } });
    rerender(panel({ lat: 31.7683, lng: 35.2137 }));

    const { lat, lng } = coordinateFields();
    expect(lat.value).toBe("30.0000");
    expect(lng.value).toBe("34.781800");
  });

  it("still fills from the prompt when the walker never detected a position", () => {
    const getCurrentPosition = mockGeolocation({ lat: 32.0853, lng: 34.7818 });
    const { rerender } = render(panel(null));

    rerender(panel({ lat: 31.7683, lng: 35.2137 }));

    expect(getCurrentPosition).not.toHaveBeenCalled();
    const { lat, lng } = coordinateFields();
    expect(lat.value).toBe("31.768300");
    expect(lng.value).toBe("35.213700");
  });

  it("does not lock the origin when the detection attempt fails", () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: {
        getCurrentPosition: (
          _onSuccess: PositionCallback,
          onError: PositionErrorCallback,
        ) => onError({} as GeolocationPositionError),
      },
    });
    const { rerender } = render(panel(null));

    detect();
    rerender(panel({ lat: 31.7683, lng: 35.2137 }));

    expect(coordinateFields().lat.value).toBe("31.768300");
  });
});

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WalkCompanionPanel } from "@/components/route/WalkCompanionPanel";
import { DEFAULT_WALK_SETTINGS } from "@/lib/types/walk-settings";
import type { AttractionCategory, Coordinates } from "@/lib/types";

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

// The walk form opens on what the signed-in walker's profile already knows —
// their measured pace and the kinds of stop they like — instead of asking again.
// Starting values, not locks: the walker's own taps win from then on.
describe("WalkCompanionPanel — saved profile pre-fills the form", () => {
  function profilePanel(
    suggestedPace: number | null,
    suggestedCategories: AttractionCategory[] | null,
  ) {
    return (
      <WalkCompanionPanel
        isLoading={false}
        onBuildWalk={vi.fn()}
        walkSettings={DEFAULT_WALK_SETTINGS}
        onWalkSettingsChange={vi.fn()}
        suggestedPace={suggestedPace}
        suggestedCategories={suggestedCategories}
      />
    );
  }

  // The selected pace and interest chips are the ones painted terra.
  function isSelected(label: string) {
    return screen.getByText(label).className.includes("border-terra");
  }

  it("selects the saved pace and ticks the saved interests", () => {
    render(profilePanel(20, ["museum", "park"]));

    expect(isSelected("Slow (20 min/km)")).toBe(true);
    expect(isSelected("Museums")).toBe(true);
    expect(isSelected("Parks")).toBe(true);
    expect(isSelected("Landmarks")).toBe(false);
  });

  // The profile records a pace measured off real walks; the picker offers three.
  it("snaps a measured pace to the nearest offered one", () => {
    render(profilePanel(12.8, null));

    expect(isSelected("Brisk (12 min/km)")).toBe(true);
    expect(isSelected("Normal (15 min/km)")).toBe(false);
  });

  it("keeps the pace the walker tapped when the same profile arrives again", () => {
    const { rerender } = render(profilePanel(20, null));

    fireEvent.click(screen.getByText("Brisk (12 min/km)"));
    rerender(profilePanel(20, null));

    expect(isSelected("Brisk (12 min/km)")).toBe(true);
    expect(isSelected("Slow (20 min/km)")).toBe(false);
  });

  it("keeps an interest the walker unticked when the same profile arrives again", () => {
    const { rerender } = render(profilePanel(null, ["museum", "park"]));

    fireEvent.click(screen.getByText("Museums"));
    // A fresh array with the same contents — what a re-render of the page above
    // hands down every time.
    rerender(profilePanel(null, ["museum", "park"]));

    expect(isSelected("Museums")).toBe(false);
    expect(isSelected("Parks")).toBe(true);
  });

  it("passes the pre-filled pace and interests into the walk it builds", () => {
    const onBuildWalk = vi.fn();
    render(
      <WalkCompanionPanel
        isLoading={false}
        onBuildWalk={onBuildWalk}
        walkSettings={DEFAULT_WALK_SETTINGS}
        onWalkSettingsChange={vi.fn()}
        suggestedOrigin={{ lat: 32.0853, lng: 34.7818 }}
        suggestedPace={20}
        suggestedCategories={["museum"]}
      />,
    );

    fireEvent.click(screen.getByText("Build My Walk"));

    expect(onBuildWalk).toHaveBeenCalledWith(
      expect.objectContaining({
        walkingPaceMinPerKm: 20,
        preferredCategories: ["museum"],
      }),
    );
  });

  // A logged-out visitor, or one whose profile has never recorded anything.
  it("opens on its own defaults when nothing is saved", () => {
    const onBuildWalk = vi.fn();
    render(
      <WalkCompanionPanel
        isLoading={false}
        onBuildWalk={onBuildWalk}
        walkSettings={DEFAULT_WALK_SETTINGS}
        onWalkSettingsChange={vi.fn()}
        suggestedOrigin={{ lat: 32.0853, lng: 34.7818 }}
        suggestedPace={null}
        suggestedCategories={[]}
      />,
    );

    expect(isSelected("Normal (15 min/km)")).toBe(true);
    expect(isSelected("Museums")).toBe(false);

    fireEvent.click(screen.getByText("Build My Walk"));

    expect(onBuildWalk).toHaveBeenCalledWith(
      expect.objectContaining({
        walkingPaceMinPerKm: 15,
        preferredCategories: undefined,
      }),
    );
  });

  // The props did not exist until the profile read landed — every other caller
  // and every earlier walk must behave exactly as before when they are absent.
  it("behaves identically when the props are not passed at all", () => {
    render(
      <WalkCompanionPanel
        isLoading={false}
        onBuildWalk={vi.fn()}
        walkSettings={DEFAULT_WALK_SETTINGS}
        onWalkSettingsChange={vi.fn()}
      />,
    );

    expect(isSelected("Normal (15 min/km)")).toBe(true);
    expect(isSelected("Parks")).toBe(false);
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

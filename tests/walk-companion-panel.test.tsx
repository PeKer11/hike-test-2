import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PlacePromptPanel } from "@/components/route/PlacePromptPanel";
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

// The prompt box and the walk form are siblings under `WalkPlannerApp`, wired
// through it: PlacePromptPanel fires `onMaxEndDistanceDetected`, the app holds
// the number, and WalkCompanionPanel takes it as `suggestedMaxEndDistanceKm`.
// This harness reproduces exactly that wiring so the round trip is tested, not
// each half's own prop contract.
function PromptToFormHarness() {
  const [maxEndDistanceKm, setMaxEndDistanceKm] = useState<number | null>(null);
  // Wired too, so a prompt that states only a walk length has somewhere to land
  // and the blank max-distance field is a real negative rather than a no-op.
  const [minutes, setMinutes] = useState<number | null>(null);
  // The other half of the same sentence: how far out to look for stops, which
  // lands in the search-radius field rather than the max-distance one.
  const [searchRadiusKm, setSearchRadiusKm] = useState<number | null>(null);

  return (
    <>
      <PlacePromptPanel
        nearLocation={null}
        acceptedAttractions={null}
        onAcceptAttractions={vi.fn()}
        onPreview={vi.fn()}
        onFoundPlacesChange={vi.fn()}
        onDurationDetected={setMinutes}
        onMaxEndDistanceDetected={setMaxEndDistanceKm}
        onSearchRadiusDetected={setSearchRadiusKm}
      />
      <WalkCompanionPanel
        isLoading={false}
        onBuildWalk={vi.fn()}
        walkSettings={DEFAULT_WALK_SETTINGS}
        onWalkSettingsChange={vi.fn()}
        suggestedMinutes={minutes}
        suggestedMaxEndDistanceKm={maxEndDistanceKm}
        suggestedSearchRadiusKm={searchRadiusKm}
      />
    </>
  );
}

function promptBox() {
  return screen.getByPlaceholderText(
    "I want to see Habima Square, the Jaffa port, and a good market",
  );
}

// The search-radius input carries no placeholder and its label is not bound to
// it, so it is found by the bounds that make it that field.
function searchRadiusField() {
  return document.querySelector(
    'input[min="0.5"][max="10"]',
  ) as HTMLInputElement;
}

function endDistanceField() {
  return screen.getByPlaceholderText("Any") as HTMLInputElement;
}

async function submitPrompt(text: string, response: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ attractions: [], unresolvedNames: [], ...response }),
    })),
  );

  render(<PromptToFormHarness />);

  fireEvent.change(promptBox(), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Find these places" }));
  await waitFor(() => expect(fetch).toHaveBeenCalled());
}

describe("a finish distance stated in the prompt", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fills the max-distance field from a distance the prompt stated", async () => {
    await submitPrompt("finish within 1km of here", { maxEndDistanceKm: 1 });

    await waitFor(() => expect(endDistanceField().value).toBe("1"));
  });

  it("fills it with half a kilometre from a 500m request", async () => {
    await submitPrompt('תחזיר אותי עד חצי ק"מ ממה שהתחלתי', {
      maxEndDistanceKm: 0.5,
    });

    await waitFor(() => expect(endDistanceField().value).toBe("0.5"));
  });

  it("leaves the field blank when the prompt stated no finish distance", async () => {
    await submitPrompt("I have three hours in Tel Aviv", {
      durationMinutes: 180,
      maxEndDistanceKm: null,
    });

    await waitFor(() =>
      expect(screen.getByDisplayValue("180")).toBeInstanceOf(
        HTMLInputElement,
      ),
    );
    expect(endDistanceField().value).toBe("");
  });

  it("overwrites a distance the walker typed, as a starting value not a lock", async () => {
    // Same convention as the time field: a newly detected value wins, because
    // the prompt is the walker speaking too, and more recently.
    const responses = [{ maxEndDistanceKm: 1 }, { maxEndDistanceKm: 0.5 }];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          attractions: [],
          unresolvedNames: [],
          ...responses.shift(),
        }),
      })),
    );

    render(<PromptToFormHarness />);
    fireEvent.change(promptBox(), {
      target: { value: "finish within 1km of here" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Find these places" }));
    await waitFor(() => expect(endDistanceField().value).toBe("1"));

    fireEvent.change(endDistanceField(), { target: { value: "3" } });
    expect(endDistanceField().value).toBe("3");

    fireEvent.change(promptBox(), {
      target: { value: "actually keep it within 500m of my start" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Find these places" }));

    await waitFor(() => expect(endDistanceField().value).toBe("0.5"));
  });
});


describe("a search radius stated in the prompt", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fills the search-radius field from a distance the prompt stated", async () => {
    await submitPrompt("search up to 10km from here", { searchRadiusKm: 10 });

    await waitFor(() => expect(searchRadiusField().value).toBe("10"));
  });

  it("fills it from the Hebrew phrasing for an origin-relative search distance", async () => {
    await submitPrompt('מאיפה שאני נמצא עכשיו עד 5 ק"מ', {
      searchRadiusKm: 5,
    });

    await waitFor(() => expect(searchRadiusField().value).toBe("5"));
  });

  it("leaves the radius at its default when the prompt stated only a finish distance", async () => {
    await submitPrompt("finish within 1km of here", {
      maxEndDistanceKm: 1,
      searchRadiusKm: null,
    });

    await waitFor(() => expect(endDistanceField().value).toBe("1"));
    expect(searchRadiusField().value).toBe("2");
  });

  it("fills both fields from one prompt that states both distances", async () => {
    // Ariel's live test case, which set the finish distance and silently
    // dropped the search distance before this field was wired up.
    await submitPrompt(
      'אני רוצה טיול בזכרון יעקב בגן טייל ולאכול משהו, להתחיל מאיפה שאני נמצא עכשיו עד 10 ק"מ, לסיים עד 1 ק"מ מאיפה שאני נמצא עכשיו',
      { searchRadiusKm: 10, maxEndDistanceKm: 1 },
    );

    await waitFor(() => expect(searchRadiusField().value).toBe("10"));
    expect(endDistanceField().value).toBe("1");
  });

  it("overwrites a radius the walker typed, as a starting value not a lock", async () => {
    const responses = [{ searchRadiusKm: 10 }, { searchRadiusKm: 3 }];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          attractions: [],
          unresolvedNames: [],
          ...responses.shift(),
        }),
      })),
    );

    render(<PromptToFormHarness />);
    fireEvent.change(promptBox(), {
      target: { value: "search up to 10km from here" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Find these places" }));
    await waitFor(() => expect(searchRadiusField().value).toBe("10"));

    fireEvent.change(searchRadiusField(), { target: { value: "1" } });
    expect(searchRadiusField().value).toBe("1");

    fireEvent.change(promptBox(), {
      target: { value: "actually look within 3km of my start" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Find these places" }));

    await waitFor(() => expect(searchRadiusField().value).toBe("3"));
  });
});

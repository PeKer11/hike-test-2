import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

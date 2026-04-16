import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HikeSearchPanel } from "@/components/route/HikeSearchPanel";

function renderPanel(
  onFindHike = vi.fn(),
  overrides?: {
    originLatValue?: string;
    originLngValue?: string;
    useMapClickForOrigin?: boolean;
    onUseMapClickForOriginChange?: (next: boolean) => void;
  },
) {
  function PanelHarness() {
    const [origin, setOrigin] = useState({
      lat: overrides?.originLatValue ?? "",
      lng: overrides?.originLngValue ?? "",
    });

    return (
      <HikeSearchPanel
        isSearching={false}
        originLatValue={origin.lat}
        originLngValue={origin.lng}
        onOriginInputChange={setOrigin}
        useMapClickForOrigin={overrides?.useMapClickForOrigin ?? false}
        onUseMapClickForOriginChange={
          overrides?.onUseMapClickForOriginChange ?? vi.fn()
        }
        onFindHike={onFindHike}
      />
    );
  }

  return render(
    <PanelHarness />,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("HikeSearchPanel validation", () => {
  it("fills origin coordinates from device location", () => {
    const mockGetCurrentPosition = vi.fn(
      (success: (position: { coords: { latitude: number; longitude: number } }) => void) => {
        success({
          coords: {
            latitude: 31.768321,
            longitude: 35.213745,
          },
        });
      },
    );
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: mockGetCurrentPosition,
      },
    });

    const onFindHike = vi.fn();
    renderPanel(onFindHike);

    fireEvent.click(screen.getByText("Use my current location"));

    expect(mockGetCurrentPosition).toHaveBeenCalledTimes(1);
    expect((screen.getByPlaceholderText("Origin lat") as HTMLInputElement).value).toBe(
      "31.768321",
    );
    expect((screen.getByPlaceholderText("Origin lng") as HTMLInputElement).value).toBe(
      "35.213745",
    );
  });

  it("rejects out-of-range latitude/longitude", () => {
    const onFindHike = vi.fn();
    renderPanel(onFindHike);

    fireEvent.change(screen.getByPlaceholderText("Origin lat"), {
      target: { value: "999" },
    });
    fireEvent.change(screen.getByPlaceholderText("Origin lng"), {
      target: { value: "999" },
    });

    fireEvent.click(screen.getByText("Find Best Hike"));

    expect(screen.getByText("Latitude must be between -90 and 90.")).toBeTruthy();
    expect(screen.getByText("Longitude must be between -180 and 180.")).toBeTruthy();
    expect(onFindHike).not.toHaveBeenCalled();
  });

  it("rejects partial endpoint input", () => {
    const onFindHike = vi.fn();
    renderPanel(onFindHike, {
      originLatValue: "31.7683",
      originLngValue: "35.2137",
    });

    fireEvent.change(screen.getByPlaceholderText("Endpoint lat (optional)"), {
      target: { value: "31.7" },
    });

    fireEvent.click(screen.getByText("Find Best Hike"));

    expect(screen.getByText("Endpoint longitude is required.")).toBeTruthy();
    expect(onFindHike).not.toHaveBeenCalled();
  });

  it("rejects non-positive max distance", () => {
    const onFindHike = vi.fn();
    renderPanel(onFindHike, {
      originLatValue: "31.7683",
      originLngValue: "35.2137",
    });

    fireEvent.change(screen.getByPlaceholderText("Max distance km (optional)"), {
      target: { value: "0" },
    });

    fireEvent.click(screen.getByText("Find Best Hike"));

    expect(screen.getByText("Max distance must be greater than 0.")).toBeTruthy();
    expect(onFindHike).not.toHaveBeenCalled();
  });

  it("rejects non-positive max start distance", () => {
    const onFindHike = vi.fn();
    renderPanel(onFindHike, {
      originLatValue: "31.7683",
      originLngValue: "35.2137",
    });

    fireEvent.change(screen.getByPlaceholderText("Max start distance km (optional)"), {
      target: { value: "0" },
    });

    fireEvent.click(screen.getByText("Find Best Hike"));

    expect(screen.getByText("Max start distance must be greater than 0.")).toBeTruthy();
    expect(onFindHike).not.toHaveBeenCalled();
  });

  it("rejects invalid nearby route count", () => {
    const onFindHike = vi.fn();
    renderPanel(onFindHike, {
      originLatValue: "31.7683",
      originLngValue: "35.2137",
    });

    fireEvent.change(screen.getByPlaceholderText("Nearby route count (default 1)"), {
      target: { value: "0" },
    });

    fireEvent.click(screen.getByText("Find Best Hike"));

    expect(screen.getByText("Nearby route count must be at least 1.")).toBeTruthy();
    expect(onFindHike).not.toHaveBeenCalled();
  });

  it("rejects non-positive max finish distance", () => {
    const onFindHike = vi.fn();
    renderPanel(onFindHike, {
      originLatValue: "31.7683",
      originLngValue: "35.2137",
    });

    fireEvent.change(
      screen.getByPlaceholderText("Max finish distance from origin km (optional)"),
      {
        target: { value: "0" },
      },
    );

    fireEvent.click(screen.getByText("Find Best Hike"));

    expect(screen.getByText("Max finish distance must be greater than 0.")).toBeTruthy();
    expect(onFindHike).not.toHaveBeenCalled();
  });

  it("accepts valid coordinates and submits", () => {
    const onFindHike = vi.fn();
    renderPanel(onFindHike);

    fireEvent.change(screen.getByPlaceholderText("Origin lat"), {
      target: { value: "31.7683" },
    });
    fireEvent.change(screen.getByPlaceholderText("Origin lng"), {
      target: { value: "35.2137" },
    });
    fireEvent.change(screen.getByPlaceholderText("Endpoint lat (optional)"), {
      target: { value: "31.77" },
    });
    fireEvent.change(screen.getByPlaceholderText("Endpoint lng (optional)"), {
      target: { value: "35.22" },
    });
    fireEvent.change(screen.getByPlaceholderText("Max distance km (optional)"), {
      target: { value: "10" },
    });
    fireEvent.change(screen.getByPlaceholderText("Max start distance km (optional)"), {
      target: { value: "2" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("Max finish distance from origin km (optional)"),
      {
        target: { value: "4" },
      },
    );
    fireEvent.change(screen.getByPlaceholderText("Nearby route count (default 1)"), {
      target: { value: "3" },
    });

    fireEvent.click(screen.getByText("Find Best Hike"));

    expect(onFindHike).toHaveBeenCalledTimes(1);
    expect(onFindHike).toHaveBeenCalledWith(
      expect.objectContaining({
        maxStartDistanceKm: 2,
        maxFinishDistanceFromOriginKm: 4,
        desiredRouteCount: 3,
      }),
    );
  });

  it("toggles map-click-origin mode", () => {
    const onUseMapClickForOriginChange = vi.fn();
    renderPanel(vi.fn(), {
      useMapClickForOrigin: false,
      onUseMapClickForOriginChange,
    });

    fireEvent.click(screen.getByRole("button", { name: "Map click sets origin" }));

    expect(onUseMapClickForOriginChange).toHaveBeenCalledWith(true);
  });
});

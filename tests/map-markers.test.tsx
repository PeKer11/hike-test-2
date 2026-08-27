import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ReactNode } from "react";

// react-leaflet is the one thing here that cannot run: its components need a
// live Leaflet map in the React context, which jsdom has no viewport for. The
// stand-ins render the marker as a button carrying the icon's own HTML, so
// everything actually asserted below — which icon a marker gets, and what a tap
// on it does — is still MapMarkers' own output rather than a mock's.
vi.mock("react-leaflet", () => ({
  Marker: ({
    icon,
    eventHandlers,
    children,
  }: {
    icon: { options: { html: string } };
    eventHandlers?: { click?: () => void };
    children?: ReactNode;
  }) => (
    <button
      type="button"
      data-testid="marker"
      data-icon={icon.options.html}
      onClick={() => eventHandlers?.click?.()}
    >
      {children}
    </button>
  ),
  Popup: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

const { MapMarkers, markerIconHtml, PIN_RING_COLOR } = await import(
  "@/components/map/MapMarkers"
);

function waypoint(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `Stop ${id}`,
    coordinates: { lat: 32.08, lng: 34.78 },
    required: true,
    isStart: false,
    isEnd: false,
    ...overrides,
  };
}

const stops = [
  waypoint("w1", { isStart: true }),
  waypoint("w2"),
  waypoint("w3"),
  waypoint("w4", { isEnd: true }),
];

afterEach(cleanup);

describe("markerIconHtml", () => {
  it("rings a pinned marker and leaves an unpinned one with the hairline outline", () => {
    expect(markerIconHtml("2", "#2563eb", true)).toContain(
      `box-shadow:0 0 0 3px ${PIN_RING_COLOR}`,
    );
    expect(markerIconHtml("2", "#2563eb", false)).toContain(
      "box-shadow:0 0 0 1px rgba(0,0,0,0.15)",
    );
  });

  it("keeps the stop's own colour and number when it is pinned", () => {
    const pinned = markerIconHtml("3", "#2563eb", true);

    expect(pinned).toContain("background:#2563eb");
    expect(pinned).toContain(">3<");
  });

  it("does not paint a pinned stop the start marker's red", () => {
    // The "red dot" this feature was sketched as would have been unreadable
    // against the start marker, which is already #dc2626.
    expect(markerIconHtml("3", "#2563eb", true)).not.toContain(
      "background:#dc2626",
    );
  });
});

describe("MapMarkers pinning", () => {
  it("rings every pinned stop and no others", () => {
    render(<MapMarkers waypoints={stops} pinnedIds={["w2", "w4"]} onTogglePin={vi.fn()} />);

    const ringed = screen
      .getAllByTestId("marker")
      .map((el) => el.getAttribute("data-icon") ?? "")
      .map((html) => html.includes(PIN_RING_COLOR));

    expect(ringed).toEqual([false, true, false, true]);
  });

  it("reports the tapped stop's id so the same toggle the list uses can run", () => {
    const onTogglePin = vi.fn();
    render(<MapMarkers waypoints={stops} pinnedIds={[]} onTogglePin={onTogglePin} />);

    fireEvent.click(screen.getAllByTestId("marker")[2]);

    expect(onTogglePin).toHaveBeenCalledWith("w3");
  });

  it("reports the id again when an already-pinned stop is tapped, so a second tap unpins", () => {
    const onTogglePin = vi.fn();
    render(<MapMarkers waypoints={stops} pinnedIds={["w3"]} onTogglePin={onTogglePin} />);

    fireEvent.click(screen.getAllByTestId("marker")[2]);

    expect(onTogglePin).toHaveBeenCalledWith("w3");
  });

  it("says which way the pin went, so a tap on a divIcon is not silent", () => {
    render(<MapMarkers waypoints={stops} pinnedIds={["w3"]} onTogglePin={vi.fn()} />);

    expect(screen.getByText(/Pinned — kept when the walk is rebuilt/)).toBeTruthy();
    expect(screen.getAllByText(/Tap to pin/)).toHaveLength(3);
  });

  it("offers no pinning at all when the map is not showing a walk's own stops", () => {
    render(<MapMarkers waypoints={stops} />);

    expect(screen.queryByText(/Tap to pin/)).toBeNull();
    for (const marker of screen.getAllByTestId("marker")) {
      expect(marker.getAttribute("data-icon")).not.toContain(PIN_RING_COLOR);
    }
  });

  it("leaves an unpinnable marker's tap inert rather than throwing", () => {
    render(<MapMarkers waypoints={stops} />);

    expect(() => fireEvent.click(screen.getAllByTestId("marker")[1])).not.toThrow();
  });
});

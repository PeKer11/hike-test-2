import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The Google map itself cannot run in jsdom. The stand-in AdvancedMarker hands back the props the real one was given.
const { fakeMap, fakeMaps, circles } = vi.hoisted(() => {
  const circles: { setCenter: ReturnType<typeof vi.fn>; setRadius: ReturnType<typeof vi.fn>; setMap: ReturnType<typeof vi.fn> }[] = [];
  class Circle {
    setCenter = vi.fn();
    setRadius = vi.fn();
    setMap = vi.fn();
    constructor() {
      circles.push(this);
    }
  }
  return { fakeMap: { id: "map" }, fakeMaps: { Circle }, circles };
});

vi.mock("@vis.gl/react-google-maps", () => ({
  AdvancedMarker: ({ children, anchorLeft, anchorTop, anchorPoint }: { children: React.ReactNode; anchorLeft?: string; anchorTop?: string; anchorPoint?: unknown }) => (
    <div data-testid="advanced-marker" data-anchor-left={anchorLeft} data-anchor-top={anchorTop} data-anchor-point={anchorPoint ? "set" : undefined}>
      {children}
    </div>
  ),
  InfoWindow: () => null,
  useMap: () => fakeMap,
  useMapsLibrary: () => fakeMaps,
}));

const { GoogleCurrentPosition } = await import("@/components/map/GoogleMarkers");

afterEach(() => {
  cleanup();
  circles.length = 0;
});

describe("GoogleCurrentPosition", () => {
  it("centres the dot on the fix: an AdvancedMarker anchors at the bottom middle of its content by default", () => {
    render(<GoogleCurrentPosition position={{ lat: 32.08, lng: 34.78 }} headingDeg={90} />);
    const marker = screen.getByTestId("advanced-marker");
    expect(marker.getAttribute("data-anchor-left")).toBe("-50%");
    expect(marker.getAttribute("data-anchor-top")).toBe("-50%");
  });

  it("draws the same walker marker as the Leaflet map, beam included, once there is a heading", () => {
    const { rerender } = render(<GoogleCurrentPosition position={{ lat: 32.08, lng: 34.78 }} headingDeg={90} />);
    expect(document.querySelector("[data-testid=walker-beam]")).not.toBeNull();
    rerender(<GoogleCurrentPosition position={{ lat: 32.08, lng: 34.78 }} headingDeg={null} />);
    expect(document.querySelector("[data-testid=walker-marker]")).not.toBeNull();
    expect(document.querySelector("[data-testid=walker-beam]")).toBeNull();
  });

  it("creates the accuracy halo once and moves it with setCenter/setRadius across 5 fixes", () => {
    const at = (i: number) => ({ lat: 32.08 + i * 1e-5, lng: 34.78 });
    const { rerender, unmount } = render(<GoogleCurrentPosition position={at(0)} accuracyM={20} />);
    for (let i = 1; i < 5; i++) rerender(<GoogleCurrentPosition position={at(i)} accuracyM={20 + i} />);
    expect(circles).toHaveLength(1);
    expect(circles[0].setCenter).toHaveBeenLastCalledWith(at(4));
    expect(circles[0].setRadius).toHaveBeenLastCalledWith(24);
    unmount();
    expect(circles[0].setMap).toHaveBeenCalledWith(null);
  });

  it("draws no halo for a good fix (10 m or better), and adds one when the fix gets worse", () => {
    const pos = { lat: 32.08, lng: 34.78 };
    const { rerender } = render(<GoogleCurrentPosition position={pos} accuracyM={8} />);
    expect(circles).toHaveLength(0);
    rerender(<GoogleCurrentPosition position={pos} accuracyM={30} />);
    expect(circles).toHaveLength(1);
    rerender(<GoogleCurrentPosition position={pos} accuracyM={5} />);
    expect(circles[0].setMap).toHaveBeenCalledWith(null);
  });
});

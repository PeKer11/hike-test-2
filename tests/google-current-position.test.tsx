import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The Google map itself cannot run in jsdom. The stand-in AdvancedMarker hands back the props the real one was given.
vi.mock("@vis.gl/react-google-maps", () => ({
  AdvancedMarker: ({ children, anchorLeft, anchorTop, anchorPoint }: { children: React.ReactNode; anchorLeft?: string; anchorTop?: string; anchorPoint?: unknown }) => (
    <div data-testid="advanced-marker" data-anchor-left={anchorLeft} data-anchor-top={anchorTop} data-anchor-point={anchorPoint ? "set" : undefined}>
      {children}
    </div>
  ),
  InfoWindow: () => null,
  useMap: () => null,
  useMapsLibrary: () => null,
}));

const { GoogleCurrentPosition } = await import("@/components/map/GoogleMarkers");

afterEach(cleanup);

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
});

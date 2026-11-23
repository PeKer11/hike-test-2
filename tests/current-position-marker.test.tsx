import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// react-leaflet needs a live Leaflet map in context, which jsdom cannot give. The stand-ins hand back what the real
// components were given (the icon's own HTML, the halo's radius and colours), so what is asserted is still
// CurrentPositionMarker's own output.
vi.mock("react-leaflet", () => ({
  Marker: ({ icon }: { icon: { options: { html: string; iconSize: number[]; iconAnchor: number[] } } }) => (
    <div data-testid="leaflet-marker" data-size={icon.options.iconSize.join("x")} data-anchor={icon.options.iconAnchor.join(",")} dangerouslySetInnerHTML={{ __html: icon.options.html }} />
  ),
  Circle: ({ radius, pathOptions }: { radius: number; pathOptions: { color: string; fillColor: string } }) => (
    <div data-testid="halo" data-radius={radius} data-color={pathOptions.color} data-fill={pathOptions.fillColor} />
  ),
}));

const { CurrentPositionMarker } = await import("@/components/map/CurrentPositionMarker");
const { WALKER_BOX_PX } = await import("@/components/map/WalkerMarker");

afterEach(cleanup);
const POSITION = { lat: 32.08, lng: 34.78 };
const beam = () => document.querySelector("[data-testid=walker-beam]");
const turn = () => /rotate\((-?[\d.]+)deg\)/.exec(beam()?.getAttribute("style") ?? "")?.[1];

describe("CurrentPositionMarker (Leaflet)", () => {
  it("draws the beam with the right rotation when the walker has a heading", () => {
    render(<CurrentPositionMarker position={POSITION} headingDeg={212.4} />);
    expect(beam()).not.toBeNull();
    expect(turn()).toBe("212"); // rebuilt only per whole degree
    expect(document.querySelector("[data-testid=walker-marker]")!.getAttribute("data-heading")).toBe("212");
  });

  it("draws no beam without a heading (undefined, null or not a number)", () => {
    for (const headingDeg of [undefined, null, Number.NaN]) {
      render(<CurrentPositionMarker position={POSITION} headingDeg={headingDeg} />);
      expect(beam()).toBeNull();
      expect(document.querySelector("[data-testid=walker-marker]")).not.toBeNull(); // the dot itself is always there
      cleanup();
    }
  });

  it("turns the beam with the heading, and the accuracy halo is untouched by it", () => {
    const { rerender } = render(<CurrentPositionMarker position={POSITION} headingDeg={212.4} />);
    expect(beam()).not.toBeNull();
    rerender(<CurrentPositionMarker position={POSITION} accuracyM={20} headingDeg={undefined} />);
    expect(beam()).toBeNull();
    expect(screen.getByTestId("halo")).toBeTruthy();
  });

  it("centres the dot on the position: the marker box is anchored at its middle", () => {
    render(<CurrentPositionMarker position={POSITION} headingDeg={0} />);
    expect(screen.getByTestId("leaflet-marker").getAttribute("data-size")).toBe(`${WALKER_BOX_PX}x${WALKER_BOX_PX}`);
    expect(screen.getByTestId("leaflet-marker").getAttribute("data-anchor")).toBe(`${WALKER_BOX_PX / 2},${WALKER_BOX_PX / 2}`);
  });

  it("recolours the accuracy halo to leather, not the old blue", () => {
    render(<CurrentPositionMarker position={POSITION} accuracyM={18} headingDeg={90} />);
    const halo = screen.getByTestId("halo");
    expect(halo.getAttribute("data-radius")).toBe("18");
    expect(halo.getAttribute("data-color")).toBe("#d2602f");
    expect(halo.getAttribute("data-fill")).toBe("#d2602f");
  });

  it("shows no halo without an accuracy", () => {
    render(<CurrentPositionMarker position={POSITION} headingDeg={90} />);
    expect(screen.queryByTestId("halo")).toBeNull();
  });
});

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { fakeMap, fakeMaps, lines } = vi.hoisted(() => {
  const lines: { opts: Record<string, unknown>; setPath: ReturnType<typeof vi.fn>; setOptions: ReturnType<typeof vi.fn>; setMap: ReturnType<typeof vi.fn> }[] = [];
  class Polyline {
    setPath = vi.fn();
    setOptions = vi.fn();
    setMap = vi.fn();
    constructor(public opts: Record<string, unknown>) {
      lines.push(this);
    }
  }
  return { fakeMap: { id: "map" }, fakeMaps: { Polyline }, lines };
});

vi.mock("@vis.gl/react-google-maps", () => ({
  useMap: () => fakeMap,
  useMapsLibrary: () => fakeMaps,
}));

const { Line } = await import("@/components/map/GoogleMapView");

afterEach(() => {
  cleanup();
  lines.length = 0;
  vi.unstubAllGlobals();
});

const path = (n: number) => Array.from({ length: n }, (_, i) => ({ lat: 32 + i * 1e-4, lng: 34.8 }));

describe("Line (a google.maps.Polyline)", () => {
  it("builds one Polyline and updates it with setPath across 10 renders", () => {
    const { rerender, unmount } = render(<Line path={path(2)} color="#f6b81c" weight={4} opacity={0.8} zIndex={1} />);
    for (let n = 3; n <= 11; n++) rerender(<Line path={path(n)} color="#f6b81c" weight={4} opacity={0.8} zIndex={1} />);
    expect(lines).toHaveLength(1);
    expect(lines[0].setPath).toHaveBeenLastCalledWith(path(11));
    expect(lines[0].setMap).not.toHaveBeenCalled();
    unmount();
    expect(lines[0].setMap).toHaveBeenCalledWith(null);
  });

  it("does not touch the polyline for a re-render with the same path and style", () => {
    const p = path(5);
    const { rerender } = render(<Line path={p} color="#f6b81c" weight={4} opacity={0.8} zIndex={1} />);
    const sets = lines[0].setPath.mock.calls.length;
    const opts = lines[0].setOptions.mock.calls.length;
    rerender(<Line path={p} color="#f6b81c" weight={4} opacity={0.8} zIndex={1} />);
    expect(lines).toHaveLength(1);
    expect(lines[0].setPath.mock.calls.length).toBe(sets);
    expect(lines[0].setOptions.mock.calls.length).toBe(opts);
  });

  it("applies a style change with setOptions, without rebuilding", () => {
    const p = path(5);
    const { rerender } = render(<Line path={p} color="#f6b81c" weight={4} opacity={0.8} zIndex={1} />);
    rerender(<Line path={p} color="#7fc4a0" weight={5} opacity={0.6} zIndex={2} />);
    expect(lines).toHaveLength(1);
    expect(lines[0].setOptions).toHaveBeenLastCalledWith(expect.objectContaining({ strokeColor: "#7fc4a0", strokeWeight: 5, strokeOpacity: 0.6, zIndex: 2 }));
  });

  it("a dashed line is a transparent stroke with a dash symbol, and rebuilds only when dashed or arrows change", () => {
    vi.stubGlobal("google", { maps: { SymbolPath: { FORWARD_CLOSED_ARROW: 1 } } });
    const p = path(5);
    const { rerender } = render(<Line path={p} color="#1e3d2f" weight={3} opacity={0.5} zIndex={3} dashed arrows />);
    expect(lines[0].opts).toMatchObject({ strokeOpacity: 0, strokeWeight: 0 });
    expect((lines[0].opts.icons as unknown[]).length).toBe(2); // dash + arrows
    rerender(<Line path={p} color="#1e3d2f" weight={3} opacity={0.5} zIndex={3} dashed />);
    expect(lines).toHaveLength(2);
    expect(lines[0].setMap).toHaveBeenCalledWith(null);
  });

  it("draws the route's direction arrows as before: a white arrow outlined in the route colour, every 160 px", () => {
    vi.stubGlobal("google", { maps: { SymbolPath: { FORWARD_CLOSED_ARROW: 1 } } });
    render(<Line path={path(5)} color="#25604b" weight={5} opacity={0.95} zIndex={3} arrows />);
    const icons = lines[0].opts.icons as { icon: Record<string, unknown>; offset: string; repeat: string }[];
    expect(icons).toHaveLength(1);
    expect(icons[0]).toMatchObject({ offset: "40px", repeat: "160px", icon: { scale: 2.6, strokeColor: "#25604b", strokeWeight: 1.5, fillColor: "#ffffff" } });
  });
});

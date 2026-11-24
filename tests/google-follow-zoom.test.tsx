import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fakeMap, state } = vi.hoisted(() => {
  const state = { zoom: 13 };
  const fakeMap = {
    moveCamera: vi.fn(),
    panTo: vi.fn(),
    fitBounds: vi.fn(),
    getZoom: vi.fn(() => state.zoom),
    addListener: vi.fn(() => ({ remove: vi.fn() })),
    getDiv: vi.fn(() => document.createElement("div")),
  };
  return { fakeMap, state };
});

vi.mock("@vis.gl/react-google-maps", () => ({
  useMap: () => fakeMap,
  useMapsLibrary: () => ({}),
}));

const { PositionFollower } = await import("@/components/map/GoogleMapView");

const P1 = { lat: 32.08, lng: 34.78 };
const P2 = { lat: 32.0801, lng: 34.78 };
const ROUTE = [P1, { lat: 32.09, lng: 34.78 }];

beforeEach(() => {
  state.zoom = 13;
  vi.clearAllMocks();
});
afterEach(cleanup);

describe("PositionFollower walking zoom", () => {
  it("zooms to street level once when following starts, then only pans", () => {
    const { rerender } = render(<PositionFollower currentPosition={P1} followPosition={false} />);
    expect(fakeMap.moveCamera).not.toHaveBeenCalled();
    rerender(<PositionFollower currentPosition={P1} followPosition />);
    expect(fakeMap.moveCamera).toHaveBeenCalledTimes(1);
    expect(fakeMap.moveCamera).toHaveBeenCalledWith({ center: P1, zoom: 17 });
    rerender(<PositionFollower currentPosition={P2} followPosition />);
    expect(fakeMap.moveCamera).toHaveBeenCalledTimes(1);
    expect(fakeMap.panTo).toHaveBeenLastCalledWith(P2);
  });

  it("waits for the first position when following starts without one", () => {
    const { rerender } = render(<PositionFollower followPosition />);
    expect(fakeMap.moveCamera).not.toHaveBeenCalled();
    rerender(<PositionFollower currentPosition={P1} followPosition />);
    expect(fakeMap.moveCamera).toHaveBeenCalledWith({ center: P1, zoom: 17 });
  });

  it("leaves a map that is already at 17 or closer alone", () => {
    state.zoom = 18;
    render(<PositionFollower currentPosition={P1} followPosition />);
    expect(fakeMap.moveCamera).not.toHaveBeenCalled();
  });

  it("re-centre restores street zoom after the walker zoomed out", () => {
    state.zoom = 17;
    render(<PositionFollower currentPosition={P1} followPosition />);
    state.zoom = 14;
    fireEvent.click(screen.getByRole("button", { name: "Re-centre on me" }));
    expect(fakeMap.moveCamera).toHaveBeenLastCalledWith({ center: P1, zoom: 17 });
  });

  it("whole route still zooms out", () => {
    state.zoom = 17;
    render(<PositionFollower currentPosition={P1} followPosition routeGeometry={ROUTE} />);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Show whole route" }));
    });
    expect(fakeMap.fitBounds).toHaveBeenCalledTimes(1);
    expect(fakeMap.moveCamera).not.toHaveBeenCalled();
  });
});

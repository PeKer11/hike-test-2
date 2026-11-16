import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MapCredits } from "@/components/map/MapCredits";
import { MapGlyphs } from "@/components/map/MapGlyphs";
import { MapOptionsCard } from "@/components/map/MapOptionsCard";

vi.mock("@/components/auth/LogoutButton", () => ({ LogoutButton: () => <button type="button">Log out</button> }));
vi.mock("@/components/theme/ThemeToggle", () => ({ ThemeToggle: () => <div /> }));
vi.mock("@/components/map/top-rated-groups", () => ({ GROUPS: { food: { label: "Food", glyph: null, color: "#000" } } }));

afterEach(cleanup);

const base = { mapType: "map" as const, onMapType: vi.fn(), showMapType: true, topRatedNote: "", signedIn: false };

describe("map controls moved into Details", () => {
  it("switches base map and top rated from Details", () => {
    const onMapType = vi.fn();
    const onTopRated = vi.fn();
    render(<MapOptionsCard {...base} onMapType={onMapType} topRated={false} onTopRated={onTopRated} />);
    fireEvent.click(screen.getByRole("radio", { name: "Satellite" }));
    expect(onMapType).toHaveBeenCalledWith("satellite");
    fireEvent.click(screen.getByRole("switch", { name: /Top rated/ }));
    expect(onTopRated).toHaveBeenCalledWith(true);
  });

  it("keeps Log out reachable when signed in, and hides it otherwise", () => {
    const { rerender } = render(<MapOptionsCard {...base} signedIn />);
    expect(screen.getByText("Log out")).toBeTruthy();
    rerender(<MapOptionsCard {...base} signedIn={false} />);
    expect(screen.queryByText("Log out")).toBeNull();
  });

  it("omits the satellite and top-rated controls on the Leaflet map", () => {
    render(<MapOptionsCard {...base} showMapType={false} />);
    expect(screen.queryByRole("radio", { name: "Satellite" })).toBeNull();
    expect(screen.queryByRole("switch")).toBeNull();
  });
});

describe("the two glyphs and the credits chip", () => {
  it("shows follow (pressed while following) and layers", () => {
    const onLayers = vi.fn();
    render(<MapGlyphs showFollow following onFollow={vi.fn()} onLayers={onLayers} />);
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.getByLabelText("Re-centre on me").getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByLabelText("Map layers"));
    expect(onLayers).toHaveBeenCalled();
  });

  it("keeps the openrouteservice credit visible and opens the full lines on tap", () => {
    render(<MapCredits lines={["Route: © openrouteservice", "Weather by Open-Meteo"]} />);
    expect(screen.getByText("© openrouteservice by HeiGIT | Data from OpenStreetMap")).toBeTruthy();
    expect(screen.queryByText("Weather by Open-Meteo")).toBeNull();
    fireEvent.click(screen.getByLabelText("Map credits"));
    expect(screen.getByText("Weather by Open-Meteo")).toBeTruthy();
  });
});

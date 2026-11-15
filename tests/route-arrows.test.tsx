// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { MapContainer } from "react-leaflet";
import { describe, expect, it } from "vitest";

import { RouteArrows } from "@/components/map/RouteArrows";

describe("RouteArrows", () => {
  it("draws direction arrows pointing along a due-east route", () => {
    const geometry = Array.from({ length: 11 }, (_, i) => ({ lat: 32, lng: 34.8 + i * 0.001 }));
    const { container } = render(
      <MapContainer center={[32, 34.8]} zoom={15}>
        <RouteArrows geometry={geometry} color="#1f8a4c" />
      </MapContainer>,
    );
    const svgs = container.querySelectorAll("svg[style*='rotate']");
    expect(svgs.length).toBeGreaterThan(3);
    expect(svgs[0].getAttribute("style")).toContain("rotate(90deg)");
  });

  it("draws nothing for a one-point route", () => {
    const { container } = render(
      <MapContainer center={[32, 34.8]} zoom={15}>
        <RouteArrows geometry={[{ lat: 32, lng: 34.8 }]} color="#000" />
      </MapContainer>,
    );
    expect(container.querySelectorAll("svg[style*='rotate']").length).toBe(0);
  });
});

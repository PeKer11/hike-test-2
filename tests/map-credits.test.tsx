import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MapCredits } from "@/components/map/MapCredits";

afterEach(cleanup);

// HeiGIT's required attribution, recorded in docs/data-source-terms.md. Style may change; these words may not.
const ORS_CREDIT = "© openrouteservice by HeiGIT | Data from OpenStreetMap";

describe("MapCredits", () => {
  it("shows the openrouteservice wording exactly, in the DOM, before any tap", () => {
    render(<MapCredits lines={["Route: © openrouteservice by HeiGIT | Data from OpenStreetMap, © OpenStreetMap contributors"]} />);
    const credit = screen.getByText(ORS_CREDIT);
    expect(credit.textContent).toBe(ORS_CREDIT);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Map credits" }).getAttribute("aria-expanded")).toBe("false");
  });

  it("is never visually hidden: no sr-only, hidden or transparent wrapper", () => {
    render(<MapCredits lines={[]} />);
    const button = screen.getByRole("button", { name: "Map credits" });
    for (let el: HTMLElement | null = screen.getByText(ORS_CREDIT); el; el = el.parentElement) {
      expect(el.className).not.toMatch(/sr-only|\bhidden\b|opacity-0|invisible/);
      if (el === button) break;
    }
  });

  it("is a quiet text line, not a pill: no background, no shadow box, small type", () => {
    render(<MapCredits lines={[]} />);
    const cls = screen.getByRole("button", { name: "Map credits" }).className;
    expect(cls).not.toMatch(/\bbg-/);
    expect(cls).not.toMatch(/rounded-full|shadow-tk/);
    expect(cls).toMatch(/text-\[10\.5px\]/);
    // A halo keeps it readable over satellite imagery without a box.
    expect(cls).toContain("text-shadow");
  });

  it("opens the full credit lines on tap and closes them on a second tap", () => {
    render(<MapCredits lines={["Route: © openrouteservice", "Weather by Open-Meteo"]} />);
    const button = screen.getByRole("button", { name: "Map credits" });
    fireEvent.click(button);
    expect(screen.getByRole("dialog", { name: "Map credits" })).toBeTruthy();
    expect(screen.getByText("Weather by Open-Meteo")).toBeTruthy();
    expect(button.getAttribute("aria-expanded")).toBe("true");
    // The short wording stays on screen while the box is open.
    expect(screen.getByText(ORS_CREDIT)).toBeTruthy();
    fireEvent.click(button);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

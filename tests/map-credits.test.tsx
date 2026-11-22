import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MapCredits, OSM_COPYRIGHT_URL } from "@/components/map/MapCredits";

afterEach(cleanup);

// HeiGIT's required attribution, recorded in docs/data-source-terms.md. Placement and weight may change; these words may not.
const ORS_CREDIT = "© openrouteservice.org by HeiGIT | Map data © OpenStreetMap contributors";

describe("MapCredits", () => {
  it("shows the openrouteservice wording exactly, in the DOM, with no tap needed", () => {
    render(<MapCredits />);
    expect(screen.getByTestId("ors-credit").textContent?.replace(/\s+/g, " ").trim()).toBe(ORS_CREDIT);
  });

  it("links 'OpenStreetMap contributors' to the OSM copyright page, safely, and nothing else", () => {
    render(<MapCredits />);
    const link = screen.getByRole("link", { name: "OpenStreetMap contributors" });
    expect(link.getAttribute("href")).toBe("https://www.openstreetmap.org/copyright");
    expect(OSM_COPYRIGHT_URL).toBe("https://www.openstreetmap.org/copyright");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("is not behind a toggle: no button, no dialog, nothing collapsed", () => {
    render(<MapCredits extra={["Weather by Open-Meteo"]} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("ⓘ")).toBeNull();
  });

  it("is never visually hidden: no sr-only, hidden or transparent wrapper", () => {
    render(<MapCredits />);
    for (let el: HTMLElement | null = screen.getByTestId("ors-credit"); el && el !== document.body; el = el.parentElement) {
      expect(el.className).not.toMatch(/sr-only|\bhidden\b|opacity-0|invisible/);
    }
  });

  it("is a quiet but readable text line: 12 px, faded charcoal, left-to-right even in a Hebrew screen, English language tag", () => {
    render(<MapCredits />);
    const line = screen.getByTestId("map-credits");
    expect(line.className).toContain("text-[12px]");
    expect(line.className).toContain("text-charcoal/70");
    expect(line.getAttribute("dir")).toBe("ltr");
    expect(line.getAttribute("lang")).toBe("en");
    expect(line.className).not.toMatch(/\bbg-|rounded-full|shadow-tk/);
  });

  it("adds the other data credits that apply, after the routing credit, in the same always-visible line", () => {
    render(<MapCredits extra={["ESA WorldCover 2021 (CC BY 4.0)", "Weather by Open-Meteo"]} />);
    const line = screen.getByTestId("map-credits");
    expect(line.textContent?.replace(/\s+/g, " ").trim()).toBe(`${ORS_CREDIT} · ESA WorldCover 2021 (CC BY 4.0) · Weather by Open-Meteo`);
    // The routing credit is still its own exact element.
    expect(screen.getByTestId("ors-credit").textContent?.replace(/\s+/g, " ").trim()).toBe(ORS_CREDIT);
  });
});

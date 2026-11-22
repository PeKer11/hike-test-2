import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { validHeading, walkerMarkerHtml, WalkerMarkerShape, WALKER_COLOR } from "@/components/map/WalkerMarker";

afterEach(cleanup);

/** What a Leaflet divIcon would put on the map for this heading. */
function leafletMarker(heading?: number | null): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = walkerMarkerHtml(heading);
  document.body.appendChild(host);
  return host;
}

const rotation = (el: Element | null) => /rotate\((-?[\d.]+)deg\)/.exec(el?.getAttribute("style") ?? "")?.[1] ?? null;

describe("the walker marker", () => {
  it("draws a leather disc with a cream ring and an ink hairline, not the old blue dot", () => {
    const html = walkerMarkerHtml(null);
    expect(html).toContain("var(--tk-leather");
    expect(html).toContain("#f8f3ea"); // surface ring
    expect(html).toContain("#1b2620"); // ink hairline
    expect(html.toLowerCase()).not.toContain("#2563eb");
    expect(WALKER_COLOR).toBe("#d2602f");
  });

  describe("Google version", () => {
    it("shows the arrowhead, turned to the heading, once there is one", () => {
      render(<WalkerMarkerShape headingDeg={137.46} />);
      expect(screen.getByTestId("walker-marker").getAttribute("data-heading")).toBe("137.5");
      expect(rotation(screen.getByTestId("walker-arrow"))).toBe("137.5");
      expect(screen.getByTestId("walker-arrow").getAttribute("style")).toContain("transition: transform 400ms ease-out");
    });

    it.each([[undefined], [null], [Number.NaN], [Number.POSITIVE_INFINITY]])("shows no arrowhead without a real heading (%s)", (heading) => {
      render(<WalkerMarkerShape headingDeg={heading} />);
      expect(screen.getByTestId("walker-marker").hasAttribute("data-heading")).toBe(false);
      expect(screen.queryByTestId("walker-arrow")).toBeNull();
    });

    it("keeps an unwrapped heading as is, so a turn through north is a short CSS rotation", () => {
      render(<WalkerMarkerShape headingDeg={365} />);
      expect(rotation(screen.getByTestId("walker-arrow"))).toBe("365");
      cleanup();
      render(<WalkerMarkerShape headingDeg={-12} />);
      expect(rotation(screen.getByTestId("walker-arrow"))).toBe("-12");
    });

    it("is labelled for a screen reader", () => {
      render(<WalkerMarkerShape headingDeg={90} />);
      expect(screen.getByRole("img", { name: "Your position" })).toBeTruthy();
    });
  });

  describe("Leaflet version", () => {
    it("agrees with the Google one: same arrowhead, same rotation, same absence", () => {
      for (const heading of [0, 45.04, 270, 365, -12]) {
        const leaflet = leafletMarker(heading);
        const { container } = render(<WalkerMarkerShape headingDeg={heading} />);
        expect(leaflet.querySelector("[data-testid=walker-marker]")!.getAttribute("data-heading")).toBe(
          container.querySelector("[data-testid=walker-marker]")!.getAttribute("data-heading"),
        );
        expect(rotation(leaflet.querySelector("[data-testid=walker-arrow]"))).toBe(rotation(container.querySelector("[data-testid=walker-arrow]")));
        cleanup();
        leaflet.remove();
      }
      const none = leafletMarker(undefined);
      expect(none.querySelector("[data-testid=walker-arrow]")).toBeNull();
      expect(none.querySelector("[data-testid=walker-marker]")!.hasAttribute("data-heading")).toBe(false);
      none.remove();
    });

    it("never puts anything but a number into the markup", () => {
      // The heading is rendered into an HTML string: a hostile value must not become markup.
      const html = walkerMarkerHtml('"><img src=x onerror=alert(1)>' as unknown as number);
      expect(html).not.toContain("onerror");
      expect(html).not.toContain("<img");
    });
  });

  it("knows a drawable heading when it sees one", () => {
    expect(validHeading(0)).toBe(true);
    expect(validHeading(-30)).toBe(true);
    expect(validHeading(null)).toBe(false);
    expect(validHeading(undefined)).toBe(false);
    expect(validHeading(Number.NaN)).toBe(false);
  });
});

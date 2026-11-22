import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BEAM_RADIUS_PX, validHeading, walkerMarkerHtml, WalkerMarkerShape, WALKER_BOX_PX, WALKER_COLOR } from "@/components/map/WalkerMarker";

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

  describe("the direction beam", () => {
    const beam = (root: ParentNode) => root.querySelector("[data-testid=walker-beam]");

    it("comes out of the dot toward the heading, turned like the arrowhead, in both versions", () => {
      render(<WalkerMarkerShape headingDeg={137.46} />);
      expect(rotation(beam(document))).toBe("137.5");
      expect(rotation(beam(document))).toBe(rotation(screen.getByTestId("walker-arrow")));
      const leaflet = leafletMarker(137.46);
      expect(rotation(beam(leaflet))).toBe("137.5");
      leaflet.remove();
    });

    it.each([[undefined], [null], [Number.NaN]])("shows nothing without a real heading, no fake direction (%s)", (heading) => {
      render(<WalkerMarkerShape headingDeg={heading} />);
      expect(beam(document)).toBeNull();
      const leaflet = leafletMarker(heading);
      expect(beam(leaflet)).toBeNull();
      leaflet.remove();
    });

    it("sits under the arrowhead and the disc, which stay as they were", () => {
      const leaflet = leafletMarker(90);
      const kids = [...leaflet.querySelector("[data-testid=walker-marker]")!.children].map((c) => c.getAttribute("data-testid") ?? "disc");
      expect(kids).toEqual(["walker-beam", "walker-arrow", "disc"]);
      expect(leaflet.innerHTML).toContain("var(--tk-leather"); // the leather disc
      expect(leaflet.innerHTML).toContain("0 0 0 2.5px #f8f3ea"); // its cream ring
      leaflet.remove();
      render(<WalkerMarkerShape headingDeg={90} />);
      const react = [...screen.getByTestId("walker-marker").children].map((c) => c.getAttribute("data-testid") ?? "disc");
      expect(react).toEqual(["walker-beam", "walker-arrow", "disc"]);
    });

    it("is a translucent leather wedge that fades to nothing outward, with softened sides", () => {
      const svg = beam(leafletMarker(0))!.querySelector("svg")!;
      const stops = [...svg.querySelectorAll("stop")].map((s) => ({ offset: Number(s.getAttribute("offset")), color: s.getAttribute("stop-color"), opacity: Number(s.getAttribute("stop-opacity")) }));
      expect(stops.length).toBeGreaterThanOrEqual(2);
      expect(stops.every((s) => s.color === WALKER_COLOR)).toBe(true);
      expect(stops[0].opacity).toBeGreaterThan(0.5); // strong enough to read on pale sand and roofs
      expect(stops[0].opacity).toBeLessThan(1); // translucent, never solid
      expect(stops[stops.length - 1]).toMatchObject({ offset: 1, opacity: 0 }); // no hard outer edge
      for (let i = 1; i < stops.length; i++) expect(stops[i].opacity).toBeLessThan(stops[i - 1].opacity); // a steady fade
      expect(Number(svg.querySelector("radialGradient")!.getAttribute("r"))).toBe(BEAM_RADIUS_PX);
      expect(svg.querySelector("feGaussianBlur")).not.toBeNull(); // soft sides
      expect(svg.querySelector("path")!.getAttribute("filter")).toMatch(/^url\(#.+\)$/);
    });

    it("reaches about 40 to 50 px from the dot, which is visible on satellite at normal zoom", () => {
      expect(BEAM_RADIUS_PX).toBeGreaterThanOrEqual(40);
      expect(BEAM_RADIUS_PX).toBeLessThanOrEqual(50);
      const svg = beam(leafletMarker(0))!.querySelector("svg")!;
      // The wedge's apex is the centre of the marker box, and its drawing box is centred on it (overflow visible).
      const box = Number(svg.getAttribute("width"));
      expect(box).toBeGreaterThan(2 * BEAM_RADIUS_PX);
      expect(parseFloat(svg.getAttribute("style")!.match(/left:(-?[\d.]+)px/)![1])).toBe(-(box - WALKER_BOX_PX) / 2);
      const [, ax, ay] = /^M([\d.]+) ([\d.]+)/.exec(svg.querySelector("path")!.getAttribute("d")!)!;
      expect([Number(ax), Number(ay)]).toEqual([box / 2, box / 2]);
    });

    it("uses distinct gradient and filter ids per version, so two markers never share a definition", () => {
      const { container } = render(<WalkerMarkerShape headingDeg={10} />);
      const leaflet = leafletMarker(10);
      const ids = (root: ParentNode) => [...root.querySelectorAll("[id]")].map((e) => e.id);
      expect(ids(container).length).toBe(2);
      expect(ids(leaflet).length).toBe(2);
      expect(ids(container).some((i) => ids(leaflet).includes(i))).toBe(false);
      leaflet.remove();
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

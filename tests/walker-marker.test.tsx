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
  it("draws a small leather disc with a thin cream ring and an ink hairline, not the old blue dot", () => {
    const html = walkerMarkerHtml(null);
    expect(html).toContain("var(--tk-leather");
    expect(html).toContain("#f8f3ea"); // surface ring
    expect(html).toContain("#1b2620"); // ink hairline
    expect(html.toLowerCase()).not.toContain("#2563eb");
    expect(WALKER_COLOR).toBe("#d2602f");
  });

  describe("Google version", () => {
    it("shows the beam, turned to the heading, once there is one", () => {
      render(<WalkerMarkerShape headingDeg={137.46} />);
      expect(screen.getByTestId("walker-marker").getAttribute("data-heading")).toBe("137.5");
      expect(rotation(screen.getByTestId("walker-beam"))).toBe("137.5");
      expect(screen.getByTestId("walker-beam").getAttribute("style")).toContain("transition: transform 400ms ease-out");
    });

    it.each([[undefined], [null], [Number.NaN], [Number.POSITIVE_INFINITY]])("shows no beam without a real heading (%s)", (heading) => {
      render(<WalkerMarkerShape headingDeg={heading} />);
      expect(screen.getByTestId("walker-marker").hasAttribute("data-heading")).toBe(false);
      expect(screen.queryByTestId("walker-beam")).toBeNull();
    });

    it("keeps an unwrapped heading as is, so a turn through north is a short CSS rotation", () => {
      render(<WalkerMarkerShape headingDeg={365} />);
      expect(rotation(screen.getByTestId("walker-beam"))).toBe("365");
      cleanup();
      render(<WalkerMarkerShape headingDeg={-12} />);
      expect(rotation(screen.getByTestId("walker-beam"))).toBe("-12");
    });

    it("is labelled for a screen reader", () => {
      render(<WalkerMarkerShape headingDeg={90} />);
      expect(screen.getByRole("img", { name: "Your position" })).toBeTruthy();
    });
  });

  describe("Leaflet version", () => {
    it("agrees with the Google one: same beam, same rotation, same absence", () => {
      for (const heading of [0, 45.04, 270, 365, -12]) {
        const leaflet = leafletMarker(heading);
        const { container } = render(<WalkerMarkerShape headingDeg={heading} />);
        expect(leaflet.querySelector("[data-testid=walker-marker]")!.getAttribute("data-heading")).toBe(
          container.querySelector("[data-testid=walker-marker]")!.getAttribute("data-heading"),
        );
        expect(rotation(leaflet.querySelector("[data-testid=walker-beam]"))).toBe(rotation(container.querySelector("[data-testid=walker-beam]")));
        cleanup();
        leaflet.remove();
      }
      const none = leafletMarker(undefined);
      expect(none.querySelector("[data-testid=walker-beam]")).toBeNull();
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

    it("comes out of the dot toward the heading, in both versions", () => {
      render(<WalkerMarkerShape headingDeg={137.46} />);
      expect(rotation(beam(document))).toBe("137.5");
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

    it("sits under the disc, which is always there", () => {
      const leaflet = leafletMarker(90);
      const kids = [...leaflet.querySelector("[data-testid=walker-marker]")!.children].map((c) => c.getAttribute("data-testid") ?? "disc");
      expect(kids).toEqual(["walker-beam", "disc"]);
      expect(leaflet.innerHTML).toContain("var(--tk-leather"); // the leather disc
      expect(leaflet.innerHTML).toContain("0 0 0 2px #f8f3ea"); // its thin cream ring
      leaflet.remove();
      render(<WalkerMarkerShape headingDeg={90} />);
      const react = [...screen.getByTestId("walker-marker").children].map((c) => c.getAttribute("data-testid") ?? "disc");
      expect(react).toEqual(["walker-beam", "disc"]);
      cleanup();
      render(<WalkerMarkerShape headingDeg={null} />);
      expect([...screen.getByTestId("walker-marker").children].map((c) => c.getAttribute("data-testid") ?? "disc")).toEqual(["disc"]);
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

    it("reaches 36-44 px from the dot (about 2x the dot), small enough not to hide the street", () => {
      expect(BEAM_RADIUS_PX).toBeGreaterThanOrEqual(36);
      expect(BEAM_RADIUS_PX).toBeLessThanOrEqual(44);
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

  it("keeps the dot small: a 13 px core, about 19 px across with its ring and hairline, in both versions", () => {
    const disc = (root: ParentNode) => root.querySelector("[data-testid=walker-marker] > span:last-child") as HTMLElement;
    const leaflet = leafletMarker(90);
    expect(disc(leaflet).style.width).toBe("13px");
    expect(disc(leaflet).style.height).toBe("13px");
    expect(disc(leaflet).style.boxShadow).toContain("0 0 0 3px #1b2620"); // 2 px ring + 1 px hairline: 19 px in all
    leaflet.remove();
    render(<WalkerMarkerShape headingDeg={90} />);
    expect(disc(document).style.width).toBe("13px");
    expect(disc(document).style.boxShadow).toContain("0 0 0 3px #1b2620");
  });

  it("the beam is at most 2.3x the dot's 19 px", () => {
    expect(BEAM_RADIUS_PX).toBeLessThanOrEqual(2.3 * 19);
    const d = leafletMarker(0).querySelector("[data-testid=walker-beam] path")!.getAttribute("d")!;
    const [, , , bx, , cx] = /^M([\d.]+) ([\d.]+) L([\d.]+) ([\d.]+) A[\d.]+ [\d.]+ 0 0 1 ([\d.]+)/.exec(d)!.map(Number) as number[];
    expect(cx - bx).toBeLessThanOrEqual(2.3 * 19);
  });

  it("draws a beam about 60 degrees wide", () => {
    const d = leafletMarker(0).querySelector("[data-testid=walker-beam] path")!.getAttribute("d")!;
    const [, ax, ay, bx, by, cx] = /^M([\d.]+) ([\d.]+) L([\d.]+) ([\d.]+) A[\d.]+ [\d.]+ 0 0 1 ([\d.]+)/.exec(d)!.map(Number) as number[];
    const left = Math.atan2(ax - bx, ay - by);
    const right = Math.atan2(cx - ax, ay - by);
    expect(((left + right) * 180) / Math.PI).toBeGreaterThan(55);
    expect(((left + right) * 180) / Math.PI).toBeLessThan(65);
  });

  it("knows a drawable heading when it sees one", () => {
    expect(validHeading(0)).toBe(true);
    expect(validHeading(-30)).toBe(true);
    expect(validHeading(null)).toBe(false);
    expect(validHeading(undefined)).toBe(false);
    expect(validHeading(Number.NaN)).toBe(false);
  });
});

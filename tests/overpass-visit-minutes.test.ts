import { describe, expect, it } from "vitest";

import { visitMinutesForElement } from "@/lib/attractions/overpass-client";

describe("visitMinutesForElement", () => {
  it("falls back to the flat category default for an untagged node", () => {
    expect(visitMinutesForElement("museum", {}, "node")).toBe(60);
    expect(visitMinutesForElement("viewpoint", {}, "node")).toBe(15);
    expect(visitMinutesForElement("park", {}, "node")).toBe(30);
  });

  it("gives a place drawn as a footprint more time than the same place as a point", () => {
    const asPoint = visitMinutesForElement("park", {}, "node");
    const asArea = visitMinutesForElement("park", {}, "way");

    expect(asArea).toBeGreaterThan(asPoint);
    expect(visitMinutesForElement("park", {}, "relation")).toBe(asArea);
  });

  it("scales with building storeys", () => {
    const flat = visitMinutesForElement("museum", {}, "node");
    const mid = visitMinutesForElement(
      "museum",
      { "building:levels": "3" },
      "node",
    );
    const tall = visitMinutesForElement(
      "museum",
      { "building:levels": "7" },
      "node",
    );

    expect(mid).toBeGreaterThan(flat);
    expect(tall).toBeGreaterThan(mid);
  });

  it("scales with capacity", () => {
    const small = visitMinutesForElement(
      "entertainment",
      { capacity: "40" },
      "node",
    );
    const mid = visitMinutesForElement(
      "entertainment",
      { capacity: "200" },
      "node",
    );
    const large = visitMinutesForElement(
      "entertainment",
      { capacity: "1800" },
      "node",
    );

    expect(small).toBe(visitMinutesForElement("entertainment", {}, "node"));
    expect(mid).toBeGreaterThan(small);
    expect(large).toBeGreaterThan(mid);
  });

  it("ignores a size tag that is not a number", () => {
    expect(
      visitMinutesForElement("museum", { capacity: "lots", "building:levels": "many" }, "node"),
    ).toBe(visitMinutesForElement("museum", {}, "node"));
  });

  it("cuts a statue down from the landmark base", () => {
    const castle = visitMinutesForElement("landmark", { historic: "castle" }, "node");
    const memorial = visitMinutesForElement(
      "landmark",
      { historic: "memorial" },
      "node",
    );
    const artwork = visitMinutesForElement(
      "landmark",
      { tourism: "artwork" },
      "node",
    );

    expect(castle).toBe(20);
    expect(memorial).toBeLessThan(castle);
    expect(artwork).toBeLessThan(castle);
  });

  it("never doubles a visit more than twice over, however many signals stack", () => {
    const stacked = visitMinutesForElement(
      "museum",
      { "building:levels": "20", capacity: "9000" },
      "relation",
    );

    // Base 60, clamped at 2x.
    expect(stacked).toBe(120);
  });

  it("never drops a stop below five minutes", () => {
    expect(
      visitMinutesForElement("other", { historic: "milestone" }, "node"),
    ).toBeGreaterThanOrEqual(5);
  });

  it("ignores area=yes, which marks a polygon rather than a large one", () => {
    expect(visitMinutesForElement("park", { area: "yes" }, "node")).toBe(
      visitMinutesForElement("park", {}, "node"),
    );
  });
});

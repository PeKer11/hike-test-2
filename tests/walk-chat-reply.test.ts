import { describe, expect, it } from "vitest";

import type { AmenityItem } from "@/lib/walk/companion/amenity-detour";
import type { ChatStop } from "@/lib/walk/chat/intent";
import { resolveChat, type ChatContext } from "@/lib/walk/chat/reply";

const here = { lat: 32.0, lng: 34.8 };
// ~0.001 degrees of latitude is about 111 m.
const near = (lat: number): AmenityItem => ({ id: `n${lat}`, kind: "cafe", name: "Cafe Nola", coordinates: { lat, lng: 34.8 } });

const stop = (id: string, pinned = false): ChatStop => ({ id, name: `Stop ${id}`, pinned });
const ctx = (stops: ChatStop[], amenities: AmenityItem[] = []): ChatContext => ({ stops, amenities, position: here });

describe("resolveChat find", () => {
  it("offers the nearest amenity of the kind within 600 m as a detour tap", () => {
    const close = near(32.002);
    const closer = { ...near(32.001), id: "closer" };
    const r = resolveChat({ intent: "find", amenity: "cafe" }, ctx([], [close, closer]), "en");
    expect(r.actions).toHaveLength(1);
    expect(r.actions[0]).toMatchObject({ kind: "detour", item: { id: "closer" } });
    expect(r.text).toContain("Cafe Nola");
  });

  it("says so, with no action, when nothing is within 600 m or the kind differs", () => {
    const far = near(32.01); // ~1.1 km
    const toilet = { ...near(32.001), kind: "toilets" as const };
    const r = resolveChat({ intent: "find", amenity: "cafe" }, ctx([], [far, toilet]), "en");
    expect(r.actions).toEqual([]);
    expect(r.text).toBe("I don't see a cafe near your route yet.");
  });

  it("says bench and shade are not supported, even if an item of that kind is nearby", () => {
    const bench = { ...near(32.001), kind: "bench" as const };
    const en = resolveChat({ intent: "find", amenity: "bench" }, ctx([], [bench]), "en");
    expect(en.actions).toEqual([]);
    expect(en.text).toBe("I can't look up a bench yet.");
    const he = resolveChat({ intent: "find", amenity: "shade" }, ctx([]), "he");
    expect(he.actions).toEqual([]);
    expect(he.text).toBe("עדיין אי אפשר לחפש צל.");
  });
});

describe("resolveChat shorter", () => {
  it("lets the walker choose which unpinned stop to drop", () => {
    const r = resolveChat({ intent: "shorter" }, ctx([stop("a"), stop("b"), stop("c", true)]), "en");
    expect(r.actions.map((a) => a.kind === "drop" && a.stopId)).toEqual(["a", "b"]);
  });

  it("proposes the only unpinned stop directly", () => {
    const r = resolveChat({ intent: "shorter" }, ctx([stop("a", true), stop("b")]), "en");
    expect(r.actions).toHaveLength(1);
    expect(r.actions[0]).toMatchObject({ kind: "drop", stopId: "b" });
  });

  it("never drops a pinned stop: offers head-back when all are pinned", () => {
    const r = resolveChat({ intent: "shorter" }, ctx([stop("a", true), stop("b", true)]), "en");
    expect(r.actions.map((a) => a.kind)).toEqual(["head-back"]);
  });

  it("never drops the last remaining stop: offers head-back", () => {
    const r = resolveChat({ intent: "shorter" }, ctx([stop("a")]), "en");
    expect(r.actions.map((a) => a.kind)).toEqual(["head-back"]);
  });
});

describe("resolveChat skip / longer / head-back / unknown", () => {
  it("skip offers a drop, but on the last stop offers head-back", () => {
    expect(resolveChat({ intent: "skip", stopId: "a" }, ctx([stop("a"), stop("b")]), "en").actions[0]).toMatchObject({ kind: "drop", stopId: "a" });
    expect(resolveChat({ intent: "skip", stopId: "a" }, ctx([stop("a")]), "en").actions.map((a) => a.kind)).toEqual(["head-back"]);
  });

  it("skip with no resolvable stop asks which one", () => {
    const r = resolveChat({ intent: "skip" }, ctx([stop("a"), stop("b")]), "en");
    expect(r.actions).toEqual([]);
    expect(r.text).toContain("Which stop");
  });

  it("longer, head-back and unknown", () => {
    expect(resolveChat({ intent: "longer" }, ctx([]), "en").actions.map((a) => a.kind)).toEqual(["add-stop"]);
    expect(resolveChat({ intent: "head-back" }, ctx([]), "en").actions.map((a) => a.kind)).toEqual(["head-back"]);
    const u = resolveChat({ intent: "unknown" }, ctx([]), "en");
    expect(u.actions).toEqual([]);
    expect(u.text).toContain("cafe");
  });

  it("replies in Hebrew", () => {
    const r = resolveChat({ intent: "unknown" }, ctx([]), "he");
    expect(r.text).toMatch(/[א-ת]/);
  });
});

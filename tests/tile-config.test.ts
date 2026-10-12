import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_TILE_URL, resolveTileUrl, tileImgSrc } from "@/lib/map/tile-config";

afterEach(() => vi.restoreAllMocks());

describe("tile-config", () => {
  it("accepts https templates, with {s} only as a leading subdomain", () => {
    const ok = "https://{s}.tiles.example.com/{z}/{x}/{y}.png";
    expect(resolveTileUrl(ok)).toBe(ok);
    expect(tileImgSrc(ok)).toBe("https://*.tiles.example.com");
    expect(tileImgSrc(DEFAULT_TILE_URL)).toBe("https://tile.openstreetmap.org");
    expect(tileImgSrc("https://tiles.example.com/{z}/{x}/{y}@2x.png?key=1")).toBe("https://tiles.example.com");
  });

  it.each([
    "http://tile.example.com/{z}/{x}/{y}.png",
    "https://tile.example.com/{z}/{x}.png",
    "https://tile.example.com;script-src */{z}/{x}/{y}.png",
    "https://tile.example.com img-src */{z}/{x}/{y}.png",
    "https://user:pw@tile.example.com/{z}/{x}/{y}.png",
    "https://tile.example.com:8443/{z}/{x}/{y}.png",
    "https://a.{s}.example.com/{z}/{x}/{y}.png",
    "https://{s}tile.example.com/{z}/{x}/{y}.png",
    "https://*.example.com/{z}/{x}/{y}.png",
    "https://localhost/{z}/{x}/{y}.png",
    "https://tile.example.com/{z}/{x}/{y}/{evil}.png",
    "https://tile.example.com/{s}/{z}/{x}/{y}.png",
    "not a url",
  ])("falls back to default OSM and warns for %s", (bad) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(resolveTileUrl(bad)).toBe(DEFAULT_TILE_URL);
    expect(tileImgSrc(bad)).toBe("https://tile.openstreetmap.org");
    expect(warn).toHaveBeenCalled();
  });

  it("does not warn for an unset value", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(resolveTileUrl(undefined)).toBe(DEFAULT_TILE_URL);
    expect(warn).not.toHaveBeenCalled();
  });
});

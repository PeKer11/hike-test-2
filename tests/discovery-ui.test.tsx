import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { calloutHtml } from "@/components/map/PoiCallouts";
import { DirectionOptionsSheet } from "@/components/walk/DirectionOptionsSheet";
import { WalkHud } from "@/components/walk/WalkHud";
import { WalkSettingsPanel } from "@/components/WalkSettingsPanel";
import { useWalkSettings } from "@/lib/hooks/useWalkSettings";
import { DEFAULT_WALK_SETTINGS, toCalloutLevel } from "@/lib/types/walk-settings";
import type { NearbyPlace } from "@/lib/types";
import type { Announcement } from "@/lib/walk/poi-announcer";
import { walkCopy } from "@/lib/walk/walk-copy";

afterEach(cleanup);

const OPTIONS = [
  { theme: "nature" as const, minutes: 45, distanceM: 3200, stopNames: ["Yarkon Park", "גן העיר", "Third"] },
  { theme: "food" as const, minutes: 38, distanceM: 2400, stopNames: ["Carmel Market"] },
  { theme: "short" as const, minutes: 20, distanceM: 1500, stopNames: [] },
];

describe("DirectionOptionsSheet", () => {
  function setup(highlight = 0) {
    const handlers = {
      onHighlight: vi.fn(),
      onChoose: vi.fn(),
      onBack: vi.fn(),
    };
    render(<DirectionOptionsSheet options={OPTIONS} highlight={highlight} {...handlers} />);
    return handlers;
  }

  it("shows the title, one card per option with stats and stop chips, and the back pill", () => {
    setup();
    const en = walkCopy.discovery.en;
    expect(screen.getByText(en["options.title"])).toBeTruthy();
    expect(screen.getByText(en["options.nature"])).toBeTruthy();
    expect(screen.getByText(en["options.food"])).toBeTruthy();
    expect(screen.getByText(en["options.short"])).toBeTruthy();
    expect(screen.getByText("45 min · 3.2 km · 3 stops")).toBeTruthy();
    expect(screen.getByText("20 min · 1.5 km · 0 stops")).toBeTruthy();
    expect(screen.getByRole("button", { name: en["options.back"] })).toBeTruthy();
    // Place names are map data: direction-auto so Hebrew and English both read right.
    expect(screen.getByText("גן העיר").getAttribute("dir")).toBe("auto");
  });

  it("is a single non-alert card (the HUD shows at most one)", () => {
    setup();
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
    expect(screen.getAllByTestId("direction-options")).toHaveLength(1);
  });

  it("tapping a card only highlights it; choosing is a separate press", () => {
    const h = setup(0);
    fireEvent.click(screen.getByText(walkCopy.discovery.en["options.food"]));
    expect(h.onHighlight).toHaveBeenCalledWith(1);
    expect(h.onChoose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: walkCopy.discovery.en["options.choose"] }));
    expect(h.onChoose).toHaveBeenCalledWith(0);
    fireEvent.click(screen.getByRole("button", { name: walkCopy.discovery.en["options.back"] }));
    expect(h.onBack).toHaveBeenCalledTimes(1);
  });

  it("marks the highlighted card with aria-pressed", () => {
    setup(2);
    const cards = screen.getAllByRole("button", { pressed: true });
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toContain(walkCopy.discovery.en["options.short"]);
  });
});

describe("WalkHud with the options sheet", () => {
  it("renders the sheet in the alert's slot, never both", () => {
    render(
      <WalkHud
        alert={{ id: "x", tone: "alert", title: "You're off the route", actions: [] }}
        sheet={<div data-testid="sheet" />}
        stats={null}
        onDetails={() => {}}
        onEndWalk={() => {}}
      />,
    );
    expect(screen.getByTestId("sheet")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("callout tier badges and warnings", () => {
  const announcement = (over: Partial<NearbyPlace>): Announcement => ({
    place: {
      id: "p",
      name: "Hotspot <b>",
      coordinates: { lat: 32, lng: 34 },
      category: "other",
      avgVisitMinutes: 5,
      tags: {},
      source: "commons",
      verification: "crowd-signal",
      kind: "poi",
      ...over,
    },
    relation: "right",
    distanceM: 40,
    announcedAt: 0,
    isPlanStop: false,
  });
  const en = walkCopy.discovery.en;

  it("a photo hotspot carries the badge and the 'not a listed place' warning", () => {
    const html = calloutHtml(announcement({}));
    expect(html).toContain(en["badge.crowd"]);
    expect(html).toContain("not a listed place");
    expect(html).toContain("&lt;b&gt;");
  });

  it("an unverified find says so; a listed place carries no warning", () => {
    expect(calloutHtml(announcement({ verification: "detected" }))).toContain(en["warn.detected"]);
    const listed = calloutHtml(announcement({ verification: "registered", source: "osm" }));
    expect(listed).not.toContain(en["warn.crowd"]);
    expect(listed).not.toContain(en["warn.detected"]);
    expect(calloutHtml(announcement({ verification: "mapped-unnamed", source: "osm" }))).toContain(
      en["badge.mapped"],
    );
  });
});

describe("the callout level setting", () => {
  it("defaults to normal and falls back to it for junk", () => {
    expect(DEFAULT_WALK_SETTINGS.calloutLevel).toBe("normal");
    expect(toCalloutLevel("loud")).toBe("normal");
    expect(toCalloutLevel(undefined)).toBe("normal");
    expect(toCalloutLevel("quiet")).toBe("quiet");
  });

  it("is chosen in the settings panel", () => {
    const onChange = vi.fn();
    render(<WalkSettingsPanel settings={DEFAULT_WALK_SETTINGS} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /walk settings/i }));
    const select = screen.getByLabelText(walkCopy.discovery.en["level.label"]) as HTMLSelectElement;
    expect(select.value).toBe("normal");
    expect([...select.options].map((o) => o.text)).toEqual(["Quiet", "Normal", "Chatty"]);
    fireEvent.change(select, { target: { value: "chatty" } });
    expect(onChange).toHaveBeenCalledWith({ calloutLevel: "chatty" });
  });

  it("persists, and an older stored blob without it reads as normal", () => {
    const store: Record<string, string> = {
      "walk-settings": JSON.stringify({ ...DEFAULT_WALK_SETTINGS, calloutLevel: undefined }),
    };
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
          store[k] = v;
        },
      },
    });
    const { result } = renderHook(() => useWalkSettings());
    expect(result.current.settings.calloutLevel).toBe("normal");
    act(() => result.current.setSettings({ calloutLevel: "quiet" }));
    expect(JSON.parse(store["walk-settings"]).calloutLevel).toBe("quiet");
  });
});

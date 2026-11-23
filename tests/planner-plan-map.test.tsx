/**
 * The Plan screen's map (feedback round 2026-11-22, item 8 and Ariel's note that the map belongs at the TOP):
 * a block above the form on a phone, a pane beside it from a tablet's width up, the whole walk fitted after a build
 * (not one stop at zoom 14), and one "Full map" entry, never two. Same harness and the same map stand-in as
 * `walk-planner-app.test.tsx`; the stand-in also reports the `fitPath` and the focus it was handed.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Coordinates, WalkPlan } from "@/lib/types";

vi.mock("@/components/map", () => ({
  DynamicMap: ({ fitPath, focusTick, zoom }: { fitPath?: Coordinates[]; focusTick?: number; zoom?: number }) => (
    <div data-testid="map" data-fit-points={String(fitPath?.length ?? 0)} data-fit-first={fitPath?.[0] ? `${fitPath[0].lat},${fitPath[0].lng}` : ""} data-focus-tick={String(focusTick ?? 0)} data-zoom={String(zoom ?? "")} />
  ),
}));

const { WalkPlannerApp } = await import("@/components/planner/WalkPlannerApp");

const A: Coordinates = { lat: 32.0779, lng: 34.7742 };
const B: Coordinates = { lat: 32.0636, lng: 34.7746 };
const C: Coordinates = { lat: 32.0577, lng: 34.7638 };
const stop = (id: string, name: string, coordinates: Coordinates) => ({ id, name, coordinates, category: "landmark", avgVisitMinutes: 10, tags: {} });

function plan(geometry: Coordinates[], stops = [stop("a", "Alpha", A), stop("b", "Beta", B), stop("c", "Gamma", C)]): WalkPlan {
  return { orderedAttractions: stops, segments: [], totalDistanceMeters: 3000, totalMinutes: 60, feasible: true, droppedAttractions: [], geometry } as unknown as WalkPlan;
}

let store: Record<string, string> = {};
let answer: WalkPlan;

beforeEach(() => {
  store = {};
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => void (store[k] = v), removeItem: (k: string) => void delete store[k], clear: () => void (store = {}) },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => (typeof url === "string" && url.startsWith("/api/walk-plan") ? { ok: true, json: async () => answer } : { ok: false, json: async () => ({}) })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const mapBlock = () => screen.getByTestId("map").closest("section")!.parentElement as HTMLElement;
const aside = () => document.querySelector("aside") as HTMLElement;
const classes = (el: HTMLElement) => el.className.split(/\s+/);
// jsdom does not apply Tailwind, so "on screen" is: not inside an element carrying the `hidden` class (the idle phone map's wrapper).
const fullMapButtons = () => screen.queryAllByRole("button", { name: "Full map", hidden: true }).filter((b) => b.closest(".hidden") === null);

async function build() {
  render(<WalkPlannerApp />);
  await act(async () => {});
  fireEvent.change(screen.getByPlaceholderText("Latitude"), { target: { value: String(A.lat) } });
  fireEvent.change(screen.getByPlaceholderText("Longitude"), { target: { value: String(A.lng) } });
  fireEvent.click(screen.getByRole("button", { name: "Build walking route" }));
  await screen.findByRole("button", { name: "Start Walk" });
}

describe("the Plan map", () => {
  it("is a block ABOVE the form on a phone and a pane beside it from a tablet's width", async () => {
    answer = plan([A, B, C]);
    await build();
    const map = classes(mapBlock());
    // Top block: first in the stack, 40% of the frame, a pine line under it. Not at the bottom.
    for (const c of ["order-1", "h-[40%]", "border-b-[1.5px]"]) expect(map).toContain(c);
    expect(map).not.toContain("order-2");
    expect(map).not.toContain("h-[26%]");
    expect(classes(aside())).toContain("order-2");
    // A tablet and up: two panes, the form 360px at the start and the map taking the rest.
    for (const c of ["@3xl:order-2", "@3xl:h-full", "@3xl:flex-1", "@3xl:border-b-0"]) expect(map).toContain(c);
    for (const c of ["@3xl:order-1", "@3xl:w-[360px]", "@3xl:border-r"]) expect(classes(aside())).toContain(c);
    // The map's own top-down border is the aside's (no double rule under it).
    expect(classes(aside())).not.toContain("border-t");
  });

  it("fits the whole route after a build instead of centring on the first stop", async () => {
    answer = plan([A, { lat: 32.07, lng: 34.775 }, B, C]);
    await build();
    const map = screen.getByTestId("map");
    expect(map.getAttribute("data-fit-points")).toBe("4");
    expect(map.getAttribute("data-fit-first")).toBe(`${A.lat},${A.lng}`);
    // No "focus on stop 1" any more: the focus request counter has not moved.
    expect(map.getAttribute("data-focus-tick")).toBe("0");
  });

  it("falls back to the stops when there is no route line, and to a close-up for a single point", async () => {
    answer = plan([], [stop("a", "Alpha", A), stop("b", "Beta", B)]);
    await build();
    expect(screen.getByTestId("map").getAttribute("data-fit-points")).toBe("2");
    cleanup();

    answer = plan([], [stop("a", "Alpha", A)]);
    await build();
    // One point cannot be fitted: it is a close-up on it (a focus request), not a fit.
    expect(screen.getByTestId("map").getAttribute("data-fit-points")).toBe("0");
    expect(Number(screen.getByTestId("map").getAttribute("data-focus-tick"))).toBeGreaterThan(0);
    expect(screen.getByTestId("map").getAttribute("data-zoom")).toBe("15");
  });

  it("has one Full map entry: the row while there is no map, the button on the map once there is", async () => {
    answer = plan([A, B, C]);
    render(<WalkPlannerApp />);
    await act(async () => {});
    // Idle: no map to show, so the form's row is the way in.
    expect(fullMapButtons()).toHaveLength(1);
    expect(fullMapButtons()[0].className).toContain("tk-bar");
    cleanup();

    await build();
    // Built: the button on the map; the row is gone.
    expect(fullMapButtons()).toHaveLength(1);
    expect(fullMapButtons()[0].className).not.toContain("tk-bar");
    expect(mapBlock().contains(fullMapButtons()[0])).toBe(true);
    // And it opens the map full screen and back.
    fireEvent.click(fullMapButtons()[0]);
    expect(classes(mapBlock())).toContain("h-full");
    expect(screen.getByRole("button", { name: "Back to plan" })).toBeTruthy();
  });
});

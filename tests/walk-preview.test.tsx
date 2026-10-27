import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MyWalksPanel } from "@/components/walks/MyWalksPanel";
import { boundsOf } from "@/lib/utils/geo";
import type { SavedWalk } from "@/lib/walks/saved-walks";
import { previewPathOf } from "@/lib/walks/walk-history";

const walk = (over: Partial<SavedWalk> = {}): SavedWalk => ({
  id: "w1", title: "Jaffa", status: "completed", visibility: "private", createdAt: "2026-10-25T10:00:00Z",
  start: { lat: 32, lng: 34 }, stops: [{ name: "A", category: "park", lat: 32.1, lng: 34.1 }, { name: "B", category: "food", lat: 32.2, lng: 34.2 }],
  params: {}, totalMin: 30, distanceM: 2000, areaLabel: null, ...over,
} as SavedWalk);

vi.mock("@/lib/walks/walk-history", async (orig) => ({
  ...(await orig<typeof import("@/lib/walks/walk-history")>()),
  withWalkClient: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/walks/walk-runs", () => ({
  fetchWalksWithRuns: vi.fn().mockImplementation(async () => [{ walk: walk(), runs: [], isDraft: false }]),
}));

describe("previewPathOf", () => {
  it("is start then stops in order", () => {
    expect(previewPathOf(walk())).toEqual([{ lat: 32, lng: 34 }, { lat: 32.1, lng: 34.1 }, { lat: 32.2, lng: 34.2 }]);
  });
  it("returns to the start for a loop", () => {
    const p = previewPathOf(walk({ params: { maxEndDistanceFromOriginMeters: 0 } }));
    expect(p[p.length - 1]).toEqual({ lat: 32, lng: 34 });
    expect(p).toHaveLength(4);
  });
  it("drops bad coordinates", () => {
    expect(previewPathOf(walk({ stops: [{ name: "A", category: "park", lat: NaN, lng: 1 }] }))).toHaveLength(1);
  });
});

describe("boundsOf", () => {
  it("boxes the path", () => {
    expect(boundsOf([{ lat: 1, lng: 5 }, { lat: 3, lng: 2 }])).toEqual({ north: 3, south: 1, east: 5, west: 2 });
  });
  it("is null under two points", () => {
    expect(boundsOf([{ lat: 1, lng: 1 }])).toBeNull();
  });
});

describe("MyWalksPanel show on map", () => {
  afterEach(cleanup);
  it("shows the walk, and hides it when it is the one on the map", async () => {
    const onShow = vi.fn();
    const { rerender } = render(<MyWalksPanel isSignedIn refreshKey={0} onWalkAgain={vi.fn()} onShowOnMap={onShow} previewId={null} />);
    fireEvent.click(await screen.findByText("Show on map"));
    expect(onShow).toHaveBeenCalledWith(expect.objectContaining({ id: "w1" }));
    rerender(<MyWalksPanel isSignedIn refreshKey={0} onWalkAgain={vi.fn()} onShowOnMap={onShow} previewId="w1" />);
    await waitFor(() => screen.getByText("Hide from map"));
    fireEvent.click(screen.getByText("Hide from map"));
    expect(onShow).toHaveBeenLastCalledWith(null);
  });
});

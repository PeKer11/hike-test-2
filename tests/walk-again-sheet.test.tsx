import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WalkAgainSheet } from "@/components/walks/WalkAgainSheet";
import { decideWalkAgain, type WalkAgainMode } from "@/lib/walks/walk-again";
import type { SavedWalk } from "@/lib/walks/saved-walks";

afterEach(cleanup);

const walk: SavedWalk = {
  id: "w", title: "Dizengoff", status: "completed", areaLabel: null, totalMin: 60, distanceM: 3000, params: {}, visibility: "private", createdAt: "", completedAt: null,
  start: { lat: 32.0, lng: 34.8 },
  stops: [{ name: "A", category: "landmark", lat: 32.01, lng: 34.8 }],
  geometry: [{ lat: 32.0, lng: 34.8 }, { lat: 32.01, lng: 34.8 }, { lat: 32.02, lng: 34.8 }],
  end: { lat: 32.02, lng: 34.8 }, isLoop: false,
};
const supported = new Set<WalkAgainMode>(["join_nearest", "walk_to_start", "reroute_from_here", "transit_to_start"]);
const here = { lat: 32.0, lng: 34.81 };

describe("WalkAgainSheet", () => {
  it("one primary button with the default and its minutes, and a tap chooses it", () => {
    const onChoose = vi.fn();
    render(<WalkAgainSheet walk={walk} here={here} decision={decideWalkAgain(walk, here)} lang="en" supported={supported} onChoose={onChoose} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Let's go · Walk to the start · \d+ min/ }));
    expect(onChoose).toHaveBeenCalledWith(expect.objectContaining({ mode: "walk_to_start" }));
  });

  it("shows at most two plain alternatives, only ones the app can run, and 'Not now' closes", () => {
    const onClose = vi.fn();
    const far = { lat: 32.0, lng: 34.9 };
    render(<WalkAgainSheet walk={walk} here={far} decision={decideWalkAgain(walk, far)} lang="en" supported={new Set<WalkAgainMode>(["walk_to_start", "reroute_from_here"])} onChoose={vi.fn()} onClose={onClose} />);
    expect(screen.getByRole("button", { name: /Same route, from here/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Walk to the start/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Get there/ })).toBeNull(); // transit is not in `supported`
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("is in Hebrew when asked", () => {
    render(<WalkAgainSheet walk={walk} here={here} decision={decideWalkAgain(walk, here)} lang="he" supported={supported} onChoose={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /יוצאים · הליכה לנקודת ההתחלה/ })).toBeTruthy();
  });
});

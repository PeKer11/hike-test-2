import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MyWalksPanel } from "@/components/walks/MyWalksPanel";
import type { SavedWalk } from "@/lib/walks/saved-walks";
import type { WalkWithRuns } from "@/lib/walks/walk-runs";

const mk = (id: string, title: string, extra: Partial<SavedWalk> = {}): SavedWalk => ({
  id, title, status: "completed", areaLabel: null, start: { lat: 32, lng: 34.8 }, totalMin: 60, distanceM: 3000,
  stops: [{ name: "Cafe", category: "food", lat: 32.01, lng: 34.8 }], params: {}, visibility: "private", createdAt: "2026-11-01T10:00:00Z", completedAt: null, ...extra,
});
const wrap = (walk: SavedWalk): WalkWithRuns => ({ walk, runs: [], runCount: 0, lastRunAt: null, isDraft: true });

const parent = mk("p", "Market walk");
const child = mk("c", "Market walk · reversed", { parentWalkId: "p", variantKind: "reverse" });
let listed: WalkWithRuns[] = [wrap(parent), wrap(child)];

vi.mock("@/lib/walks/walk-history", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/walks/walk-history")>()),
  withWalkClient: async (fn: (c: unknown, u: string) => unknown) => fn({}, "u"),
  updateWalk: vi.fn(),
  deleteWalk: vi.fn(),
}));
vi.mock("@/lib/walks/saved-walks", () => ({ listMyWalksOrThrow: async () => listed.map((i) => i.walk) }));
vi.mock("@/lib/walks/walk-runs", () => ({ fetchWalksWithRuns: async () => listed }));
const requestVariant = vi.fn();
vi.mock("@/lib/walks/variant-client", () => ({ requestVariant: (...a: unknown[]) => requestVariant(...a) }));
vi.mock("@/lib/geo/here", () => ({ locateOnce: async () => ({ lat: 32.005, lng: 34.801 }) }));

beforeEach(() => {
  listed = [wrap(parent), wrap(child)];
  requestVariant.mockReset();
});
afterEach(cleanup);

const open = async () => {
  render(<MyWalksPanel isSignedIn refreshKey={0} onWalkAgain={vi.fn()} onEditAsNew={vi.fn()} />);
  await screen.findByText("Market walk");
};

describe("My walks: variants", () => {
  it("groups a variant under its parent and shows it when the count is tapped", async () => {
    await open();
    expect(screen.queryByText("Market walk · reversed")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "1 version" }));
    expect(screen.getByText("Market walk · reversed")).toBeTruthy();
  });

  it("makes a reversed version from the menu, tells the walker, and reloads the list", async () => {
    requestVariant.mockResolvedValue({ ok: true, walk: mk("n", "Market walk · reversed (2)"), ascentM: 10 });
    await open();
    fireEvent.click(screen.getAllByRole("button", { name: "Version ▾" })[0]);
    fireEvent.click(screen.getByRole("menuitem", { name: "Reverse direction" }));
    await waitFor(() => expect(requestVariant).toHaveBeenCalledWith("p", { kind: "reverse" }));
    expect(await screen.findByText(/Saved "Market walk · reversed \(2\)"/)).toBeTruthy();
  });

  it("shorter asks for one number: 30, 45 or 60", async () => {
    requestVariant.mockResolvedValue({ ok: true, walk: mk("n", "x"), ascentM: null });
    await open();
    fireEvent.click(screen.getAllByRole("button", { name: "Version ▾" })[0]);
    fireEvent.click(screen.getByRole("menuitem", { name: "Shorter ›" }));
    fireEvent.click(screen.getByRole("button", { name: "45 min" }));
    await waitFor(() => expect(requestVariant).toHaveBeenCalledWith("p", { kind: "shorter", minutes: 45 }));
  });

  it("from here uses the walker's position", async () => {
    requestVariant.mockResolvedValue({ ok: true, walk: mk("n", "x"), ascentM: null });
    await open();
    fireEvent.click(screen.getAllByRole("button", { name: "Version ▾" })[0]);
    fireEvent.click(screen.getByRole("menuitem", { name: "From here" }));
    await waitFor(() => expect(requestVariant).toHaveBeenCalledWith("p", { kind: "start_here", at: { lat: 32.005, lng: 34.801 } }));
  });

  it("explains a refusal instead of failing silently", async () => {
    requestVariant.mockResolvedValue({ ok: false, error: "no stop with that name", needsAi: false });
    await open();
    fireEvent.click(screen.getAllByRole("button", { name: "Version ▾" })[0]);
    fireEvent.click(screen.getByRole("menuitem", { name: "Reverse direction" }));
    expect(await screen.findByText("no stop with that name")).toBeTruthy();
  });
});

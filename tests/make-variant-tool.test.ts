import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/api/ors-client", () => ({ getMatrix: vi.fn() }));
vi.mock("@/lib/api/google-places-client", () => ({ searchTextPlaces: vi.fn(async () => []), searchNearbyPlaces: vi.fn(async () => []) }));

import { ASSISTANT_SYSTEM } from "@/lib/assistant/prompt";
import { EMPTY_STATE } from "@/lib/assistant/state";
import { runTool } from "@/lib/assistant/tools";
import type { SavedWalk } from "@/lib/walks/saved-walks";

const ID = "11111111-1111-1111-1111-111111111111";
const parent: SavedWalk = {
  id: ID, title: "Carmel market walk", status: "completed", areaLabel: "Tel Aviv", start: { lat: 32.07, lng: 34.77 }, totalMin: 90, distanceM: 4000,
  stops: [{ name: "Carmel Market", category: "food", lat: 32.068, lng: 34.768 }, { name: "Nachalat", category: "other", lat: 32.066, lng: 34.77 }],
  params: {}, visibility: "private", createdAt: "2026-11-01T10:00:00Z", completedAt: null,
};
const noWalks = async () => [];

describe("make_variant", () => {
  it("is for signed-in walkers only", async () => {
    const run = await runTool("make_variant", JSON.stringify({ walk_id: ID, kind: "reverse" }), EMPTY_STATE);
    expect(run.output).toMatch(/signed-in/);
  });

  it("passes a reverse request to the variant maker and tells the model the result, without coordinates", async () => {
    const fn = vi.fn(async () => ({ ok: true, saved_walk_id: "new", title: "Carmel market walk · reversed", totalMin: 88, km: 3.9 }));
    const run = await runTool("make_variant", JSON.stringify({ walk_id: ID, kind: "reverse" }), EMPTY_STATE, undefined, noWalks, undefined, fn);
    expect(fn).toHaveBeenCalledWith(ID, { kind: "reverse" });
    expect(run.output).toContain("reversed");
    expect(run.output).not.toMatch(/"lat"|"lng"/);
  });

  it("shorter needs minutes, skip_stop needs a stop name, start_here needs a start point", async () => {
    const fn = vi.fn(async () => ({ ok: true }));
    expect((await runTool("make_variant", JSON.stringify({ walk_id: ID, kind: "shorter" }), EMPTY_STATE, undefined, noWalks, undefined, fn)).output).toMatch(/missing detail/);
    expect((await runTool("make_variant", JSON.stringify({ walk_id: ID, kind: "skip_stop" }), EMPTY_STATE, undefined, noWalks, undefined, fn)).output).toMatch(/missing detail/);
    expect((await runTool("make_variant", JSON.stringify({ walk_id: ID, kind: "start_here" }), EMPTY_STATE, undefined, noWalks, undefined, fn)).output).toMatch(/no start point/);
    expect(fn).not.toHaveBeenCalled();
    await runTool("make_variant", JSON.stringify({ walk_id: ID, kind: "shorter", minutes: 45 }), EMPTY_STATE, undefined, noWalks, undefined, fn);
    expect(fn).toHaveBeenCalledWith(ID, { kind: "shorter", minutes: 45 });
  });

  it("start_here uses the start point already set", async () => {
    const fn = vi.fn(async () => ({ ok: true }));
    await runTool("make_variant", JSON.stringify({ walk_id: ID, kind: "start_here" }), { ...EMPTY_STATE, origin: { lat: 32.0, lng: 34.8 } }, undefined, noWalks, undefined, fn);
    expect(fn).toHaveBeenCalledWith(ID, { kind: "start_here", at: { lat: 32.0, lng: 34.8 } });
  });

  it("AI kinds hand back the saved stops to build from, not a finished walk", async () => {
    const fn = vi.fn();
    const run = await runTool("make_variant", JSON.stringify({ walk_id: ID, kind: "add_stop", category: "cafe" }), EMPTY_STATE, undefined, async () => [parent], undefined, fn);
    expect(fn).not.toHaveBeenCalled();
    const out = JSON.parse(run.output);
    expect(out.ai).toBe(true);
    expect(out.parent.stops.map((s: { name: string }) => s.name)).toEqual(["Carmel Market", "Nachalat"]);
    expect(out.instruction).toMatch(/Do not rebuild from scratch/);
    expect(run.output).not.toMatch(/"lat"|"lng"/);
  });

  it("rejects a malformed walk id before anything runs", async () => {
    const fn = vi.fn();
    const run = await runTool("make_variant", JSON.stringify({ walk_id: "../../etc", kind: "reverse" }), EMPTY_STATE, undefined, noWalks, undefined, fn);
    expect(run.output).toMatch(/bad arguments/);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("the prompt", () => {
  it("tells the model to recall first and never rebuild from scratch for 'same walk but ...'", () => {
    expect(ASSISTANT_SYSTEM).toMatch(/make_variant/);
    expect(ASSISTANT_SYSTEM).toMatch(/never rebuild from scratch/i);
  });
});

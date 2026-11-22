import { describe, expect, it } from "vitest";

import { PACE_MISMATCH_REASK_MS, PACE_MISMATCH_SUSTAIN_MS, PaceMismatchWatcher } from "@/lib/walk/pace-mismatch";

const T0 = 5_000_000;
/** Look every 5 s for `ms`, at a steady speed. Returns the first offer. */
function walk(w: PaceMismatchWatcher, kmh: number | null, from: number, ms: number, moving = true) {
  for (let t = from; t <= from + ms; t += 5_000) {
    const offer = w.update({ kmh, moving, atMs: t });
    if (offer) return { offer, at: t };
  }
  return { offer: null, at: from + ms };
}

describe("PaceMismatchWatcher", () => {
  it("offers once when the walker is 2x the plan (plan 2 km/h, walking 4.5) after 3 minutes", () => {
    const w = new PaceMismatchWatcher(30);
    const early = walk(w, 4.5, T0, PACE_MISMATCH_SUSTAIN_MS - 5_000);
    expect(early.offer).toBeNull();
    const r = walk(w, 4.5, early.at + 5_000, 20_000);
    expect(r.offer).toEqual({ measuredKmh: 4.5, plannedKmh: 2 });
    // Asked once: the card is up, nothing more until it is answered.
    expect(walk(w, 4.5, r.at + 5_000, 10 * 60_000).offer).toBeNull();
  });

  it("rounds the speed to the nearest 0.5 km/h", () => {
    const w = new PaceMismatchWatcher(30);
    expect(walk(w, 4.7, T0, PACE_MISMATCH_SUSTAIN_MS).offer?.measuredKmh).toBe(4.5);
    const w2 = new PaceMismatchWatcher(30);
    expect(walk(w2, 4.8, T0, PACE_MISMATCH_SUSTAIN_MS).offer?.measuredKmh).toBe(5);
  });

  it("stays quiet for a walker near the plan, mildly faster, slower, paused or without a speed", () => {
    const w = new PaceMismatchWatcher(15); // 4 km/h
    expect(walk(w, 4, T0, 20 * 60_000).offer).toBeNull();
    expect(walk(w, 6, T0, 20 * 60_000).offer).toBeNull(); // 1.5x: the pace cards' business
    expect(walk(w, 7.5, T0, 20 * 60_000).offer).toBeNull(); // 1.9x: still under the 2x line
    expect(walk(w, 2, T0, 20 * 60_000).offer).toBeNull(); // slower: its own card
    expect(walk(w, 0, T0, 20 * 60_000, false).offer).toBeNull();
    expect(walk(w, null, T0, 20 * 60_000).offer).toBeNull();
    expect(walk(new PaceMismatchWatcher(30), 4.5, T0, 20 * 60_000, false).offer).toBeNull(); // not moving
  });

  it("ignores speeds no walker has (GPS noise, a car)", () => {
    const w = new PaceMismatchWatcher(60); // plan 1 km/h
    expect(walk(w, 25, T0, 20 * 60_000).offer).toBeNull();
    expect(walk(w, 1.2, T0, 20 * 60_000).offer).toBeNull();
  });

  it("a dip below the threshold, a lost speed, or a clock that went back starts the 3 minutes over", () => {
    const dip = new PaceMismatchWatcher(30);
    walk(dip, 4.5, T0, PACE_MISMATCH_SUSTAIN_MS - 10_000);
    dip.update({ kmh: 2, moving: true, atMs: T0 + PACE_MISMATCH_SUSTAIN_MS - 5_000 });
    expect(walk(dip, 4.5, T0 + PACE_MISMATCH_SUSTAIN_MS, 60_000).offer).toBeNull();

    // GPS lost (no speed) for one look: the run is broken even though both sides were fast.
    const lost = new PaceMismatchWatcher(30);
    walk(lost, 4.5, T0, PACE_MISMATCH_SUSTAIN_MS - 10_000);
    lost.update({ kmh: null, moving: false, atMs: T0 + PACE_MISMATCH_SUSTAIN_MS - 5_000 });
    expect(walk(lost, 4.5, T0 + PACE_MISMATCH_SUSTAIN_MS, 60_000).offer).toBeNull();

    // The same reading again (a re-render) adds nothing.
    const same = new PaceMismatchWatcher(30);
    same.update({ kmh: 4.5, moving: true, atMs: T0 });
    for (let i = 0; i < 50; i += 1) {
      expect(same.update({ kmh: 4.5, moving: true, atMs: T0 })).toBeNull();
    }
  });

  it("looks 50 s apart still count, as under the simulator's 10x fix clock", () => {
    const w = new PaceMismatchWatcher(30);
    let offer = null;
    for (let t = T0; t <= T0 + PACE_MISMATCH_SUSTAIN_MS + 50_000 && !offer; t += 50_000) {
      offer = w.update({ kmh: 4.5, moving: true, atMs: t });
    }
    expect(offer).not.toBeNull();
  });

  it("Keep means not asked again, until the plan's pace changes", () => {
    const w = new PaceMismatchWatcher(30);
    expect(walk(w, 4.5, T0, PACE_MISMATCH_SUSTAIN_MS).offer).not.toBeNull();
    w.decline();
    expect(walk(w, 4.5, T0 + 5 * 60_000, 30 * 60_000).offer).toBeNull();
    w.setPlannedPace(30); // the plan was re-timed: a new question is allowed
    expect(walk(w, 4.5, T0 + 40 * 60_000, PACE_MISMATCH_SUSTAIN_MS).offer).not.toBeNull();
  });

  it("after the plan is re-baselined to the walker's speed, the same speed is no longer a mismatch", () => {
    const w = new PaceMismatchWatcher(30);
    expect(walk(w, 4.5, T0, PACE_MISMATCH_SUSTAIN_MS).offer).not.toBeNull();
    w.setPlannedPace(60 / 4.5);
    expect(walk(w, 4.5, T0 + 5 * 60_000, 30 * 60_000).offer).toBeNull();
  });
});

describe("an offer nobody answered (lapse)", () => {
  it("may come back, but only as a new question after the quiet period", () => {
    const w = new PaceMismatchWatcher(30);
    const first = walk(w, 4.5, T0, PACE_MISMATCH_SUSTAIN_MS);
    expect(first.offer).not.toBeNull();
    w.lapse(first.at);
    // Not straight away, however long the same speed is kept up.
    expect(walk(w, 4.5, first.at + 5_000, PACE_MISMATCH_REASK_MS - 10_000).offer).toBeNull();
    // After the quiet period the 3 minutes start counting again, and it asks once more.
    const again = walk(w, 4.5, first.at + PACE_MISMATCH_REASK_MS, PACE_MISMATCH_SUSTAIN_MS + 10_000);
    expect(again.offer).toEqual({ measuredKmh: 4.5, plannedKmh: 2 });
  });

  it("lapse after Keep changes nothing: Keep stays quiet until the plan's pace changes", () => {
    const w = new PaceMismatchWatcher(30);
    const first = walk(w, 4.5, T0, PACE_MISMATCH_SUSTAIN_MS);
    w.decline();
    w.lapse(first.at);
    expect(walk(w, 4.5, first.at + 5_000, 60 * 60_000).offer).toBeNull();
  });
});

describe("carrying a watcher to the next leg", () => {
  it("exposes the pace it judges against, so a leg with the same plan pace can reuse it and keep a Keep", () => {
    const w = new PaceMismatchWatcher(30);
    expect(w.plannedPace).toBe(30);
    const first = walk(w, 4.5, T0, PACE_MISMATCH_SUSTAIN_MS);
    expect(first.offer).not.toBeNull();
    w.decline();
    // Same watcher on the next leg: still quiet however long the walker keeps this speed up.
    expect(walk(w, 4.5, first.at + 5_000, 60 * 60_000).offer).toBeNull();
  });

  it("reopen: an offer taken down by a route change (not ignored) is asked again, without the quiet period", () => {
    const w = new PaceMismatchWatcher(30);
    const first = walk(w, 4.5, T0, PACE_MISMATCH_SUSTAIN_MS);
    expect(first.offer).not.toBeNull();
    w.reopen();
    expect(walk(w, 4.5, first.at + 5_000, PACE_MISMATCH_SUSTAIN_MS + 10_000).offer).not.toBeNull();
  });

  it("reopen does not undo a Keep", () => {
    const w = new PaceMismatchWatcher(30);
    const first = walk(w, 4.5, T0, PACE_MISMATCH_SUSTAIN_MS);
    w.decline();
    w.reopen();
    expect(walk(w, 4.5, first.at + 5_000, 60 * 60_000).offer).toBeNull();
  });

  it("startLeg: a watcher carried to a leg whose clock is behind its last reading is not silent for good", () => {
    const w = new PaceMismatchWatcher(30);
    // The previous leg ran an hour ahead of the next one (the simulator's 10x clock).
    const far = T0 + 60 * 60_000;
    expect(walk(w, 3, far, 60_000).offer).toBeNull(); // 3 km/h is not 2x a 2 km/h plan: nothing offered, but lastAt is now far ahead
    expect(walk(w, 4.5, T0, 10 * 60_000).offer).toBeNull(); // a clock that went back says nothing new, ever
    w.startLeg(T0);
    expect(walk(w, 4.5, T0, PACE_MISMATCH_SUSTAIN_MS + 10_000).offer).not.toBeNull();
  });

  it("startLeg also brings a quiet period armed on the other clock back to its own length", () => {
    const w = new PaceMismatchWatcher(30);
    const far = T0 + 60 * 60_000;
    const first = walk(w, 4.5, far, PACE_MISMATCH_SUSTAIN_MS);
    expect(first.offer).not.toBeNull();
    w.lapse(first.at); // quiet until far + 10 min
    w.startLeg(T0);
    const again = walk(w, 4.5, T0, PACE_MISMATCH_REASK_MS + PACE_MISMATCH_SUSTAIN_MS + 10_000);
    expect(again.offer).not.toBeNull();
    expect(again.at).toBeLessThan(far);
  });
});

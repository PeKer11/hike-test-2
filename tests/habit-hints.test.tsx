import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The server checks the walker's stored learning consent; these tests are about what happens once it is granted.
vi.mock("@/lib/preferences/consent", () => ({ hasLearningConsent: vi.fn(async () => true) }));

import { HabitHintChip } from "@/components/planner/HabitHintChip";
import { buildHabitHints, planTimeHabitHints } from "@/lib/preferences/habit-hints";
import { applyAnswer, applyWalk, type HabitState, type WalkObservation } from "@/lib/preferences/habit-model";

// Wednesday 14:00 Israel (UTC+3 in July).
const NOW = Date.UTC(2026, 6, 15, 11, 0, 0);
const ISRAEL = { lat: 32.08, lng: 34.78 };

const obs = (i: number, over: Partial<WalkObservation> = {}): WalkObservation => ({
  habit: "eat",
  dayType: "weekday",
  activeBins: [31, 32, 33],
  firstEventBin: 32, // 16:00
  epochDay: 20000 + i,
  ...over,
});
function habits(n = 4, over: Partial<WalkObservation> = {}): HabitState {
  let s: HabitState = [];
  for (let i = 0; i < n; i++) s = applyWalk(s, obs(i, over), 100 + i);
  return s;
}

afterEach(cleanup);

describe("buildHabitHints", () => {
  const base = { habits: habits(), startMs: NOW, availableMinutes: 180, timeZone: "Asia/Jerusalem" };

  it("hints the habit time as fixed EN and HE text when the walk covers the peak", () => {
    const [h] = buildHabitHints(base);
    expect(h).toMatchObject({ habit: "eat", localTime: "16:00" });
    expect(h.text.en).toBe("You usually eat around 16:00. Add a food stop then?");
    expect(h.text.he).toBe("בדרך כלל אתם אוכלים בסביבות 16:00. להוסיף עצירת אוכל?");
    expect(["high", "medium"]).toContain(h.confidence);
  });

  it("nothing when the peak is outside the walk, the habit is not established, or the zone is unknown", () => {
    expect(buildHabitHints({ ...base, availableMinutes: 90 })).toEqual([]); // 14:00-15:30
    expect(buildHabitHints({ ...base, habits: habits(2) })).toEqual([]);
    expect(buildHabitHints({ ...base, timeZone: "Not/AZone" })).toEqual([]);
    expect(buildHabitHints({ ...base, habits: [] })).toEqual([]);
    expect(buildHabitHints({ ...base, availableMinutes: NaN })).toEqual([]);
  });

  it("the peak exactly at the walk's end still counts; a minute short does not", () => {
    expect(buildHabitHints({ ...base, availableMinutes: 120 })).toHaveLength(1);
    expect(buildHabitHints({ ...base, availableMinutes: 119 })).toHaveLength(0);
  });

  it("wraps past midnight and respects the skip set and a muted habit", () => {
    const night = habits(4, { activeBins: [1], firstEventBin: 1 }); // 00:30
    expect(buildHabitHints({ ...base, habits: night, startMs: Date.UTC(2026, 6, 15, 19, 0), availableMinutes: 200 })).toHaveLength(1);
    expect(buildHabitHints({ ...base, skip: new Set(["eat"]) })).toEqual([]);
    const muted = applyAnswer(habits(), { habit: "eat", dayType: "weekday", answer: "not-now", bin: 32, askedAtMs: NOW });
    const m3 = [1, 2].reduce((s) => applyAnswer(s, { habit: "eat", dayType: "weekday", answer: "not-now", bin: 32, askedAtMs: NOW }), muted);
    expect(buildHabitHints({ ...base, habits: m3 })).toEqual([]);
  });
});

describe("planTimeHabitHints", () => {
  const args = {
    habits: habits(),
    nowMs: NOW,
    availableMinutes: 180,
    origin: ISRAEL,
    clientTimeZone: undefined as unknown,
    requestedCategories: undefined,
    planned: [],
  };
  it("uses the Israel zone inside Israel and ignores a junk client zone", () => {
    expect(planTimeHabitHints(args)).toHaveLength(1);
    expect(planTimeHabitHints({ ...args, clientTimeZone: { x: 1 } })).toHaveLength(1);
  });
  it("outside Israel it uses the device zone the client sent", () => {
    // Same instant is 07:00 in New York (UTC-4): the 16:00 peak is 9 h away, beyond 180 min.
    const far = { ...args, origin: { lat: 40.7, lng: -74 }, clientTimeZone: "America/New_York" };
    expect(planTimeHabitHints(far)).toEqual([]);
    expect(planTimeHabitHints({ ...far, availableMinutes: 600 })).toHaveLength(1);
  });
  it("nothing when food was asked for in words or the plan already has a food stop", () => {
    expect(planTimeHabitHints({ ...args, requestedCategories: ["food"] })).toEqual([]);
    const stop = { id: "r", name: "R", coordinates: ISRAEL, category: "food" as const, avgVisitMinutes: 30, tags: { amenity: "restaurant" } };
    expect(planTimeHabitHints({ ...args, planned: [stop] })).toEqual([]);
    expect(planTimeHabitHints({ ...args, habits: undefined })).toEqual([]);
  });
});

describe("HabitHintChip", () => {
  const hint = buildHabitHints({ habits: habits(), startMs: NOW, availableMinutes: 180, timeZone: "Asia/Jerusalem" });
  it("renders the text for the UI language and can be dismissed", () => {
    const onDismiss = vi.fn();
    const { rerender } = render(<HabitHintChip hints={hint} lang="en" onDismiss={onDismiss} />);
    expect(screen.getByText(/You usually eat around 16:00/)).toBeTruthy();
    rerender(<HabitHintChip hints={hint} lang="he" onDismiss={onDismiss} />);
    expect(screen.getByText(/בדרך כלל אתם אוכלים בסביבות 16:00/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button"));
    expect(onDismiss).toHaveBeenCalledWith("eat");
  });
  it("renders nothing without hints", () => {
    const { container } = render(<HabitHintChip hints={[]} lang="en" onDismiss={() => {}} />);
    expect(container.innerHTML).toBe("");
  });
});

// --- the route ---------------------------------------------------------------

const mockFetchAttractions = vi.fn();
const mockGetUser = vi.fn();
const mockLoadMemoryWire = vi.fn();

vi.mock("@/lib/attractions/overpass-client", () => ({
  fetchAttractions: (...a: unknown[]) => mockFetchAttractions(...a),
}));
vi.mock("@/lib/api/ors-client", () => ({
  getDirections: async () => {
    throw new Error("no ORS in tests");
  },
  getMatrix: async () => {
    throw new Error("no ORS in tests");
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}));
vi.mock("@/lib/preferences/preference-store", () => ({
  getPreferredCategoryWeights: async () => new Map(),
  getDownvotedCategories: async () => new Map(),
  getUpvotedCategories: async () => new Map(),
  getDownvotedPoiKeys: async () => new Set(),
  getTrendingCategoryCounts: async () => new Map(),
  recordWalkSession: async () => 1,
}));
vi.mock("@/lib/preferences/companion-memory-wire", () => ({
  loadMemoryWire: (...a: unknown[]) => mockLoadMemoryWire(...a),
}));

import { POST } from "@/app/api/walk-plan/route";

const landmark = {
  id: "osm-1",
  name: "A",
  coordinates: { lat: 32.081, lng: 34.78 },
  category: "landmark",
  avgVisitMinutes: 20,
  tags: {},
};
const post = (extra: Record<string, unknown>) =>
  POST(
    new Request("http://localhost/api/walk-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat: 32.08, lng: 34.78, availableMinutes: 180, walkingPaceMinPerKm: 15, ...extra }),
    }),
  );
const wire = (h: HabitState) => ({ sessionCount: 4, paceByEnv: {}, interactions: [], priors: {}, habits: h });

describe("POST /api/walk-plan habitHints", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    mockFetchAttractions.mockReset().mockResolvedValue([landmark]);
    mockGetUser.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } });
    mockLoadMemoryWire.mockReset().mockResolvedValue(wire(habits()));
  });
  afterEach(() => vi.useRealTimers());

  it("returns fixed EN/HE hint text from the stored habits, with consent", async () => {
    const body = await (await post({ learnPreferences: true })).json();
    expect(body.habitHints).toHaveLength(1);
    expect(body.habitHints[0]).toMatchObject({ habit: "eat", localTime: "16:00" });
    expect(body.habitHints[0].text.he).toMatch(/16:00/);
  });

  it("omits the key entirely without consent, signed out, with no habits, or when food was requested", async () => {
    expect((await (await post({})).json()).habitHints).toBeUndefined();
    expect(mockLoadMemoryWire).not.toHaveBeenCalled();

    mockGetUser.mockResolvedValue({ data: { user: null } });
    expect((await (await post({ learnPreferences: true })).json()).habitHints).toBeUndefined();

    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockLoadMemoryWire.mockResolvedValue(wire([]));
    expect((await (await post({ learnPreferences: true })).json()).habitHints).toBeUndefined();

    mockLoadMemoryWire.mockResolvedValue(wire(habits()));
    expect((await (await post({ learnPreferences: true, preferredCategories: ["food"] })).json()).habitHints).toBeUndefined();
  });
});

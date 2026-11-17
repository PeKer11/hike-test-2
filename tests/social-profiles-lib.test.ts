import { afterEach, describe, expect, it, vi } from "vitest";

import {
  blockUser, getMyProfile, getProfileCard, isMissingRpc, reportUser, requestFriendById, sanitizeCard,
  sanitizeProfileWalks, sanitizePublicStops, saveProfile, validateDisplayName,
} from "@/lib/social/profiles";
import { profileErrorCopy } from "@/lib/social/copy";
import { AVATARS } from "@/lib/social/avatars";

const ID = "123e4567-e89b-12d3-a456-426614174000";

function fakeClient(result: { data?: unknown; error?: { code?: string } | null } = { data: null, error: null }) {
  const rpc = vi.fn(async () => ({ data: result.data ?? null, error: result.error ?? null }));
  const maybeSingle = vi.fn(async () => ({ data: result.data ?? null, error: result.error ?? null }));
  const from = vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }));
  return { rpc, from, client: { rpc, from } as unknown as import("@supabase/supabase-js").SupabaseClient };
}

afterEach(() => vi.unstubAllEnvs());

describe("flag off: no social call at all", () => {
  it("every client function returns without touching the client", async () => {
    vi.stubEnv("NEXT_PUBLIC_SOCIAL_PROFILES", "");
    const f = fakeClient({ data: true });
    expect(await getMyProfile(f.client, ID)).toEqual({ status: "unavailable" });
    expect(await getProfileCard(f.client, ID)).toBeNull();
    expect(await blockUser(f.client, ID)).toBe(false);
    expect(await reportUser(f.client, ID, "profile", "spam")).toBe(false);
    expect(await requestFriendById(f.client, ID)).toBe(false);
    expect(await saveProfile(f.client, { displayName: "Dana", avatar: "boot", visibility: "private", showHistory: true, showTaste: false, presenceAudience: "off", adult: true })).toBe("unavailable");
    expect(f.rpc).not.toHaveBeenCalled();
    expect(f.from).not.toHaveBeenCalled();
  });
});

describe("migration missing: hidden, not broken", () => {
  it("treats a missing function or table as unavailable", async () => {
    vi.stubEnv("NEXT_PUBLIC_SOCIAL_PROFILES", "1");
    for (const code of ["PGRST202", "42883", "42P01", "PGRST205"]) expect(isMissingRpc({ code })).toBe(true);
    expect(isMissingRpc({ code: "23505" })).toBe(false);
    const missing = fakeClient({ error: { code: "PGRST202" } });
    expect(await getMyProfile(missing.client, ID)).toEqual({ status: "unavailable" });
    expect(await getProfileCard(missing.client, ID)).toBeNull();
    expect(await saveProfile(missing.client, { displayName: "Dana", avatar: "boot", visibility: "private", showHistory: true, showTaste: false, presenceAudience: "off", adult: true })).toBe("unavailable");
  });

  it("no profile row is `none`, a row is `ok`", async () => {
    vi.stubEnv("NEXT_PUBLIC_SOCIAL_PROFILES", "1");
    expect(await getMyProfile(fakeClient({ data: null }).client, ID)).toEqual({ status: "none" });
    const r = await getMyProfile(fakeClient({ data: { display_name: "Dana", avatar: "nope", visibility: "friends", suspended_at: null } }).client, ID);
    expect(r).toMatchObject({ status: "ok", profile: { displayName: "Dana", avatar: "backpack", visibility: "friends", presenceAudience: "off", showTaste: false } });
  });
});

describe("saveProfile", () => {
  const base = { displayName: "Dana", avatar: "boot" as const, visibility: "private" as const, showHistory: true, showTaste: false, presenceAudience: "off" as const, adult: true };
  it("maps every RPC code and refuses bad names locally without a call", async () => {
    vi.stubEnv("NEXT_PUBLIC_SOCIAL_PROFILES", "1");
    for (const code of ["ok", "signin", "suspended", "adult_required", "rate_limited", "name_reserved", "invalid"]) {
      expect(await saveProfile(fakeClient({ data: code }).client, base)).toBe(code);
    }
    expect(await saveProfile(fakeClient({ data: "weird" }).client, base)).toBe("error");
    const f = fakeClient({ data: "ok" });
    expect(await saveProfile(f.client, { ...base, displayName: "a@b.co" })).toBe("invalid");
    expect(await saveProfile(f.client, { ...base, displayName: "Traike team" })).toBe("name_reserved");
    expect(f.rpc).not.toHaveBeenCalled();
  });

  it("has a line of copy in both languages for every failure code", () => {
    for (const lang of ["en", "he"] as const) {
      for (const code of ["signin", "suspended", "adult_required", "rate_limited", "name_reserved", "invalid", "unavailable", "error"] as const) {
        expect(profileErrorCopy[lang][code].length).toBeGreaterThan(3);
      }
    }
  });

  it("validates names like the database", () => {
    expect(validateDisplayName("Dana")).toBeNull();
    expect(validateDisplayName("דנה")).toBeNull();
    expect(validateDisplayName("D")).toBe("invalid");
    expect(validateDisplayName("x".repeat(31))).toBe("invalid");
    expect(validateDisplayName("call 0501234567")).toBe("invalid");
    expect(validateDisplayName("<b>hi</b>")).toBe("invalid");
    expect(validateDisplayName("מנהל האתר")).toBe("name_reserved");
    expect(validateDisplayName("Support")).toBe("name_reserved");
  });

  it("offers 12 avatars", () => expect(AVATARS).toHaveLength(12));
});

describe("sanitizers", () => {
  it("a card row is cleaned and an empty answer is null", () => {
    expect(sanitizeCard([])).toBeNull();
    const c = sanitizeCard([{ display_name: "Dana", avatar: "tent", visibility: "public", relation: "friend", member_since: "2026-05-01", walk_count: 3.4, km_total: 12, top_areas: ["Jaffa", 5, "Yarkon", "a", "b"], top_categories: ["park"], taste_tags: [], friend_state: "friends" }]);
    expect(c).toMatchObject({ displayName: "Dana", avatar: "tent", walkCount: 3, topAreas: ["Jaffa", "Yarkon", "a"], friendState: "friends", relation: "friend" });
  });

  it("stops: a place id wins, whatever else arrives; hidden ones keep only a category", () => {
    const stops = sanitizePublicStops([
      { category: "food", placeId: "ChIJabcdefghij12345", name: "Leaky Cafe", lat: 1, lng: 2 },
      { category: "park", name: "OSM Park", lat: 32.02, lng: 34.8 },
      { category: "landmark" },
      "junk",
    ]);
    expect(stops).toEqual([{ category: "food", placeId: "ChIJabcdefghij12345" }, { category: "park", name: "OSM Park", lat: 32.02, lng: 34.8 }, { category: "landmark" }]);
  });

  it("walks: days only, junk dropped", () => {
    const w = sanitizeProfileWalks([{ id: ID, area_label: "Jaffa", walked_on: "2026-11-10T12:00:00Z", total_min: 95, distance_m: 4200, stops: [] }, { id: "x" }]);
    expect(w).toEqual([{ id: ID, areaLabel: "Jaffa", walkedOn: "2026-11-10", totalMin: 95, distanceM: 4200, stops: [] }]);
  });
});

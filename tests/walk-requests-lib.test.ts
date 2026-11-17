import { afterEach, describe, expect, it, vi } from "vitest";

import {
  activeMeetings, incomingPending, listMyRequests, meetPlaceFromAttraction, respondToRequest, sanitizeRequests, sendRequest, setRequestNote, visibleChoices,
  type MeetChoice,
} from "@/lib/social/walk-requests";

import { fakeSupabase } from "./helpers/fake-supabase";

const ID = "123e4567-e89b-12d3-a456-426614174000";
const row = (over: Record<string, unknown> = {}) => ({
  id: ID, direction: "in", status: "pending", other_id: ID, other_name: "Dana", other_avatar: "boot",
  meet_kind: "osm", meet_ref: "osm-node-777", meet_name: "Cafe Ahead", meet_lat: 32.07, meet_lng: 34.78,
  meet_at: "2026-11-17T16:40:00Z", my_note: null, their_note: "here", created_at: "2026-11-17T16:00:00Z", ...over,
});

afterEach(() => vi.unstubAllEnvs());

describe("meeting places", () => {
  const at = { lat: 32.07, lng: 34.78 };
  it("an OSM stop keeps its key, name and position; a Google stop keeps only its id", () => {
    expect(meetPlaceFromAttraction({ id: "osm-node-777", name: "Cafe Ahead", coordinates: at })).toEqual({ kind: "osm", ref: "osm-node-777", name: "Cafe Ahead", lat: 32.07, lng: 34.78 });
    expect(meetPlaceFromAttraction({ id: "google-ChIJabcdefghij12345", name: "Leaky Cafe", coordinates: at })).toEqual({ kind: "google", ref: "ChIJabcdefghij12345" });
  });
  it("anything else cannot be a meeting place (chat stops, friend plans, street waypoints)", () => {
    for (const id of ["ai-123456", "friend-0-1,2", "via:Dizengoff", "saved-w1-2", "osm-1"]) expect(meetPlaceFromAttraction({ id, name: "x", coordinates: at })).toBeNull();
  });
  it("Google choices are hidden on a Leaflet map", () => {
    const choices: MeetChoice[] = [
      { place: { kind: "google", ref: "ChIJabcdefghij12345" }, label: "G" },
      { place: { kind: "osm", ref: "osm-node-1", name: "O", lat: 1, lng: 2 }, label: "O" },
    ];
    expect(visibleChoices(choices, "leaflet").map((c) => c.label)).toEqual(["O"]);
    expect(visibleChoices(choices, "google")).toHaveLength(2);
  });
});

describe("sendRequest", () => {
  it("a Google place goes as place_id only: no name, no position", async () => {
    vi.stubEnv("NEXT_PUBLIC_SOCIAL_PRESENCE", "1");
    const f = fakeSupabase({ rpc: { send_walk_request: { data: ID } } });
    expect(await sendRequest(f.client, ID, { kind: "google", ref: "ChIJabcdefghij12345" }, 15)).toBe(ID);
    expect(f.calls[0].args).toEqual({ p_to_user: ID, p_meet_kind: "google", p_meet_ref: "ChIJabcdefghij12345", p_meet_name: null, p_meet_lat: null, p_meet_lng: null, p_meet_in_min: 15 });
  });
  it("an OSM place goes with name and position", async () => {
    vi.stubEnv("NEXT_PUBLIC_SOCIAL_PRESENCE", "1");
    const f = fakeSupabase({ rpc: { send_walk_request: { data: ID } } });
    await sendRequest(f.client, ID, { kind: "osm", ref: "osm-node-777", name: "Cafe Ahead", lat: 32.07, lng: 34.78 }, 0);
    expect(f.calls[0].args).toMatchObject({ p_meet_kind: "osm", p_meet_name: "Cafe Ahead", p_meet_lat: 32.07, p_meet_lng: 34.78 });
  });
  it("any refusal is null, whatever the reason", async () => {
    vi.stubEnv("NEXT_PUBLIC_SOCIAL_PRESENCE", "1");
    expect(await sendRequest(fakeSupabase({ rpc: { send_walk_request: { data: null } } }).client, ID, { kind: "google", ref: "ChIJabcdefghij12345" }, 15)).toBeNull();
    expect(await sendRequest(fakeSupabase({ rpc: { send_walk_request: { error: { code: "PGRST202" } } } }).client, ID, { kind: "google", ref: "ChIJabcdefghij12345" }, 15)).toBeNull();
  });
});

describe("flag off: no call at all", () => {
  it("every function returns before touching the client", async () => {
    vi.stubEnv("NEXT_PUBLIC_SOCIAL_PRESENCE", "");
    const f = fakeSupabase({ rpc: {} });
    expect(await listMyRequests(f.client)).toBeNull();
    expect(await sendRequest(f.client, ID, { kind: "google", ref: "ChIJabcdefghij12345" }, 0)).toBeNull();
    expect(await respondToRequest(f.client, ID, true)).toBe(false);
    expect(await setRequestNote(f.client, ID, "here")).toBe(false);
    expect(f.calls).toEqual([]);
  });
});

describe("sanitizeRequests", () => {
  it("keeps good rows and drops bad ones (a Google row with a name is fine: only the ref is read)", () => {
    const out = sanitizeRequests([
      row(),
      row({ meet_kind: "google", meet_ref: "ChIJabcdefghij12345", meet_name: "Leak", meet_lat: 1, meet_lng: 2 }),
      row({ meet_ref: "osm-node-x" }),
      row({ status: "weird" }),
      row({ other_id: "nope" }),
      null,
    ]);
    expect(out).toHaveLength(2);
    expect(out[1].meet).toEqual({ kind: "google", ref: "ChIJabcdefghij12345" });
    expect(out[0]).toMatchObject({ theirNote: "here", myNote: null, otherName: "Dana" });
  });
  it("filters incoming pending and accepted ones", () => {
    const rs = sanitizeRequests([row(), row({ direction: "out" }), row({ status: "accepted" })]);
    expect(incomingPending(rs)).toHaveLength(1);
    expect(activeMeetings(rs)).toHaveLength(1);
  });
});

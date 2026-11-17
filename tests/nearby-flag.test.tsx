import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fakeSupabase } from "./helpers/fake-supabase";

const rpc = vi.fn();
const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser }, rpc }) }));
vi.mock("next/image", () => ({ default: () => <span /> }));

import { GET } from "@/app/api/social/walking-now/route";
import { NearbyConsentSheet } from "@/components/social/NearbyConsentSheet";
import { ProfileEditSheet } from "@/components/social/ProfileEditSheet";
import { nearbyEnabled, nearbyServerEnabled } from "@/lib/social/flag";
import { fetchWalkingNow } from "@/lib/social/presence";
import { getCardByToken, saveProfile } from "@/lib/social/profiles";
import { sendNearbyRequest } from "@/lib/social/walk-requests";

const U = "123e4567-e89b-12d3-a456-426614174000";
const T = "223e4567-e89b-12d3-a456-426614174000";
const friendRow = { token: U, friend_id: U, display_name: "Dana", avatar: "boot", relation: "friend", area_label: null, since_bucket: "about_30", distance_bucket: "near", profile_visible: true };
const strangerRow = { token: T, friend_id: null, display_name: "Noa", avatar: "camera", relation: "nearby", area_label: null, since_bucket: "just_started", distance_bucket: "here", profile_visible: true };

beforeEach(() => {
  rpc.mockReset();
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  vi.stubEnv("NEXT_PUBLIC_SOCIAL_PRESENCE", "1");
  vi.stubEnv("NEXT_PUBLIC_SOCIAL_PROFILES", "1");
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the nearby flags are off by default", () => {
  it("both default to false", () => {
    expect(nearbyEnabled()).toBe(false);
    expect(nearbyServerEnabled()).toBe(false);
  });

  it("the server needs BOTH flags: the client flag alone never switches it on", () => {
    vi.stubEnv("NEXT_PUBLIC_SOCIAL_NEARBY", "1");
    expect(nearbyServerEnabled()).toBe(false);
    vi.stubEnv("SOCIAL_NEARBY", "1");
    expect(nearbyServerEnabled()).toBe(true);
  });
});

describe("strangers never appear unless every layer agrees", () => {
  it("the walking-now route drops strangers without the server flag, even if the database returns them", async () => {
    rpc.mockResolvedValue({ data: [friendRow, strangerRow], error: null });
    vi.stubEnv("NEXT_PUBLIC_SOCIAL_NEARBY", "1");
    let body = await (await GET()).json();
    expect(body.rows.map((r: { displayName: string }) => r.displayName)).toEqual(["Dana"]);
    vi.stubEnv("SOCIAL_NEARBY", "1");
    body = await (await GET()).json();
    expect(body.rows.map((r: { displayName: string }) => r.displayName)).toEqual(["Dana", "Noa"]);
    expect(body.rows[1].friendId).toBeNull();
  });

  it("the client drops strangers when its own flag is off", async () => {
    const reply = { available: true, rows: [{ token: U, friendId: U, displayName: "Dana", avatar: "boot", relation: "friend", areaLabel: null, since: "about_30", distance: "near", profileVisible: true }, { token: T, friendId: null, displayName: "Noa", avatar: "camera", relation: "nearby", areaLabel: null, since: "just_started", distance: "here", profileVisible: true }] };
    const doFetch = vi.fn(async () => new Response(JSON.stringify(reply)));
    expect((await fetchWalkingNow(doFetch as unknown as typeof fetch)).rows.map((r) => r.displayName)).toEqual(["Dana"]);
    vi.stubEnv("NEXT_PUBLIC_SOCIAL_NEARBY", "1");
    expect((await fetchWalkingNow(doFetch as unknown as typeof fetch)).rows.map((r) => r.displayName)).toEqual(["Dana", "Noa"]);
  });

  it("with the flag off, no stranger call is made at all", async () => {
    const f = fakeSupabase({ rpc: { send_walk_request_nearby: { data: U }, social_profile_card_by_token: { data: [] } } });
    expect(await sendNearbyRequest(f.client, T, { kind: "google", ref: "ChIJabcdefghij12345" }, 15)).toBeNull();
    expect(await getCardByToken(f.client, T)).toBeNull();
    expect(f.calls).toEqual([]);
  });

  it("a profile can only be saved as 'everyone nearby' when the flag is on; otherwise it goes as friends", async () => {
    const f = fakeSupabase({ rpc: { save_social_profile: { data: "ok" } } });
    const input = { displayName: "Dana", avatar: "boot" as const, visibility: "private" as const, showHistory: true, showTaste: false, presenceAudience: "public" as const, adult: true };
    await saveProfile(f.client, input);
    expect(f.calls[0].args?.p_presence_audience).toBe("friends");
    vi.stubEnv("NEXT_PUBLIC_SOCIAL_NEARBY", "1");
    await saveProfile(f.client, input);
    expect(f.calls[1].args?.p_presence_audience).toBe("public");
  });
});

describe("consent", () => {
  it("the sheet has three lines, an unticked box, and the button waits for the tick", () => {
    const onConfirm = vi.fn();
    render(<NearbyConsentSheet open onClose={vi.fn()} onConfirm={onConfirm} lang="he" />);
    const box = screen.getByRole("checkbox") as HTMLInputElement;
    const button = screen.getByRole("button", { name: "הפעלה" }) as HTMLButtonElement;
    expect(box.checked).toBe(false);
    expect(button.disabled).toBe(true);
    expect(screen.getByText("אחרים שהולכים לידכם יראו שם ואזור, לא מיקום.")).toBeTruthy();
    fireEvent.click(box);
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    expect(onConfirm).toHaveBeenCalled();
  });

  it("the profile editor offers 'Nearby' only with the flag, and picking it asks for consent first", async () => {
    const f = fakeSupabase({ rpc: { save_social_profile: { data: "ok" } } });
    const view = render(<ProfileEditSheet open onClose={vi.fn()} lang="en" client={f.client} userId="u1" initial={null} onSaved={vi.fn()} onDeleted={vi.fn()} />);
    expect(screen.queryByRole("tab", { name: "Nearby" })).toBeNull();
    view.unmount();
    vi.stubEnv("NEXT_PUBLIC_SOCIAL_NEARBY", "1");
    render(<ProfileEditSheet open onClose={vi.fn()} lang="en" client={f.client} userId="u1" initial={null} onSaved={vi.fn()} onDeleted={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: "Nearby" }));
    expect(screen.getByText("Share with people nearby?")).toBeTruthy();
    // not chosen yet: the audience is still off
    expect(screen.getByRole("tab", { name: "Off", selected: true })).toBeTruthy();
  });
});

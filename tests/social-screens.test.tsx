import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fakeSupabase } from "./helpers/fake-supabase";

const session = vi.hoisted(() => ({ current: null as null | { client: unknown; userId: string } }));
vi.mock("@/lib/hooks/useSocialClient", () => ({ useSocialClient: () => session.current }));
vi.mock("next/image", () => ({ default: (p: Record<string, unknown>) => <span data-src={String(p.src)} /> }));

import { BlockReportSheet } from "@/components/social/BlockReportSheet";
import { ProfileEditSheet } from "@/components/social/ProfileEditSheet";
import { ProfileView } from "@/components/social/ProfileView";
import { SocialView } from "@/components/social/SocialView";
import { profileErrorCopy } from "@/lib/social/copy";
import { PlannerBridge } from "@/lib/shell/planner-bridge";

const OTHER = "123e4567-e89b-12d3-a456-426614174000";

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_SOCIAL_PROFILES", "1"));
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  session.current = null;
});

describe("Social screen", () => {
  it("with no profile, offers to create one", async () => {
    const f = fakeSupabase({ rpc: { list_friends: { data: [] }, friends_walks: { data: [] }, my_friend_code: { data: "ABCDEFGH" } }, tables: { social_profiles: { data: null } } });
    session.current = { client: f.client, userId: "u1" };
    render(<SocialView lang="en" bridge={new PlannerBridge()} signedIn profileId={null} addCode={null} />);
    expect(await screen.findByRole("button", { name: "Create a profile" })).toBeTruthy();
  });

  it("lays its sections out in the page column, two columns from md, with the tab row inset like the Walks screen's", async () => {
    const f = fakeSupabase({ rpc: { list_friends: { data: [] }, friends_walks: { data: [] }, my_friend_code: { data: "ABCDEFGH" } }, tables: { social_profiles: { data: null } } });
    session.current = { client: f.client, userId: "u1" };
    render(<SocialView lang="en" bridge={new PlannerBridge()} signedIn profileId={null} addCode={null} />);
    const create = await screen.findByRole("button", { name: "Create a profile" });
    // The sections are in one two-column flow inside the page column (the media rules live in globals.css).
    expect(create.closest(".tk-cols-2")?.parentElement?.className).toContain("tk-page");
    // Tablet and desktop only: the Saved / Walked / Friends row sits in the same column, inset 16px; a phone keeps it as approved.
    const tabs = screen.getByRole("tablist", { name: "Filter walks" }).closest(".tk-page") as HTMLElement;
    expect(tabs.className.split(/\s+/)).toContain("md:px-4");
    expect(tabs.className.split(/\s+/)).not.toContain("px-4");
  });

  it("with the flag off, shows today's friends features only and never reads profiles", async () => {
    vi.stubEnv("NEXT_PUBLIC_SOCIAL_PROFILES", "");
    const f = fakeSupabase({ rpc: { list_friends: { data: [] }, friends_walks: { data: [] }, my_friend_code: { data: "ABCDEFGH" } } });
    session.current = { client: f.client, userId: "u1" };
    render(<SocialView lang="en" bridge={new PlannerBridge()} signedIn profileId={null} addCode={null} />);
    expect(await screen.findByText("My friends")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Create a profile" })).toBeNull();
    expect(f.calls.some((c) => c.name === "social_profiles" || c.name === "social_profile_card")).toBe(false);
  });

  it("before the migration (functions missing) it hides the profile parts without errors", async () => {
    const f = fakeSupabase({
      rpc: { list_friends: { data: [] }, friends_walks: { data: [] }, my_friend_code: { data: "ABCDEFGH" } },
      tables: { social_profiles: { error: { code: "PGRST205" } } },
    });
    session.current = { client: f.client, userId: "u1" };
    render(<SocialView lang="he" bridge={new PlannerBridge()} signedIn profileId={null} addCode={null} />);
    expect(await screen.findByText("החברים שלי")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "יצירת פרופיל" })).toBeNull();
  });

  it("signed out: a login prompt, no calls", () => {
    render(<SocialView lang="en" bridge={new PlannerBridge()} signedIn={false} profileId={null} addCode={null} />);
    expect(screen.getByText("Log in to see your friends")).toBeTruthy();
  });

  it("an invite link asks before adding", async () => {
    const f = fakeSupabase({ rpc: { list_friends: { data: [] }, friends_walks: { data: [] }, my_friend_code: { data: "ABCDEFGH" }, request_friend: { data: true } } });
    session.current = { client: f.client, userId: "u1" };
    render(<SocialView lang="en" bridge={new PlannerBridge()} signedIn profileId={null} addCode="QWERTY12" />);
    expect(screen.getByText("Add this friend?")).toBeTruthy();
    expect(f.calls.some((c) => c.name === "request_friend")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(f.calls.some((c) => c.name === "request_friend" && c.args?.code === "QWERTY12")).toBe(true));
  });
});

describe("Profile screen", () => {
  it("someone else's private profile is an empty state, not an error", async () => {
    const f = fakeSupabase({ rpc: { social_profile_card: { data: [] }, social_profile_walks: { data: [] } } });
    session.current = { client: f.client, userId: "u1" };
    render(<ProfileView userId={OTHER} lang="en" bridge={new PlannerBridge()} onBack={vi.fn()} />);
    expect(await screen.findByText("This profile is private.")).toBeTruthy();
  });

  it("a friend's card shows stats and a Google stop by id only (the name is looked up live)", async () => {
    const f = fakeSupabase({
      rpc: {
        social_profile_card: { data: [{ display_name: "Dana", avatar: "boot", visibility: "friends", relation: "friend", member_since: "2026-05-01", walk_count: 4, km_total: 31, top_areas: ["Jaffa"], top_categories: ["park"], taste_tags: [], friend_state: "friends" }] },
        social_profile_walks: { data: [{ id: OTHER, area_label: "Jaffa", walked_on: "2026-11-10", total_min: 90, distance_m: 4200, stops: [{ category: "park", name: "OSM Park", lat: 32.1, lng: 34.8 }, { category: "food", placeId: "ChIJabcdefghij12345" }, { category: "food" }] }] },
      },
    });
    session.current = { client: f.client, userId: "u1" };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ places: [{ placeId: "ChIJabcdefghij12345", name: "Cafe Live", coordinates: { lat: 1, lng: 2 }, category: "food" }] }))));
    render(<ProfileView userId={OTHER} lang="en" bridge={new PlannerBridge()} onBack={vi.fn()} />);
    expect(await screen.findByText("Dana")).toBeTruthy();
    expect(screen.getByText("31")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Jaffa/ }));
    expect(await screen.findByText("OSM Park")).toBeTruthy();
    expect(await screen.findByText("Cafe Live")).toBeTruthy();
    expect(screen.getByText("+1 more places")).toBeTruthy();
    vi.unstubAllGlobals();
  });
});

describe("BlockReportSheet", () => {
  it("blocks first, then reports, and tells the caller", async () => {
    const f = fakeSupabase({ rpc: { block_user: { data: true }, report_user: { data: true } } });
    const onDone = vi.fn();
    render(<BlockReportSheet open onClose={vi.fn()} lang="en" client={f.client} target={OTHER} targetName="Dana" onDone={onDone} />);
    fireEvent.click(screen.getByRole("radio", { name: "Spam" }));
    fireEvent.click(screen.getByRole("button", { name: "Send report" }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith("reported"));
    const rpcs = f.calls.filter((c) => c.kind === "rpc");
    expect(rpcs.map((c) => c.name)).toEqual(["block_user", "report_user"]);
    expect(rpcs[1].args).toMatchObject({ p_target: OTHER, p_reason: "spam", p_context: "profile" });
  });

  it("the block box is the only pre-ticked box, and unticking it skips the block", async () => {
    const f = fakeSupabase({ rpc: { block_user: { data: true }, report_user: { data: true } } });
    render(<BlockReportSheet open onClose={vi.fn()} lang="en" client={f.client} target={OTHER} targetName="Dana" onDone={vi.fn()} />);
    const box = screen.getByRole("checkbox") as HTMLInputElement;
    expect(box.checked).toBe(true);
    fireEvent.click(box);
    fireEvent.click(screen.getByRole("button", { name: "Send report" }));
    await waitFor(() => expect(f.calls.some((c) => c.name === "report_user")).toBe(true));
    expect(f.calls.some((c) => c.name === "block_user")).toBe(false);
  });
});

describe("ProfileEditSheet", () => {
  it("requires the unticked 18+ box when creating, and maps every RPC code to a line", async () => {
    for (const code of ["signin", "suspended", "adult_required", "rate_limited", "name_reserved", "invalid"] as const) {
      const f = fakeSupabase({ rpc: { save_social_profile: { data: code } } });
      const view = render(<ProfileEditSheet open onClose={vi.fn()} lang="en" client={f.client} userId="u1" initial={null} onSaved={vi.fn()} onDeleted={vi.fn()} />);
      expect((screen.getByLabelText("I am 18 or older") as HTMLInputElement).checked).toBe(false);
      fireEvent.change(screen.getByPlaceholderText("A name you choose"), { target: { value: "Dana" } });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      expect((await screen.findByRole("alert")).textContent).toBe(profileErrorCopy.en[code]);
      view.unmount();
    }
  });

  it("defaults to private and saves with what was picked", async () => {
    const f = fakeSupabase({ rpc: { save_social_profile: { data: "ok" } } });
    const onSaved = vi.fn();
    render(<ProfileEditSheet open onClose={vi.fn()} lang="en" client={f.client} userId="u1" initial={null} onSaved={onSaved} onDeleted={vi.fn()} />);
    expect(screen.getByRole("tab", { name: "Only me", selected: true })).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("A name you choose"), { target: { value: "Dana" } });
    fireEvent.click(screen.getByLabelText("I am 18 or older"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(f.calls.find((c) => c.name === "save_social_profile")?.args).toMatchObject({ p_display_name: "Dana", p_visibility: "private", p_presence_audience: "off", p_adult: true });
  });
});

describe("Walking now on the Social screen", () => {
  const rows = [{ token: OTHER, friendId: OTHER, displayName: "Dana", avatar: "boot", relation: "friend", areaLabel: "Jaffa", since: "about_30", distance: "near", profileVisible: true }];
  const mineRow = { user_id: "u1", display_name: "Tester", avatar: "tent", visibility: "private", show_history: true, show_taste: false, presence_audience: "friends", suspended_at: null };
  const rpc = { list_friends: { data: [] }, friends_walks: { data: [] }, my_friend_code: { data: "ABCDEFGH" } };

  it("lists friends who walk, with words from buckets and no position", async () => {
    vi.stubEnv("NEXT_PUBLIC_SOCIAL_PRESENCE", "1");
    const f = fakeSupabase({ rpc, tables: { social_profiles: { data: mineRow } } });
    session.current = { client: f.client, userId: "u1" };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ available: true, rows }))));
    render(<SocialView lang="en" bridge={new PlannerBridge()} signedIn profileId={null} addCode={null} />);
    expect(await screen.findByText("Dana")).toBeTruthy();
    expect(screen.getByText("Jaffa · nearby · about 30 min")).toBeTruthy();
    vi.unstubAllGlobals();
  });

  it("is hidden with the presence flag off (and nothing is fetched), or when the route says unavailable", async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ available: false, rows: [] })));
    vi.stubGlobal("fetch", fetchSpy);
    const f = fakeSupabase({ rpc, tables: { social_profiles: { data: mineRow } } });
    session.current = { client: f.client, userId: "u1" };
    render(<SocialView lang="en" bridge={new PlannerBridge()} signedIn profileId={null} addCode={null} />);
    expect(await screen.findByText("My friends")).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.queryByText("Walking now")).toBeNull();
    cleanup();
    vi.stubEnv("NEXT_PUBLIC_SOCIAL_PRESENCE", "1");
    render(<SocialView lang="en" bridge={new PlannerBridge()} signedIn profileId={null} addCode={null} />);
    await screen.findByText("My friends");
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(screen.queryByText("Walking now")).toBeNull();
    vi.unstubAllGlobals();
  });
});

describe("a nearby walker's link (?w=)", () => {
  it("is ignored while the nearby flag is off: the normal Social screen shows", async () => {
    const f = fakeSupabase({ rpc: { list_friends: { data: [] }, friends_walks: { data: [] }, my_friend_code: { data: "ABCDEFGH" }, social_profile_card_by_token: { data: [{ user_id: OTHER, display_name: "Noa" }] } }, tables: { social_profiles: { data: null } } });
    session.current = { client: f.client, userId: "u1" };
    render(<SocialView lang="en" bridge={new PlannerBridge()} signedIn profileId={null} nearbyToken={OTHER} addCode={null} />);
    expect(await screen.findByText("My friends")).toBeTruthy();
    expect(f.calls.some((c) => c.name === "social_profile_card_by_token")).toBe(false);
  });
});

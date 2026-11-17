import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TasteCard } from "@/components/social/TasteCard";
import type { SocialProfile } from "@/lib/social/profiles";

import { fakeSupabase } from "./helpers/fake-supabase";

const profile: SocialProfile = { displayName: "Dana", avatar: "boot", visibility: "friends", showHistory: true, showTaste: false, presenceAudience: "off", suspended: false };
const view = { available: true, summary: { bullets: ["Likes views"], tags: ["views", "food"], areas: [] }, createdAt: "2026-11-10T10:00:00Z", basedOnWalks: 5, nextAvailableAt: null };

beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_TASTE_SUMMARY", "1"); vi.stubEnv("NEXT_PUBLIC_SOCIAL_PROFILES", "1"); });
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("My taste card", () => {
  it("renders nothing and fetches nothing with the flag off", () => {
    vi.stubEnv("NEXT_PUBLIC_TASTE_SUMMARY", "");
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const { container } = render(<TasteCard lang="en" profile={profile} client={fakeSupabase().client} onProfileChanged={vi.fn()} />);
    expect(container.textContent).toBe("");
    expect(f).not.toHaveBeenCalled();
  });

  it("renders nothing when the server says unavailable (migration E missing)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ available: false, summary: null }))));
    const { container } = render(<TasteCard lang="en" profile={profile} client={fakeSupabase().client} onProfileChanged={vi.fn()} />);
    await new Promise((r) => setTimeout(r, 20));
    expect(container.textContent).toBe("");
  });

  it("shows the private text and tags; showing tags on the profile is an unticked, explicit choice", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(view))));
    const f = fakeSupabase({ rpc: { save_social_profile: { data: "ok" } } });
    const changed = vi.fn();
    render(<TasteCard lang="en" profile={profile} client={f.client} onProfileChanged={changed} />);
    expect(await screen.findByText("Likes views")).toBeTruthy();
    expect(screen.getByText("Views")).toBeTruthy();
    const box = screen.getByRole("checkbox", { name: "Show tags on my profile" }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    fireEvent.click(box);
    await waitFor(() => expect(changed).toHaveBeenCalled());
    expect(f.calls.find((c) => c.name === "save_social_profile")?.args).toMatchObject({ p_show_taste: true });
  });

  it("creating asks the server once and shows its answer; a cooldown is said in one line", async () => {
    const fetchMock = vi.fn(async (_u: unknown, init?: RequestInit) =>
      new Response(JSON.stringify(init?.method === "POST" ? { ...view, cooldown: true } : { available: true, summary: null })),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<TasteCard lang="en" profile={profile} client={fakeSupabase().client} onProfileChanged={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Create" }));
    expect(await screen.findByText("Once a week. The last one is still fresh.")).toBeTruthy();
    expect(fetchMock.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === "POST")).toHaveLength(1);
  });
});

import { cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConsentGate } from "@/components/onboarding/ConsentGate";
import { WalkSettingsPanel } from "@/components/WalkSettingsPanel";
import { WalkPlanResults } from "@/components/route/WalkPlanResults";
import { CommunityBadge } from "@/components/walk/CommunityBadge";
import { useCommunityBadges, useSocialOptInSync } from "@/lib/hooks/useCommunityBadges";
import { fetchAggregates, syncOptIn } from "@/lib/social/client";
import { DEFAULT_WALK_SETTINGS } from "@/lib/types/walk-settings";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const noop = () => {};

function openPanel(settings = DEFAULT_WALK_SETTINGS, onChange = noop) {
  render(<WalkSettingsPanel settings={settings} onChange={onChange} />);
  fireEvent.click(screen.getByText("Walk settings"));
}

describe("flag OFF (default): no social UI and no calls", () => {
  it("settings default is off", () => {
    expect(DEFAULT_WALK_SETTINGS.socialSharingEnabled).toBe(false);
  });

  it("panel has no Community section", () => {
    openPanel({ ...DEFAULT_WALK_SETTINGS, socialSharingEnabled: true });
    expect(screen.queryByText("Community")).toBeNull();
    expect(screen.queryByText(/community recommendations/i)).toBeNull();
  });

  it("consent screen has no social line, in either language", () => {
    const { rerender } = render(<ConsentGate lang="en" onLanguage={noop} onAnswer={noop} />);
    expect(screen.queryByText(/community/i)).toBeNull();
    rerender(<ConsentGate lang="he" onLanguage={noop} onAnswer={noop} />);
    expect(screen.queryByText(/קהילה/)).toBeNull();
  });

  it("no network from the client helpers, the badge hook or the opt-in sync", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect(await fetchAggregates(["osm-node-1"], true, f as unknown as typeof fetch)).toEqual({ support: {}, similar: {} });
    await syncOptIn(true, f as unknown as typeof fetch);
    const { result } = renderHook(() => useCommunityBadges(["osm-node-1"], true, true));
    renderHook(() => useSocialOptInSync(true, true, () => undefined));
    await new Promise((r) => setTimeout(r, 10));
    expect(result.current).toEqual({ support: {}, similar: {} });
    expect(f).not.toHaveBeenCalled();
  });

  it("plan results render no badge element", () => {
    render(
      <WalkPlanResults
        plan={plan()}
        error={null}
        community={{ support: {}, similar: {} }}
      />,
    );
    expect(screen.queryByTestId("community-badge")).toBeNull();
  });
});

describe("flag ON", () => {
  it("panel shows its own Community section and toggles the setting", () => {
    vi.stubEnv("NEXT_PUBLIC_SOCIAL", "1");
    const onChange = vi.fn();
    openPanel(DEFAULT_WALK_SETTINGS, onChange);
    expect(screen.getByText("Community")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Contribute anonymously to community recommendations"));
    expect(onChange).toHaveBeenCalledWith({ socialSharingEnabled: true });
  });

  it("consent screen carries a separate optional line, in both languages", () => {
    vi.stubEnv("NEXT_PUBLIC_SOCIAL", "1");
    const { rerender } = render(<ConsentGate lang="en" onLanguage={noop} onAnswer={noop} />);
    expect(screen.getByText(/Separately and optionally/)).toBeTruthy();
    rerender(<ConsentGate lang="he" onLanguage={noop} onAnswer={noop} />);
    expect(screen.getByText(/בנפרד ובאופן רשותי/)).toBeTruthy();
  });

  it("fetches only when opted in; sends only OSM keys", async () => {
    vi.stubEnv("NEXT_PUBLIC_SOCIAL", "1");
    const f = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ support: { "osm-node-1": "5+", "osm-node-9": "5+" }, similar: { "osm-node-1": ["park"] } }),
    });
    expect(await fetchAggregates(["osm-node-1"], false, f as unknown as typeof fetch)).toEqual({ support: {}, similar: {} });
    expect(f).not.toHaveBeenCalled();
    const r = await fetchAggregates(["osm-node-1", "cafe@1,2"], true, f as unknown as typeof fetch);
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ poiKeys: ["osm-node-1"] });
    expect(r).toEqual({ support: { "osm-node-1": "5+" }, similar: { "osm-node-1": ["park"] } });
  });

  it("hook fetches when opted in and signed in", async () => {
    vi.stubEnv("NEXT_PUBLIC_SOCIAL", "1");
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ support: { "osm-node-1": "10+" }, similar: {} }) });
    vi.stubGlobal("fetch", f);
    const { result } = renderHook(() => useCommunityBadges(["osm-node-1"], true, true));
    await waitFor(() => expect(result.current.support["osm-node-1"]).toBe("10+"));
  });

  it("badge renders fixed text, EN and HE, and nothing without data", () => {
    const data = { support: { "osm-node-1": "10+" as const }, similar: { "osm-node-1": ["park" as const] } };
    const { rerender, container } = render(<CommunityBadge poiKey="osm-node-1" data={data} lang="en" />);
    expect(screen.getByTestId("community-badge").textContent).toContain("Recommended by walkers (10+)");
    rerender(<CommunityBadge poiKey="osm-node-1" data={data} lang="he" />);
    expect(screen.getByTestId("community-badge").textContent).toContain("מומלץ על ידי הולכים (10+)");
    rerender(<CommunityBadge poiKey="osm-node-2" data={data} lang="en" />);
    expect(container.innerHTML).toBe("");
  });

  it("opt-in sync only READS the server state and never pushes the local value", async () => {
    vi.stubEnv("NEXT_PUBLIC_SOCIAL", "1");
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ optedIn: false }) });
    vi.stubGlobal("fetch", f);
    const setLocal = vi.fn();
    const { rerender } = renderHook(() => useSocialOptInSync(true, true, setLocal));
    rerender();
    await waitFor(() => expect(setLocal).toHaveBeenCalledWith(false));
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls.every((c) => (c[1] as { method: string }).method === "GET")).toBe(true);
  });

  it("opt-in sync leaves the local value alone when the server answer is unknown", async () => {
    vi.stubEnv("NEXT_PUBLIC_SOCIAL", "1");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ optedIn: null }) }));
    const setLocal = vi.fn();
    renderHook(() => useSocialOptInSync(true, true, setLocal));
    await new Promise((r) => setTimeout(r, 20));
    expect(setLocal).not.toHaveBeenCalled();
  });
});

function plan() {
  return {
    orderedAttractions: [{ id: "osm-node-1", name: "Spot", category: "park", avgVisitMinutes: 10 }],
    droppedAttractions: [],
    segments: [],
    totalMinutes: 10,
    totalDistanceMeters: 100,
  } as unknown as Parameters<typeof WalkPlanResults>[0]["plan"];
}

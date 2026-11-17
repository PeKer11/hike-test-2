import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MeetCard, RequestCard } from "@/components/social/RequestCard";
import { WalkTogetherSheet } from "@/components/social/WalkTogetherSheet";
import { sanitizeRequests, type MeetChoice } from "@/lib/social/walk-requests";

import { fakeSupabase } from "./helpers/fake-supabase";

vi.mock("next/image", () => ({ default: () => <span /> }));

const ID = "123e4567-e89b-12d3-a456-426614174000";
const google: MeetChoice = { place: { kind: "google", ref: "ChIJabcdefghij12345" }, label: "Cafe Puah" };
const osm: MeetChoice = { place: { kind: "osm", ref: "osm-node-777", name: "Old Park", lat: 32.07, lng: 34.78 }, label: "Old Park" };

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_SOCIAL_PRESENCE", "1"));
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("WalkTogetherSheet", () => {
  it("a Google pick sends the place_id only, never a name or a position; there is no free-text field", async () => {
    const f = fakeSupabase({ rpc: { send_walk_request: { data: ID } } });
    const onSent = vi.fn();
    render(<WalkTogetherSheet open onClose={vi.fn()} lang="en" client={f.client} friend={{ id: ID, name: "Dana" }} choices={[google, osm]} mapProvider="google" onSent={onSent} />);
    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "Cafe Puah" }));
    fireEvent.click(screen.getByRole("radio", { name: "30 min" }));
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(onSent).toHaveBeenCalled());
    const args = f.calls.find((c) => c.name === "send_walk_request")!.args!;
    expect(args).toMatchObject({ p_to_user: ID, p_meet_kind: "google", p_meet_ref: "ChIJabcdefghij12345", p_meet_name: null, p_meet_lat: null, p_meet_lng: null, p_meet_in_min: 30 });
    expect(JSON.stringify(args)).not.toContain("Cafe Puah");
  });

  it("on a Leaflet map Google places are not offered", () => {
    render(<WalkTogetherSheet open onClose={vi.fn()} lang="en" client={fakeSupabase().client} friend={{ id: ID, name: "Dana" }} choices={[google, osm]} mapProvider="leaflet" onSent={vi.fn()} />);
    expect(screen.queryByRole("radio", { name: "Cafe Puah" })).toBeNull();
    expect(screen.getByRole("radio", { name: "Old Park" })).toBeTruthy();
  });

  it("with nothing to pick, says so and cannot send; a refusal shows one neutral line", async () => {
    const { unmount } = render(<WalkTogetherSheet open onClose={vi.fn()} lang="he" client={fakeSupabase().client} friend={{ id: ID, name: "דנה" }} choices={[]} mapProvider="google" onSent={vi.fn()} />);
    expect((screen.getByRole("button", { name: "שליחה" }) as HTMLButtonElement).disabled).toBe(true);
    unmount();
    const f = fakeSupabase({ rpc: { send_walk_request: { data: null } } });
    render(<WalkTogetherSheet open onClose={vi.fn()} lang="en" client={f.client} friend={{ id: ID, name: "Dana" }} choices={[osm]} mapProvider="google" onSent={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Couldn't send it. Try again later.");
  });
});

describe("request cards", () => {
  const [incoming] = sanitizeRequests([{ id: ID, direction: "in", status: "pending", other_id: ID, other_name: "Dana", other_avatar: "boot", meet_kind: "osm", meet_ref: "osm-node-777", meet_name: "Old Park", meet_lat: 32.07, meet_lng: 34.78, meet_at: "2026-11-17T16:40:00Z", my_note: null, their_note: null, created_at: "2026-11-17T16:00:00Z" }]);

  it("an incoming request can be accepted, declined, or reported", () => {
    const h = { onAccept: vi.fn(), onDecline: vi.fn(), onCancel: vi.fn(), onMore: vi.fn() };
    render(<RequestCard request={incoming} lang="en" placeName="Old Park" {...h} />);
    expect(screen.getByText("Dana wants to walk with you")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    expect(h.onAccept).toHaveBeenCalled();
    expect(h.onDecline).toHaveBeenCalled();
    expect(h.onMore).toHaveBeenCalled();
  });

  it("the meeting card offers four fixed notes and no text field, and adds to the route only during a walk", () => {
    const onNote = vi.fn();
    const accepted = { ...incoming, status: "accepted" as const };
    const view = render(<MeetCard request={accepted} lang="en" placeName="Old Park" canAddToRoute={false} onNote={onNote} onAddToRoute={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Add to route" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "On my way" }));
    expect(onNote).toHaveBeenCalledWith("on_my_way");
    // four note chips (one now pressed) and Cancel
    expect(screen.getAllByRole("button")).toHaveLength(5);
    expect(screen.queryAllByRole("button", { pressed: true })).toHaveLength(0);
    view.unmount();
    const onAdd = vi.fn();
    render(<MeetCard request={accepted} lang="en" placeName="Old Park" canAddToRoute onNote={onNote} onAddToRoute={onAdd} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Add to route" }));
    expect(onAdd).toHaveBeenCalled();
  });
});

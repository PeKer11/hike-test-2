import { describe, expect, it } from "vitest";

import { sanitizeFriendCode, sanitizeFriendWalks, sanitizeFriends } from "@/lib/walks/friends";

const ID = "123e4567-e89b-12d3-a456-426614174000";

describe("friends sanitizers", () => {
  it("accepts a well-formed friend row and drops junk", () => {
    const rows = sanitizeFriends([
      { friendship_id: ID, friend_id: ID, label: "Friend AB12", status: "pending", incoming: true },
      { friendship_id: "x", friend_id: ID, label: "bad id", status: "pending" },
      { friendship_id: ID, friend_id: ID, label: "bad status", status: "blocked" },
      null,
      "str",
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].incoming).toBe(true);
    expect(sanitizeFriends({})).toEqual([]);
  });

  it("caps label length", () => {
    const [r] = sanitizeFriends([{ friendship_id: ID, friend_id: ID, label: "x".repeat(500), status: "accepted" }]);
    expect(r.label).toHaveLength(40);
  });

  it("sanitizes walks: drops unknown fields and bad stops, caps lengths", () => {
    const [w] = sanitizeFriendWalks([
      {
        id: ID, title: "t".repeat(300), status: "saved", created_at: "2026-10-24T10:00:00Z",
        start_lat: 1, email: "a@b.c", total_min: 45, distance_m: "far",
        stops: [
          { name: "Cafe", category: "food", lat: 32, lng: 34, extra: 1 },
          { name: "", category: "food", lat: 32, lng: 34 },
          { name: "Far", category: "x", lat: 200, lng: 34 },
        ],
      },
    ]);
    expect(w.title).toHaveLength(120);
    expect(w.stops).toEqual([{ name: "Cafe", category: "food", lat: 32, lng: 34 }]);
    expect(w.distanceM).toBeNull();
    expect(w.ownerLabel).toBe("Friend");
    expect(JSON.stringify(w)).not.toContain("a@b.c");
  });

  it("rejects walks with unknown status", () => {
    expect(sanitizeFriendWalks([{ id: ID, title: "t", status: "weird", created_at: "x" }])).toEqual([]);
  });

  it("validates friend codes", () => {
    expect(sanitizeFriendCode("ABCD2345")).toBe("ABCD2345");
    expect(sanitizeFriendCode("abc")).toBeNull();
    expect(sanitizeFriendCode(5)).toBeNull();
  });
});

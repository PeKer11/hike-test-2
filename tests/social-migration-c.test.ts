import { describe, expect, it } from "vitest";

import { functionsIn, grantedToAuthenticated, hasNotAppliedHeader, hasRevokeFromAnon, readMigration, revokedFromAuthenticated } from "./helpers/sql";

const sql = readMigration("20261119110000_walk_requests.sql");
const fns = functionsIn(sql);
const noComments = (s: string) => s.replace(/--.*$/gm, "");

describe("migration C (walk requests), SQL text", () => {
  it("says it is not applied, and that A, B come first", () => {
    expect(hasNotAppliedHeader(sql)).toBe(true);
    expect(sql).toMatch(/A 20261118100000_social_profiles\.sql, then B 20261119100000_walk_presence\.sql, THEN this file/);
  });

  it("the table is closed to every client role", () => {
    expect(sql).toContain("alter table public.walk_requests enable row level security");
    expect(sql).toMatch(/revoke all on table public\.walk_requests from anon, authenticated, public/);
    expect(noComments(sql)).not.toMatch(/create policy[^;]*walk_requests/i);
  });

  it("a meeting place is OSM (key + name + position) or a Google place id ONLY", () => {
    expect(sql).toContain("meet_ref ~ '^osm-(node|way|relation)-[0-9]{1,15}$'");
    expect(sql).toMatch(/meet_kind = 'google' and meet_ref ~ '\^\[A-Za-z0-9_-\]\{10,200\}\$'\s+and meet_name is null and meet_lat is null and meet_lng is null/);
  });

  it("has no free text: notes are an enum, there is no message column", () => {
    const table = noComments(sql.slice(sql.indexOf("create table if not exists public.walk_requests"), sql.indexOf("create index")));
    expect(table).not.toMatch(/\b(message|body|text_note|comment)\b/i);
    expect((table.match(/in \('on_my_way','late_10','here','cant_make_it'\)/g) ?? []).length).toBe(2);
  });

  it("every function is security definer, pinned, revoked from anon; client RPCs are granted, the trigger function is not", () => {
    for (const f of fns) {
      expect(f.body, f.name).toMatch(/security definer/i);
      expect(f.body, f.name).toMatch(/set search_path = public, pg_temp/i);
      expect(hasRevokeFromAnon(sql, f.name), f.name).toBe(true);
    }
    for (const n of ["send_walk_request", "respond_walk_request", "cancel_walk_request", "set_walk_request_note", "my_walk_requests"]) {
      expect(grantedToAuthenticated(sql, n), n).toBe(true);
    }
    expect(revokedFromAuthenticated(sql, "user_blocks_side_effects")).toBe(true);
    expect(grantedToAuthenticated(sql, "user_blocks_side_effects")).toBe(false);
    expect(sql).not.toMatch(/execute\s+format/i);
  });

  it("send_walk_request: limits, friends only, both presences on, every refusal is null", () => {
    const f = fns.find((x) => x.name === "send_walk_request")!;
    expect(f.body).toMatch(/\(0, 10, 15, 30, 45, 60\)/);
    expect(f.body).toMatch(/interval '1 hour'\) >= 5/);
    expect(f.body).toMatch(/interval '1 day'\) >= 20/);
    expect(f.body).toMatch(/>= 10 then/);
    expect(f.body).toMatch(/are_friends\(uid, p_to_user\)/);
    expect(f.body.match(/presence_audience = 'off'/g)?.length).toBe(2);
    expect(f.body).toMatch(/interval '7 days'/);
    expect(f.body).toMatch(/exception when check_violation[^;]*return null/);
    expect(f.body).not.toMatch(/return false|raise exception/);
    expect(f.body).toMatch(/p_meet_in_min \+ 30/);
  });

  it("respond is for the addressee only; cancel for either side; notes at most once per 15 s", () => {
    expect(fns.find((x) => x.name === "respond_walk_request")!.body).toMatch(/r\.to_user = auth\.uid\(\) and r\.status = 'pending' and r\.expires_at > now\(\)/);
    expect(fns.find((x) => x.name === "cancel_walk_request")!.body).toMatch(/auth\.uid\(\) in \(r\.from_user, r\.to_user\)/);
    expect(fns.find((x) => x.name === "set_walk_request_note")!.body).toMatch(/interval '15 seconds'/);
  });

  it("my_walk_requests reports 'expired', hides blocked pairs, last 24 h, limit 20", () => {
    const f = fns.find((x) => x.name === "my_walk_requests")!;
    expect(f.body).toMatch(/'expired'/);
    expect(f.body).toMatch(/not public\.is_blocked/);
    expect(f.body).toMatch(/interval '24 hours'/);
    expect(f.body).toMatch(/limit 20/);
  });

  it("blocking cancels open requests (trigger)", () => {
    expect(sql).toMatch(/after insert on public\.user_blocks/);
    expect(sql).toMatch(/set status = 'cancelled'/);
    expect(sql).toMatch(/drop trigger if exists user_blocks_side_effects/);
  });
});

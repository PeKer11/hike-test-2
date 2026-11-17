import { describe, expect, it } from "vitest";

import { functionsIn, grantedToAuthenticated, hasNotAppliedHeader, hasRevokeFromAnon, readMigration, revokedFromAuthenticated } from "./helpers/sql";

const sql = readMigration("20261118100000_social_profiles.sql");
const fns = functionsIn(sql);

describe("migration A (social profiles), SQL text", () => {
  it("says it is not applied and states the paste order", () => {
    expect(hasNotAppliedHeader(sql)).toBe(true);
    expect(sql).toMatch(/Paste ONLY AFTER the phase 4 code is deployed/);
  });

  it("has every expected function", () => {
    const names = fns.map((f) => f.name).sort();
    for (const n of [
      "is_blocked", "are_friends", "can_view_profile", "public_stops", "save_social_profile", "block_user", "report_user",
      "request_friend", "request_friend_by_id", "social_profile_card", "social_profile_walks", "list_friends", "friends_walks", "list_my_blocks",
    ]) expect(names).toContain(n);
  });

  it("every function is security definer with a pinned search_path and is revoked from anon/public", () => {
    for (const f of fns) {
      expect(f.body, f.name).toMatch(/security definer/i);
      expect(f.body, f.name).toMatch(/set search_path = public, pg_temp/i);
      expect(hasRevokeFromAnon(sql, f.name), `${f.name} revoke`).toBe(true);
    }
  });

  it("internal helpers are not callable by clients; client RPCs are granted", () => {
    for (const n of ["is_blocked", "can_view_profile", "public_stops"]) {
      expect(revokedFromAuthenticated(sql, n), n).toBe(true);
      expect(grantedToAuthenticated(sql, n), n).toBe(false);
    }
    for (const n of ["save_social_profile", "block_user", "report_user", "request_friend", "request_friend_by_id", "social_profile_card", "social_profile_walks", "list_friends", "friends_walks", "list_my_blocks", "are_friends"]) {
      expect(grantedToAuthenticated(sql, n), n).toBe(true);
    }
  });

  it("uses no dynamic SQL", () => {
    expect(sql).not.toMatch(/execute\s+format|execute\s+'/i);
  });

  it("are_friends only answers about the caller's own relationships and respects blocks", () => {
    const f = fns.find((x) => x.name === "are_friends")!;
    expect(f.body).toContain("auth.uid() in (a, b)");
    expect(f.body).toContain("is_blocked");
  });

  it("public_stops drops stops within 300 m of the start and strips Google names", () => {
    const f = fns.find((x) => x.name === "public_stops")!;
    expect(f.body).toMatch(/> 300/);
    expect(f.body).toMatch(/jsonb_build_object\('category', s->>'category', 'placeId', s->>'placeId'\)/);
    // the Google branch must come before any branch that carries a name
    expect(f.body.indexOf("'placeId', s->>'placeId'")).toBeLessThan(f.body.indexOf("'name', left"));
  });

  it("the profile walks have no title, no start point and no time of day", () => {
    const f = fns.find((x) => x.name === "social_profile_walks")!;
    const select = f.body.slice(f.body.indexOf("select w.id"), f.body.indexOf("public.public_stops("));
    expect(select).not.toMatch(/title|start_lat|start_lng|geometry/i);
    expect(select).toContain("::date");
    expect(f.body).toMatch(/not public\.are_friends/);
  });

  it("saved_walks select is own-only and the friends policy is dropped", () => {
    expect(sql).toMatch(/drop policy if exists "Read own walks or friends' shared walks" on public\.saved_walks/);
    expect(sql).toMatch(/create policy "Read own walks" on public\.saved_walks for select to authenticated using \(auth\.uid\(\) = user_id\)/);
    expect(sql).not.toMatch(/create policy "Read own walks or friends/);
  });

  it("list_friends is dropped, created, then granted", () => {
    const iDrop = sql.indexOf("drop function if exists public.list_friends()");
    const iCreate = sql.indexOf("create function public.list_friends()");
    const iGrant = sql.indexOf("grant execute on function public.list_friends()");
    expect(iDrop).toBeGreaterThan(-1);
    expect(iCreate).toBeGreaterThan(iDrop);
    expect(iGrant).toBeGreaterThan(iCreate);
  });

  it("display name checks, reserved names and the 18+ gate are present", () => {
    expect(sql).toContain("display_name !~ '[@<>/\\\\]'");
    expect(sql).toContain("display_name !~ '[0-9]{5,}'");
    expect(sql).toMatch(/traike\|admin\|support\|official\|moderator\|staff\|תמיכה\|מנהל\|צוות\|טרייק/);
    expect(sql).toContain("adult_required");
    expect(sql).toMatch(/visibility text not null default 'private'/);
    expect(sql).toMatch(/presence_audience text not null default 'off'/);
  });

  it("tables are RLS-enabled, closed to anon, and writes go through functions", () => {
    for (const t of ["social_profiles", "user_blocks", "abuse_reports"]) {
      expect(sql).toContain(`alter table public.${t} enable row level security`);
      expect(sql).toMatch(new RegExp(`revoke all on table public\\.${t} from[^;]*anon`));
    }
    expect(sql).toMatch(/revoke insert, update on table public\.social_profiles from authenticated/);
    expect(sql).toMatch(/revoke all on table public\.abuse_reports from anon, authenticated/);
  });

  it("is idempotent: tables use if not exists, policies are dropped first", () => {
    expect(sql).not.toMatch(/create table public\./);
    for (const m of sql.matchAll(/create policy "([^"]+)" on (public\.\w+)/g)) {
      expect(sql, m[1]).toContain(`drop policy if exists "${m[1]}" on ${m[2]}`);
    }
  });

  it("reporting auto-suspends at three distinct reporters", () => {
    const f = fns.find((x) => x.name === "report_user")!;
    expect(f.body).toMatch(/n >= 3/);
    expect(f.body).toMatch(/count\(distinct r\.reporter\)/);
  });
});

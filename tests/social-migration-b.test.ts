import { describe, expect, it } from "vitest";

import { functionsIn, grantedToAuthenticated, hasNotAppliedHeader, hasRevokeFromAnon, readMigration, revokedFromAuthenticated } from "./helpers/sql";

const sql = readMigration("20261119100000_walk_presence.sql");
const fns = functionsIn(sql);
const noComments = (s: string) => s.replace(/--.*$/gm, "");

describe("migration B (walk presence), SQL text", () => {
  it("says it is not applied and that A goes first", () => {
    expect(hasNotAppliedHeader(sql)).toBe(true);
    expect(sql).toMatch(/A 20261118100000_social_profiles\.sql FIRST/);
  });
  it("has no select policy on walk_presence and revokes the table from every client role", () => {
    expect(sql).not.toMatch(/create policy[^;]*on public\.walk_presence/i);
    expect(sql).toMatch(/revoke all on table public\.walk_presence from anon, authenticated, public/);
    expect(sql).toContain("alter table public.walk_presence enable row level security");
  });
  it("stores a cell, not a position", () => {
    const table = noComments(sql.slice(sql.indexOf("create table if not exists public.walk_presence"), sql.indexOf("create index")));
    expect(table).not.toMatch(/\blat\b|\blng\b|latitude|longitude|geometry/i);
    expect(table).toMatch(/cell_y integer/);
    expect(table).toMatch(/cell_x integer/);
  });
  it("every function is security definer with a pinned search_path, revoked from anon; the trigger function from everyone", () => {
    for (const f of fns) {
      expect(f.body, f.name).toMatch(/security definer/i);
      expect(f.body, f.name).toMatch(/set search_path = public, pg_temp/i);
      expect(hasRevokeFromAnon(sql, f.name), f.name).toBe(true);
    }
    expect(revokedFromAuthenticated(sql, "social_profiles_presence_guard")).toBe(true);
    for (const n of ["set_my_presence", "clear_my_presence", "walking_now"]) expect(grantedToAuthenticated(sql, n), n).toBe(true);
    expect(grantedToAuthenticated(sql, "social_profiles_presence_guard")).toBe(false);
    expect(sql).not.toMatch(/execute\s+format/i);
  });
  it("has the 60 s, 3-cell and 10-minute rules and the 20 minute expiry", () => {
    const f = fns.find((x) => x.name === "set_my_presence")!;
    expect(f.body).toMatch(/interval '60 seconds'/);
    expect(f.body).toMatch(/> 3/);
    expect(f.body).toMatch(/interval '10 minutes'/);
    expect(f.body).toMatch(/interval '20 minutes'/);
    expect(f.body).toMatch(/prof\.presence_audience = 'off'/);
  });
  it("walking_now is friends only, needs the caller's own presence on, and never returns a position", () => {
    const f = fns.find((x) => x.name === "walking_now")!;
    expect(f.body).toMatch(/are_friends\(auth\.uid\(\), p\.user_id\)/);
    expect(f.body).toMatch(/presence_audience <> 'off'/);
    expect(f.body).toMatch(/limit 30/);
    expect(f.body.slice(0, f.body.indexOf("language sql"))).not.toMatch(/\bcell_|\blat\b|\blng\b/);
  });
  it("the audience guard trigger deletes on off or suspension", () => {
    expect(sql).toMatch(/after update of presence_audience, suspended_at on public\.social_profiles/);
    expect(sql).toMatch(/drop trigger if exists social_profiles_presence_guard/);
  });
});

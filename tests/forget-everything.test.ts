import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const deleted: string[] = [];
let profileUpdate: Record<string, unknown> | null = null;

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: (table: string) => ({
      delete: () => ({
        eq: () => {
          deleted.push(table);
          return Promise.resolve({ error: null });
        },
        or: () => {
          deleted.push(table);
          return Promise.resolve({ error: null });
        },
      }),
      update: (patch: Record<string, unknown>) => ({
        eq: () => {
          if (table === "profiles") profileUpdate = patch;
          return Promise.resolve({ error: null });
        },
      }),
    }),
  }),
}));

import { DELETE, MEMORY_TABLES, PROFILE_LEARNED_RESET } from "@/app/api/forget-everything/route";
import { HABIT_ASK_KEY } from "@/lib/walk/companion/habit-ask-log";
import { START_LOCATION_KEY } from "@/lib/start-location";
import { clearLocalLearning, FORGOTTEN_EVENT, LEARNING_STORAGE_KEYS } from "@/lib/preferences/forget-client";

beforeEach(() => {
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  deleted.length = 0;
  profileUpdate = null;
});

/** Tables with a user_id column that deliberately are not in MEMORY_TABLES. */
const ALLOWED_NOT_FORGOTTEN: Record<string, string> = {
  llm_usage: "spend accounting for the budget guard, not walker-learned content",
};

function tablesWithUserId(): string[] {
  const dir = join(process.cwd(), "supabase/migrations");
  const found = new Set<string>();
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".sql"))) {
    const sql = readFileSync(join(dir, f), "utf8");
    for (const m of sql.matchAll(/create table (?:if not exists )?public\.(\w+)\s*\(([\s\S]*?)\n\);/gi)) {
      if (/\buser_id\b/.test(m[2])) found.add(m[1]);
    }
  }
  return [...found];
}

describe("forget everything", () => {
  it("every table with a user_id is forgotten or explicitly allow-listed with a reason", () => {
    const tables = tablesWithUserId();
    expect(tables.length).toBeGreaterThan(5);
    const unaccounted = tables.filter(
      (t) => !(MEMORY_TABLES as readonly string[]).includes(t) && !(t in ALLOWED_NOT_FORGOTTEN),
    );
    expect(unaccounted).toEqual([]);
    for (const reason of Object.values(ALLOWED_NOT_FORGOTTEN)) expect(reason.length).toBeGreaterThan(10);
  });

  it("deletes attraction_feedback and resets the learned profile columns", async () => {
    const res = await DELETE();
    expect(res.status).toBe(204);
    expect(deleted).toContain("attraction_feedback");
    expect(deleted).toContain("saved_walks");
    expect(deleted).toContain("friendships");
    expect(profileUpdate).toEqual(PROFILE_LEARNED_RESET);
    for (const col of ["pace_by_env", "walking_pace_min_per_km", "typical_walk_minutes", "session_count"]) {
      expect(profileUpdate).toHaveProperty(col);
    }
  });

  it("every learned profiles column added by a migration is in the reset", () => {
    const dir = join(process.cwd(), "supabase/migrations");
    const cols = new Set<string>();
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".sql"))) {
      const sql = readFileSync(join(dir, f), "utf8");
      for (const m of sql.matchAll(/alter table public\.profiles([\s\S]*?);/gi)) {
        for (const c of m[1].matchAll(/add column (?:if not exists )?(\w+)/gi)) cols.add(c[1]);
      }
    }
    const settingsNotLearned = new Set(["callout_level", "ui_language", "is_internal", "friend_code"]) // is_internal is an operator flag, not something the walker taught us;
    for (const c of cols) {
      if (!settingsNotLearned.has(c)) expect(PROFILE_LEARNED_RESET).toHaveProperty(c);
    }
  });

  it("client clears the habit-ask key and announces it", () => {
    const store = new Map<string, string>([[HABIT_ASK_KEY, "[1]"]]);
    const events: string[] = [];
    vi.stubGlobal("window", {
      localStorage: { removeItem: (k: string) => store.delete(k) },
      dispatchEvent: (e: Event) => events.push(e.type),
    });
    clearLocalLearning();
    vi.unstubAllGlobals();
    expect(store.has(HABIT_ASK_KEY)).toBe(false);
    expect(events).toEqual([FORGOTTEN_EVENT]);
    expect(LEARNING_STORAGE_KEYS).toContain(HABIT_ASK_KEY);
    expect(LEARNING_STORAGE_KEYS).toContain(START_LOCATION_KEY);
  });
});

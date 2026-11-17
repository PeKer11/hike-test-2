import { readFileSync } from "node:fs";
import { join } from "node:path";

export const readMigration = (name: string): string => readFileSync(join(process.cwd(), "supabase/migrations", name), "utf8");

/** Every `create [or replace] function public.name(` in the file, with the SQL text up to the closing `$$;`/`end; $$;`. */
export function functionsIn(sql: string): { name: string; body: string }[] {
  const out: { name: string; body: string }[] = [];
  const re = /create (?:or replace )?function public\.(\w+)\s*\(/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql))) {
    const start = m.index;
    const end = sql.indexOf("$$;", sql.indexOf("$$", start) + 2);
    out.push({ name: m[1], body: sql.slice(start, end + 3) });
  }
  return out;
}

export const hasRevokeFromAnon = (sql: string, fn: string): boolean =>
  new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from [^;]*\\banon\\b`, "i").test(sql);

export const revokedFromAuthenticated = (sql: string, fn: string): boolean =>
  new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from [^;]*\\bauthenticated\\b`, "i").test(sql);

export const grantedToAuthenticated = (sql: string, fn: string): boolean =>
  new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to authenticated`, "i").test(sql);

/** The shared header rule: not applied, pasted by hand. */
export const hasNotAppliedHeader = (sql: string): boolean => /NOT applied: Ariel pastes this into the Supabase SQL editor himself/.test(sql.slice(0, 400));

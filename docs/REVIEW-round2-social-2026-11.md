# Review: round 2, phases 4–9 (social) (2026-11-18)

Reviewer: fresh Opus, read-only on source. Range: `git diff 8627e43..feat/round2` (`33700a1` P4 … `946fe1c` P9), against `docs/PLAN-round2-2026-11.md` §3, §5 P4–P9 and `docs/PROGRESS-round2-2026-11.md`. Worktree head == `946fe1c`.

## תקציר

- **פסק דין: לא להדביק את מיגרציה A ולא להדליק דגלים עדיין.** יש ארבעה MUST. שלושה מהם נוגעים ל-A ואחד ל-B. כל אחד מהם הוא תיקון קטן.
- **M1:** משתמש מושעה (אחרי 3 דיווחים) מוחק את הפרופיל החברתי שלו בכפתור "מחיקת הפרופיל" ויוצר אותו מחדש. ההשעיה נעלמת והפרופיל חוזר להיות ציבורי. **אומת על Postgres אמיתי.**
- **M2:** "הולכים עכשיו": כל משתמש יכול לקרוא ל-RPC ישירות מהדפדפן ולשים את עצמו בכל תא. `clear_my_presence` מאפס את חוק "בלי קפיצות". כך חבר מגלה בשתי-שלוש קריאות את התא המדויק (~1 ק"מ) של חבר שהולך, ויכול לעקוב אחריו. זה בניגוד לטקסט ההסכמה "שם ועיר, אף פעם לא מיקום". עם D, זר רואה כל הולך "ציבורי" בכל מקום בארץ, ולא רק ברדיוס 2 ק"מ. **אומת.**
- **M3:** סקריפט בדיקת ה-RLS נכשל על הבדיקה הראשונה שלו: הוא מקבל `rate_limited` במקום `name_reserved`. אריאל יריץ אותו ויקבל שגיאה. **אומת.** כשמסירים את הבדיקה הזו, כל שאר הבדיקות עוברות.
- **M4:** `friends_walks` עדיין מחזירה כותרת ("<שם התחנה הראשונה> + N, תאריך"). התחנה הראשונה היא בדיוק זו שליד הבית, ש-`public_stops` מסתירה, ולפעמים זה שם של Google. היא גם מחזירה שעה מדויקת. דף הפרטיות מבטיח את ההפך. **אומת.**
- **D (זרים בסביבה) באמת כבוי**, כל עוד D לא הודבק. אומת: בלי D אף זר לא נראה, גם בקריאה ישירה ל-RPC. אבל ברגע ש-D מודבק, הדגלים לא עוצרים כלום, ויש שלושה SHOULD שחוסמים את שער D: S2, S3, S10.

## Checks run

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| eslint on the changed `src` files and test helpers | 0 errors, 64 warnings |
| `npx vitest run` (full) | 3202 passed, 1 failed: `tests/assistant-chat-undo.test.tsx` (known, pre-existing) |
| **Migrations on real Postgres** | **PGlite 0.2.17 = PostgreSQL 16.4 (WASM), outside the repo.** Supabase-like setup: roles `anon`/`authenticated`/`service_role`; `auth.users`; `auth.uid()` read from `request.jwt.claims`; the public-schema default ACL that grants ALL/EXECUTE to anon, authenticated and service_role (as `20260824090000` describes). All 39 migrations apply in order. A, B, C and E apply cleanly a second time. |
| `supabase/checks/social_rls_check.sql`, as written | **fails**: `reserved name was not refused: rate_limited` (M3) |
| Same script minus that one assert | both parts pass, without D and with D |
| Probes P0–P11, Q1–Q8, R1–R4 | results are cited per finding below |

Probe files (scratch, outside the repo; nothing in the repo was written except this file): `/private/tmp/claude-501/-Users-arielshorpacker-Documents-obs-vault-try/524556ef-c0ac-4ecf-a3bd-ee43717b0761/scratchpad/scripts/` (`harness.mjs`, `probes.sql`, `probes2.sql`, `probes3b.sql`, `checkrun.sql`). Run them with `node harness.mjs <pglite dist/index.js> <migrations dir> <probe.sql>`. Env `SKIP=20261125100000` leaves D out.

---

## MUST

### M1 (A) Suspension is undone by deleting and re-creating the profile
- `20261118100000_social_profiles.sql:44-45`: the policy "Delete own social profile" lets the walker delete their own row.
- `save_social_profile` (`:136-138`) checks `suspended_at` only on an existing row. With no row, it creates a fresh one.
- The UI gives this away in one tap: `ProfileEditSheet.tsx:142` → `deleteMyProfile` (`profiles.ts:226-230`) is a direct table delete. `forget-everything/route.ts:29` deletes `social_profiles` too.

**Scenario, verified (probe P2):**
1. Alpha is auto-suspended by 3 reports. `save_social_profile` returns `suspended`.
2. As Alpha: `delete from social_profiles …`, then `save_social_profile('Alpha','boot','public',…,true)` returns `ok`.
3. The row now has `suspended_at` null, visibility `public` and presence `friends`. The harasser is back in walking-now, walk requests and public profiles until someone files another report.

The plan's decision 15 ("auto-suspend until the owner reviews") does not hold.

Fix:
- keep the suspension in a record the walker cannot delete, for example `social_suspensions(user_id pk → auth.users on delete cascade, suspended_at, reviewed_at)`;
- check that record in `save_social_profile`, `can_view_profile`, `set_my_presence`, `walking_now` and `send_walk_request`;
- or drop the delete policy and add a `delete_my_social_profile()` RPC that keeps a tombstone while suspended. Forget-everything must go through the same path.

Add a check-script case for this. Keeping that tombstone after erasure is a counsel item, the same as `abuse_reports`.

### M2 (B; blocks D) Presence is client-writable anywhere. Friends can pinpoint and follow a walker's 1 km cell
`set_my_presence`, `clear_my_presence` and `walking_now` are granted to `authenticated` (`20261119100000_walk_presence.sql:115-117`). The browser holds the session, so it can call them directly. Every protection in `/api/social/presence` is skipped that way:
- the `classifyPoint` deny zones (`route.ts:47-50`);
- the 6/min limiter;
- the 800 m / 10 min home rule (client publisher only);
- the 4/min `walking-now` limiter.

What the SQL does enforce can be undone: `clear_my_presence` (`:58-61`) deletes the row, and the next `set_my_presence` sees `not found`, so `fresh` is true (`:41`) and the 3-cell "no jumps" rule (`:44`) is skipped.

**Scenario, verified (Q1–Q3):**
1. Hotel walks in cell (3207,3477). Friend Golf is 30 cells away and sees "far". A direct 30-cell move is refused.
2. `clear_my_presence(); set_my_presence(3207,3477)` succeeds, and `walking_now` now says Hotel is **here**.
3. One cell east, it says **near**.

So the exact cell is found in 2–3 calls, and repeating every minute gives the walker's track and direction. The consent line says "Friends see your name and city, never a position" (`copy.ts:125,265`). The privacy draft says "friends see your name and the city" (`privacy/page.tsx:10`) and never mentions a distance bucket. Plan §3.2 says "never direction". The plan's R5 threat (coercive control) is exactly a "friend".

**With D (Q7, Q8):** stranger Sierra in Haifa sees nobody. She teleports next to Papa in Jerusalem, sees "Papa · here", and sends him a request. The "only within ~2 km of each other" rule depends on a position the client chooses, so any public walker anywhere can be found and contacted.

Fix (minimum before pasting B):
- `clear_my_presence` keeps a tombstone instead of deleting: set `expires_at = now()`, keep the cell and `updated_at`;
- a "new walk" may jump only after ≥ 30 min, at most 3 a day; the jump rule otherwise always compares to the last cell;
- for friends, drop `distance_bucket`, or at least `here`. It is not in the consented copy. Update the copy and the privacy draft either way.

Before D, writes and reads must also go through the server only:
- revoke the three functions from `authenticated`;
- have the routes call `service_role`-only variants that take `p_user` from `getUser()`;
- rate-limit `walking_now` there.

GPS itself can be spoofed, but then the jump and teleport caps bound how fast anyone can scan.

### M3 (check script) `social_rls_check.sql` fails on its first assertion, every time
- `social_rls_check.sql:37-40` creates A's profile, then immediately calls `save_social_profile('Traike Admin', …)` as A.
- `save_social_profile` checks `rate_limited` (`20261118100000:139`, `updated_at > now() - 3 s`) **before** `name_reserved` (`:140`).
- `now()` is fixed within the transaction, so the second call always returns `rate_limited`.

Verified: running the script raises `reserved name was not refused: rate_limited`. Handoff step 5.1 asks Ariel to run this script and send the output. As written, it can only fail, and the other part-1 checks never run.

Fix: test the reserved name with B's first call, before B has a row, or back-date `updated_at` as the owner between the calls. With the assert removed, both parts pass in PGlite, with and without D. While fixing it, see S6: the coverage is A only.

### M4 (A) `friends_walks` still serves the home-adjacent stop name (and Google names) in the title, plus exact times
`20261118100000:319,321` returns `w.title` and `w.created_at` unchanged:
- titles are `"<first stop name> + N more, <day>"` (`walk-history.ts:61-66`);
- the first stop is the one most likely within 300 m of the start, and `public_stops` drops exactly that stop;
- for a Google stop, the title is Google Places content served to another user, which the plan's Google rule (§3.9) forbids.

Verified (P7): the stop "Cafe Nearhome" (90 m from the start) is gone from `stops`, but the title still names it. `created_at` is a full timestamp, about the walk's start time.

The P5 privacy draft (`privacy/page.tsx:9`) promises "Stops within 300 m of a walk's start are left out … Never your start point, route line or time of day". PROGRESS flags this for counsel, but it is an engineering fix in the same function, and the plan already decided "no title" for exactly this reason.

Fix (same return shape, so `create or replace` still works):
- `title` → `coalesce(w.area_label, 'Walk')`, or a neutral `'Walk'`; `friends.ts:103` needs a non-empty title;
- `created_at` → `date_trunc('day', w.created_at)`.

`planSharedWalk` copies the title into the friend's own walk, so the fix also stops the name spreading further.

---

## SHOULD

- **S1. Reports can be weaponised, and the owner's restore does not stick.** `report_user` (`20261118100000:181-187`) counts every report in 7 days:
  - including ones the owner already marked `reviewed`;
  - including reports from people the target blocked;
  - with no need for any relation to the target.

  Verified (P1, P3): after Alpha blocked Bravo, Bravo's **single** report re-suspended Alpha, because the two older reporters were still counted. Three sock-puppet accounts (profiles older than a day) can suspend any user whose UUID leaks through an `&u=` profile link. Fix:
  - count only `status = 'open'`;
  - ignore reporters the target has blocked;
  - consider requiring some prior contact (friendship, request or presence) for a report to count toward the auto-suspend.
- **S2 (C; blocks D). The meeting place is free text plus any coordinates.**
  - The table check (`20261119110000:22-25`) only shapes `meet_ref`. `meet_name` can be any 1–80 characters, and `meet_lat/lng` can be any point.
  - Verified (Q4): `send_walk_request(…, 'osm', 'osm-node-1', 'Call me 050-123-4567, flat 3, back door', 31.5, 34.9, 0)` is accepted and shown to the recipient. Q8 shows the same through D for a stranger.
  - "Add to route" (`WalkPlannerApp.tsx:1334-1340`) pins the sender's coordinates.
  - `sourceOf` (`walk-history.ts:21-23`) then labels the stop `osm`, so the sender's text later appears as an "OSM stop name" on the recipient's public profile.

  This contradicts "no free text anywhere" and "we meet only in a public place". Fix:
  - resolve OSM refs on the server (POI cache or lookup by id) before insert, or send only the ref and resolve it on the recipient side;
  - save meeting stops with `source: "other"`;
  - required before D.
- **S3 (blocks D). "Everyone nearby" can be chosen before D exists, with a consent stamp.** Verified (R1): `save_social_profile(…, 'public', …)` called directly returns `ok` and stamps `public_consent_at`. The client coercion (`profiles.ts:211`) is the only guard. Those walkers become visible to strangers the moment D is pasted, under consent given against non-counsel copy. `public_consent_at` is also shared with "public profile" consent (`:146`), so nearby consent is not recorded separately (plan §3.9). Fix:
  - A coerces `'public'` presence to `'friends'`;
  - D replaces `save_social_profile`, adds `nearby_consent_at`, and resets existing `'public'` audiences to `'friends'` on paste.
- **S4. Flags are not kill switches; give each migration an "off" SQL.**
  - Once a migration is in, every RPC is callable directly. The comment in `flag.ts:24-27` ("the client flag alone can never switch this on") is true only before D.
  - The walking-now filter (`walking-now/route.ts:22`) does not stop a direct `walking_now()`, `send_walk_request_nearby()` or `social_profile_card_by_token()`.
  - `NEXT_PUBLIC_*` values are inlined at build time, so flipping one needs a redeploy.

  Ship a rollback file for D (restore B's `walking_now`; drop `send_walk_request_nearby` and `social_profile_card_by_token`) and one-line `revoke execute … from authenticated` kill switches for B and C. Add them to the handoff.
- **S5 (E). The taste cooldown is under the walker's control.**
  - E grants own insert/update on `taste_summaries` (`20261126100000:27-31`), so the walker writes `created_at` (verified: `2000-01-01`).
  - The route's DELETE (`taste/route.ts:149-158`), which the card offers as "Delete" (`TasteCard.tsx:93`), clears the row, and the next POST calls the model again.
  - Own `saved_walks` inserts can also satisfy "3 new walks".

  The per-caller budget ($0.25/day) still caps the cost, but P9 acceptance ("at most one call per user per 7 days") does not hold. Fix: keep the last-generated time somewhere the walker cannot write (for example `llm_usage` or a server-written column), and write `taste_summaries` only through the route.
- **S6. The RLS check covers A only, and one assert is fragile.** Add:
  - anon catalog checks (`has_function_privilege('anon', …)` over every new function, `has_table_privilege` over the 6 new tables; P0 shows the expected answers);
  - B: reciprocity, expiry, the M2 teleport;
  - C: friends only, blocks cancel requests, note rate limit;
  - E: tags only with `show_taste`;
  - D (rolled back): nearby needs both public;
  - `report_user` suspension and the M1 evasion;
  - `list_friends` hides names on outgoing pending requests.

  Also `:132-133` asserts `friends_walks` returns exactly 1 row, which fails if test account A has real shared walks. Filter by the inserted id. The probes listed above can be pasted in as a starting point.
- **S7 (A). A public profile shows walks the walker had marked private.** `social_profile_walks` (`:283-284`) ignores `saved_walks.visibility`. Verified (P8): a completed walk with `visibility='private'` ("Secret spot") is listed with its OSM stop for a non-friend once the profile is public. `show_history` defaults on, and the line says only "…sees your name, stats and walks" (`copy.ts` `vPublicLine`). Either:
  - honour per-walk `private`; or
  - default `hidden_from_profile = true` for walks finished before the profile first left `private`, and say "all your past walks" in the line.
- **S8 (A). Display-name rules are bypassed with invisible characters.** Verified (Q6): `E'Tr​aike ‮troppus'` is accepted. It renders as "Traike support". Reject `[­​-‏‪-‮⁠-⁩﻿]` in the table check and in `validateDisplayName`, and NFKC-normalise before the reserved-word test.
- **S9. Consent copy does not match the data.**
  - The walking-now line and the privacy draft omit the here/near/far bucket (see M2).
  - Plan §3.9's "don't share on a base" line is missing.
  - `vPublicLine` does not say that past walks are included (S7).
- **S10 (D). Walk requests reveal a stranger's permanent user id.** `my_walk_requests` returns `other_id` (`20261119110000:127`). Verified (Q8): after a nearby request, Sierra gets Papa's UUID, although Papa's profile is **private**. That defeats the per-walk token design (plan R5), and it feeds S1 (report by UUID). For non-friends, return `other_id` null and add `block_by_request(id)` / `report_by_request(id)`.

---

## NICE

1. `set_my_presence` with a null cell raises an unhandled `not_null_violation` (`20261119100000:44-55` only catches `check_violation`). The route always sends numbers.
2. `public_stops` relies on the planner evaluating the regex before the `::float8` casts (`20261118100000:119-122`). It held on PG16 (P7: `lat:"abc"` did not error), but evaluation order is not guaranteed. A friend's malformed row would then break `friends_walks` for all their friends. Wrap the distance in `case when … ~ … then … end`.
3. Re-pasting A after E silently resets `taste_tags` to `'{}'` (verified R4), although A's header says "safe to paste twice". Note it in A's header, or have E own the card.
4. The default ACL leaves `TRUNCATE`, `REFERENCES` and `TRIGGER` to `authenticated` on `social_profiles`, `user_blocks` and `taste_summaries` (P0c). PostgREST cannot reach these, but `revoke truncate, references, trigger` makes it tidy.
5. `block_user`, `report_user` and `request_friend_by_id` return false on a foreign-key violation and true otherwise, which shows whether a UUID is a user. Low risk (UUIDv4).
6. `useSocialInbox.ts:20` polls every 30 s for every signed-in walker once the presence flag is on, even with no profile. The plan says "with a profile".
7. `HomeView.tsx:128-129` would list nearby strangers as "friends walking" when D is on. Filter `relation === "friend"`.
8. `BlockReportSheet.tsx:38` pre-selects "harassment", which skews the review queue. Start with no reason selected.
9. The audience and taste toggles ignore the save result (`SocialView.tsx:122-123`, `TasteCard.tsx:43`). The 3 s rate limit makes a quick second toggle a silent no-op.
10. Forget-everything also deletes the walker's own blocks (`forget-everything/route.ts:66`). After they make a new profile, people they blocked can find them again. Say so in the confirm copy, or keep blocks as safety data.
11. Presence home protection uses `walkStartPointRef`, which `handleBuildWalk` resets to `input.origin` on every non-`autoResume` build (`WalkPlannerApp.tsx:1445-1463`). I did not trace every mid-walk path. If any of them builds without `autoResume`, the 800 m zone moves away from home, and the walk back home on a loop is published. Keep a separate presence-home point, set once per walk. Consider an end-point zone too.
12. Expired presence rows stay until another walker publishes (`20261119100000:38`), so everyone's last cell sits in the table indefinitely. Clean it up from `walking_now`'s caller path or with pg_cron.
13. `area_label` falls back to client text (`presence/route.ts:27`) and is free text through the direct RPC. Friends see it, and strangers too with D.
14. Builder-known: no block/report on the walk-sheet request alert; "Hide from profile" starts with the wrong label; RequestCard and MeetCard share one file.

---

## Verified as correct

- **SQL hygiene:**
  - every new function is `security definer` with `set search_path = public, pg_temp`;
  - there is no dynamic SQL;
  - every function has a matching revoke;
  - `list_friends` is dropped, created and re-granted.
- **Grants (PGlite with the Supabase default ACL simulated):**
  - with A–E applied, `anon` can execute **zero** public functions and has no privilege on any of the 6 new tables;
  - `authenticated` cannot execute `is_blocked`, `can_view_profile`, `public_stops`, `_insert_walk_request` or the 2 trigger functions;
  - `walk_presence`, `walk_requests` and `abuse_reports` have no client privileges;
  - `saved_walks` select is own-rows only.
- **Blocks hold both ways** in `can_view_profile`, `are_friends` (also refuses third-party pairs), `list_friends`, `request_friend` (both versions), `request_friend_by_id`, `walking_now` (both branches), `send` / `respond`, `my_walk_requests` and `card_by_token`. The C trigger cancels open requests on block. (The exception is `report_user`: see S1.)
- **D is off:**
  - without D, a stranger who teleports next to a public walker still sees nobody, and `send_walk_request_nearby` does not exist (Q7, Q8);
  - client paths need both flags; the route drops stranger rows without `SOCIAL_NEARBY`; `?w=` is ignored with the flag off;
  - `saveProfile` turns "public" into "friends".
- **Projections:** `public_stops` drops stops within 300 m, keeps Google stops as id only, and in strict mode names only OSM stops (check-script part 2 passes). Outgoing pending friend requests show no name.
- **Ordering:** A → B → C → (D) → E applies cleanly. D adds the `_insert_walk_request` helper that C lacked, and E's card keeps the shape D's `card_by_token` uses.
- **Tolerance:**
  - every client call returns before the network with its flag off;
  - a missing function or table (`PGRST202`, `PGRST205`, `42883`, `42P01`) hides the feature;
  - forget-everything tolerates missing tables.
- **Taste:**
  - no learning consent → 403 before any read;
  - migration E missing → "unavailable" before any spend;
  - the prompt has no Google names, coordinates, dates or titles;
  - the parser drops foreign areas and rejects phone or address text;
  - `LlmBudgetExceededError` → 429;
  - others see only the enum tags, and only with `show_taste`.
- **Presence routes:** flag off → 404, signed out → 401, zod bounds, nothing logged, only the cell is sent to the database.

## What was verified vs not verified

**Verified:**
- by me, on PostgreSQL 16.4 (PGlite) with simulated Supabase roles and default ACL:
  - every migration applies;
  - A, B, C and E are idempotent;
  - the grants;
  - the check script (M3);
  - the findings marked "verified" above (P0–P11, Q1–Q8, R1–R4);
- tsc, eslint and the full vitest run;
- reading every changed SQL file and the social routes, libs and sheets.

**Not verified:**
- **Real Supabase:**
  - PostgREST exposure and its error codes;
  - the production default ACL as actually configured (simulated here from `20260824090000`'s description);
  - function owners: PGlite runs as superuser, while Supabase's `postgres` is not a superuser but owns the tables;
  - the real `auth.uid()`;
  - Realtime and pg_graphql exposure of the new tables.
- **Real use:** two real accounts and two phones (walking now, 20-min expiry, requests); iOS background throttling; the Vercel IP-city header; Places resolve with a real key; LLM output quality and cost.
- **Not traced:** the UI was not run in a browser by me (the builder's screenshots used a mock); whether any mid-walk build resets the presence start point (N11).
- **Legal:** counsel items (consent model, 18+, retention of reports and suspension tombstones, the DPIA for D).

---

## Fix status (2026-11-18)
- **M1 fixed:** new table `social_suspensions` (service role only), written by `report_user`, checked by `save_social_profile` when there is no profile row. Owner restore = delete the row there + clear `suspended_at`. Added to `tests/forget-everything.test.ts` as an intentional non-erasure (counsel item). Check-script case 7 added.
- **M2 (B) fixed, minimum version:** `clear_my_presence` keeps a tombstone; a jump needs 30+ min since the last write; housekeeping keeps ended rows 30 min; friends get `distance_bucket = null`. Verified on Postgres: clear + far set is refused, a near set works, `walking_now` shows no bucket. **Not done (still blocks D):** server-only presence writes/reads, no daily jump cap (S-level). **Copy updated:** the privacy page now says presence rows are removed within about 50 minutes of a walk ending.
- **M3 fixed:** the reserved-name check runs before A has a row. The script now passes end to end (Postgres, with placeholders replaced).
- **M4 fixed:** `friends_walks` title = area label or "Walk"; `created_at` truncated to the day.
- Not touched: all SHOULD items (S1–S10) and D.
- Tests: tsc clean, eslint 0 errors, suite green except the known `assistant-chat-undo`.

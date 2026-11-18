# Round 2 — manual test checklist and preview steps (2026-11-18)

Branch: `feat/round2` (head 490d382 or later). Production = `main` (e790974). Nothing here is deployed yet.

## 0. One thing to decide first: which database does the preview use?
Migration A changes `are_friends`, `list_friends` and `friends_walks`, which the **old production code** also calls. If the preview
points at the **production Supabase**, pasting A changes production too, before round-2 code is live there.
- **Safest:** a separate Supabase project for the preview (copy the schema: run the existing migrations in order, then A, B, C, E).
- **Acceptable only if you accept the risk:** same DB, and paste A only right before promoting round 2 to production.
Do not paste anything until you chose.

## 1. Preview deploy (platform-specific, do it in your hosting dashboard)
1. Deploy branch `feat/round2` as a **preview** (not production). In a Vercel-style setup this is the branch's preview URL.
2. Preview env vars: the normal ones (Supabase URL/key of the DB you chose in §0, LLM keys) plus, in this order after each migration:
   - `NEXT_PUBLIC_SOCIAL=1` (master), `NEXT_PUBLIC_SOCIAL_PROFILES=1` after A
   - `NEXT_PUBLIC_SOCIAL_PRESENCE=1` after B
   - `NEXT_PUBLIC_TASTE_SUMMARY=1` after E (optional)
   - **Never** set `SOCIAL_NEARBY` / `NEXT_PUBLIC_SOCIAL_NEARBY` (D is locked).
   `NEXT_PUBLIC_*` values are baked in at build time: change one, redeploy.
3. Migrations, in the Supabase SQL editor, each only when its code is live on the preview:
   A `20261118100000_social_profiles.sql` → run `supabase/checks/social_rls_check.sql` (replace `__USER_A__`, `__USER_B__` with two test-account UUIDs) → send me the output → B `20261119100000` → C `20261119110000` → E `20261126100000` (optional). Not D.
4. Panic buttons: `supabase/kill-switches/` (off-B, off-C, rollback-D).

## 2. Two accounts (X, Y) + a phone. Tick each.
**Profile (A)**
- [ ] X creates a profile (18+ checkbox required, name 2–30 chars). A name like "Traike support" is refused.
- [ ] Default visibility is private; Y cannot open X's profile link.
- [ ] X sets public: Y sees name, avatar and stats; X's walks marked private do NOT appear.
- [ ] X "delete social profile", then recreates: works (not suspended).

**Friends, block, report**
- [ ] X and Y become friends by code. Y sees X's friends-visible walk: title is the area name or "Walk", not a place name; no stop within 300 m of the start; no time of day.
- [ ] X blocks Y: friendship gone, Y cannot find or add X, Y sees no block notice.
- [ ] Y reports X once: nothing visible happens (3 distinct reporters needed; do not test the auto-suspend on real accounts).

**Walking now (B), phone with GPS, both accounts friends**
- [ ] X turns on "walking now" (friends). Nothing appears in the first 10 min or within 800 m of the start.
- [ ] After that Y sees "X is walking": name, city, rough time since start. **No distance** (here/near/far must not appear).
- [ ] X turns it off or ends the walk: X disappears for Y.

**Walk requests (C)**
- [ ] X sends Y a request with a meeting place from the list; Y accepts, declines, adds to route. Y cannot type free-text meeting places.

**Taste summary (E, optional)**
- [ ] Generate once; delete; confirm it does not call the model again within 7 days (known gap S5: it will — note what you see).

**Round 1–3 regression (quick)**
- [ ] Quick walk: "yes" adds the place; "off-route" card is centered; start screen tiles; history tabs.

## 3. What to send back
- The `social_rls_check.sql` output (success line `ALL CHECKS PASSED`, or the exception text).
- Anything on the list above that fails, with a screenshot.

## 4. Known and left open
S2, S10 (D blockers), S5, S9, NICE items: see `docs/REVIEW-round2-social-2026-11.md`. Known test failure: `assistant-chat-undo`.

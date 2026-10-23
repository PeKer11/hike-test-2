# Traike Social Plan v2: recommendations, open-data import, friends, "walkers like you"

Status: plan only. Nothing here is built by this plan. The planner wrote it on 2026-10-23 and edited no files. It builds on `docs/PERSONALIZATION_SOCIAL_PLAN.md` §4 and on the O1-S / R1 entries in `docs/NEXT_PHASE_DECISIONS.md`. The sequencing rule from `TODO.md` (Social item) holds: social reaches real users only after the legal review, the patent/IP review and the public site have cleared. It starts right after that gate, never before it or alongside it. Building behind a default-OFF flag before the gate is allowed only where the existing plan already allows it.

Owner constraints carried forward:
- No Google data in walking routes or in any social table.
- Location is treated as especially sensitive (Amendment 13).
- Live features are off by default, friends-only, and have ghost mode.
- Strangers' live dots are never shown.
- Product copy never uses the owner's personal name.

---

## Summary in Hebrew (תקציר)

1. **"המלצה על מקום"**: כפתור "מקום מעולה" ועוד עד 3 תגיות קבועות (נוף, צל, שקט, מתאים לילדים, קפה). **בלי טקסט חופשי ב-v1**, כדי שלא נצטרך מודרציה ולא יגיע אלינו מידע אישי. ההמלצה של המשתמש משפרת את המסלולים שלו כבר עכשיו, לפי ההסכמה הקיימת. אחרים יראו אותה רק אחרי השער המשפטי, רק כאגרגט (לפחות 5 הולכים שונים, עיכוב של 48 שעות, מספר מעוגל) ובלי שמות.
2. **ייבוא המלצות קיימות**: **אין אתר עם המלצות משתמשים אמיתיות בהיקף גדול שמותר לקחת ממנו.** גוגל, Tripadvisor, AllTrails, Komoot, Wikiloc, טיולי/למטייל, iNature ועמוד ענן אוסרים העתקה או אחסון, או לא מפרסמים רישיון פתוח. מה שמותר לקחת הוא מידע פתוח ו"עורכותי": רשימות "לראות/לעשות" של ויקימסע (CC BY-SA, עם ייחוס), צפיות בוויקיפדיה (CC0, מדד פופולריות), ויקינתונים (CC0) ו-OSM (ODbL). המלצות אמיתיות בעברית אפשר להשיג רק דרך שותפות, ומועמדים טובים הם עמוד ענן / Israel Hiking Map וטיולי.
3. **חברים**: שני שלבים. **F1**, מיד אחרי השער: חברות הדדית בהזמנה בלבד, וחברים רואים זה את ההמלצות של זה ו"כרטיס הליכה" שהמשתמש בחר לשתף (אזור, מרחק, יום, בלי קו מסלול ובלי שעה). **F2**, "הולך עכשיו": רק אחרי DPIA ואישור גיל 18+. מוצג שם אזור כללי בלבד, דרך Supabase Realtime בערוץ פרטי. אין טבלת מיקום. במצב רפאים לא נשלח שום דבר, ומבחוץ אי אפשר להבחין בין "רפאים" לבין "לא הולך".
4. **"Netflix"**: עם מעט משתמשים, CF מייצר רעש. עד שיש מספיק משתמשים: התאמה לפי טעם (קיים), ציון פתוח (ויקי) וטרנדים (קיים). אחר כך: **"פלחי טעם"** קבועים ("אוהבי טבע ונוף") ו-"מי שאהב A אהב גם B", ושניהם עומדים ב-k-אנונימיות. אחר כך: פירוק מטריצות. כל אלה הם סיגנל דירוג מוגבל, שלעולם לא גובר על מה שהמשתמש עצמו ביקש או דחה.

---

## 0. What exists today (from the code, 2026-10-23)

| Fact | Where | Consequence for v2 |
|---|---|---|
| S1 `community_place_support(text[])` and S2 `similar_walkers_places(text[])` are built as **live SECURITY DEFINER functions** (no materialized view). They enforce k ≥ 5, 48 h delay on votes and opt-ins, buckets 5+/10+/25+, OSM keys only, ≤ 50 keys, and caller must be opted in. | `supabase/migrations/20261012110000_social_aggregates.sql`, `src/lib/social/*`, `/api/social/{aggregates,optin}` | The foundation is in place. **The migration was never run against Postgres.** |
| Opt-in is a separate `community_optin` table, and one toggle both contributes and lets you see. | same | Reuse it for "community". Friends get their own toggles (§2.3). |
| The flag is `NEXT_PUBLIC_SOCIAL`, default OFF. With it off, the UI does not render and the routes return 404. | `src/lib/social/flag.ts` | New features get their own sub-flags. |
| Community data is **badge only**. Nothing ranks by it. | `WalkPlanResults.tsx`, `useCommunityBadges.ts` | Ranking integration is new work (§4.4). |
| S2 was built as **user-user cosine**. The original plan's default was item-item. | migration above | Revisited in §4 (Q2). |
| The only cross-user place signal is end-of-walk POI upvotes in `attraction_feedback` (`poi_key` = `osm-node-123`). | initial schema, `aggregates.ts` `KEY_RE` | "Recommend" needs a deliberate action of its own (§2.1). |
| `walk_summaries` stores `area_label`, the UTC start hour, distance and duration. **No route geometry is stored anywhere.** | `20261011100000_companion_memory.sql` | "Who walked where" must be an explicit shared card, not a lookup into history. |
| No age field, no friend tables, no Realtime use. | grep | Everything for friends is new. |
| `NEARBY_PROVIDER` defaults to `osm`; Google is optional behind an env var. | `src/lib/places/nearby-provider.ts` | Social and import tables accept **OSM keys only**. Google content is never stored. |
| Ranker scale: base by category 3 to 5 (widest gap about 10), `PREFERRED_CATEGORY_BOOST` 4, `TRENDING_CATEGORY_BOOST` 2 (applied only without personal signal), notability +3 for wikidata / +2 for wikipedia, distance −1 per km. | `src/lib/attractions/attraction-ranker.ts` | Social and open signals are capped below 4, so they never override an explicit ask (§4.4). |

**Gaps found in the built S1/S2 (fix before the flag is ever ON):**
1. **The plan's military/deny-zone exclusion is not in the SQL.** Neither function excludes POIs in deny zones or near `landuse=military`. Add an `excluded_poi_keys` table, filled by a server job using `safety-zones.ts`, and join it out.
2. **Key probing.** The migration says so itself: the "only keys you already hold" rule is enforced by the API route, not the DB. Anyone calling the RPC directly can probe any OSM key. Add a DB-side rate limit (a per-user call counter table, as in the `llm_usage_bump` pattern), or revoke `authenticated` execute and call only through the server with the service role plus the user id.
3. **Internal and test accounts** (the owner's) must be excluded from all aggregates: `profiles.is_internal boolean default false`, filtered in every social function. Otherwise two test accounts plus three friends can satisfy k = 5 with fake signal.
4. **Never run live.** Apply the migration to a Supabase branch or staging project and run the RLS tests in §5 with two or more real JWTs.

---

## 1. Phasing and build order (legal gate placement)

| Phase | When | Packages | Visible to others? |
|---|---|---|---|
| **P0: pre-gate, flags OFF** | now | **G0** fix the four gaps above and run the migration on staging (S). **R1** Recommend button + tags, private use only (M). **I1** open-data import pipeline + `open_place_signals` (M). **C0** CF offline harness + ranking hook with social weights = 0 (S–M). | No. R1 data feeds only the user's own ranking, under the existing `learnPreferences` consent. I1 contains no personal data. |
| **GATE** | owner | Legal review covers: consent copy (HE/EN), Amendment 13 classification, DPIA-lite for P1/F1, CC BY-SA and ODbL attribution plus the derivative-database question, patent/IP, public site. | — |
| **P1: right after gate** | +0 | Turn on S1 badge + **community ranking signal** + recommendation tags (k ≥ 5). Turn on open-data badges ("In Wikivoyage", "Popular on Wikipedia"). | Yes, aggregates only. |
| **F1: friends, no live** | +2–4 weeks | Friend graph by invite, friends' recommendations, opt-in shared walk cards, block/report (L). | Friends only. |
| **CF1** | when thresholds in §4.2 are met | Taste-segment popularity + item-item co-occurrence (M). | Aggregates only. |
| **F2: "walking now"** | after full DPIA + 18+ attestation + counsel sign-off on F2 specifically | Coarse-area presence over Realtime private channels (M–L). | Friends only. |
| **CF2** | about 2k active users | Implicit-feedback matrix factorization (M). | Aggregates only. |

I1 is technically non-personal and could ship before the gate. But the gate's "data licensing" item explicitly covers it, so it ships with P1.

---

## 2. Per-feature design

### 2.1 Feature 1: "Recommend this place" (R1, then P1)

**UX**
- A "Recommend" / "מקום מעולה" control appears in three places:
  - on the place card while walking, once the visit tracker marks the place visited;
  - in the walk-end summary, next to the existing thumbs;
  - on the place details in the planner.
- After tapping, an optional row of up to **3 chips** from a fixed list: `view`, `shade`, `quiet`, `kids`, `coffee`, `food`, `photo`, `accessible`, `sunset`. Copy is EN+HE and templated.
- **No free text in v1.** Free text brings moderation, PII (names, phone numbers), defamation risk when it names a business, and prompt injection into the assistant.
- The user sees "You recommended this" and can undo it anytime.
- After P1, others see the existing `CommunityBadge` ("Recommended by walkers (10+)" / "מומלץ על ידי הולכים (10+)"), plus at most 2 tags, and only tags that ≥ 5 distinct users chose ("walkers mention: view, shade").

**Data model** (new table, separate purpose and lifecycle from `attraction_feedback`):
```sql
create type public.place_tag as enum ('view','shade','quiet','kids','coffee','food','photo','accessible','sunset');
create table public.place_recommendations (
  user_id uuid not null references auth.users(id) on delete cascade,
  poi_key text not null check (poi_key ~ '^osm-(node|way|relation)-[0-9]{1,15}$'),
  category public.attraction_category not null,
  tags public.place_tag[] not null default '{}' check (cardinality(tags) <= 3),
  created_at timestamptz not null default now(),   -- forced by force_insert_timestamps()
  updated_at timestamptz not null default now(),
  primary key (user_id, poi_key)
);
```
- RLS: own-row select, insert, update and delete for `authenticated`. Revoke all from anon and public. Add the table to `MEMORY_TABLES` so "forget everything" deletes it.
- The regex check makes it impossible to store a Google id, or a `name@coords` key that could name a private home.

**Aggregate.** Extend `community_place_support`, or add `place_recommendation_support(p_poi_keys text[])`, returning `(poi_key, supporters_bucket, tags place_tag[])`.
- Supporters are distinct opted-in users with an upvote **or** a recommendation, older than 48 h, excluding the caller, internal accounts and excluded keys, with `having count(distinct user_id) >= 5`.
- Each tag is included only if ≥ 5 distinct supporters chose it.
- The return table is fixed. It never carries user ids, timestamps or raw counts.

**API**
- `PUT/DELETE /api/places/recommend {poiKey, category, tags}`: session-gated, validated with zod against the enum and the regex, and rate-limited to 60 per day per user.
- Reads go through the existing `/api/social/aggregates`.

**Consent**
- R1's personal use falls under "Remember my preferences".
- Contributing to others falls under the existing community opt-in. Its copy must now say that "recommendations and tags" count, not just thumbs-ups. That is a purpose description change, so counsel reviews it.

**Risks**
- Brigading by fake accounts: k counts distinct accounts. Mitigate with internal exclusion, a minimum account age of 7 days to count, and one vote per account per place (the primary key).
- Military sites: the exclusion list.
- Differencing: the 48 h delay plus buckets.

**Effort:** R1 is M (migration, route, two UI spots, tests). The P1 aggregate is S on top of G0.

### 2.2 Feature 2: open-data import (I1)

The source research and verdicts are in §3. Import design:
- **Job:** `scripts/import-open-signals.ts`, run monthly on the server (not per request). Inputs:
  - the Geofabrik Israel-and-Palestine OSM extract (OSM ids plus `wikidata` tags; bulk is not pulled through Overpass);
  - Wikidata for QIDs in the Israel bounding box (labels HE/EN/AR/RU, sitelink count, instance-of);
  - Wikipedia pageviews for each sitelink over the last 12 months (REST `metrics/pageviews/per-article`, with a User-Agent);
  - Wikivoyage EN+HE dumps, parsed for `see/do/eat/drink/listing` templates (name, type, `lat`/`long`, `wikidata`, url, description).
- **Matching to POIs,** in order (`match_method` and `match_confidence` are stored):
  1. exact Wikidata QID: OSM `wikidata=` ↔ Wikivoyage `wikidata=` ↔ Wikidata item;
  2. OSM id stored on the Wikidata item (the OSM-id properties; **verify the property ids**);
  3. fuzzy match: normalised name similarity ≥ 0.85 across HE/EN labels, distance ≤ 75 m urban / 250 m rural, and compatible category;
  4. unmatched rows are kept as `unmatched` and never shown.

  Hand-label 100 Israeli matches before trusting step 3.
- **Table** `open_place_signals(poi_key, wikidata_qid, source, value numeric, excerpt text null, source_url, license, attribution, match_method, match_confidence, fetched_at, primary key (poi_key, source))`:
  - `source` is one of `wikivoyage_en | wikivoyage_he | wikipedia_pageviews | wikidata_sitelinks | overture_confidence`.
  - It holds no personal data, so `select` can go to anon and authenticated, and writes are `service_role` only.
  - `excerpt` is only for Wikivoyage, at most about 300 characters, and always shown with title, link and the CC BY-SA 4.0 notice.
- **Dedupe:** one row per (poi_key, source). Pageviews are summed across language editions before taking the log. A place listed in both EN and HE Wikivoyage counts as "listed" once, plus a small bonus.
- **Provenance label:** each source keeps its own label and is never merged into a "Traike" number. "Listed in Wikivoyage" / "מופיע בוויקימסע" links to the article. "Popular on Wikipedia" is a fact and needs no number. "Recommended by walkers (10+)" is reserved for Traike users. An attributions page lists OSM (ODbL), Wikimedia (CC BY-SA 4.0), Wikidata and pageviews (CC0), Overture (CDLA-P-2.0 / Apache-2.0) and Foursquare (Apache-2.0 NOTICE).
- **Weighting against real Traike walkers** (ranking only, §4.4):
  - `open = 0.5·norm(log1p(pageviews_12m)) + 0.3·listed_wikivoyage + 0.2·norm(sitelinks)`, in [0, 1], worth at most **+1.5**.
  - Because `notabilityBonus` already gives +3/+2 for wikidata and wikipedia tags, cap notability plus open at +6 so famous places are not double-counted.
  - The Traike walker signal shrinks toward the open prior: `w_walkers = n/(n+10)`, where n is the supporter bucket's minimum. Real walkers take over as they accumulate.
- **Effort:** M. Risks:
  - ODbL derivative-database status of tables keyed by OSM ids is **[OPEN: counsel, check against the OSMF Collective Database / Horizontal Layers guidelines]**;
  - CC BY-SA share-alike applies to any Wikivoyage text we display or adapt, so it is kept verbatim and separately attributed, never blended into our own copy.

### 2.3 Feature 3: friends (F1 then F2), reconciling S3

S3 survives as F2, unchanged in spirit: mutual friends only, coarse area, ephemeral, 18+, after the gate and a DPIA. New in v2 is F1, which is lower risk and comes first.

**Data model (F1)**
```sql
create table public.social_profiles (          -- opt-in; no row = invisible to everyone
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),  -- user-chosen, real name not required
  avatar text check (char_length(avatar) <= 8),                                  -- emoji/initials, no photo upload v1
  age_18_attested_at timestamptz not null                                         -- required for any friend feature
);
create table public.friendships (
  user_low uuid not null references auth.users(id) on delete cascade,
  user_high uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('pending','accepted')),
  requested_by uuid not null, created_at timestamptz default now(), accepted_at timestamptz,
  primary key (user_low, user_high), check (user_low < user_high)
);
create table public.user_blocks (blocker uuid, blocked uuid, created_at timestamptz default now(),
  primary key (blocker, blocked));               -- one-sided; survives unfriend; silent
create table public.friend_invites (code_hash text primary key, inviter uuid not null,
  expires_at timestamptz not null, used_at timestamptz);   -- single-use, 48 h
create table public.social_sharing (
  user_id uuid primary key references auth.users(id) on delete cascade,
  share_recs_with_friends boolean not null default false,
  share_walk_cards boolean not null default false,          -- master; each card is still per-walk
  presence_enabled boolean not null default false,          -- F2
  ghost boolean not null default false,                     -- F2
  presence_epoch integer not null default 0                 -- F2, rotated on block/unfriend
);
create table public.shared_walks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  area_label text not null check (char_length(area_label) <= 60),  -- "Jaffa Old City"
  walked_on date not null,                                          -- day only, never time
  distance_m integer, duration_min smallint,
  stop_poi_keys text[] not null default '{}' check (cardinality(stop_poi_keys) <= 8),  -- OSM keys only
  created_at timestamptz default now()
);
```
- Helper `public.are_friends(a uuid, b uuid) returns boolean`: SECURITY DEFINER, stable, `search_path = public, pg_temp`. It returns true for an `accepted` row with no block in either direction.
- **RLS:**
  - `friendships`: rows visible to their two members only;
  - `social_profiles`: select own or `are_friends`;
  - `shared_walks`: select own or (`are_friends` and owner's `share_walk_cards`);
  - friends' recommendations through a function `friends_recommendations(p_poi_keys)` that returns `(poi_key, friend display_name)` only when the friend has `share_recs_with_friends`;
  - everything else own-row; anon revoked everywhere.
- **No discovery:** no search by name, phone or email, and no contact upload in v1. Friends connect only through an invite link or QR, handled by `accept_friend_invite(code)` (SECURITY DEFINER, rate-limited to 5 invites per day). This prevents enumeration and stranger contact.
- **Shared walk card:** created only when the user taps "Share with friends" at walk end. It is per walk and default off. It never includes a route line, start point or time of day, which prevents home and routine inference. Stops in deny zones or within about 300 m of the walk start are dropped. Cards can be deleted, and auto-expire after 90 days (default, owner may change).
- **UX:** a Friends tab with a list, invite, pending requests, a "What friends can see" screen (one per toggle), friends' cards and recommendation badges ("Dana recommended this"). Block and report are on every friend row.

**F2: "walking now" (do not build before its own sign-off)**
- **No presence table.** Supabase Realtime Broadcast is used on a private channel `presence:<user_id>:<epoch>`. Supabase docs (fetched 2026-10-23) confirm the mechanism:
  - clients join with `config.private = true`;
  - "Allow public access" must be disabled;
  - RLS on `realtime.messages` uses `realtime.topic()` and `extension`;
  - **policies are cached per connection until JWT expiry**;
  - do not run `alter table realtime.messages enable row level security` in a migration.
- Policies:
  - insert (send): only to your own topic with the current epoch, and only if `presence_enabled and not ghost`;
  - select (receive): only if `are_friends(auth.uid(), topic_owner)` and the topic epoch equals the owner's current `presence_epoch`.
- **Revocation despite the cache:** block or unfriend bumps `presence_epoch`, and the sender immediately moves to the new topic. Old subscribers receive nothing more, without waiting for their JWT to expire.
- **Payload:** `{status: 'walking', area: area_label | H3 res-7 cell id, since: rounded to 15 min}`. Sent when the area changes, or every 10 minutes as a heartbeat. Expires client-side after 20 minutes. There are never coordinates, dots, direction, speed or ETA.
- **Suppression:**
  - the first 10 minutes and the first ~1 km from the walk start (home protection, like Strava privacy zones);
  - inside detected-tier deny zones or near `landuse=military`;
  - when the app is backgrounded longer than 5 minutes;
  - at walk end.
- **Ghost mode** sends nothing. To friends, a ghosted user looks the same as one who is not walking; there is no "hidden" indicator. This matters for coercive-control scenarios.
- **UX:** sharing is off per walk and asked at walk start ("Let friends see I'm walking in [area]?"). A persistent "Sharing" pill appears during the walk, with one-tap ghost. Every 30 days: "You share walking status with N friends. Review?"

**Abuse and safety**
- Stalking: no strangers, coarse area only, epoch revocation, silent block, no "last seen" history.
- Minors: 18+ attestation for all friend features. Israeli law has no dedicated child-consent age (minors' consent runs through guardianship law, per [edlaw summary](https://edlaw.eduverse.com/docs/jurisdiction/nat/il/protection-of-privacy-law), **[secondary source; counsel to confirm]**). Attestation is weak; counsel decides whether it is enough.
- Soldiers and military sites: suppression zones, plus a consent-copy line advising not to share while on base.
- Harassment: no messaging in v1. Report goes to an `abuse_reports` table, and the owner reviews it manually.

**Consent copy needs.** Four separate opt-ins, never pre-ticked: community contribution (exists), share my recommendations with friends, share this walk card, walking-now status. The PPA's 2026 consent position paper prefers opt-in for sensitive data, requires "explicit and separate consent for each use", treats pre-ticked boxes as "suspicious consent", and says inaction is not consent ([Pearl Cohen, 1 Mar 2026](https://www.pearlcohen.com/israeli-privacy-regulator-issues-position-paper-on-valid-consent/)). All copy is HE/EN, reviewed by counsel, and never uses the owner's name.

**Effort:** F1 is L (5 tables, 4 functions, invite flow, Friends tab, block/report, forget-everything, tests). F2 is M–L (Realtime policies, epoch, suppression logic, indicator, phone testing).

### 2.4 Feature 4: "walkers like you" (CF)

See §4. Effort: C0 is S–M, CF1 is M, CF2 is M.

---

## 3. Import sources: can we take existing recommendations? (fetched or searched 2026-10-23)

**Bottom line:** no website with a large corpus of genuine user recommendations, Israeli or global, allows taking and storing its content. What we can legally take is **editorial and open** data (Wikivoyage listings, Wikipedia/Wikidata notability, Wikipedia pageviews, OSM). Real Hebrew user reviews are reachable **only through a partnership**.

### 3a. Israel-focused

| Source | Corpus and fields | API / dump | License / ToS | Cost | Israel quality | Verdict |
|---|---|---|---|---|---|---|
| **Hebrew Wikivoyage** (he.wikivoyage.org) | **2,453 articles, 14 active users** (siteinfo API). District overviews in prose; few per-listing coordinates (the sampled Tel Aviv page had 9 `lat` values). | MediaWiki API, dumps.wikimedia.org | **CC BY-SA 4.0** (siteinfo `rightsinfo`). Attribution means title, author/source, license and a note of changes ([Wikimedia reuse guide](https://www.mediawiki.org/wiki/Wikimedia_APIs/Content_reuse)). | free | Hebrew, thin, little activity | **Use with attribution** (signal + link + short excerpt) |
| **English Wikivoyage, Israel pages** | Editor-picked see/do/eat listings with name, type, `lat`/`long`, url, hours, price, description and `wikidata` ([listing fields](https://www.wikidata.org/wiki/Wikidata:Wikivoyage/Resources)). Sample counts (listings/coordinates): Haifa 63/67, Eilat 59/48, Tel Aviv/Jaffa 39/36, Safed 30/22, Nazareth 26/16, Akko 19/20. | API, dumps | CC BY-SA 4.0 | free | **The best open "recommended" signal for tourists** (tourist-first fits) | **Use with attribution** |
| **Wikipedia** (he/en/ar/ru) | Geotagged articles (already used in `wiki-geosearch.ts`). **Pageviews:** e.g. he "שוק הכרמל" had 479 views in Aug 2026 and 385 in Sep. | REST API, Enterprise free tier (5,000 on-demand requests/month + 30 snapshots, [help center](https://helpcenter.enterprise.wikimedia.com/hc/en-us/articles/6303505941275-How-much-does-Wikimedia-Enterprise-cost)) | Text CC BY-SA 4.0. **Pageviews CC0** ("All Analytics datasets are available under the Creative Commons CC0 dedication", [dumps readme](https://dumps.wikimedia.org/other/pageview_complete/readme.html)). | free | Good for notable places; weak for small urban gems | **Use** (pageviews as popularity prior) |
| **Wikidata** | QIDs, multilingual labels, sitelink count (a notability proxy), OSM id properties | SPARQL, dumps | CC0 | free | Good | **Use** |
| **OpenStreetMap** (Israel) | Already the primary source. `tourism=viewpoint/attraction`, `historic`, `natural=spring`, marked trail relations, `wikidata`. **No recommendation tag.** | Geofabrik extract for bulk; Overpass for live (within its usage policy) | **ODbL**; attribution "© OpenStreetMap contributors". Derivative-database share-alike may apply to tables keyed by OSM ids **[OPEN: counsel]**. | free | Very good in Israel (an active hiking community maps springs and trails) | **Use with attribution** (already in place) |
| **Israel Hiking Map / Mapeak** | Shows OSM, Wikipedia and iNature POIs; user POIs go into OSM ([OSGeo page](https://wiki.osgeo.org/wiki/Israel_Hiking_and_Biking_Maps), [App Store](https://apps.apple.com/il/app/israel-hiking-map/id1451300509)) | No public data API found | Custom code license. Tiles historically **CC BY-NC-SA 3.0** ([NextGIS listing, 2016–17](https://qms.nextgis.com/geoservices/670)) **[may have changed]**. Some infrastructure is closed after commercial misuse ([OSM forum](https://community.openstreetmap.org/t/questions-about-the-future-of-mapeak-in-relation-to-osm-open-data-foss/147246)). | — | Excellent for trails | **Don't take its tiles or server data.** Take the same data from OSM directly. **Partnership candidate.** |
| **iNature** (inature.info) | Israeli nature and hiking wiki since 2003: trails by region, springs, caves, parks | No API | Footer: **"כל הזכויות שמורות"** (all rights reserved) | — | High, Hebrew | **Don't** (partnership only) |
| **Tiuli / Lametayel** (tiuli.com, lametayel.co.il) | Trails, articles, user reviews and forums (size not stated) | No API | [ToS](https://www.tiuli.com/pages/108/terms-of-use): no copying or distribution; **"אין להפעיל ... כל אמצעי ... לשם העתקה או אחזור של תכנים"** (no means of any kind may be used to copy or retrieve content); personal use only; no framing; users license their content to the site. | — | High, Hebrew | **Don't scrape. Partnership candidate** (commercial). |
| **Amud Anan** (עמוד ענן) | Community-written POIs and drawn trails; ">20k POIs" at launch ([Gadgety](https://www.gadgety.co.il/?p=98620), dated) | No API found | ToS not read **[UNVERIFIED]** | — | High, Hebrew | **Don't** until terms are read. **Partnership candidate.** |
| **INPA (parks.org.il) / KKL-JNF trail pages** | Official park and trail pages | No open dataset found on data.gov.il | ToS not read **[UNVERIFIED]**; assume copyright | — | Authoritative | **Link out only.** Facts like existence and hours come via OSM. Ask for official data. |
| **data.gov.il** | CKAN search on 2026-10-23: **no national attractions or trails dataset.** The Tourism Ministry publishes tourist-info offices, guides and VAT stores. Some municipal sets exist (Be'er Sheva urban nature sites; Ma'ale Adumim nature reserves; "Other (Open)"). | CKAN API | Per dataset ("Other (Open)" / CC BY) | free | Patchy | **Use case by case with attribution** (low value). Tel Aviv and Jerusalem municipal GIS portals not checked **[UNVERIFIED]**. |
| Facebook hiking groups, forums (Tapuz, Lametayel forum) | Many real recommendations | — | Personal data plus copyright. Facebook bans automated collection **[general knowledge]**. | — | High | **Don't** |
| Google Maps reviews | Largest corpus | — | Owner decision plus Places ToS (no storage beyond place_id; display on Google maps only) | — | High | **Don't** |

### 3b. Global

| Source | What it has | License / ToS | Cost | Verdict |
|---|---|---|---|---|
| **Foursquare OS Places** | 26 fields: `fsq_place_id`, name, lat/lng, address, locality, region, postcode, country, `date_created/refreshed/closed`, tel, website, email, socials, `fsq_category_ids/labels`, geom, bbox. **No tips, ratings or popularity** ([schema](https://docs.foursquare.com/data-products/docs/places-os-data-schema)). | **Apache 2.0**; include the NOTICE | free (portal / Iceberg / [HF](https://huggingface.co/datasets/foursquare/fsq-os-places)) | **Use with attribution** for existence, categories and closures. It is **not** a recommendation source. |
| Foursquare Places API "Tips" (Premium) | User tips | Premium tier, from **$18.75 CPM** for the first 100k calls ([pricing](https://location.foursquare.com/pricing/)). Pay-as-you-go: **no caching except IDs** ([usage guidelines](https://docs.foursquare.com/developer/reference/usage-guidelines-personalization-apis); whether this applies to Tips is **[UNVERIFIED]**). | paid | **Don't** (can't store; Israeli tip volume unknown) |
| **Overture Places** | About 88M places (Oct 2026; Meta about 60M): names, `taxonomy`/`basic_category`, `confidence` 0–1, websites, socials, brand, sources, `operating_status`, GERS id. **No ratings or reviews** ([guide](https://docs.overturemaps.org/guides/places)). | CDLA-Permissive-2.0, Apache-2.0 (FSQ), CC0 (AllThePlaces) ([attribution](https://docs.overturemaps.org/attribution)). Joining with OSM may trigger ODbL. | free | **Use with attribution** for POI confidence and enrichment only |
| **Tripadvisor Content API** | Reviews, ratings, rankings | [Caching policy](https://docs.terra.tripadvisor.com/docs/caching-policy): "caching, copying, downloading, storing or indexing content is not permitted"; only the Location ID may be cached. Legacy terms: AI/ML use needs a separate signed agreement ([terms](https://tripadvisor-content-api.readme.io/reference/terms-of-use)). Scraping is prohibited. | free tier / paid | **Don't** (can't use as a ranking signal or in the assistant) |
| **AllTrails** | Trails, reviews, photos | [ToS (17 Dec 2025)](https://www.alltrails.com/terms): no scraping or mining (§4.1(vii)); Materials may not be copied or used commercially (§5.1). Enforced: an open-source scraper was taken down at the CTO's request in Jan 2026 ([listing](https://mcpservers.org/zh-TW/servers/srinath1510/alltrails_mcp_server)). | — | **Don't** |
| **Komoot** | Highlights and tips | [ToS](https://www.komoot.com/terms-of-service) §1.4: no export or publishing except through its own export function. No public API found ([dev blog, dated](https://janlukas.blog/dev/komoot-export)). | — | **Don't** |
| **Wikiloc** | Trails, comments | The [terms page](https://www.wikiloc.com/wikiloc/terms_en.html) returned 403 to our fetcher **[UNVERIFIED]**. No public API found. | — | **Don't** (default) |
| **OpenTripMap** | POIs built from OSM, Wikidata and Wikipedia, plus a `rate` field (undefined on the page) | **ODbL**; "You can pre-fetch, index, store, or cache data" ([product page](https://dev.opentripmap.org/product)) | free tier (limits not read) | **Optional, with attribution.** It mostly repackages sources we read directly, so marginal value is low. |
| **Mapillary** | Street-level photos (not recommendations) | Images **CC BY-SA** ([help](https://help.mapillary.com/hc/en-us/articles/115001770409)). A forum claim says its terms restrict building place databases **[UNVERIFIED]**. | free API | **Use with attribution** for photos only; low priority |
| **Reddit** (r/Israel, r/travel) | Threads with tips | Data API: commercial use needs a separate agreement; deletions must propagate ([coverage](https://ca.news.yahoo.com/reddit-locks-down-public-data-164936476.html); **official text not read**) | negotiated | **Don't** |
| Travel blogs, Atlas Obscura | Curated picks | Copyright; Atlas Obscura has no API and its ToS was not read **[UNVERIFIED]** | — | **Don't** (link out at most) |

**Partnership order (owner decision, Q4):** first Israel Hiking Map / Mapeak and Amud Anan (community and open-minded), then Tiuli/Lametayel (commercial; would want traffic or revenue share). Approach them after the public site exists, so there is something to show.

---

## 4. "Walkers like you" (Netflix-style) for tiny data

### 4.1 Honest constraints
- User-user CF over 2 to 50 accounts is noise and is easy to probe. The built `similar_walkers_places` lets the caller steer their own taste vector (they can change it via chat), and it reports places once ≥ 3 of ≤ 20 neighbours support them. In a small population that lets a caller triangulate a handful of specific people. **Recommendation: leave it dormant and do not ship it (Q2).**
- **Exposure normalisation** is the same trap as with habits. Popular places get recommended because they get shown. Use `place_interactions` `offered`/`visited` as the denominator.

### 4.2 Stages

| Stage | Threshold (opted-in, non-internal) | Method | Shown to user |
|---|---|---|---|
| **CF0** (now) | any | Content-based (`category_preferences`, exists) + open prior (§2.2) + trending (exists, only without personal signal) | Never "people like you". Open-data labels only. |
| **CF1a: taste segments** | ≥ 50 users, segment size ≥ 20, ≥ 300 POI-level positives in the city | Each user is assigned deterministically to one of about 6 fixed segments by the dominant 1–2 categories of their vector ("nature & views", "food & markets", "history & culture", "parks & family", "urban & shopping", "mixed"). Score = supporters / exposed members, with a Beta prior from the global rate. Reported only if ≥ 5 distinct supporters. | "Popular with walkers who like nature & views" / "פופולרי אצל הולכים שאוהבים טבע ונוף" |
| **CF1b: item-item** | same, plus the user has ≥ 2 positive POIs in the city | "Liked A also liked B" with pair support ≥ 5 distinct users ([Linden et al. 2003](https://www.cs.umd.edu/~samir/498/Amazon-Recommendations.pdf), cited from prior knowledge) | "Walkers who liked [A] also liked this" |
| **CF2: matrix factorization** | about 2k active users, ≥ 20k interactions | Implicit ALS ([Hu, Koren & Volinsky 2008](http://yifanhu.net/PUB/cf.pdf), from prior knowledge), or a hybrid with item features (category, open prior) for new items. Nightly server job. User factors stay private. | Ranking only. On-screen claims still need k ≥ 5 support. |

Segments are fixed, coarse and large, so a caller cannot narrow the crowd by editing their own taste. They also give a template explanation that names no person.

### 4.3 What to do until there are enough users
- Run CF0. Mark internal accounts. Show "Listed in Wikivoyage" and "Popular on Wikipedia" from day one of P1.
- Every function returns `[]` below its thresholds, and the UI renders nothing. This is already the pattern.
- A weekly server metric (count only) tracks opted-in users per segment and per city, so the owner can see when CF1 becomes possible.

### 4.4 Plugging into the planner and assistant
- New `RankerOptions.socialScores?: Map<poiKey, {community?, segment?, cooc?, open?}>` with each value in [0, 1]. It is applied **after** the personal terms in `rankAttractions`:
  - `+ 2·community + 1.5·max(segment, cooc) + 1.5·open`, total capped at **+3**;
  - +3 is below `PREFERRED_CATEGORY_BOOST` (4) and below one category-base step pair, so it never overrides an explicit ask;
  - it never applies to `downvotedPoiKeys` or to `place_interactions` dismissed/suppressed places;
  - notability + open is capped at +6.
- `/api/walk-plan` fetches the scores server-side for the candidate keys. The current 50-key cap means batching, or raising the cap to 200 with the DB-side rate limit from G0.
- Keep `EXPLORATION_RATE = 0.15`, and make the exploration stop immune to social boosts to avoid a popularity feedback loop.
- **Assistant:** a tool `place_social_hint(poiKey)` returns only `{reason: 'community'|'segment'|'cooc'|'wikivoyage'|'wikipedia', bucket?, segment_label?}` plus a template string. The LLM never sees ids, counts below k or names. The `social-explanation` eval kind in plan §5.5 already covers this.

### 4.5 Evaluation
- **Before data:** a synthetic simulator (planted segments and noise) to test plumbing and the privacy invariants. It says nothing about quality.
- **Offline, once ≥ 300 positives:** leave-one-out on recommends and upvotes. HR@8 and NDCG@8 (8 = `MAX_WALK_STOPS`) against popularity-only and content-only baselines. Report per city, and the coverage and diversity of categories.
- **Online, once ≥ ~200 weekly walkers:** A/B or interleaving by user-id hash. Primary metric: stop kept in plan × visited (visit tracker). Secondary: post-walk upvotes and recommends. Guardrails: downvote rate, category diversity, zero privacy-test regressions. Thresholds are set in advance. Statistical power will be low for months; say so in the reports.

---

## 5. Test and verification list

**Database (run on a Supabase branch or staging with ≥ 3 real JWTs, never only text tests)**
- [ ] The social migration applies cleanly; the `supabase-nextjs-security-auditor` pass is clean.
- [ ] k: 4 distinct supporters → nothing returned; 5 → `5+`; bucket edges at 10 and 25. The caller's own vote is excluded. Internal accounts are excluded. Accounts younger than 7 days are not counted.
- [ ] 48 h delay on votes, recommendations and opt-ins. The server timestamp overrides a backdated client value.
- [ ] Excluded (military / deny-zone) keys never return. A tag is returned only with ≥ 5 supporters.
- [ ] Probing: direct RPC calls hit the DB-side rate limit. A caller who edits their own taste vector cannot get a segment below 20 members or a place below 5 supporters.
- [ ] `place_recommendations` rejects non-OSM keys, more than 3 tags, and other users' rows.
- [ ] Friends RLS: a non-friend cannot read profiles, cards or recommendations. Pending does not count as friends. A block in either direction hides everything. Invites are single-use, expire after 48 h and are capped at 5 per day.
- [ ] Forget-everything deletes `place_recommendations`, `social_profiles`, `friendships`, `user_blocks`, `shared_walks`, `social_sharing` and `friend_invites`. The forget-tables test enumerates them.

**Realtime (F2)**
- [ ] With "Allow public access" disabled, a non-friend's join to `presence:<id>:<epoch>` is rejected.
- [ ] Block or unfriend → epoch bump → the old subscriber receives no further message (measured, not assumed).
- [ ] Ghost mode or presence off → zero outgoing broadcasts (network spy). Friends see nothing that distinguishes ghost from not walking.
- [ ] No broadcast in the first 10 minutes or ~1 km, in deny zones, near military land use, after more than 5 minutes in the background, or after walk end. The payload never contains coordinates.

**Import (I1)**
- [ ] Every `open_place_signals` row has non-null `license`, `attribution` and `source_url`.
- [ ] Match precision ≥ 95% on 100 hand-labelled Israeli POIs (HE and EN names). Unmatched rows are never shown.
- [ ] Wikivoyage excerpts are ≤ 300 characters, verbatim, with a link. The attributions page lists every source.

**Ranking / CF**
- [ ] With social scores present, a downvoted or suppressed POI never returns. The total social boost is ≤ 3. An explicit category ask still wins. The exploration stop is unaffected.
- [ ] Flags off → zero RPC calls (extend `social-flag-off`).
- [ ] The `social-explanation` eval passes: no digits other than the bucket, no person-implying words, plus the injection cases.

**Process and owner**
- [ ] Counsel has reviewed the consent copy (HE/EN, no pre-ticked boxes, per purpose) and the DPIA for F1 and F2. The ODbL derivative-database question is answered.
- [ ] The owner's phone checks: Recommend flow, badges, Friends tab, invite by QR, sharing indicator, ghost mode.
- [ ] No Google data in any new table. No owner name in any copy. No deploy before the launch gate.

---

## 6. Open questions only the owner can answer (max 5)

1. **Recommend v1:** fixed tag chips only, no free-text tips? **Default: yes.** Free text comes later, with moderation.
2. **S2 method:** retire the already-built user-user `similar_walkers_places` (probing risk) in favour of taste segments + item-item? **Default: yes.** Keep the SQL dormant and do not ship it.
3. **Friends scope:** F1 (friends' recommendations + opt-in walk cards) right after the gate; F2 ("walking now") only after its own DPIA, 18+ attestation and about 3 months of F1 use. Or drop F2? **Default: F1 yes, F2 later.**
4. **Partnerships:** approach Israel Hiking Map / Mapeak and Amud Anan (then Tiuli) for licensed Hebrew recommendations once the public site is live? **Default: yes, in that order.**
5. **Wikivoyage display:** show a short attributed excerpt (CC BY-SA share-alike applies to what we show), or signal + link only? **Default: signal + link + one attributed sentence.**

---

## 7. Uncertainty register (not verified)

- The ODbL derivative-database status of OSM-keyed recommendation tables.
- Whether Amendment 13 classifies location as "especially sensitive" (sources conflicted in the previous plan).
- The minors' consent age (secondary source only).
- The current Israel Hiking Map tile license.
- The Amud Anan, Wikiloc, INPA, KKL and Atlas Obscura ToS (not read).
- Whether Foursquare's no-caching rule covers Tips, and the current Tips price.
- Reddit's official Data API text (only coverage read).
- The Mapillary "no place DB" claim.
- The Wikidata OSM-id property ids.
- The OpenTripMap free-tier limits and the meaning of `rate`.
- pg_cron availability.
- The Realtime policy-cache behaviour, which is documented but not measured.

## 8. Sources (fetched or searched 2026-10-23)

- Foursquare OS schema: https://docs.foursquare.com/data-products/docs/places-os-data-schema ; HF: https://huggingface.co/datasets/foursquare/fsq-os-places ; pricing: https://location.foursquare.com/pricing/ ; usage guidelines: https://docs.foursquare.com/developer/reference/usage-guidelines-personalization-apis
- Overture places: https://docs.overturemaps.org/guides/places ; attribution: https://docs.overturemaps.org/attribution
- Wikivoyage listing fields: https://www.wikidata.org/wiki/Wikidata:Wikivoyage/Resources ; OSM wiki on Wikivoyage: https://wiki.openstreetmap.org/wiki/Wikivoyage ; Wikimedia reuse: https://www.mediawiki.org/wiki/Wikimedia_APIs/Content_reuse ; site statistics from the he/en.wikivoyage.org `api.php?meta=siteinfo` and `action=parse` (queried live)
- Pageviews CC0: https://dumps.wikimedia.org/other/pageview_complete/readme.html ; Wikimedia Enterprise pricing: https://helpcenter.enterprise.wikimedia.com/hc/en-us/articles/6303505941275-How-much-does-Wikimedia-Enterprise-cost
- Tripadvisor caching: https://docs.terra.tripadvisor.com/docs/caching-policy ; terms: https://tripadvisor-content-api.readme.io/reference/terms-of-use
- AllTrails ToS: https://www.alltrails.com/terms ; scraper takedown: https://mcpservers.org/zh-TW/servers/srinath1510/alltrails_mcp_server
- Komoot ToS: https://www.komoot.com/terms-of-service ; https://janlukas.blog/dev/komoot-export
- Wikiloc terms (403): https://www.wikiloc.com/wikiloc/terms_en.html
- Tiuli ToS: https://www.tiuli.com/pages/108/terms-of-use
- iNature: https://inature.info/ (footer)
- Amud Anan: https://www.gadgety.co.il/?p=98620
- Israel Hiking Map: https://wiki.osgeo.org/wiki/Israel_Hiking_and_Biking_Maps , https://qms.nextgis.com/geoservices/670 , https://community.openstreetmap.org/t/questions-about-the-future-of-mapeak-in-relation-to-osm-open-data-foss/147246
- data.gov.il CKAN API: https://data.gov.il/api/3/action/package_search (queried live)
- OpenTripMap: https://dev.opentripmap.org/product
- Mapillary license: https://help.mapillary.com/hc/en-us/articles/115001770409
- Reddit coverage: https://ca.news.yahoo.com/reddit-locks-down-public-data-164936476.html
- Supabase Realtime Authorization: https://supabase.com/docs/guides/realtime/authorization
- PPA consent position paper: https://www.pearlcohen.com/israeli-privacy-regulator-issues-position-paper-on-valid-consent/ ; minors note: https://edlaw.eduverse.com/docs/jurisdiction/nat/il/protection-of-privacy-law
- Carried from v1 (not re-fetched): Amendment 13 (DLA Piper, Vixio, Pearl Cohen), Strava/Israel incidents, de Montjoye 2013, Sweeney 2002, Hu/Koren/Volinsky 2008, Linden 2003.
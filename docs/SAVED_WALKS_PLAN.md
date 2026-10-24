# Saved walks + friends (2026-10-24, Ariel)
Decisions: save EVERY walk (built, bookmarked, finished) with stop names; "walk it again"; show in the app; the chat can recall them
("like yesterday but another pizzeria", "from my last 5 walks"); friends can see each other's walks. Private by default.

Contract (already written): supabase/migrations/20261024100000_saved_walks_friends.sql (NOT applied to production) and
src/lib/walks/saved-walks.ts (types + listMyWalks/insertWalk). Do not change either without telling the others.

Parts (separate files):
1. Chat: tool `recall_walks` in src/lib/assistant/tools.ts + prompt line (own walks only; "other X" = exclude names already visited).
2. History: save on build/finish/bookmark in the planner, an in-app "My walks" list with "Walk again" and a share toggle.
3. Friends: friend_code, request/accept by code (security-definer RPCs), friends list, friends' shared walks view.
Also: add saved_walks/friendships to src/app/api/forget-everything/route.ts.
Open: Google-sourced stop names stored in `stops` = the existing "Google content storage" item (resolve before launch).

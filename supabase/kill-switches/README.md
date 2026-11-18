# Kill switches for round 2 social (NOT migrations; never run automatically)

The `NEXT_PUBLIC_SOCIAL_*` flags only hide the UI, and they are inlined at build time. Once a migration is pasted, its
functions are callable directly by any signed-in user. These files switch a feature off in the database, at once.
Paste one into the Supabase SQL editor. Each is safe to run twice. To turn the feature on again, run the matching
`grant` lines (listed at the bottom of each file) or re-paste the migration.

- `off-B-presence.sql`  — stops "walking now" (and deletes every presence row).
- `off-C-walk-requests.sql` — stops walk requests.
- `rollback-D-nearby.sql` — removes "strangers nearby" completely (do this first if anything goes wrong with D).

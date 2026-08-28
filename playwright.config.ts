import { defineConfig, devices } from "@playwright/test";

/**
 * The e2e layer, and only the e2e layer.
 *
 * `tests/` is 1330 jsdom unit and component tests, and it is where logic goes.
 * This suite exists for the one thing that suite structurally cannot see: a
 * real browser hydrating a real server response. The `useWalkSettings`
 * hydration mismatch fixed 2026-08-07 survived 698 passing tests because
 * `renderHook` has no server pass to disagree with. Everything here runs
 * against a production build served by `next start`, because "the page came
 * back and hydrated" is not a claim jsdom can make.
 *
 * Smoke level on purpose. Nothing here re-tests ranking, decay, TSP ordering or
 * RLS -- that is all covered in depth next door, and duplicating it here would
 * buy flakiness at browser speed for coverage that already exists.
 */

/** The port the e2e server listens on. 3000 and 3001 belong to whatever a
 *  person is already running. */
const PORT = 3101;
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * Auth deliberately unconfigured.
 *
 * `src/proxy.ts` gates /app behind a session whenever Supabase env vars are
 * present, so with real credentials a signed-out browser never reaches the
 * planner at all -- it lands on /login, and the hydration bug class this suite
 * exists for goes untested. Without them the app takes its documented
 * "auth is optional" path: the planner is public, and the auth-backed surfaces
 * (account indicator, standing facts) fall back to empty. That is the mode CI
 * runs in too, since CI has no secrets, so local and CI exercise the same
 * build rather than two different apps. The signed-in gate itself is a second
 * server in a mutually exclusive configuration -- see TODO.md for why that is
 * deferred rather than bolted on here.
 */
const AUTH_DISABLED_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
};

export default defineConfig({
  testDir: "./e2e",
  // Belt and braces against the two suites eating each other: vitest.config.ts
  // only includes `tests/**`, and this only looks at `e2e/**/*.spec.ts`.
  testMatch: "**/*.spec.ts",

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // On CI, both: `list` so the failure is readable in the log, `html` so the
  // trace captured on retry has somewhere to live for the workflow to upload.
  // `open: "never"` stops the html reporter trying to launch a browser on a
  // headless runner.
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : [["html", { open: "never" }]],

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    // A production build, not `next dev`. The dev server's overlay, HMR socket
    // and unminified warnings are all noise against a suite whose main
    // assertion is "the console stayed clean", and a route that only 500s once
    // compiled is exactly the bug worth catching.
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: BASE_URL,
    // Never reuse. The usual `!process.env.CI` would let a server left over
    // from an earlier run answer these tests, and since the command above is
    // what rebuilds the app, reuse means silently testing yesterday's build --
    // in a suite whose entire subject is the build. Turbopack's incremental
    // rebuild costs a few seconds; a false green costs more.
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      ...AUTH_DISABLED_ENV,
      // Keeps the e2e build out of `.next`, which a running `npm run dev` owns.
      NEXT_DIST_DIR: ".next-e2e",
    },
  },
});

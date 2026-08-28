import { expect, test } from "@playwright/test";

/**
 * What a visitor with no session gets.
 *
 * The documented contract is that auth is optional: planning a walk is public,
 * and everything the app would otherwise remember about you degrades to empty
 * rather than to an error. Both halves are asserted here against a real server,
 * because "empty, best-effort" and "500 that the panel swallowed" look
 * identical from inside a mocked unit test.
 */

test("the planner is public and the auth-backed surfaces stay quiet", async ({
  page,
}) => {
  const response = await page.goto("/app");

  // Not a redirect to /login: with Supabase unconfigured `src/proxy.ts` leaves
  // the route open, and the planner has to be usable on that path.
  expect(response?.status()).toBe(200);
  expect(new URL(page.url()).pathname).toBe("/app");
  await expect(
    page.getByRole("button", { name: "Build My Walk" }),
  ).toBeEnabled();

  // Nothing is remembered about a visitor who isn't anyone, so the panel that
  // would say so renders nothing at all.
  await expect(page.getByText("Things I remember about you")).toHaveCount(0);
});

test("the memory endpoints answer empty rather than erroring", async ({
  request,
}) => {
  // Straight at the server, no browser: the panels above never call these
  // without a session, so this is the only place the signed-out path of these
  // handlers gets exercised end to end.
  for (const path of ["/api/standing-facts", "/api/prompt-history"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(await response.json(), path).toEqual([]);
  }
});

test("/login offers a way in", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
});

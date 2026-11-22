import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createRecoveryRequestClient: () => ({ auth: { resetPasswordForEmail: vi.fn() } }),
  createClient: () => ({ auth: { getUser, signInWithPassword: vi.fn(), signUp: vi.fn() } }),
}));

import { AuthScreen } from "@/components/auth/AuthScreen";

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// Feedback round 2026-11-22, item 8: sign in, sign up, forgot and reset password are one frame with one set of controls.
describe("the sign-in frame", () => {
  it("is the same frame and the same controls on every auth page", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u" } } });
    const frames: string[] = [];
    for (const [mode, heading] of [
      ["login", "Sign in to Traike"],
      ["signup", "Create your account"],
      ["forgot", "Reset your password"],
      ["reset", "Choose a new password"],
    ] as const) {
      render(<AuthScreen mode={mode} />);
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(heading);
      // The guide strip, the skip link and the appearance toggle are in every one.
      expect(screen.getByText("Skip · Try first")).toBeTruthy();
      expect(screen.getByText("Appearance")).toBeTruthy();
      expect(screen.getByRole("radiogroup", { name: "Theme" })).toBeTruthy();
      await waitFor(() => expect(screen.getByRole("button", { name: /Continue|Create account|Send reset link|Save password/ })).toBeTruthy());
      // One primary button style (the shared control system), one input style.
      expect(screen.getByRole("button", { name: /Continue|Create account|Send reset link|Save password/ }).className).toContain("tk-btn-primary");
      expect(document.querySelector("input")?.className).toContain("rounded-[6px]");
      frames.push(document.querySelector("main")!.className);
      cleanup();
    }
    expect(new Set(frames).size).toBe(1);
  });

  it("is a 440px column on a phone, 480px on a tablet and a 960px split card on a desktop", () => {
    render(<AuthScreen mode="login" />);
    const card = document.querySelector("main > div")!.className.split(/\s+/);
    for (const c of ["max-w-[440px]", "md:max-w-[480px]", "lg:max-w-[960px]", "lg:flex-row"]) expect(card).toContain(c);
    // The arch and the guide are the start half, the form the other.
    expect(document.querySelector("header")!.className).toContain("lg:w-1/2");
  });

  it("speaks Hebrew when the saved language is Hebrew, forgot and reset included", async () => {
    store.set("walk-settings", JSON.stringify({ uiLanguage: "he" }));
    getUser.mockResolvedValue({ data: { user: { id: "u" } } });
    render(<AuthScreen mode="forgot" />);
    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe("איפוס סיסמה");
    await waitFor(() => expect(screen.getByRole("button", { name: /שליחת קישור איפוס/ })).toBeTruthy());
    cleanup();
    render(<AuthScreen mode="reset" />);
    await waitFor(() => expect(screen.getByRole("button", { name: /שמירת הסיסמה/ })).toBeTruthy());
  });
});

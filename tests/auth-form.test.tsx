import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const signIn = vi.fn();
const signUp = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithPassword: signIn, signUp } }),
}));

import { AuthForm, cleanEmail } from "@/components/auth/AuthForm";

const assign = vi.fn();

beforeEach(() => {
  signIn.mockReset();
  signUp.mockReset();
  assign.mockReset();
  vi.stubGlobal("location", { ...window.location, origin: "http://x", assign });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function fill(email: string, password: string) {
  // Set .value directly, like autofill does — no input event.
  (document.getElementById("email") as HTMLInputElement).value = email;
  (document.getElementById("password") as HTMLInputElement).value = password;
  fireEvent.submit(document.querySelector("form")!);
}

describe("AuthForm login", () => {
  it("sends values that autofill set without a typing event", async () => {
    signIn.mockResolvedValue({ error: null });
    render(<AuthForm mode="login" />);
    fill("a@b.com", "secret1");
    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith({ email: "a@b.com", password: "secret1" }),
    );
    expect(assign).toHaveBeenCalledWith("/app");
  });

  it("strips hidden direction marks, spaces and case from the email", async () => {
    signIn.mockResolvedValue({ error: null });
    render(<AuthForm mode="login" />);
    fill("‏ Ariel@X.com ", "secret1");
    await waitFor(() => expect(signIn).toHaveBeenCalled());
    expect(signIn.mock.calls[0][0].email).toBe("ariel@x.com");
    expect(cleanEmail("‫a@b.com‎")).toBe("a@b.com");
  });

  it("shows a friendly message and a forgot-password link on bad credentials", async () => {
    signIn.mockResolvedValue({ error: { code: "invalid_credentials", message: "Invalid login credentials" } });
    render(<AuthForm mode="login" />);
    fill("a@b.com", "wrong");
    expect(await screen.findByText("Wrong email or password.")).toBeTruthy();
    expect(screen.getByText("Forgot password?").getAttribute("href")).toBe("/forgot-password");
  });
});

describe("AuthForm signup", () => {
  it("says the email already has an account when identities is empty", async () => {
    signUp.mockResolvedValue({ data: { user: { identities: [] }, session: null }, error: null });
    render(<AuthForm mode="signup" />);
    (document.getElementById("confirmPassword") as HTMLInputElement).value = "secret1";
    fill("a@b.com", "secret1");
    expect(await screen.findByText(/already has an account/)).toBeTruthy();
  });
});

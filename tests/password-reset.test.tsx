import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const reset = vi.fn();
const getUser = vi.fn();
const updateUser = vi.fn();
const exchange = vi.fn();
const initialize = vi.fn();
const getSession = vi.fn();
const verifyOtp = vi.fn();
const setSession = vi.fn();
const replace = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createRecoveryRequestClient: () => ({ auth: { resetPasswordForEmail: reset } }),
  createClient: () => ({
    auth: {
      resetPasswordForEmail: reset,
      getUser,
      updateUser,
      exchangeCodeForSession: exchange,
      initialize,
      getSession,
      verifyOtp,
      setSession,
    },
  }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh: vi.fn() }) }));

import { AuthCallback } from "@/components/auth/AuthCallback";
import { PasswordResetForm } from "@/components/auth/PasswordResetForm";

const assign = vi.fn();

beforeEach(() => {
  for (const m of [reset, getUser, updateUser, exchange, initialize, getSession, verifyOtp, setSession, replace, assign]) m.mockReset();
  vi.stubGlobal("location", { origin: "http://x", assign, search: "", hash: "" });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const submit = () => fireEvent.submit(document.querySelector("form")!);
const setVal = (id: string, v: string) => {
  (document.getElementById(id) as HTMLInputElement).value = v;
};

describe("PasswordResetForm request", () => {
  it("shows a rate-limit error instead of a fake success", async () => {
    reset.mockResolvedValue({ error: { code: "over_email_send_rate_limit", message: "x" } });
    render(<PasswordResetForm mode="request" />);
    setVal("email", "a@b.com");
    submit();
    expect(await screen.findByText(/Too many attempts/)).toBeTruthy();
    expect(screen.queryByText(/we sent a reset link/)).toBeNull();
  });

  it("sends redirectTo with a '?' and shows the neutral notice", async () => {
    reset.mockResolvedValue({ error: null });
    render(<PasswordResetForm mode="request" />);
    setVal("email", "‏A@b.com");
    submit();
    expect(await screen.findByText(/we sent a reset link/)).toBeTruthy();
    expect(reset).toHaveBeenCalledWith("a@b.com", {
      redirectTo: "http://x/auth/callback?next=/reset-password",
    });
  });
});

describe("PasswordResetForm update", () => {
  it("shows the expired message and no form without a session", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    render(<PasswordResetForm mode="update" />);
    expect(await screen.findByText(/invalid or expired/)).toBeTruthy();
    expect(screen.getByText("Request a new one").getAttribute("href")).toBe("/forgot-password");
  });

  it("maps same_password and goes to /app on success", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u" } } });
    updateUser.mockResolvedValueOnce({ error: { code: "same_password", message: "x" } });
    render(<PasswordResetForm mode="update" />);
    await waitFor(() => expect(screen.getByText("Save password")).toBeTruthy());
    setVal("password", "newpass1");
    setVal("confirmPassword", "newpass1");
    submit();
    expect(await screen.findByText(/current password/)).toBeTruthy();
    expect(assign).not.toHaveBeenCalled();

    updateUser.mockResolvedValueOnce({ error: null });
    submit();
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/app"));
  });
});

function openCallback(search: string, hash = "") {
  vi.stubGlobal("location", { origin: "http://x", assign, search, hash });
  render(<AuthCallback />);
}

describe("AuthCallback", () => {
  it("never exchanges the PKCE code a second time", async () => {
    initialize.mockResolvedValue({ error: null });
    getSession.mockResolvedValue({ data: { session: { user: {} } } });
    openCallback("?code=abc&next=/reset-password");
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/reset-password"));
    expect(exchange).not.toHaveBeenCalled();
  });

  it("sends a failed reset to /forgot-password", async () => {
    initialize.mockResolvedValue({ error: null });
    getSession.mockResolvedValue({ data: { session: null } });
    openCallback("?code=abc&next=/reset-password");
    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(replace.mock.calls[0][0]).toMatch(/^\/forgot-password\?error=/);
  });

  it("verifies a token_hash recovery link and lands on /reset-password", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    openCallback("?next=/reset-password&sb_flow_id=x&token_hash=h&type=recovery");
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/reset-password"));
    expect(verifyOtp).toHaveBeenCalledWith({ type: "recovery", token_hash: "h" });
  });

  it("goes to /reset-password for type=recovery even without next", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    openCallback("?token_hash=h&type=recovery");
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/reset-password"));
  });

  it("shows the expired text for an otp_expired recovery link", async () => {
    verifyOtp.mockResolvedValue({ error: { message: "Email link is invalid or has expired" } });
    openCallback("?token_hash=h&type=recovery&next=/reset-password");
    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(decodeURIComponent(replace.mock.calls[0][0])).toMatch(/\/forgot-password\?error=This reset link expired/);
  });

  it("rejects an off-site next", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    openCallback("?token_hash=h&type=email&next=//evil.com");
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/app"));
  });
});

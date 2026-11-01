"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

import { cleanEmail, friendlyError } from "./AuthForm";

type ResetMode = "request" | "update";

const inputClasses =
  "w-full rounded-[10px] border border-charcoal/15 bg-cream/40 px-3 py-2.5 text-sm text-charcoal focus:border-terra focus:outline-none";
const labelClasses = "text-sm font-semibold text-forest";

export function PasswordResetForm({
  mode,
  initialError,
}: {
  mode: ResetMode;
  initialError?: string;
}) {
  const [error, setError] = useState<string | null>(initialError ?? null);
  // Update mode needs the recovery session the callback created.
  const [hasSession, setHasSession] = useState<boolean | null>(
    mode === "update" ? null : true,
  );
  const [coolingDown, setCoolingDown] = useState(false);

  useEffect(() => {
    if (mode !== "update") return;
    void createClient()
      .auth.getUser()
      .then(({ data }) => setHasSession(Boolean(data.user)));
  }, [mode]);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isRequest = mode === "request";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const form = new FormData(event.currentTarget);
    setIsSubmitting(true);

    try {
      const supabase = createClient();

      if (isRequest) {
        const email = cleanEmail(String(form.get("email") ?? ""));
        if (!email.includes("@")) {
          setError("Enter your email.");
          return;
        }
        // redirectTo must keep its "?": the email template appends "&token_hash=…".
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          email,
          {
            redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
          },
        );
        if (resetError) {
          setError(friendlyError(resetError));
          return;
        }
        // Same message whether or not the account exists.
        setNotice(
          "If an account exists for that email, we sent a reset link. Check spam — only the newest link works.",
        );
        setCoolingDown(true);
        setTimeout(() => setCoolingDown(false), 60_000);
        return;
      }

      const password = String(form.get("password") ?? "");
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      if (password !== String(form.get("confirmPassword") ?? "")) {
        setError("Passwords don't match.");
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) {
        setError(friendlyError(updateError));
        return;
      }
      window.location.assign("/app");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-sm space-y-5 rounded-xl bg-white p-8 shadow-[0_4px_20px_rgba(30,61,47,0.12)]">
      <h1 className="font-display text-2xl font-bold text-forest">
        {isRequest ? "Reset your password" : "Choose a new password"}
      </h1>

      {hasSession === null && (
        <p className="text-sm text-charcoal/70">Checking your link…</p>
      )}
      {hasSession === false && (
        <p className="rounded-[10px] bg-terra/10 p-3 text-xs text-terra">
          This reset link is invalid or expired.{" "}
          <Link href="/forgot-password" className="font-semibold underline">
            Request a new one
          </Link>
        </p>
      )}

      <form
        className={`space-y-4 ${hasSession ? "" : "hidden"}`}
        onSubmit={handleSubmit}
        noValidate
      >
        {isRequest ? (
          <label className="block space-y-1.5">
            <span className={labelClasses}>Email</span>
            <input
              type="email"
              name="email"
              id="email"
              autoComplete="email"
              required
              className={inputClasses}
            />
          </label>
        ) : (
          <>
            <label className="block space-y-1.5">
              <span className={labelClasses}>New password</span>
              <input
                type="password"
                name="password"
                id="password"
                autoComplete="new-password"
                required
                className={inputClasses}
              />
            </label>
            <label className="block space-y-1.5">
              <span className={labelClasses}>Confirm password</span>
              <input
                type="password"
                name="confirmPassword"
                id="confirmPassword"
                autoComplete="new-password"
                required
                className={inputClasses}
              />
            </label>
          </>
        )}

        {error && (
          <p className="rounded-[10px] bg-terra/10 p-3 text-xs text-terra">
            {error}
          </p>
        )}
        {notice && (
          <p className="rounded-[10px] bg-skysoft/25 p-3 text-xs text-forest">
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting || coolingDown}
          className="w-full rounded-[10px] bg-terra px-7 py-3 text-sm font-bold text-cream shadow-[0_4px_20px_rgba(30,61,47,0.12)] transition-colors hover:bg-terra/90 disabled:bg-terra/50"
        >
          {isSubmitting ? "Working…" : isRequest ? "Send reset link" : "Save password"}
        </button>
      </form>

      <p className="text-sm text-charcoal/70">
        <Link href="/login" className="font-semibold text-terra hover:text-terra/80">
          Back to log in
        </Link>
      </p>
    </div>
  );
}

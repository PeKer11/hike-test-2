"use client";

import Link from "next/link";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

type AuthMode = "login" | "signup";

interface AuthFormProps {
  mode: AuthMode;
  /** Error carried over from the auth callback redirect. */
  initialError?: string;
}

// Brand tokens from DESIGN.md (see globals.css @theme) so these pages sit next
// to the landing page rather than looking like the generic app chrome.
const inputClasses =
  "w-full rounded-[10px] border border-charcoal/15 bg-cream/40 px-3 py-2.5 text-sm text-charcoal focus:border-terra focus:outline-none";

const labelClasses = "text-sm font-semibold text-forest";

// Invisible direction marks that Hebrew text (WhatsApp, Gmail) puts around a
// pasted email; the browser rejects them and the user can't see why.
const INVISIBLE_MARKS = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF\s]/g;

export function cleanEmail(raw: string): string {
  return raw.replace(INVISIBLE_MARKS, "").toLowerCase();
}

export function friendlyError(error: {
  code?: string;
  name?: string;
  message: string;
}): string {
  if (error.name === "AuthSessionMissingError") {
    return "Your reset link expired. Request a new one.";
  }
  switch (error.code) {
    case "invalid_credentials":
      return "Wrong email or password.";
    case "email_not_confirmed":
      return "Confirm your email first — check your inbox for the link.";
    case "over_request_rate_limit":
      return "Too many attempts. Wait a minute and try again.";
    case "over_email_send_rate_limit":
      // Also fires when the project-wide hourly email quota is used up, so a
      // minute is not enough.
      return "Too many emails sent recently. Try again in about an hour.";
    case "user_already_exists":
      return "This email already has an account — log in instead.";
    case "email_address_not_authorized":
      return "We can't email this address yet.";
    case "same_password":
      return "That's your current password. Choose a different one.";
    case "otp_expired":
      return "This reset link expired or was already used. Request a new one.";
    case "session_not_found":
    case "session_expired":
      return "Your reset link expired. Request a new one.";
    case "reauthentication_needed":
      return "For security, use a fresh reset link from your email.";
    default:
      return error.message;
  }
}

export function AuthForm({ mode, initialError }: AuthFormProps) {
  const [error, setError] = useState<string | null>(initialError ?? null);
  // Set when signup succeeded but Supabase is waiting on an email confirmation,
  // so there is no session to redirect with yet.
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    // Read the DOM, not React state: autofill and password managers set the
    // value without a typing event, so state can still be empty.
    const form = new FormData(event.currentTarget);
    const email = cleanEmail(String(form.get("email") ?? ""));
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    if (!email.includes("@") || !password) {
      setError("Enter your email and password.");
      return;
    }
    if (mode === "signup" && password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();

      if (mode === "login") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          throw new Error(friendlyError(signInError));
        }
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/app`,
          },
        });
        if (signUpError) {
          throw new Error(friendlyError(signUpError));
        }
        if (data.user?.identities?.length === 0) {
          throw new Error("This email already has an account — log in instead.");
        }
        if (!data.session) {
          setNotice(
            "Check your inbox — confirm your email address to finish signing up.",
          );
          return;
        }
      }

      // Full load: the session cookie changed, so skip any cached client route.
      window.location.assign("/app");
      return;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const isSignup = mode === "signup";

  return (
    <div className="w-full max-w-sm space-y-5 rounded-xl bg-paper p-8 shadow-[0_4px_20px_rgba(30,61,47,0.12)]">
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-bold text-forest">
          {isSignup ? "Create your account" : "Welcome back"}
        </h1>
        <p className="text-sm leading-relaxed text-charcoal/70">
          {isSignup
            ? "Save your walking profile so every walk starts where the last one left off."
            : "Log in to pick up your walking profile."}
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
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

        <label className="block space-y-1.5">
          <span className={labelClasses}>Password</span>
          <input
            type="password"
            name="password"
            id="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            required
            className={inputClasses}
          />
        </label>

        {isSignup && (
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
        )}

        {!isSignup && (
          <Link
            href="/forgot-password"
            className="block text-sm font-semibold text-terra hover:text-terra/80"
          >
            Forgot password?
          </Link>
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
          disabled={isSubmitting}
          className="w-full rounded-[10px] bg-terra px-7 py-3 text-sm font-bold text-cream shadow-[0_4px_20px_rgba(30,61,47,0.12)] transition-colors hover:bg-terra/90 disabled:bg-terra/50"
        >
          {isSubmitting ? (
            <span className="inline-flex items-center justify-center gap-2" role="status">
              <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-cream/40 border-t-cream" />
              {isSignup ? "Creating account…" : "Logging in…"}
            </span>
          ) : isSignup ? (
            "Create account"
          ) : (
            "Log in"
          )}
        </button>
      </form>

      <p className="text-sm text-charcoal/70">
        {isSignup ? "Already have an account? " : "No account yet? "}
        <Link
          href={isSignup ? "/login" : "/signup"}
          className="font-semibold text-terra hover:text-terra/80"
        >
          {isSignup ? "Log in" : "Sign up"}
        </Link>
      </p>
    </div>
  );
}

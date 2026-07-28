"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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

export function AuthForm({ mode, initialError }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError ?? null);
  // Set when signup succeeded but Supabase is waiting on an email confirmation,
  // so there is no session to redirect with yet.
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

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
          throw new Error(signInError.message);
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
          throw new Error(signUpError.message);
        }
        if (!data.session) {
          setNotice(
            "Check your inbox — confirm your email address to finish signing up.",
          );
          return;
        }
      }

      // The session cookie changed, so any cached server render is stale.
      router.refresh();
      router.push("/app");
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
    <div className="w-full max-w-sm space-y-5 rounded-xl bg-white p-8 shadow-[0_4px_20px_rgba(30,61,47,0.12)]">
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

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-1.5">
          <span className={labelClasses}>Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
            className={inputClasses}
          />
        </label>

        <label className="block space-y-1.5">
          <span className={labelClasses}>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={isSignup ? "new-password" : "current-password"}
            minLength={6}
            required
            className={inputClasses}
          />
        </label>

        {isSignup && (
          <label className="block space-y-1.5">
            <span className={labelClasses}>Confirm password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
              className={inputClasses}
            />
          </label>
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
          {isSubmitting
            ? "Working…"
            : isSignup
              ? "Create account"
              : "Log in"}
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

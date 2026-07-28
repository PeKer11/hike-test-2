"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { Button, Card } from "@/components/ui";

type AuthMode = "login" | "signup";

interface AuthFormProps {
  mode: AuthMode;
  /** Error carried over from the auth callback redirect. */
  initialError?: string;
}

const inputClasses =
  "w-full rounded-md border border-slate-300 px-2 py-2 text-sm focus:border-emerald-500 focus:outline-none";

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
    <Card className="w-full max-w-sm space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-slate-900">
          {isSignup ? "Create your account" : "Welcome back"}
        </h1>
        <p className="text-xs text-slate-500">
          {isSignup
            ? "Save your walking profile so every walk starts where the last one left off."
            : "Log in to pick up your walking profile."}
        </p>
      </div>

      <form className="space-y-3" onSubmit={handleSubmit}>
        <label className="block space-y-1">
          <span className="text-sm font-semibold text-slate-900">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
            className={inputClasses}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-semibold text-slate-900">Password</span>
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
          <label className="block space-y-1">
            <span className="text-sm font-semibold text-slate-900">
              Confirm password
            </span>
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
          <p className="rounded-md bg-rose-50 p-2 text-xs text-rose-700">
            {error}
          </p>
        )}

        {notice && (
          <p className="rounded-md bg-emerald-50 p-2 text-xs text-emerald-800">
            {notice}
          </p>
        )}

        <Button type="submit" fullWidth disabled={isSubmitting}>
          {isSubmitting
            ? "Working…"
            : isSignup
              ? "Create account"
              : "Log in"}
        </Button>
      </form>

      <p className="text-xs text-slate-500">
        {isSignup ? "Already have an account? " : "No account yet? "}
        <Link
          href={isSignup ? "/login" : "/signup"}
          className="font-semibold text-emerald-700 hover:text-emerald-600"
        >
          {isSignup ? "Log in" : "Sign up"}
        </Link>
      </p>
    </Card>
  );
}

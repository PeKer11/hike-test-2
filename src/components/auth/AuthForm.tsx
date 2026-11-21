"use client";

import Link from "next/link";
import { useState } from "react";

import { BTN } from "@/components/ui/panel-style";
import { useHydrated } from "@/lib/hooks/useHydrated";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "login" | "signup";

const FORM_COPY = {
  en: { email: "Email address", password: "Password", confirm: "Confirm password", forgot: "Forgot password?", login: "Continue", signup: "Create account", loggingIn: "Logging in…", creating: "Creating account…", noAccount: "No account yet? ", haveAccount: "Already have an account? ", signUpLink: "Sign up", logInLink: "Log in", enter: "Enter your email and password.", short: "Password must be at least 6 characters.", mismatch: "Passwords don't match." },
  he: { email: "כתובת אימייל", password: "סיסמה", confirm: "אימות סיסמה", forgot: "שכחתם סיסמה?", login: "המשך", signup: "יצירת חשבון", loggingIn: "מתחברים…", creating: "יוצרים חשבון…", noAccount: "אין חשבון עדיין? ", haveAccount: "כבר יש חשבון? ", signUpLink: "הרשמה", logInLink: "התחברות", enter: "הזינו אימייל וסיסמה.", short: "הסיסמה צריכה להכיל לפחות 6 תווים.", mismatch: "הסיסמאות אינן זהות." },
} as const;

interface AuthFormProps {
  mode: AuthMode;
  /** Language of the form's words (the screen around it reads the saved setting). */
  lang?: "he" | "en";
  /** Error carried over from the auth callback redirect. */
  initialError?: string;
}

// Brand tokens from DESIGN.md (see globals.css @theme) so these pages sit next
// to the landing page rather than looking like the generic app chrome.
const inputClasses =
  "h-[46px] w-full rounded-[6px] border-[1.5px] border-[var(--tk-ctl)] bg-cream px-3 text-[16px] font-semibold text-tk-ink focus:outline-2 focus:outline-offset-1 focus:outline-[var(--tk-ctl)]";

const labelClasses = "text-[14px] font-semibold text-tk-ink";

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

export function AuthForm({ mode, initialError, lang = "en" }: AuthFormProps) {
  const t = FORM_COPY[lang];
  // Before hydration the browser would submit this form itself (GET, password in the URL).
  const hydrated = useHydrated();
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
      setError(t.enter);
      return;
    }
    if (mode === "signup" && password.length < 6) {
      setError(t.short);
      return;
    }
    if (mode === "signup" && password !== confirmPassword) {
      setError(t.mismatch);
      return;
    }

    setIsSubmitting(true);
    let navigating = false;

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
      // Keep the spinner on until the browser leaves this page.
      navigating = true;
      window.location.assign("/app");
      return;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
    } finally {
      if (!navigating) setIsSubmitting(false);
    }
  }

  const isSignup = mode === "signup";

  return (
    <form method="post" onSubmit={handleSubmit} noValidate className="font-app-sans">
      <div className="space-y-3 border-b border-tk-hair px-4 py-3">
        <label className="block space-y-1.5">
          <span className={labelClasses}>{t.email}</span>
          <input type="email" name="email" id="email" dir="ltr" autoComplete="email" required className={inputClasses} />
        </label>

        <label className="block space-y-1.5">
          <span className={labelClasses}>{t.password}</span>
          <input type="password" name="password" id="password" dir="ltr" autoComplete={isSignup ? "new-password" : "current-password"} required className={inputClasses} />
        </label>

        {isSignup && (
          <label className="block space-y-1.5">
            <span className={labelClasses}>{t.confirm}</span>
            <input type="password" name="confirmPassword" id="confirmPassword" dir="ltr" autoComplete="new-password" required className={inputClasses} />
          </label>
        )}

        {!isSignup && (
          <Link href="/forgot-password" className="flex min-h-11 items-center text-[14px] font-semibold text-tk-ink underline">
            {t.forgot}
          </Link>
        )}

        {error && <p className="rounded-[6px] bg-terra/10 p-3 text-[14px] text-tk-check">{error}</p>}

        {notice && <p className="rounded-[6px] bg-skysoft/25 p-3 text-[14px] text-tk-ink">{notice}</p>}
      </div>

      <div className="flex flex-col gap-[10px] px-4 pb-4 pt-[14px]">
        <button type="submit" disabled={isSubmitting || !hydrated} className={`${BTN} w-full`}>
          {isSubmitting ? (
            <span className="inline-flex items-center justify-center gap-2" role="status">
              <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-current/40 border-t-current" />
              {isSignup ? t.creating : t.loggingIn}
            </span>
          ) : (
            <>
              {isSignup ? t.signup : t.login}
              <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="rtl:-scale-x-100">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </>
          )}
        </button>
        <p className="text-center text-[16px] text-tk-ink">
          {isSignup ? t.haveAccount : t.noAccount}
          <Link href={isSignup ? "/login" : "/signup"} className="font-semibold underline">
            {isSignup ? t.logInLink : t.signUpLink}
          </Link>
        </p>
      </div>
    </form>
  );
}

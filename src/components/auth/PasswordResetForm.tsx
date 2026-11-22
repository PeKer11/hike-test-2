"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ArrowIcon } from "@/components/ui/icons";
import { BTN } from "@/components/ui/panel-style";
import { useHydrated } from "@/lib/hooks/useHydrated";
import { createClient, createRecoveryRequestClient } from "@/lib/supabase/client";

import { cleanEmail, friendlyError } from "./AuthForm";

type ResetMode = "request" | "update";

// The same controls as the sign-in form (round 13): control edge, cream fill, 16px so phones do not zoom.
const inputClasses =
  "h-[46px] w-full rounded-[6px] border-[1.5px] border-[var(--tk-ctl)] bg-cream px-3 text-[16px] font-semibold text-tk-ink focus:outline-2 focus:outline-offset-1 focus:outline-[var(--tk-ctl)]";
const labelClasses = "text-[14px] font-semibold text-tk-ink";

// Server errors keep their English wording (friendlyError); the words this form owns follow the screen's language.
const COPY = {
  en: {
    email: "Email",
    newPassword: "New password",
    confirm: "Confirm password",
    show: "Show passwords",
    checking: "Checking your link…",
    invalid: "This reset link is invalid or expired.",
    requestNew: "Request a new one",
    working: "Working…",
    send: "Send reset link",
    save: "Save password",
    back: "Back to log in",
    enterEmail: "Enter your email.",
    notice: "If an account exists for that email, we sent a reset link. Check spam — only the newest link works.",
    short: "Password must be at least 6 characters.",
    mismatch: "Passwords don't match.",
    wrong: "Something went wrong. Try again.",
  },
  he: {
    email: "כתובת אימייל",
    newPassword: "סיסמה חדשה",
    confirm: "אימות סיסמה",
    show: "הצגת הסיסמאות",
    checking: "בודקים את הקישור…",
    invalid: "קישור האיפוס אינו תקין או שפג תוקפו.",
    requestNew: "בקשו קישור חדש",
    working: "רק רגע…",
    send: "שליחת קישור איפוס",
    save: "שמירת הסיסמה",
    back: "חזרה להתחברות",
    enterEmail: "הזינו את כתובת האימייל.",
    notice: "אם קיים חשבון עם האימייל הזה, שלחנו קישור איפוס. בדקו בספאם. רק הקישור האחרון תקף.",
    short: "הסיסמה צריכה להכיל לפחות 6 תווים.",
    mismatch: "הסיסמאות אינן זהות.",
    wrong: "משהו השתבש. נסו שוב.",
  },
} as const;

export function PasswordResetForm({
  mode,
  initialError,
  lang = "en",
}: {
  mode: ResetMode;
  initialError?: string;
  /** Language of the words on this form (the frame around it reads the saved setting). */
  lang?: "he" | "en";
}) {
  const t = COPY[lang];
  // Before hydration the browser would submit this form itself.
  const hydrated = useHydrated();
  const [error, setError] = useState<string | null>(initialError ?? null);
  // Update mode needs the recovery session the callback created.
  const [hasSession, setHasSession] = useState<boolean | null>(
    mode === "update" ? null : true,
  );
  const [coolingDown, setCoolingDown] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
          setError(t.enterEmail);
          return;
        }
        // redirectTo must keep its "?": the email template appends "&token_hash=…".
        const { error: resetError } = await createRecoveryRequestClient().auth.resetPasswordForEmail(
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
        setNotice(t.notice);
        setCoolingDown(true);
        setTimeout(() => setCoolingDown(false), 60_000);
        return;
      }

      const password = String(form.get("password") ?? "");
      if (password.length < 6) {
        setError(t.short);
        return;
      }
      if (password !== String(form.get("confirmPassword") ?? "")) {
        setError(t.mismatch);
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
      setError(t.wrong);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="font-app-sans">
      {hasSession === null && <p className="border-b border-tk-hair px-4 py-3 text-[14px] text-tk-sage">{t.checking}</p>}
      {hasSession === false && (
        <p className="m-4 rounded-[6px] bg-terra/10 p-3 text-[14px] text-tk-check">
          {t.invalid}{" "}
          <Link href="/forgot-password" className="font-semibold underline">
            {t.requestNew}
          </Link>
        </p>
      )}

      <form className={hasSession ? "" : "hidden"} method="post" onSubmit={handleSubmit} noValidate>
        <div className="space-y-3 border-b border-tk-hair px-4 py-3">
          {isRequest ? (
            <label className="block space-y-1.5">
              <span className={labelClasses}>{t.email}</span>
              <input type="email" name="email" id="email" dir="ltr" autoComplete="email" required className={inputClasses} />
            </label>
          ) : (
            <>
              <label className="block space-y-1.5">
                <span className={labelClasses}>{t.newPassword}</span>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  id="password"
                  dir="ltr"
                  autoComplete="new-password"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  className={inputClasses}
                />
              </label>
              <label className="block space-y-1.5">
                <span className={labelClasses}>{t.confirm}</span>
                <input
                  type={showPassword ? "text" : "password"}
                  name="confirmPassword"
                  id="confirmPassword"
                  dir="ltr"
                  autoComplete="new-password"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  className={inputClasses}
                />
              </label>
              <label className="flex min-h-11 items-center gap-2 text-[14px] font-semibold text-tk-ink">
                <input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} className="h-4 w-4 accent-[var(--tk-sel)]" />
                {t.show}
              </label>
            </>
          )}

          {error && <p className="rounded-[6px] bg-terra/10 p-3 text-[14px] text-tk-check">{error}</p>}
          {notice && <p className="rounded-[6px] bg-skysoft/25 p-3 text-[14px] text-tk-ink">{notice}</p>}
        </div>

        <div className="flex flex-col gap-[10px] px-4 pb-4 pt-[14px]">
          <button type="submit" disabled={isSubmitting || coolingDown || !hydrated} className={`${BTN} w-full`}>
            {isSubmitting ? (
              t.working
            ) : (
              <>
                {isRequest ? t.send : t.save}
                <ArrowIcon />
              </>
            )}
          </button>
        </div>
      </form>

      <p className="px-4 pb-4 text-center text-[16px] text-tk-ink">
        <Link href="/login" className="font-semibold underline">
          {t.back}
        </Link>
      </p>
    </div>
  );
}

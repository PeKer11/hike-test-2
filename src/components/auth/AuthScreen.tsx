"use client";

import Image from "next/image";
import Link from "next/link";

import { AuthForm } from "@/components/auth/AuthForm";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useAuthLang } from "@/lib/hooks/useAuthLang";

const COPY = {
  en: {
    login: "Sign in to Traike",
    signup: "Create your account",
    skip: "Skip · Try first",
    welcome: "Walks built around you",
    welcomeLine: "Save routes, sync live walks & share stops.",
    appearance: "Appearance",
    themeLabels: { light: "Day", dark: "Night" },
  },
  he: {
    login: "התחברות לטרייק",
    signup: "יצירת חשבון",
    skip: "דלג · נסה קודם",
    welcome: "מסלולים שנבנים סביבך",
    welcomeLine: "שמרו מסלולים, סנכרנו הליכות ושתפו תחנות.",
    appearance: "מצב תצוגה",
    themeLabels: { light: "יום", dark: "לילה" },
  },
} as const;

/**
 * Sign in and sign up (round 13, screen F): the lit-lantern arch under a sunset sky, a paper welcome strip with the guide,
 * then the form on the cream sheet. No tab bar: this is before the app.
 */
export function AuthScreen({ mode, initialError }: { mode: "login" | "signup"; initialError?: string }) {
  const lang = useAuthLang();
  const t = COPY[lang];
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[440px] flex-col bg-cream font-app-sans text-charcoal md:border-x md:border-tk-hair">
      <header className="relative isolate h-[294px] shrink-0 overflow-hidden bg-cream px-4 pb-4 pt-[max(14px,env(safe-area-inset-top))]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/traike/band-login.svg" alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full object-cover object-top dark:hidden" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/traike/band-login-night.svg" alt="" aria-hidden className="absolute inset-0 -z-10 hidden h-full w-full object-cover object-top dark:block" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-[46%] bg-gradient-to-b from-transparent to-cream" />

        <div dir="ltr" className="flex h-9 items-center justify-between gap-2">
          <Link href="/" className="flex w-fit items-center gap-2 text-[#FFF7EC] [text-shadow:0_1px_10px_rgba(60,20,6,0.55)]">
            <Image src="/traike-icon.png" alt="" width={30} height={30} className="rounded-lg" />
            <span className="font-app-serif text-[24px] font-bold leading-none">Traike</span>
          </Link>
          <Link
            href="/app"
            dir={lang === "he" ? "rtl" : "ltr"}
            className="tk-champagne flex h-9 min-w-0 max-w-[64%] items-center gap-2 py-[5px] pe-[15px] ps-3 text-[16px] leading-none tracking-[0.02em]"
          >
            <span aria-hidden className="tk-champagne-ring" />
            <span className="truncate">{t.skip}</span>
          </Link>
        </div>

        <div className="flex h-[calc(100%-36px)] flex-col items-center justify-between text-center">
          <h1 dir="auto" className="mt-16 font-display text-[28px] font-normal leading-[1.12] text-[#FFF7EC] [text-shadow:0_1px_12px_rgba(50,16,4,0.6)]">
            {mode === "login" ? t.login : t.signup}
          </h1>
          <div className="flex w-full items-center gap-3 rounded-[6px] border border-tk-hair bg-paper px-3 py-2 text-start shadow-[0_2px_0_var(--tk-lip)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/traike/guide-avatar.jpg" alt="" className="h-[46px] w-[46px] shrink-0 rounded-full border-2 border-[var(--tk-ctl)] object-cover object-[50%_8%] dark:hidden" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/traike/guide-avatar-night.jpg" alt="" className="hidden h-[46px] w-[46px] shrink-0 rounded-full border-2 border-[var(--tk-ctl)] object-cover object-[50%_8%] dark:block" />
            <div>
              <p className="text-[16px] font-semibold leading-[1.42] text-tk-ink">{t.welcome}</p>
              <p className="text-[14px] leading-[1.3] text-tk-sage">{t.welcomeLine}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 bg-cream">
        <AuthForm mode={mode} initialError={initialError} lang={lang} />
        <div className="flex items-center justify-between gap-3 border-t border-tk-hair px-4 py-3">
          <span className="text-[16px] font-semibold text-tk-ink">{t.appearance}</span>
          <ThemeToggle labels={t.themeLabels} />
        </div>
      </div>
    </main>
  );
}

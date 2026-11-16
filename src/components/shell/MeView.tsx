"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { LogoutButton } from "@/components/auth/LogoutButton";
import { RefreshIcon } from "@/components/shell/icons";
import { StandingFactsPanel } from "@/components/StandingFactsPanel";
import { WalkSettingsPanel } from "@/components/WalkSettingsPanel";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import type { PlannerBridge } from "@/lib/shell/planner-bridge";
import type { WalkSettings } from "@/lib/types/walk-settings";

const COPY = {
  en: {
    title: "Me",
    account: "Account",
    changePassword: "Change password",
    display: "Display",
    dayNight: "Day / night",
    remembers: "What Traike remembers",
    refresh: "Refresh the app",
    refreshLive: "A walk is live. Refresh anyway?",
    refreshConfirm: "Refresh",
    cancel: "Keep walking",
    credits: "Credits",
    logIn: "Log in",
  },
  he: {
    title: "אני",
    account: "חשבון",
    changePassword: "החלפת סיסמה",
    display: "תצוגה",
    dayNight: "יום / לילה",
    remembers: "מה Traike זוכר",
    refresh: "רענון האפליקציה",
    refreshLive: "יש הליכה פעילה. לרענן בכל זאת?",
    refreshConfirm: "רענון",
    cancel: "ממשיכים ללכת",
    credits: "קרדיטים",
    logIn: "התחברות",
  },
} as const;

const CARD = "space-y-3 rounded-tk-card bg-paper p-4 shadow-tk-card";

/** Me: account, display, walk settings, what Traike remembers, refresh, credits. */
export function MeView({
  lang,
  settings,
  bridge,
  signedIn,
  walkLive,
}: {
  lang: "he" | "en";
  settings: WalkSettings | null;
  bridge: PlannerBridge;
  signedIn: boolean;
  walkLive: boolean;
}) {
  const t = COPY[lang];
  const [email, setEmail] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    void import("@/lib/supabase/client")
      .then(async ({ createClient }) => {
        const { data } = await createClient().auth.getUser();
        if (live) setEmail(data.user?.email ?? null);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [signedIn]);

  const refresh = () => {
    // A live walk is saved on this device, so a reload is survivable, but never a surprise.
    if (walkLive && !confirming) {
      setConfirming(true);
      return;
    }
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-[900] overflow-y-auto bg-cream font-brand text-charcoal lg:start-[72px]">
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4 px-4 pt-10 pb-[calc(96px+env(safe-area-inset-bottom))] lg:pb-12">
        <h1 className="font-display text-[28px] leading-[34px] text-forest">{t.title}</h1>

        <section className={CARD} aria-label={t.account}>
          {signedIn ? (
            <>
              {email ? <p dir="ltr" className="truncate text-[16px] text-tk-ink">{email}</p> : null}
              <div className="flex items-center justify-between gap-3 text-[15px]">
                <Link href="/forgot-password" className="min-h-11 content-center font-semibold text-terra">
                  {t.changePassword}
                </Link>
                <LogoutButton className="min-h-11 font-semibold text-terra disabled:opacity-50" />
              </div>
            </>
          ) : (
            <Link href="/login" className="inline-flex min-h-11 items-center font-semibold text-terra">
              {t.logIn}
            </Link>
          )}
        </section>

        <section className={CARD} aria-label={t.display}>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[15px] text-charcoal">{t.dayNight}</span>
            <ThemeToggle />
          </div>
        </section>

        {settings ? <WalkSettingsPanel settings={settings} onChange={(next) => bridge.setSettings(next)} /> : null}

        <section aria-label={t.remembers}>
          <StandingFactsPanel isSignedIn={signedIn} learnPreferences={settings?.preferenceLearningEnabled ?? false} />
        </section>

        <section className={CARD} aria-label={t.refresh}>
          {confirming ? (
            <>
              <p className="text-[16px] text-tk-ink">{t.refreshLive}</p>
              <div className="flex gap-2">
                <button type="button" onClick={refresh} className="min-h-12 rounded-full bg-terra px-5 text-[15px] font-semibold text-on-accent">
                  {t.refreshConfirm}
                </button>
                <button type="button" onClick={() => setConfirming(false)} className="min-h-12 rounded-full bg-charcoal/5 px-5 text-[15px] font-semibold text-charcoal">
                  {t.cancel}
                </button>
              </div>
            </>
          ) : (
            <button type="button" onClick={refresh} className="flex min-h-11 items-center gap-2 text-[15px] font-semibold text-charcoal">
              <RefreshIcon />
              {t.refresh}
            </button>
          )}
        </section>

        <section className={CARD} aria-label={t.credits}>
          <p className="text-[13px] leading-[18px] text-charcoal/80">
            Route: © openrouteservice by HeiGIT | Data from OpenStreetMap, © OpenStreetMap contributors. Weather: Open-Meteo. Maps: Google.
          </p>
        </section>
      </div>
    </div>
  );
}

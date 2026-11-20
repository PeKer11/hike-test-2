"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { LogoutButton } from "@/components/auth/LogoutButton";
import { PersonIcon, RefreshIcon } from "@/components/shell/icons";
import { BandTitle, ScreenBand } from "@/components/shell/ScreenBand";
import { SocialMeCards } from "@/components/social/SocialMeCards";
import { StandingFactsPanel } from "@/components/StandingFactsPanel";
import { WalkSettingsPanel } from "@/components/WalkSettingsPanel";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { BTN, BTN_ALT, SEC_BAR } from "@/components/ui/panel-style";
import type { PlannerBridge } from "@/lib/shell/planner-bridge";
import { withWalkClient } from "@/lib/walks/walk-history";
import type { WalkSettings } from "@/lib/types/walk-settings";

const COPY = {
  en: {
    title: "Me",
    walks: "walks done",
    account: "Account",
    changePassword: "Change password",
    display: "Display",
    dayNight: "Appearance",
    themeLabels: { light: "Day", dark: "Night" },
    remembers: "What Traike remembers",
    refresh: "Refresh the app",
    refreshLive: "A walk is live. Refresh anyway?",
    refreshConfirm: "Refresh",
    cancel: "Keep walking",
    credits: "Credits",
    logIn: "Log in",
    logout: { idle: "Log out", busy: "Logging out…" },
  },
  he: {
    title: "אני",
    walks: "הליכות שהושלמו",
    account: "חשבון",
    changePassword: "החלפת סיסמה",
    display: "תצוגה",
    dayNight: "מצב תצוגה",
    themeLabels: { light: "יום", dark: "לילה" },
    remembers: "מה Traike זוכר",
    refresh: "רענון האפליקציה",
    refreshLive: "יש הליכה פעילה. לרענן בכל זאת?",
    refreshConfirm: "רענון",
    cancel: "ממשיכים ללכת",
    credits: "קרדיטים",
    logIn: "התחברות",
    logout: { idle: "יציאה", busy: "יוצאים…" },
  },
} as const;

const ROW = "flex min-h-14 items-center justify-between gap-3 border-b border-tk-hair px-4 py-2 text-[16px] text-tk-ink";
const PRIMARY = BTN;

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
  const [walkCount, setWalkCount] = useState<number | null>(null);

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

  // The walked count for the header stat; the same head-only count Home uses.
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    void withWalkClient(async (client, userId) => (await import("@/lib/walks/saved-walks")).countMyWalkedWalks(client, userId)).then((n) => {
      if (live && typeof n === "number") setWalkCount(n);
    });
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
    <div className="fixed inset-0 z-[900] overflow-y-auto bg-cream font-app-sans text-charcoal lg:start-[72px]">
      <ScreenBand art="me">
        <div className="mt-5 flex items-center gap-3.5">
          <span aria-hidden className="relative grid h-14 w-14 shrink-0 place-items-center rounded-full border-2 border-[var(--tk-ctl)] bg-paper font-app-serif text-[24px] font-bold text-tk-ink shadow-[0_2px_0_var(--tk-lip)]">
            {email ? email.charAt(0).toUpperCase() : <PersonIcon className="h-6 w-6" />}
            <span className="absolute -bottom-0.5 -end-0.5 h-3.5 w-3.5 rounded-full border-2 border-paper bg-terra" />
          </span>
          <div className="min-w-0 flex-1">
            <BandTitle>{t.title}</BandTitle>
            {email ? <p dir="ltr" className="mt-0.5 truncate text-[15px] font-semibold text-[#FFF7EC] [text-shadow:0_1px_10px_rgba(60,20,6,0.55)]">{email}</p> : null}
          </div>
          {walkCount !== null ? (
            <p className="shrink-0 text-center text-[#FFF7EC] [text-shadow:0_1px_10px_rgba(60,20,6,0.55)]">
              <bdi className="block font-app-serif text-[40px] font-semibold leading-none [font-variation-settings:'SOFT'_100,'WONK'_1]">{walkCount}</bdi>
              <span className="mt-1 block max-w-[92px] text-[13px] font-semibold leading-[1.15]">{t.walks}</span>
            </p>
          ) : null}
        </div>
      </ScreenBand>

      <div className="mx-auto flex w-full max-w-[560px] flex-col pb-[calc(96px+env(safe-area-inset-bottom))] lg:pb-12">
        <section aria-label={t.account}>
          <h2 className={SEC_BAR}>{t.account}</h2>
          {signedIn ? (
            <>
              <Link href="/forgot-password" className={`${ROW} font-semibold`}>
                {t.changePassword}
                <span aria-hidden className="text-charcoal/50 rtl:-scale-x-100">›</span>
              </Link>
              <div className={ROW}>
                <LogoutButton className="min-h-11 font-semibold text-terra disabled:opacity-50" labels={t.logout} />
              </div>
            </>
          ) : (
            <div className="border-b border-tk-hair px-4 py-4">
              <Link href="/login" className={PRIMARY}>
                {t.logIn}
              </Link>
            </div>
          )}
        </section>

        <SocialMeCards lang={lang} signedIn={signedIn} />

        <section aria-label={t.display}>
          <h2 className={SEC_BAR}>{t.display}</h2>
          <div className={ROW}>
            <span>{t.dayNight}</span>
            <ThemeToggle labels={t.themeLabels} />
          </div>
        </section>

        {settings ? <WalkSettingsPanel settings={settings} onChange={(next) => bridge.setSettings(next)} /> : null}

        <section aria-label={t.remembers}>
          <StandingFactsPanel isSignedIn={signedIn} learnPreferences={settings?.preferenceLearningEnabled ?? false} />
        </section>

        <section aria-label={t.refresh} className="border-b border-tk-hair">
          {confirming ? (
            <div className="space-y-3 px-4 py-3">
              <p className="text-[16px] text-tk-ink">{t.refreshLive}</p>
              <div className="flex gap-2">
                <button type="button" onClick={refresh} className={PRIMARY}>
                  {t.refreshConfirm}
                </button>
                <button type="button" onClick={() => setConfirming(false)} className={BTN_ALT}>
                  {t.cancel}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={refresh} className="flex min-h-14 w-full items-center gap-2 px-4 text-[16px] font-semibold text-tk-ink">
              <RefreshIcon />
              {t.refresh}
            </button>
          )}
        </section>

        <section aria-label={t.credits} className="px-4 py-4">
          <p className="text-[13px] leading-[18px] text-charcoal/70">
            Route: © openrouteservice by HeiGIT | Data from OpenStreetMap, © OpenStreetMap contributors. Weather: Open-Meteo. Maps: Google.
          </p>
        </section>
      </div>
    </div>
  );
}

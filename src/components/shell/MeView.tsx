"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { LogoutButton } from "@/components/auth/LogoutButton";
import { PersonIcon, RefreshIcon } from "@/components/shell/icons";
import { LocationChip } from "@/components/shell/LocationChip";
import { BandTitle, ScreenBand } from "@/components/shell/ScreenBand";
import { SegRow } from "@/components/ui/SegRow";
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
    walks: "walks",
    prefs: "Walking preferences",
    language: "Language",
    pace: "Default pace",
    paceLine: "Learned from your walks",
    units: "Distance units",
    account: "Account",
    changePassword: "Change password",
    display: "Display",
    dayNight: "Appearance",
    kmh: "km/h",
    unitsValue: "km / m",
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
    walks: "הליכות",
    prefs: "העדפות הליכה ותצוגה",
    language: "שפת ממשק",
    pace: "קצב הליכה קבוע",
    paceLine: "נלמד מההליכות שלכם",
    units: "יחידות מרחק",
    account: "חשבון",
    changePassword: "החלפת סיסמה",
    display: "תצוגה",
    dayNight: "מצב תצוגה",
    kmh: "קמ״ש",
    unitsValue: "ק״מ / מ׳",
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

const ROW = "flex min-h-14 items-center justify-between gap-3 border-b border-tk-hair px-4 py-[10px] text-[16px] text-tk-ink";
const PRIMARY = BTN;

/** Me: account, display, walk settings, what Traike remembers, refresh, credits. */
export function MeView({
  lang,
  settings,
  bridge,
  signedIn,
  walkLive,
  suggestedPace = null,
}: {
  lang: "he" | "en";
  settings: WalkSettings | null;
  bridge: PlannerBridge;
  signedIn: boolean;
  walkLive: boolean;
  /** The pace (min/km) learned from the walker's walks, when the account has one. */
  suggestedPace?: number | null;
}) {
  const t = COPY[lang];
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [walkCount, setWalkCount] = useState<number | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    void import("@/lib/supabase/client")
      .then(async ({ createClient }) => {
        const { data } = await createClient().auth.getUser();
        if (live) {
          setEmail(data.user?.email ?? null);
          const meta = data.user?.user_metadata as { full_name?: unknown; name?: unknown } | undefined;
          const given = typeof meta?.full_name === "string" ? meta.full_name : typeof meta?.name === "string" ? meta.name : null;
          setName(given && given.trim() ? given.trim() : null);
        }
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
      <ScreenBand art="sky" actions={<LocationChip lang={lang} onClick={() => window.history.pushState(null, "", "/app?view=plan")} />}>
        <div className="mt-[18px] flex items-center gap-[14px]">
          <span aria-hidden className="relative grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full border-2 border-[var(--tk-ctl)] bg-paper font-app-serif text-[22px] font-bold text-tk-ink shadow-[0_2px_0_var(--tk-lip)]">
            {(name ?? email) ? (name ?? email ?? "").trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("") : <PersonIcon className="h-6 w-6" />}
            <span className="absolute -bottom-0.5 -end-0.5 h-3.5 w-3.5 rounded-full border-2 border-paper bg-[var(--tk-leather)]" />
          </span>
          <div className="min-w-0 flex-1">
            <BandTitle>{name ?? t.title}</BandTitle>
            {email || walkCount !== null ? (
              <p className="mt-1 text-[16px] font-semibold leading-[1.3] text-[#FFF7EC] [text-shadow:0_1px_10px_rgba(60,20,6,0.55)]">
                {email ? <bdi dir="ltr">{email}</bdi> : null}
                {email && walkCount !== null ? " · " : ""}
                {walkCount !== null ? <><bdi>{walkCount}</bdi> {t.walks}</> : null}
              </p>
            ) : null}
          </div>
        </div>
      </ScreenBand>

      <div className="mx-auto flex w-full max-w-[560px] flex-col pb-[calc(96px+env(safe-area-inset-bottom))] lg:pb-12">
        <section aria-label={t.prefs}>
          <h2 className={SEC_BAR}>{t.prefs}</h2>
          <div className={ROW}>
            <span className="font-semibold">{t.language}</span>
            <div className="w-[150px]">
              <SegRow
                label={t.language}
                value={(settings?.uiLanguage === "auto" || !settings ? lang : settings.uiLanguage) as "en" | "he"}
                onChange={(id) => bridge.setSettings({ uiLanguage: id })}
                items={[
                  { id: "en", label: "EN" },
                  { id: "he", label: "עברית" },
                ]}
              />
            </div>
          </div>
          <div className={ROW}>
            <span className="font-semibold">{t.dayNight}</span>
            <ThemeToggle labels={t.themeLabels} />
          </div>
          {suggestedPace ? (
            <div className={ROW}>
              <span>
                <span className="block font-semibold">{t.pace}</span>
                <span className="block text-[14px] font-normal text-tk-sage">{t.paceLine}</span>
              </span>
              <span className="font-semibold">
                <bdi>{(60 / suggestedPace).toFixed(1)}</bdi> {t.kmh}
              </span>
            </div>
          ) : null}
          <div className={ROW}>
            <span className="font-semibold">{t.units}</span>
            <span className="font-semibold">{t.unitsValue}</span>
          </div>
        </section>

        {/* The sheet's closing buttons: sign out is a secondary at full width, log in the one primary. */}
        <div className="flex flex-col gap-[10px] px-4 pb-4 pt-[14px]">
          {signedIn ? (
            <LogoutButton className="tk-btn tk-btn-secondary w-full disabled:opacity-50" labels={t.logout} />
          ) : (
            <Link href="/login" className={`${PRIMARY} w-full`}>
              {t.logIn}
            </Link>
          )}
        </div>

        <section aria-label={t.account} className={signedIn ? "" : "hidden"}>
          <h2 className={SEC_BAR}>{t.account}</h2>
          <Link href="/forgot-password" className={`${ROW} font-semibold`}>
            {t.changePassword}
            <span aria-hidden className="text-charcoal/50 rtl:-scale-x-100">›</span>
          </Link>
        </section>

        <SocialMeCards lang={lang} signedIn={signedIn} />

        {settings ? <WalkSettingsPanel settings={settings} onChange={(next) => bridge.setSettings(next)} lang={lang} /> : null}

        <section aria-label={t.remembers}>
          <StandingFactsPanel isSignedIn={signedIn} learnPreferences={settings?.preferenceLearningEnabled ?? false} lang={lang} />
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

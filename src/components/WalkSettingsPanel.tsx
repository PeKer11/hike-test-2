"use client";

import { clearLocalLearning } from "@/lib/preferences/forget-client";
import { useId, useState, type ChangeEvent, type ReactNode } from "react";

import { Toggle } from "@/components/ui/Toggle";
import { syncOptIn } from "@/lib/social/client";
import { socialEnabled } from "@/lib/social/flag";
import { walkCopy } from "@/lib/walk/walk-copy";
import {
  CALLOUT_LEVELS,
  MAX_DEVIATION_DISTANCE_M,
  MIN_DEVIATION_DISTANCE_M,
  clampDeviationDistance,
  toRouteOrderMode,
} from "@/lib/types/walk-settings";
import type { CalloutLevel } from "@/lib/types/discovery";
import type {
  DeviationResponseMode,
  PaceResponseMode,
  WalkSettings,
} from "@/lib/types/walk-settings";
import { BTN_ALT_SM, SEG_WRAP, segCell } from "@/components/ui/panel-style";

// The two directions read as one setting with two halves, so they render as a
// pair rather than as two unrelated rows scattered through the panel.
const PACE_SETTINGS: { key: "slowPaceMode" | "fastPaceMode"; label: string; he: string }[] = [
  { key: "slowPaceMode", label: "When I fall behind", he: "כשאני מאחר" },
  { key: "fastPaceMode", label: "When I'm ahead", he: "כשאני מקדים" },
];

const PACE_MODE_LABELS: { value: PaceResponseMode; text: string; he: string }[] = [
  { value: "auto", text: "Reshape the walk", he: "לעצב מחדש את המסלול" },
  { value: "ask", text: "Ask me first", he: "לשאול אותי קודם" },
  { value: "off", text: "Leave it alone", he: "להשאיר כמו שזה" },
];

// Same three answers as the pace rows, worded for the situation they answer:
// off route, "reshape the walk" would read as an offer to change the plan when
// what is actually on offer is redrawing the same plan to reach the walker.
const DEVIATION_MODE_LABELS: { value: DeviationResponseMode; text: string; he: string }[] = [
  { value: "auto", text: "Redraw from here", he: "לצייר מחדש מכאן" },
  { value: "ask", text: "Ask me first", he: "לשאול אותי קודם" },
  { value: "off", text: "Leave it alone", he: "להשאיר כמו שזה" },
];

/** Hebrew for the panel's own words; English stays inline (tests and the live-walk sheet read it). */
const HE = {
  title: "הגדרות הליכה",
  paceTitle: "אם הקצב שלי משתנה",
  behind: "כשאני מאחר",
  ahead: "כשאני מקדים",
  auto: "לעצב מחדש את המסלול",
  ask: "לשאול אותי קודם",
  off: "להשאיר כמו שזה",
  redraw: "לצייר מחדש מכאן",
  interval: "כל כמה זמן לבדוק את הקצב (שניות)",
  offTitle: "אם אני סוטה מהמסלול",
  offDistance: "לשאול אותי כשאני רחוק כל כך מהמסלול (מטרים)",
  howRespond: "איך להגיב",
  silenceLabel: "אם אני לא עונה אבל ממשיך ללכת לכיוון אחד",
  silenceOn: "פעיל — אם אחזיק כיוון אחד כל הזמן שלא עניתי, צייר מחדש את המסלול סביב המקום שאליו אני הולך.",
  silenceOff: "כבוי — שתיקה משאירה את המסלול הישן כמו שהוא.",
  addStop: "כשאני מוסיף תחנה",
  assistantShould: "העוזר צריך",
  propose: "להציע מקום ואז לשאול אם מתאים",
  askKind: "לשאול קודם איזה סוג מקום",
  reshape: "כשמעצבים מחדש את ההליכה",
  startNew: "להתחיל את המסלול החדש בשבילי",
  startNewOn: "פעיל — אחרי שנעצב מחדש את ההליכה, המעקב ממשיך ישר על המסלול החדש.",
  startNewOff: "כבוי — נציג את ההליכה המעוצבת מחדש ונחכה שתלחצו על התחל הליכה.",
  language: "שפה",
  remember: "מה אנחנו זוכרים בין הליכות",
  rememberPrefs: "לזכור את ההעדפות שלי",
  rememberOn: "פעיל — מה שאתם אומרים שאתם אוהבים ואיך שאתם מדרגים הליכות מעצב את ההליכות הבאות.",
  rememberOff: "כבוי — Traike לא ילמד את ההעדפות שלכם, ולכן הליכות עתידיות עשויות להרגיש פחות אישיות.",
  keepRequests: "לשמור את הבקשות האחרונות שלי",
  keepOn: "פעיל — מה שהקלדתם לאחרונה יישאר ברשימת הבקשות האחרונות בפעם הבאה. אפשר למחוק מהרשימה בכל רגע.",
  keepOff: "כבוי — הבקשות נשכחות כשסוגרים את הלשונית.",
  community: "קהילה",
  communityLabel: "לתרום באנונימיות להמלצות הקהילה",
  communityOn: "פעיל — ההצבעות שלכם על מקומות יכולות להיספר ב\"מומלץ על ידי הולכים\" אצל אחרים, רק כשלפחות 5 הולכים מסכימים ואחרי השהיה של יומיים. שמות ומיקומים לא משותפים לעולם, ואתם רואים את הרמזים האלה גם.",
  communityOff: "כבוי — ההצבעות נשארות שלכם, ולא תראו רמזי קהילה.",
  data: "הנתונים שלכם",
  forget: "לשכוח את כל מה ש-Traike למד עליי",
  done: "בוצע. הנתונים שנלמדו נמחקו.",
  failed: "לא הצלחנו למחוק הכול. נסו שוב.",
  newRoute: "מסלול חדש מכאן",
  auto2: "אוטומטי",
} as const;

const SELECT_CLASS =
  "min-h-10 rounded-[6px] border-[1.5px] border-[var(--tk-ctl)] bg-cream px-2 text-[15px] text-[var(--tk-ctl)] outline-none focus:outline-2 focus:outline-offset-1 focus:outline-[var(--tk-ctl)]";
const ROW_CLASS =
  "flex items-center justify-between gap-3 text-[15px] text-tk-ink";
const NUMBER_CLASS =
  "w-full rounded-[6px] border-[1.5px] border-[var(--tk-ctl)] bg-cream px-3 py-2 text-[16px] text-tk-ink outline-none focus:outline-2 focus:outline-offset-1 focus:outline-[var(--tk-ctl)]";

/**
 * One named group of settings.
 *
 * Each heading names the situation the group answers rather than the machinery
 * behind it — the walker is deciding what happens when they fall behind, not
 * configuring a pace checker. The first group carries no rule above it; every
 * later one does, which is how the panel already separated its two headed
 * groups before the rest of the controls got headings of their own.
 */
function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="space-y-2 border-t border-tk-hair pt-3 first:border-t-0 first:pt-0"
    >
      <h3 id={headingId} className="text-[15px] font-semibold text-tk-ink">
        {title}
      </h3>
      {children}
    </section>
  );
}

interface WalkSettingsPanelProps {
  settings: WalkSettings;
  onChange: (s: Partial<WalkSettings>) => void;
  /** Language of the route-order row (the rest of the panel is English). */
  lang?: "he" | "en";
}

export function WalkSettingsPanel({
  settings,
  onChange,
  lang = "en",
}: WalkSettingsPanelProps) {
  /**
   * Closed to start with, for the same reason the Recent requests scrollback
   * is: these are set-once answers, while everything above them in the panel —
   * where you are, how long you have, what you feel like seeing — is filled in
   * afresh for every walk. Left open, seven controls and their explanations sit
   * between the walker and the Build My Walk button on every single visit.
   */
  const [isOpen, setIsOpen] = useState(false);
  const [forgetState, setForgetState] = useState<"idle" | "working" | "done" | "failed">("idle");
  const he = lang === "he";
  const tx = (en: string, hebrew: string) => (he ? hebrew : en);
  const intervalSeconds = Math.round(settings.paceCheckIntervalMs / 1000);

  const handleIntervalChange = (event: ChangeEvent<HTMLInputElement>) => {
    const seconds = Number(event.target.value);

    if (Number.isNaN(seconds)) {
      return;
    }

    onChange({ paceCheckIntervalMs: seconds * 1000 });
  };

  return (
    <section className="bg-cream font-app-sans">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="tk-bar w-full cursor-pointer"
      >
        <span>{tx("Walk settings", HE.title)}</span>
        <span aria-hidden="true">{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <div className="space-y-4 px-4 py-3">
          {/* Ordering inside every group: what decides whether we act at all
              comes first, then what shapes how we act, then the tuning that
              only matters once something is switched on. */}
          <SettingsSection title={tx("If my pace drifts", HE.paceTitle)}>
            {PACE_SETTINGS.map(({ key, label, he: labelHe }) => (
              <label key={key} className={ROW_CLASS}>
                <span>{tx(label, labelHe)}</span>
                <select
                  value={settings[key]}
                  onChange={(event) =>
                    onChange({ [key]: event.target.value as PaceResponseMode })
                  }
                  className={SELECT_CLASS}
                >
                  {PACE_MODE_LABELS.map(({ value, text, he: textHe }) => (
                    <option key={value} value={value}>
                      {tx(text, textHe)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            {/* Moved in here from the bottom of the panel, where it sat under
                no heading at all and read as though it belonged to the
                off-route group directly above it. It has only ever been about
                pace. */}
            <label className="space-y-1 text-[15px] text-tk-ink">
              <span className="block">{tx("How often we check your pace (seconds)", HE.interval)}</span>
              <input
                type="number"
                min={30}
                value={intervalSeconds}
                onChange={handleIntervalChange}
                className={NUMBER_CLASS}
              />
            </label>
          </SettingsSection>

          <SettingsSection title={tx("If I go off route", HE.offTitle)}>
            <label className="space-y-1 text-[15px] text-tk-ink">
              <span className="block">{tx("Ask me when I am this far from the route (metres)", HE.offDistance)}</span>
              <input
                type="number"
                min={MIN_DEVIATION_DISTANCE_M}
                max={MAX_DEVIATION_DISTANCE_M}
                key={settings.deviationDistanceM}
                defaultValue={settings.deviationDistanceM}
                onBlur={(event) => {
                  const m = clampDeviationDistance(Number(event.target.value));
                  event.target.value = String(m);
                  onChange({ deviationDistanceM: m });
                }}
                className={NUMBER_CLASS}
              />
            </label>
            <label className={ROW_CLASS}>
              <span>{tx("How to respond", HE.howRespond)}</span>
              <select
                value={settings.deviationMode}
                onChange={(event) =>
                  onChange({
                    deviationMode: event.target.value as DeviationResponseMode,
                  })
                }
                className={SELECT_CLASS}
              >
                {DEVIATION_MODE_LABELS.map(({ value, text, he: textHe }) => (
                  <option key={value} value={value}>
                    {tx(text, textHe)}
                  </option>
                ))}
              </select>
            </label>

            {/* Only means anything once there's a question to leave unanswered. */}
            {settings.deviationMode === "ask" && (
              <div className="space-y-1">
                <Toggle
                  checked={settings.continueHeadingOnSilence}
                  onChange={(next) =>
                    onChange({ continueHeadingOnSilence: next })
                  }
                  label={tx("If I don't answer but keep walking one way", HE.silenceLabel)}
                />
                <p className="text-[13px] text-charcoal/70">
                  {settings.continueHeadingOnSilence
                    ? tx("On — if I hold one direction the whole time you don't answer, redraw the walk around where I'm actually going.", HE.silenceOn)
                    : tx("Off — silence leaves the old route alone, same as always.", HE.silenceOff)}
                </p>
              </div>
            )}
          </SettingsSection>

          <SettingsSection title={walkCopy.discovery[lang]["level.title"]}>
            <label className={ROW_CLASS}>
              <span>{walkCopy.discovery[lang]["level.label"]}</span>
              <select
                value={settings.calloutLevel}
                onChange={(event) =>
                  onChange({ calloutLevel: event.target.value as CalloutLevel })
                }
                className={SELECT_CLASS}
              >
                {CALLOUT_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {walkCopy.discovery[lang][`level.${level}`]}
                  </option>
                ))}
              </select>
            </label>
          </SettingsSection>

          <SettingsSection title={lang === "he" ? "מסלול חדש מכאן" : "A new route from here"}>
            <label className={ROW_CLASS}>
              <span>{walkCopy.routeOrder[lang].setting}</span>
              <select
                value={settings.routeOrderMode}
                onChange={(event) => onChange({ routeOrderMode: toRouteOrderMode(event.target.value) })}
                className={SELECT_CLASS}
              >
                <option value="ask">{walkCopy.routeOrder[lang].ask}</option>
                <option value="keep">{walkCopy.routeOrder[lang].keepOption}</option>
                <option value="reorder">{walkCopy.routeOrder[lang].reorderOption}</option>
              </select>
            </label>
          </SettingsSection>

          <SettingsSection title={tx("When I add a stop", HE.addStop)}>
            <label className={ROW_CLASS}>
              <span>{tx("Assistant should", HE.assistantShould)}</span>
              <select
                value={settings.stopSuggestionMode}
                onChange={(event) =>
                  onChange({ stopSuggestionMode: event.target.value === "ask" ? "ask" : "propose" })
                }
                className={SELECT_CLASS}
              >
                <option value="propose">{tx("Suggest a place, then ask if it fits", HE.propose)}</option>
                <option value="ask">{tx("Ask what kind of place first", HE.askKind)}</option>
              </select>
            </label>
          </SettingsSection>

          {/* Its own group rather than a fourth row under "If my pace drifts",
              where it has sat since it was built alongside the pace work.
              `buildDeviationRebuildRequest` reads the same flag through the
              shared `buildMidWalkRebuildRequest`, so it answers what happens
              after *any* mid-walk rebuild — filing it under pace told the
              walker it only applied to one of the two ways of getting one. */}
          <SettingsSection title={tx("When we reshape your walk", HE.reshape)}>
            <Toggle
              checked={settings.autoResumeAfterRebuild}
              onChange={(next) => onChange({ autoResumeAfterRebuild: next })}
              label={tx("Start the new walk for me", HE.startNew)}
            />
            <p className="text-[13px] text-charcoal/70">
              {settings.autoResumeAfterRebuild
                ? tx("On — once we reshape your walk, tracking picks straight up on the new route.", HE.startNewOn)
                : tx("Off — we'll show you the reshaped walk and wait for you to press Start Walk.", HE.startNewOff)}
            </p>
          </SettingsSection>

          {/* The two toggles that outlive the walk. Preference learning leads
              because it is the one that quietly changes what gets built;
              keeping the requests only shows the walker their own words back. */}
          <SettingsSection title="Language / שפה">
            <div role="group" aria-label={tx("Language", HE.language)} className={SEG_WRAP}>
              {(["auto", "he", "en"] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  aria-pressed={settings.uiLanguage === code}
                  onClick={() => onChange({ uiLanguage: code })}
                  className={segCell(settings.uiLanguage === code)}
                >
                  {code === "auto" ? tx("Auto", HE.auto2) : code === "he" ? "עברית" : "English"}
                </button>
              ))}
            </div>
          </SettingsSection>

          <SettingsSection title={tx("What we remember between walks", HE.remember)}>
            <div className="space-y-1">
              <Toggle
                checked={settings.preferenceLearningEnabled}
                onChange={(next) =>
                  onChange({
                    preferenceLearningEnabled: next,
                    learningConsent: next ? "granted" : "declined",
                  })
                }
                label={tx("Remember my preferences", HE.rememberPrefs)}
              />
              <p className="text-[13px] text-charcoal/70">
                {settings.preferenceLearningEnabled
                  ? tx("On — what you say you like and how you rate your walks shapes the walks we build for you next.", HE.rememberOn)
                  : tx("Off — Traike won't learn your preferences, so future walks may feel less personalized.", HE.rememberOff)}
              </p>
            </div>

            <div className="space-y-1">
              <Toggle
                checked={settings.historyPersistenceEnabled}
                onChange={(next) =>
                  onChange({ historyPersistenceEnabled: next })
                }
                label={tx("Keep my recent requests", HE.keepRequests)}
              />
              <p className="text-[13px] text-charcoal/70">
                {settings.historyPersistenceEnabled
                  ? tx("On — the last few things you typed stay in the Recent requests list next time you open Traike. Clear them any time from that list.", HE.keepOn)
                  : tx("Off — your requests are forgotten when you close the tab.", HE.keepOff)}
              </p>
            </div>

          </SettingsSection>

          {/* Own section, own flag: contributing to OTHER walkers' recommendations is a
              different purpose from "Remember my preferences". Absent unless
              NEXT_PUBLIC_SOCIAL=1. */}
          {socialEnabled() ? (
            <SettingsSection title={tx("Community", HE.community)}>
              <div className="space-y-1">
                <Toggle
                  checked={settings.socialSharingEnabled}
                  onChange={(next) => {
                    onChange({ socialSharingEnabled: next });
                    // The only place the opt-in is written to the server: an explicit toggle.
                    void syncOptIn(next);
                  }}
                  label={tx("Contribute anonymously to community recommendations", HE.communityLabel)}
                />
                <p className="text-[13px] text-charcoal/70">
                  {settings.socialSharingEnabled
                    ? tx("On — your place upvotes can count toward \"Recommended by walkers\" for others, only once at least 5 walkers agree and after a 2-day delay. No names or locations are ever shared, and you see these hints too.", HE.communityOn)
                    : tx("Off — your upvotes stay yours, and you won't see community hints.", HE.communityOff)}
                </p>
              </div>
            </SettingsSection>
          ) : null}

          <SettingsSection title={tx("Your data", HE.data)}>
            <div className="space-y-1">
              <button
                type="button"
                disabled={forgetState === "working"}
                onClick={() => {
                  setForgetState("working");
                  fetch("/api/forget-everything", { method: "DELETE" })
                    .then((res) => {
                      setForgetState(res.ok ? "done" : "failed");
                      if (res.ok) clearLocalLearning();
                      // The server just deleted the opt-in row; keep the local
                      // setting in step so it is not silently re-sent.
                      if (res.ok && socialEnabled() && settings.socialSharingEnabled) {
                        onChange({ socialSharingEnabled: false });
                      }
                    })
                    .catch(() => setForgetState("failed"));
                }}
                className={`${BTN_ALT_SM} whitespace-normal`}
              >
                {tx("Forget everything Traike learned about me", HE.forget)}
              </button>
              {forgetState === "done" ? (
                <p className="text-[13px] text-charcoal/70">{tx("Done. Your learned data is deleted.", HE.done)}</p>
              ) : null}
              {forgetState === "failed" ? (
                <p className="text-[13px] text-charcoal/70">{tx("Couldn't clear everything. Try again.", HE.failed)}</p>
              ) : null}
            </div>
          </SettingsSection>
        </div>
      )}
    </section>
  );
}

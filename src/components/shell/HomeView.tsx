"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { LocationChip } from "@/components/shell/LocationChip";
import { BTN, BTN_ALT_SM } from "@/components/ui/panel-style";
import { RouteSketch } from "@/components/walks/RouteSketch";
import { routeOf } from "@/lib/walks/walk-again";
import type { PlannerBridge, AppView } from "@/lib/shell/planner-bridge";
import { loadActiveWalk, type ActiveWalkSnapshot } from "@/lib/walk/active-walk-store";
import { socialProfilesEnabled } from "@/lib/social/flag";
import { socialCopy } from "@/lib/social/copy";
import { presenceEnabled } from "@/lib/social/flag";
import { fetchWalkingNow } from "@/lib/social/presence";
import { getMyProfile } from "@/lib/social/profiles";
import { incomingPending, type WalkRequest } from "@/lib/social/walk-requests";
import { withWalkClient } from "@/lib/walks/walk-history";
import type { SavedWalk } from "@/lib/walks/saved-walks";

const COPY = {
  en: {
    suggestTitle: "Your walk in progress",
    lastTitle: "Last walk",
    stat: { km: "km", stops: "stops", done: "done" },
    routeBar: "Your walk",
    routeLast: "Last walk's stops",
    start: "Start",
    next: "Next",
    passed: "Passed",
    finish: "Finish",
    recent: "Saved & recent walks",
    allWalks: "All walks",
    walk: "Walk",
    route: "Route of",
    stopsWord: "stops",
    morning: "Good morning",
    afternoon: "Good afternoon",
    evening: "Good evening",
    newRoute: "New route",
    newRouteCta: "How much time do you have?",
    planMyWalk: "Plan my walk",
    myWalks: "My walks",
    myWalksLine: "Walked and saved",
    invite: "Invite a friend",
    inviteLine: "Walk together",
    continueWalk: "Continue walk",
    backToWalk: "Back to the walk",
    stops: (done: number, total: number) => `${done} of ${total} stops`,
    stopsLabel: "stops done",
    resume: "Continue",
    open: "Open",
    last: "Last walk",
    again: "Walk again",
    km: "km",
    min: "min",
  },
  he: {
    suggestTitle: "ההליכה שלכם בעיצומה",
    lastTitle: "ההליכה האחרונה",
    stat: { km: "ק״מ", stops: "תחנות", done: "הושלמו" },
    routeBar: "ההליכה שלכם",
    routeLast: "תחנות ההליכה האחרונה",
    start: "התחלה",
    next: "הבאה",
    passed: "עברתם",
    finish: "סיום",
    recent: "מסלולים שמורים ואחרונים",
    allWalks: "לכל המסלולים",
    walk: "צא",
    route: "מסלול",
    stopsWord: "תחנות",
    morning: "בוקר טוב",
    afternoon: "צהריים טובים",
    evening: "ערב טוב",
    newRoute: "מסלול חדש",
    newRouteCta: "כמה זמן יש לכם?",
    planMyWalk: "תכנן לי הליכה",
    myWalks: "ההליכות שלי",
    myWalksLine: "מה שהלכתם ושמרתם",
    invite: "הזמנת חבר",
    inviteLine: "הולכים ביחד",
    continueWalk: "המשך הליכה",
    backToWalk: "חזרה להליכה",
    stops: (done: number, total: number) => `${done} מתוך ${total} תחנות`,
    stopsLabel: "תחנות הושלמו",
    resume: "המשך",
    open: "פתיחה",
    last: "ההליכה האחרונה",
    again: "הולכים שוב",
    km: 'ק"מ',
    min: "דק׳",
  },
} as const;

function greetingKey(hour: number): "morning" | "afternoon" | "evening" {
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

// Hero pictures. The portrait is the approved phone look and stays the default; the landscape serves md and up;
// ?homebg=forward swaps the phone one for a variant with the traveler a little closer (a comparison, not the default).
const HERO_PHONE = "/images/traike/home-forest.jpg";
const HERO_FORWARD = "/images/traike/home-forest-forward.jpg";
const HERO_WIDE = "/images/traike/home-forest-wide.jpg";

const ON_PHOTO = "text-[#FFF8EE] [text-shadow:0_2px_14px_rgba(0,0,0,.45)]";

/** The 52px timeline rows of the mockup: time column (here the step), spine with a ring, the stop, a tag. */
function StopRow({ index, count, name, tag, current, past }: { index: number; count: number; name: string; tag: string; current?: boolean; past?: boolean }) {
  return (
    <li className={`relative grid min-h-[52px] grid-cols-[22px_1fr_auto] items-center gap-2 border-b px-4 py-2 ${current ? "border-[var(--tk-sel)] bg-[var(--tk-sel)] text-[var(--tk-on-sel)]" : "border-tk-hair"}`}>
      <span aria-hidden className="relative flex h-full items-center justify-center self-stretch">
        {index > 0 ? <span className="absolute -top-[9px] bottom-1/2 left-[calc(50%-1px)] w-0.5 bg-[var(--tk-hair)]" /> : null}
        {index < count - 1 ? <span className="absolute -bottom-[9px] top-1/2 left-[calc(50%-1px)] w-0.5 bg-[var(--tk-hair)]" /> : null}
        <span className={`relative grid h-[14px] w-[14px] place-items-center rounded-full border-2 ${past ? "border-[var(--tk-walked)] bg-tk-bar" : current ? "border-[var(--tk-on-sel)] bg-[var(--tk-sel)]" : "border-[var(--tk-ctl)] bg-cream"}`}>
          {current ? <span className="h-1.5 w-1.5 rounded-full bg-[var(--tk-leather)]" /> : null}
        </span>
      </span>
      <span className={`text-[18px] font-semibold leading-[1.22] ${past ? "text-tk-sage" : ""}`}><bdi>{name}</bdi></span>
      <span className={`whitespace-nowrap text-[14px] font-semibold ${current ? "text-[var(--tk-on-sel)] opacity-80" : "text-tk-sage"}`}>{tag}</span>
    </li>
  );
}

/** Home (round 13): the photo hero with the one number that matters, the route it is about, and the walks to go again. */
export function HomeView({
  greetingName,
  lang,
  bridge,
  walkLive,
  signedIn,
  requests = [],
  onNavigate,
}: {
  greetingName: string | null;
  lang: "he" | "en";
  bridge: PlannerBridge;
  walkLive: boolean;
  signedIn: boolean;
  /** Walk-together requests; an incoming one is the first context row. */
  requests?: readonly WalkRequest[];
  onNavigate: (view: AppView) => void;
}) {
  const t = COPY[lang];
  const [snapshot, setSnapshot] = useState<ActiveWalkSnapshot | null>(null);
  const [recent, setRecent] = useState<SavedWalk[]>([]);
  const [hour, setHour] = useState(12);
  const [homeBg, setHomeBg] = useState<"city" | "forest" | "forward">("forest");
  const [socialName, setSocialName] = useState<string | null>(null);
  const [walkingNames, setWalkingNames] = useState<string[]>([]);

  // Read on the client only: the server cannot know the time of day or this device's storage.
  useEffect(() => {
    setHour(new Date().getHours());
    const bg = new URLSearchParams(window.location.search).get("homebg");
    if (bg === "city" || bg === "forward") setHomeBg(bg);
    setSnapshot(loadActiveWalk());
  }, []);
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    void withWalkClient(async (client, userId) => {
      const saved = await import("@/lib/walks/saved-walks");
      // A short page of rows: the last three walks, never the whole history.
      return saved.listMyWalks(client, userId, 3);
    }).then((rows) => {
      if (live && rows) setRecent(rows);
    });
    return () => {
      live = false;
    };
  }, [signedIn]);

  // The chosen social name wins over the account's first name (never the email).
  useEffect(() => {
    if (!signedIn || !socialProfilesEnabled()) return;
    let live = true;
    void withWalkClient((client, userId) => getMyProfile(client, userId)).then((p) => {
      if (live && p?.status === "ok") {
        setSocialName(p.profile.displayName);
        // Friends walking now: only when I share too (no lurking) and the feature is on.
        if (presenceEnabled() && p.profile.presenceAudience !== "off") {
          void fetchWalkingNow().then((r) => live && setWalkingNames(r.rows.slice(0, 3).map((x) => x.displayName)));
        }
      }
    });
    return () => {
      live = false;
    };
  }, [signedIn]);

  const incomingRequest = incomingPending(requests)[0];
  const last = recent[0] ?? null;

  const done = snapshot ? snapshot.visitedIds.length : 0;
  const total = snapshot ? snapshot.plan.orderedAttractions.length : 0;
  const inProgress = walkLive || snapshot !== null;
  const greeting = `${t[greetingKey(hour)]}${socialName ?? greetingName ? `, ${socialName ?? greetingName}` : ""}`;

  // The hero number: the walk in progress, else the last walk; with neither, the greeting stands alone.
  const hero =
    snapshot && !walkLive
      ? { minutes: Math.round(snapshot.plan.totalMinutes), km: snapshot.plan.totalDistanceMeters / 1000, stops: total, third: { value: done, label: t.stat.done } }
      : last && last.totalMin !== null
        ? { minutes: Math.round(last.totalMin), km: (last.distanceM ?? 0) / 1000, stops: last.stops.length, third: null }
        : null;

  // The timeline under the hero: stops of the walk in progress (passed / next) or of the last walk.
  const timeline: { name: string; tag: string; current?: boolean; past?: boolean }[] =
    snapshot && !walkLive
      ? snapshot.plan.orderedAttractions.map((a, i, all) => {
          const passed = snapshot.visitedIds.includes(a.id);
          const next = !passed && snapshot.plan.orderedAttractions.findIndex((x) => !snapshot.visitedIds.includes(x.id)) === i;
          return { name: a.name, tag: passed ? t.passed : next ? t.next : i === all.length - 1 ? t.finish : "", current: next, past: passed };
        })
      : last
        ? last.stops.map((s, i, all) => ({ name: s.name, tag: i === 0 ? t.start : i === all.length - 1 ? t.finish : "" }))
        : [];

  // The forest scenes have a sharp wide picture for tablet and desktop; the city one does not.
  const wide = homeBg !== "city";

  const contextRow = (text: string) => (
    <button type="button" onClick={() => onNavigate("social")} className="tk-row w-full text-start">
      <span className="flex-1 text-[18px] font-semibold leading-[1.22]">{text}</span>
      <span aria-hidden className="text-charcoal/50 rtl:-scale-x-100">›</span>
    </button>
  );

  return (
    <div className="font-app-sans fixed inset-0 z-[900] overflow-y-auto bg-cream text-charcoal lg:start-[72px]">
      <header className={`relative isolate overflow-hidden bg-cream${wide ? " md:min-h-[clamp(26rem,34vw,34rem)]" : ""}`}>
        <Image src={homeBg === "city" ? "/images/traike/home-city.jpg" : homeBg === "forward" ? HERO_FORWARD : HERO_PHONE} alt="" fill priority sizes="100vw" aria-hidden className={`-z-20 object-cover object-[50%_38%] dark:hidden${wide ? " md:hidden" : ""}`} />
        <Image src={homeBg === "city" ? "/images/traike/home-city-night.jpg" : homeBg === "forward" ? HERO_FORWARD : HERO_PHONE} alt="" fill sizes="100vw" aria-hidden className={`-z-20 hidden object-cover object-[50%_38%] ${wide ? "max-md:dark:block" : "dark:block"}`} />
        {wide && (
          // Tablet and desktop only: a 2880x1200 landscape, sharp at the full width. The phone pair above is untouched.
          // On a tablet the band is covered by height, so the picture is drawn about 1000px wide (hence that size).
          // The traveler is on the start side, so Hebrew mirrors the picture to keep him on the reading side.
          <Image src={HERO_WIDE} alt="" fill sizes="(min-width: 1024px) calc(100vw - 72px), 1000px" aria-hidden className="-z-20 hidden object-cover object-[0%_62%] md:block rtl:-scale-x-100" />
        )}
        <div
          aria-hidden
          className={`absolute inset-0 -z-10${wide ? " md:hidden" : ""}`}
          style={{ background: "linear-gradient(180deg, rgba(14,22,16,.5) 0%, rgba(14,22,16,.12) 38%, rgba(14,22,16,0) 62%, color-mix(in srgb, var(--tk-paper) 55%, transparent) 88%, var(--tk-paper) 100%)" }}
        />
        {wide && (
          <div
            aria-hidden
            className="absolute inset-0 -z-10 hidden md:block"
            style={{ background: "linear-gradient(180deg, rgba(14,22,16,.5) 0%, rgba(14,22,16,.3) 34%, rgba(14,22,16,.05) 60%, rgba(14,22,16,0) 72%, color-mix(in srgb, var(--tk-paper) 55%, transparent) 90%, var(--tk-paper) 100%)" }}
          />
        )}
        <div className="relative mx-auto max-w-[560px] px-4 pb-[14px] pt-[max(14px,env(safe-area-inset-top))]">
          <div dir="ltr" className="flex h-9 items-center justify-between gap-2">
            <span className={`flex w-fit items-center gap-2 ${ON_PHOTO}`}>
              <Image src="/traike-icon.png" alt="" width={30} height={30} className="rounded-lg" />
              <span className="font-app-serif text-[24px] font-bold leading-none">Traike</span>
            </span>
            <div className="flex min-w-0 max-w-[64%] justify-end">
              <LocationChip lang={lang} onClick={() => onNavigate("plan")} />
            </div>
          </div>

          <div className="mt-4">
            {hero ? (
              <>
                <h1 dir="auto" className={`text-[15px] font-bold leading-[1.3] ${ON_PHOTO}`}>{snapshot && !walkLive ? t.suggestTitle : t.lastTitle}</h1>
                <p className={`mt-0.5 flex items-baseline gap-1.5 ${ON_PHOTO}`}>
                  <bdi className="font-app-serif text-[84px] font-semibold leading-[0.86] tracking-[-0.03em] [font-variation-settings:'SOFT'_100,'WONK'_1]">{hero.minutes}</bdi>
                  <span className="text-[18px] font-semibold">{t.min}</span>
                </p>
                <dl className={`mt-3 flex ${ON_PHOTO}`}>
                  {[
                    { v: hero.km.toFixed(1), l: t.stat.km },
                    { v: String(hero.stops), l: t.stat.stops },
                    ...(hero.third ? [{ v: String(hero.third.value), l: hero.third.label }] : []),
                  ].map((f, i, all) => (
                    <div key={f.l} className={`flex flex-col gap-0.5 pe-4 ${i < all.length - 1 ? "me-4 border-e border-[rgba(255,248,238,.4)]" : ""}`}>
                      <dd className="font-app-serif text-[26px] font-semibold leading-none [font-variation-settings:'SOFT'_100,'WONK'_1]"><bdi>{f.v}</bdi></dd>
                      <dt className="text-[13px] font-semibold opacity-80">{f.l}</dt>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <h1 dir="auto" className={`pb-1 pt-10 font-app-serif text-[38px] font-bold leading-[42px] ${ON_PHOTO}`}>{greeting}</h1>
            )}
            <button
              type="button"
              onClick={() => {
                if (inProgress) {
                  if (!walkLive && snapshot) bridge.actions?.resumeWalk(snapshot);
                  onNavigate("walk");
                } else onNavigate("plan");
              }}
              className={`${BTN} mt-[14px] !min-h-12 w-full`}
            >
              {inProgress ? (walkLive ? t.backToWalk : t.continueWalk) : t.planMyWalk}
              <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="rtl:-scale-x-100">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
            {inProgress ? (
              <button type="button" onClick={() => onNavigate("plan")} className="sr-only">
                {t.planMyWalk}
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[560px] flex-col pb-[calc(96px+env(safe-area-inset-bottom))] lg:pb-12">
        {timeline.length > 0 ? (
          <section aria-label={snapshot && !walkLive ? t.routeBar : t.routeLast}>
            <h2 className="tk-bar">
              <span>{snapshot && !walkLive ? t.routeBar : t.routeLast}</span>
              {snapshot && !walkLive ? (
                <span className="font-normal text-tk-sage"><bdi>{done}</bdi> / <bdi>{total}</bdi> {t.stat.stops}</span>
              ) : last?.totalMin != null ? (
                <span className="font-normal text-tk-sage"><bdi>{Math.round(last.totalMin)}</bdi> {t.min}</span>
              ) : null}
            </h2>
            <ol>
              {timeline.slice(0, 6).map((r, i, all) => (
                <StopRow key={`${i}-${r.name}`} index={i} count={all.length} name={r.name} tag={r.tag} current={r.current} past={r.past} />
              ))}
            </ol>
          </section>
        ) : null}

        {incomingRequest ? contextRow(socialCopy[lang].wantsToWalk(incomingRequest.otherName)) : walkingNames.length > 0 ? contextRow(socialCopy[lang].friendsWalking(walkingNames.join(lang === "he" ? " ו" : ", "))) : null}

        <section aria-label={t.recent}>
          {signedIn ? (
            <h2 className="tk-bar">
              <span>{t.recent}</span>
              <button type="button" onClick={() => onNavigate("walks")} className="min-h-11 cursor-pointer text-[14px] font-semibold underline">
                {t.allWalks}
              </button>
            </h2>
          ) : (
            <button type="button" onClick={() => onNavigate("walks")} className="tk-bar w-full cursor-pointer">
              <span>{t.myWalks}</span>
              <span aria-hidden className="rtl:-scale-x-100">›</span>
            </button>
          )}
          {signedIn
            ? recent.map((w) => (
                <div key={w.id} className="grid grid-cols-[48px_1fr_auto] items-center gap-3 border-b border-tk-hair px-4 py-[10px]">
                  <RouteSketch route={routeOf(w)} label={`${t.route} ${w.title}`} square className="h-12 w-12 !rounded-[4px] border border-tk-hair !bg-tk-bar" />
                  <div className="min-w-0">
                    <p className="text-[18px] font-semibold leading-[1.22] text-tk-ink"><bdi>{w.title}</bdi></p>
                    <p className="mt-0.5 text-[14px] text-tk-sage">
                      <bdi>
                        {[w.totalMin !== null ? `${Math.round(w.totalMin)} ${t.min}` : null, w.distanceM !== null ? `${(w.distanceM / 1000).toFixed(1)} ${t.km}` : null, w.stops.length > 0 ? `${w.stops.length} ${t.stopsWord}` : null].filter(Boolean).join(" · ")}
                      </bdi>
                    </p>
                  </div>
                  <button type="button" className={BTN_ALT_SM} onClick={() => bridge.actions?.walkAgain(w)}>
                    {t.walk}
                  </button>
                </div>
              ))
            : null}
        </section>
      </div>
    </div>
  );
}

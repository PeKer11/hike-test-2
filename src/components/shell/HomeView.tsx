"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { ChoiceTile } from "@/components/shell/ChoiceTile";
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
    morning: "Good morning",
    afternoon: "Good afternoon",
    evening: "Good evening",
    newRoute: "New route",
    newRouteCta: "How much time do you have?",
    myWalks: "My walks",
    myWalksLine: "Walked and saved",
    invite: "Invite a friend",
    inviteLine: "Walk together",
    continueWalk: "Continue walk",
    backToWalk: "Back to the walk",
    stops: (done: number, total: number) => `${done} of ${total} stops`,
    resume: "Continue",
    open: "Open",
    last: "Last walk",
    again: "Walk again",
    km: "km",
    min: "min",
  },
  he: {
    morning: "בוקר טוב",
    afternoon: "צהריים טובים",
    evening: "ערב טוב",
    newRoute: "מסלול חדש",
    newRouteCta: "כמה זמן יש לכם?",
    myWalks: "ההליכות שלי",
    myWalksLine: "מה שהלכתם ושמרתם",
    invite: "הזמנת חבר",
    inviteLine: "הולכים ביחד",
    continueWalk: "המשך הליכה",
    backToWalk: "חזרה להליכה",
    stops: (done: number, total: number) => `${done} מתוך ${total} תחנות`,
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

const CARD = "relative rounded-tk-card bg-paper p-5 shadow-tk-card";
const PRIMARY = "min-h-12 rounded-full bg-terra px-6 text-[15px] font-semibold text-on-accent shadow-tk-soft transition-colors hover:bg-terra/90";

/** Home: at most four blocks: greeting, a walk to continue, the two big choices, one context card (last walk, else invite). */
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
  /** Walk-together requests; an incoming one is the first context card. */
  requests?: readonly WalkRequest[];
  onNavigate: (view: AppView) => void;
}) {
  const t = COPY[lang];
  const [snapshot, setSnapshot] = useState<ActiveWalkSnapshot | null>(null);
  const [last, setLast] = useState<SavedWalk | null>(null);
  const [walkCount, setWalkCount] = useState<number | null>(null);
  const [hour, setHour] = useState(12);
  const [homeBg, setHomeBg] = useState<"city" | "forest">("city");
  const [socialName, setSocialName] = useState<string | null>(null);
  const [walkingNames, setWalkingNames] = useState<string[]>([]);

  // Read on the client only: the server cannot know the time of day or this device's storage.
  useEffect(() => {
    setHour(new Date().getHours());
    if (new URLSearchParams(window.location.search).get("homebg") === "forest") setHomeBg("forest");
    setSnapshot(loadActiveWalk());
  }, []);
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    void withWalkClient(async (client, userId) => {
      const saved = await import("@/lib/walks/saved-walks");
      // One row for the last-walk card and a head count for the tile: never a page of full rows.
      const [latest, count] = await Promise.all([saved.listMyWalks(client, userId, 1), saved.countMyWalkedWalks(client, userId)]);
      return { latest, count };
    }).then((result) => {
      if (!live || !result) return;
      setWalkCount(result.count);
      if (result.latest[0]) setLast(result.latest[0]);
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

  const done = snapshot ? snapshot.visitedIds.length : 0;
  const total = snapshot ? snapshot.plan.orderedAttractions.length : 0;

  return (
    <div className="font-app-sans fixed inset-0 z-[900] overflow-y-auto bg-cream text-charcoal lg:start-[72px]">
      {/* Round 13 hero: the photo is shown in full (no blur, no wash), type sits on it. */}
      <div className="relative h-[300px] w-full overflow-hidden">
        <Image src={homeBg === "forest" ? "/images/traike/home-forest.jpg" : "/images/traike/home-city.jpg"} alt="" fill priority sizes="100vw" aria-hidden className="object-cover object-[50%_38%] dark:hidden" />
        <Image src={homeBg === "forest" ? "/images/traike/home-forest.jpg" : "/images/traike/home-city-night.jpg"} alt="" fill sizes="100vw" aria-hidden className="hidden object-cover object-[50%_38%] dark:block" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/10 to-transparent" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-cream" />
        <div className="relative mx-auto flex max-w-[960px] items-center px-4 pt-5 lg:px-8">
          <span className="flex items-center gap-2.5 text-[#FFF8EE] [text-shadow:0_2px_12px_rgba(0,0,0,.45)]">
            <Image src="/traike-icon.png" alt="" width={30} height={30} className="rounded-lg" />
            <span className="font-app-serif tracking-tight text-[24px] font-bold leading-none">Traike</span>
          </span>
        </div>
        <div className="absolute inset-x-0 bottom-10">
          <h1 className="font-app-serif tracking-tight mx-auto max-w-[960px] px-4 text-[38px] font-bold leading-[42px] text-[#FFF8EE] [text-shadow:0_2px_14px_rgba(0,0,0,.5)] lg:px-8">
            {t[greetingKey(hour)]}
            {socialName ?? greetingName ? `, ${socialName ?? greetingName}` : ""}
          </h1>
        </div>
      </div>
      <div className="relative mx-auto flex w-full max-w-[960px] flex-col gap-4 px-4 pt-2 pb-[calc(96px+env(safe-area-inset-bottom))] lg:px-8 lg:pb-12">
        {walkLive || snapshot ? (
          <section className={CARD} aria-label={t.continueWalk}>
            <h2 className="text-[20px] font-semibold leading-[26px] text-tk-ink">{walkLive ? t.backToWalk : t.continueWalk}</h2>
            {snapshot && !walkLive ? <p className="mt-1 text-[16px] text-charcoal/70">{t.stops(done, total)}</p> : null}
            <button
              type="button"
              className={`${PRIMARY} mt-4`}
              onClick={() => {
                if (!walkLive && snapshot) bridge.actions?.resumeWalk(snapshot);
                onNavigate("walk");
              }}
            >
              {walkLive ? t.open : t.resume}
            </button>
          </section>
        ) : null}

        <div className="grid grid-cols-2 gap-3.5 pt-6 lg:grid-cols-3" aria-label={t.newRoute}>
          <div className="lg:col-span-2 [&>button]:h-full [&>button]:w-full">
            <ChoiceTile variant="primary" title={t.newRoute} line={t.newRouteCta} image="/images/traike/3d/compass.png" onClick={() => onNavigate("plan")} />
          </div>
          <ChoiceTile title={t.myWalks} line={walkCount === null ? t.myWalksLine : undefined} number={walkCount} image="/images/traike/3d/boot.png" onClick={() => onNavigate("walks")} />
        </div>

        {incomingRequest ? (
          <button type="button" onClick={() => onNavigate("social")} className={`${CARD} flex min-h-16 items-center justify-between text-start`}>
            <span dir="auto" className="text-[20px] font-semibold leading-[26px] text-tk-ink">
              {socialCopy[lang].wantsToWalk(incomingRequest.otherName)}
            </span>
            <span aria-hidden className="text-charcoal/50">›</span>
          </button>
        ) : walkingNames.length > 0 ? (
          <button type="button" onClick={() => onNavigate("social")} className={`${CARD} flex min-h-16 items-center justify-between text-start`}>
            <span dir="auto" className="text-[20px] font-semibold leading-[26px] text-tk-ink">
              {socialCopy[lang].friendsWalking(walkingNames.join(lang === "he" ? " ו" : ", "))}
            </span>
            <span aria-hidden className="text-charcoal/50">›</span>
          </button>
        ) : last ? (
          <section className={CARD} aria-label={t.last}>
            <p className="text-[13px] font-medium text-charcoal/60">{t.last}</p>
            <h2 dir="auto" className="mt-0.5 text-[20px] font-semibold leading-[26px] text-tk-ink">
              {last.title}
            </h2>
            <p className="mt-1 text-[16px] text-charcoal/70">
              {last.distanceM !== null ? `${(last.distanceM / 1000).toFixed(1)} ${t.km}` : ""}
              {last.distanceM !== null && last.totalMin !== null ? " · " : ""}
              {last.totalMin !== null ? `${Math.round(last.totalMin)} ${t.min}` : ""}
            </p>
            <button type="button" className={`${PRIMARY} mt-4`} onClick={() => bridge.actions?.walkAgain(last)}>
              {t.again}
            </button>
          </section>
        ) : signedIn ? (
          <button type="button" onClick={() => onNavigate("social")} className={`${CARD} flex min-h-16 items-center justify-between text-start`}>
            <span>
              <span className="block text-[20px] font-semibold leading-[26px] text-tk-ink">{t.invite}</span>
              <span className="block text-[16px] text-charcoal/70">{t.inviteLine}</span>
            </span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import type { PlannerBridge, AppView } from "@/lib/shell/planner-bridge";
import { loadActiveWalk, type ActiveWalkSnapshot } from "@/lib/walk/active-walk-store";
import { withWalkClient } from "@/lib/walks/walk-history";
import type { SavedWalk } from "@/lib/walks/saved-walks";

const COPY = {
  en: {
    morning: "Good morning",
    afternoon: "Good afternoon",
    evening: "Good evening",
    newRoute: "New route",
    newRouteCta: "How much time do you have?",
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

/** Home: at most four blocks: greeting, new route, a walk to continue, the last walk. */
export function HomeView({
  greetingName,
  lang,
  bridge,
  walkLive,
  signedIn,
  onNavigate,
}: {
  greetingName: string | null;
  lang: "he" | "en";
  bridge: PlannerBridge;
  walkLive: boolean;
  signedIn: boolean;
  onNavigate: (view: AppView) => void;
}) {
  const t = COPY[lang];
  const [snapshot, setSnapshot] = useState<ActiveWalkSnapshot | null>(null);
  const [last, setLast] = useState<SavedWalk | null>(null);
  const [hour, setHour] = useState(12);

  // Read on the client only: the server cannot know the time of day or this device's storage.
  useEffect(() => {
    setHour(new Date().getHours());
    setSnapshot(loadActiveWalk());
  }, []);
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    void withWalkClient(async (client, userId) => (await import("@/lib/walks/saved-walks")).listMyWalks(client, userId, 1)).then((walks) => {
      if (live && walks && walks[0]) setLast(walks[0]);
    });
    return () => {
      live = false;
    };
  }, [signedIn]);

  const done = snapshot ? snapshot.visitedIds.length : 0;
  const total = snapshot ? snapshot.plan.orderedAttractions.length : 0;

  return (
    <div className="fixed inset-0 z-[900] overflow-y-auto bg-cream font-brand text-charcoal lg:start-[72px]">
      <Image src="/images/hub-mountain-lake-sunset.png" alt="" fill priority sizes="100vw" aria-hidden className="scale-105 object-cover object-center blur-lg dark:hidden" />
      <Image src="/images/hub-night.jpg" alt="" fill sizes="100vw" aria-hidden className="hidden scale-105 object-cover object-center blur-lg dark:block" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-cream/80 via-cream/60 to-cream/85" />
      <div className="relative mx-auto flex w-full max-w-[960px] flex-col gap-4 px-4 pt-10 pb-[calc(96px+env(safe-area-inset-bottom))] lg:px-8 lg:pb-12">
        <h1 className="font-display text-[40px] leading-[44px] text-forest">
          {t[greetingKey(hour)]}
          {greetingName ? `, ${greetingName}` : ""}
        </h1>

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

        <section className={CARD} aria-label={t.newRoute}>
          <Image src="/images/traike/3d/compass.png" alt="" width={96} height={113} aria-hidden className="pointer-events-none absolute -top-8 end-4 h-[96px] w-auto drop-shadow-xl" />
          <h2 className="text-[20px] font-semibold leading-[26px] text-tk-ink">{t.newRoute}</h2>
          <button type="button" className={`${PRIMARY} mt-4`} onClick={() => onNavigate("plan")}>
            {t.newRouteCta}
          </button>
        </section>

        {last ? (
          <section className={CARD} aria-label={t.last}>
            <Image src="/images/traike/3d/boot.png" alt="" width={96} height={90} aria-hidden className="pointer-events-none absolute -top-6 end-4 h-[84px] w-auto drop-shadow-xl" />
            <p className="text-[13px] font-medium text-charcoal/60">{t.last}</p>
            <h2 dir="auto" className="mt-0.5 pe-24 text-[20px] font-semibold leading-[26px] text-tk-ink">
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
        ) : null}
      </div>
    </div>
  );
}

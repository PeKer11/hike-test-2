"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { HomeView } from "@/components/shell/HomeView";
import { MeView } from "@/components/shell/MeView";
import { SocialView } from "@/components/social/SocialView";
import { Rail } from "@/components/shell/Rail";
import { TabBar } from "@/components/shell/TabBar";
import { BackIcon } from "@/components/shell/icons";
import { HUB_VIEWS } from "@/components/shell/nav";
import { shellLang } from "@/components/shell/useShellLang";
import { PlannerFrame } from "@/components/planner/PlannerFrame";
import { PlannerBridge, parseView, parseWalksTab, type AppView } from "@/lib/shell/planner-bridge";
import type { AttractionCategory } from "@/lib/types";

interface AppShellProps {
  greetingName: string | null;
  suggestedPace: number | null;
  suggestedCategories: AttractionCategory[] | null;
}

/**
 * The app's one page. The planner stays mounted for as long as the page lives (its GPS watch, chat and
 * timers keep running); screens are switched with `?view=` and the History API, so Back works and nothing
 * unmounts. Home, Social and Me are drawn over it; Walks is the planner's own side panel shown
 * full-size; Plan and Live walk are the planner as it was.
 */
function Shell({ greetingName, suggestedPace, suggestedCategories }: AppShellProps) {
  const params = useSearchParams();
  const view = parseView(params.get("view"));
  const walksTab = parseWalksTab(params.get("tab"));
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const profileParam = params.get("u");
  const profileId = profileParam && uuid.test(profileParam) ? profileParam : null;
  const addParam = params.get("add");
  const addCode = addParam && /^[A-Z0-9]{6,12}$/.test(addParam) ? addParam : null;
  const [bridge] = useState(() => new PlannerBridge());
  const live = useSyncExternalStore(bridge.subscribe, bridge.getState, bridge.getState);
  const lang = shellLang(live.settings);

  const navigate = useCallback((next: AppView) => {
    window.history.pushState(null, "", next === "home" ? "/app" : `/app?view=${next}`);
  }, []);

  // A walk starting takes the screen to the live walk; one ending leaves it (the finish card is on Plan).
  const wasLive = useRef(false);
  useEffect(() => {
    if (live.walkLive && !wasLive.current && view !== "walk") {
      window.history.replaceState(null, "", "/app?view=walk");
    } else if (!live.walkLive && wasLive.current && view === "walk") {
      window.history.replaceState(null, "", "/app?view=plan");
    }
    wasLive.current = live.walkLive;
  }, [live.walkLive, view]);

  // A reload (or a deep link) on the live-walk screen with no walk running has nothing to show and no way out
  // (no tab bar, no Back). Go Home, where "Continue walk" is offered. Wait for the planner's first publish
  // (it sets `settings`) so this cannot race a walk that is just starting.
  const walkSeen = useRef(false);
  useEffect(() => {
    if (live.walkLive) walkSeen.current = true;
    if (view === "walk" && !live.walkLive && !walkSeen.current && bridge.actions && live.settings) {
      window.history.replaceState(null, "", "/app");
    }
  }, [view, live.walkLive, live.settings, bridge]);

  const hub = HUB_VIEWS.includes(view);
  const plannerShown = view === "plan" || view === "walk" || view === "walks";

  return (
    <div data-view={view} className="font-brand text-charcoal">
      <PlannerFrame
        suggestedPace={suggestedPace}
        suggestedCategories={suggestedCategories}
        view={view}
        walksTab={walksTab}
        bridge={bridge}
        onNavigate={navigate}
        active={plannerShown}
        bottomBar={view === "walks"}
      />
      {view === "home" ? (
        <HomeView greetingName={greetingName} lang={lang} bridge={bridge} walkLive={live.walkLive} signedIn={live.signedIn} onNavigate={navigate} />
      ) : null}
      {view === "social" ? (
        <SocialView lang={lang === "he" ? "he" : "en"} bridge={bridge} signedIn={live.signedIn} profileId={profileId} addCode={addCode} />
      ) : null}
      {view === "me" ? <MeView lang={lang} settings={live.settings} bridge={bridge} signedIn={live.signedIn} walkLive={live.walkLive} /> : null}

      {view === "plan" ? (
        <button
          type="button"
          onClick={() => navigate("home")}
          aria-label={lang === "he" ? "חזרה" : "Back"}
          className="fixed start-3 top-3 z-[1000] flex h-11 w-11 items-center justify-center rounded-full bg-paper text-forest shadow-tk-card lg:hidden"
        >
          <BackIcon />
        </button>
      ) : null}

      {hub ? <TabBar view={view} lang={lang} friendBadge={live.friendRequests} onNavigate={navigate} /> : null}
      <Rail view={view} lang={lang} friendBadge={live.friendRequests} onNavigate={navigate} />
    </div>
  );
}

export function AppShell(props: AppShellProps) {
  // useSearchParams needs a Suspense boundary for prerendering in this Next version.
  return (
    <Suspense fallback={null}>
      <Shell {...props} />
    </Suspense>
  );
}

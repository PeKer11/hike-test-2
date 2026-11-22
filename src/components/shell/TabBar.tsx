"use client";

import { HomeIcon, PersonIcon, PlanIcon, WalkIcon, WalksIcon } from "@/components/shell/icons";
import { NAV_ITEMS, navFor, navTarget } from "@/components/shell/nav";
import type { AppView } from "@/lib/shell/planner-bridge";

/** A walk is running: a small leather dot on the Walk tab ("you / now"), cut out of the bar colour so it reads on the pine tab too. */
export function LiveDot({ className = "" }: { className?: string }) {
  return <span aria-hidden data-testid="walk-live-dot" className={`pointer-events-none absolute h-2.5 w-2.5 rounded-full bg-[var(--tk-leather)] shadow-[0_0_0_2px_var(--tk-nav-fill,var(--tk-cream))] ${className}`} />;
}

export const NAV_ICONS = { home: HomeIcon, plan: PlanIcon, walk: WalkIcon, walks: WalksIcon, me: PersonIcon } as const;

/** Phone bottom bar (round 13): Home, Plan, Walk, Walks, Me. The tab for the screen you are on is filled pine. */
export function TabBar({
  view,
  lang,
  friendBadge,
  walkLive = false,
  onNavigate,
}: {
  view: AppView;
  lang: "he" | "en";
  friendBadge: number;
  walkLive?: boolean;
  onNavigate: (view: AppView) => void;
}) {
  const current = navFor(view);
  return (
    <nav
      aria-label="App"
      className="tk-navfill fixed inset-x-0 bottom-0 z-[1000] grid grid-cols-5 gap-1 border-t-[1.5px] border-[var(--tk-ctl)] bg-cream p-1 pb-[max(4px,env(safe-area-inset-bottom))] lg:hidden"
    >
      {NAV_ITEMS.map((i) => {
        const Icon = NAV_ICONS[i.id];
        const on = current === i.id;
        return (
          <button key={i.id} type="button" onClick={() => onNavigate(navTarget(i.id, walkLive))} aria-current={on ? "page" : undefined} className="tk-tab">
            <Icon />
            {i[lang]}
            {i.id === "walk" && walkLive ? <LiveDot className="end-[30%] top-1.5" /> : null}
            {i.id === "walks" && friendBadge > 0 ? (
              <span className="absolute end-[22%] top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-terra px-1 text-[13px] font-semibold leading-none text-on-accent">
                {friendBadge}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

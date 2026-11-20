"use client";

import { NAV_ICONS } from "@/components/shell/TabBar";
import { NAV_ITEMS, navFor, navTarget } from "@/components/shell/nav";
import type { AppView } from "@/lib/shell/planner-bridge";

/** Desktop (lg and up): a 72px rail with the same five destinations as the phone bar. */
export function Rail({
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
    <nav aria-label="App" className="tk-navfill fixed inset-y-0 start-0 z-[1000] hidden w-[72px] flex-col items-center gap-2 border-e-[1.5px] border-[var(--tk-ctl)] bg-cream py-4 lg:flex">
      {NAV_ITEMS.map((i) => {
        const Icon = NAV_ICONS[i.id];
        const on = current === i.id;
        return (
          <button key={i.id} type="button" onClick={() => onNavigate(navTarget(i.id, walkLive))} aria-current={on ? "page" : undefined} className="tk-tab min-h-14 w-14">
            <Icon />
            {i[lang]}
            {i.id === "walks" && friendBadge > 0 ? (
              <span className="absolute end-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-terra px-1 text-[13px] font-semibold leading-none text-on-accent">
                {friendBadge}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

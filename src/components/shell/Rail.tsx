"use client";

import { HomeIcon, PeopleIcon, PersonIcon, PlusIcon, WalksIcon } from "@/components/shell/icons";
import { HUB_ITEMS, NEW_ROUTE } from "@/components/shell/nav";
import type { AppView } from "@/lib/shell/planner-bridge";

const ICONS: Record<string, (p: { className?: string }) => React.ReactNode> = {
  home: HomeIcon,
  walks: WalksIcon,
  social: PeopleIcon,
  me: PersonIcon,
};

/** Desktop (lg and up): a 72px rail with the same destinations. */
export function Rail({
  view,
  lang,
  friendBadge,
  onNavigate,
}: {
  view: AppView;
  lang: "he" | "en";
  friendBadge: number;
  onNavigate: (view: AppView) => void;
}) {
  const planOn = view === "plan" || view === "walk";
  return (
    <nav aria-label="App" className="fixed inset-y-0 start-0 z-[1000] hidden w-[72px] flex-col items-center gap-2 border-e-[1.5px] border-[var(--tk-ctl)] bg-cream py-4 lg:flex">
      <button
        type="button"
        onClick={() => onNavigate("plan")}
        aria-label={NEW_ROUTE[lang]}
        aria-current={planOn ? "page" : undefined}
        className="tk-fab mb-2"
      >
        <PlusIcon className="h-6 w-6" />
      </button>
      {HUB_ITEMS.map((i) => {
        const Icon = ICONS[i.view];
        const on = view === i.view;
        return (
          <button
            key={i.view}
            type="button"
            onClick={() => onNavigate(i.view)}
            aria-current={on ? "page" : undefined}
            className="tk-tab min-h-14 w-14"
          >
            <Icon className="h-6 w-6" />
            {i[lang]}
            {i.view === "social" && friendBadge > 0 ? (
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

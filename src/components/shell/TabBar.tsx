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

/** Phone bottom bar: four hubs and a raised "+" for a new route. Only on hub screens. */
export function TabBar({
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
  const item = (i: (typeof HUB_ITEMS)[number]) => {
    const Icon = ICONS[i.view];
    const on = view === i.view;
    return (
      <button
        key={i.view}
        type="button"
        onClick={() => onNavigate(i.view)}
        aria-current={on ? "page" : undefined}
        className={`relative flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-[14px] text-[13px] font-medium transition-colors ${on ? "text-terra" : "text-charcoal/70"}`}
      >
        <Icon className="h-6 w-6" />
        {i[lang]}
        {i.view === "social" && friendBadge > 0 ? (
          <span className="absolute end-[22%] top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-terra px-1 text-[13px] font-semibold leading-none text-on-accent">
            {friendBadge}
          </span>
        ) : null}
      </button>
    );
  };
  const [home, walks, social, me] = HUB_ITEMS;
  return (
    <nav
      aria-label="App"
      className="fixed inset-x-0 bottom-0 z-[1000] flex items-center gap-1 rounded-t-[22px] bg-paper px-3 pt-2 pb-[max(8px,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(30,61,47,0.18)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.5)] lg:hidden"
    >
      {item(home)}
      {item(walks)}
      <button
        type="button"
        onClick={() => onNavigate("plan")}
        aria-label={NEW_ROUTE[lang]}
        className="-mt-7 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-terra text-on-accent shadow-tk-card transition-transform active:scale-95"
      >
        <PlusIcon className="h-7 w-7" />
      </button>
      {item(social)}
      {item(me)}
    </nav>
  );
}

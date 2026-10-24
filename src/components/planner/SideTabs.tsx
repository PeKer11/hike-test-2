"use client";

import type { KeyboardEvent } from "react";

export type SideTab = "plan" | "walks" | "places" | "friends";

/** Thin rounded line icons in the brand's hand-drawn style; they take the tab's text colour. */
const ICONS: Record<SideTab, string> = {
  plan: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm3.5 5.5-2 5-5 2 2-5 5-2Z",
  walks: "M8 4c-2 1-2.5 4-1.5 7 .6 1.8 2 2.2 2.8 1 .9-1.4.9-4.5-.1-6.5C8.8 4.7 8.4 4.1 8 4Zm-.5 11.5c-.6 1 .1 2.5 1.2 2.5s1.6-1.3 1-2.2c-.5-.7-1.7-.8-2.2-.3ZM16 8c2 1 2.5 4 1.5 7-.6 1.8-2 2.2-2.8 1-.9-1.4-.9-4.5.1-6.5.4-1.2.8-1.8 1.2-1.5Z",
  places: "M4 6.5 9 5l6 1.5 5-1.5v12l-5 1.5-6-1.5-5 1.5v-12ZM9 5v12m6-10.5v12M12 8.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z",
  friends: "M8 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm8 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3.5 19c0-3 2-5 4.5-5s4.5 2 4.5 5m-1-4.5c.8-.4 1.6-.5 2.5-.5 2.5 0 4.5 2 4.5 5",
};

const TABS: { id: SideTab; label: string }[] = [
  { id: "plan", label: "Plan" },
  { id: "walks", label: "Walks" },
  { id: "places", label: "Places" },
  { id: "friends", label: "Friends" },
];

interface SideTabsProps {
  value: SideTab;
  onChange: (tab: SideTab) => void;
  /** Incoming friend requests, shown as a badge on Friends. */
  friendsBadge?: number;
}

/** Segmented control above the side column; arrow keys move between tabs. */
export function SideTabs({ value, onChange, friendsBadge = 0 }: SideTabsProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    const next = TABS[(TABS.findIndex((t) => t.id === value) + step + TABS.length) % TABS.length];
    onChange(next.id);
  };

  return (
    <div
      role="tablist"
      aria-label="Side panel"
      onKeyDown={onKeyDown}
      className="sticky top-0 z-10 flex gap-1 rounded-full bg-cream/90 p-1 shadow-tk-card backdrop-blur"
    >
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          tabIndex={value === tab.id ? 0 : -1}
          onClick={() => onChange(tab.id)}
          className={`flex-1 cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
            value === tab.id ? "bg-forest text-cream" : "text-charcoal/70 hover:text-forest"
          }`}
        >
          <svg aria-hidden viewBox="0 0 24 24" className="mr-1 inline h-4 w-4 align-[-3px]" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d={ICONS[tab.id]} />
          </svg>
          {tab.label}
          {tab.id === "friends" && friendsBadge > 0 && (
            <span className="ml-1 rounded-full bg-terra px-1.5 text-xs text-cream">{friendsBadge}</span>
          )}
        </button>
      ))}
    </div>
  );
}

"use client";

import type { KeyboardEvent } from "react";

export type SideTab = "plan" | "walks" | "places" | "friends";

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
          {tab.label}
          {tab.id === "friends" && friendsBadge > 0 && (
            <span className="ml-1 rounded-full bg-terra px-1.5 text-xs text-cream">{friendsBadge}</span>
          )}
        </button>
      ))}
    </div>
  );
}

"use client";

import { useSyncExternalStore } from "react";

import { THEME_EVENT, readChoice, setChoice, type ThemeChoice } from "@/lib/theme/theme";

const OPTIONS: { value: ThemeChoice; label: string; icon: React.ReactNode }[] = [
  {
    value: "light",
    label: "Light",
    icon: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
      </>
    ),
  },
  {
    value: "system",
    label: "Match device",
    icon: (
      <>
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8M12 16v4" />
      </>
    ),
  },
  {
    value: "dark",
    label: "Dark",
    icon: <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />,
  },
];

function subscribe(cb: () => void) {
  window.addEventListener(THEME_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(THEME_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function ThemeToggle({ floating = false }: { floating?: boolean }) {
  // "system" on the server keeps hydration identical.
  const choice = useSyncExternalStore(subscribe, readChoice, () => "system" as ThemeChoice);

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={
        floating
          ? "fixed right-3 top-3 z-[1000] flex items-center gap-0.5 rounded-full border border-charcoal/10 bg-paper/90 p-1 shadow-tk-soft backdrop-blur"
          : "flex items-center gap-0.5 rounded-full border border-charcoal/10 p-0.5"
      }
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={choice === o.value}
          aria-label={o.label}
          title={o.label}
          onClick={() => setChoice(o.value)}
          className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
            choice === o.value ? "bg-terra text-on-accent" : "text-charcoal/60 hover:text-charcoal"
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            {o.icon}
          </svg>
        </button>
      ))}
    </div>
  );
}

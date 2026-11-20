"use client";

import { setChoice } from "@/lib/theme/theme";
import { useResolvedTheme } from "@/lib/theme/useResolvedTheme";

const OPTIONS: { value: "light" | "dark"; label: string; icon: React.ReactNode }[] = [
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
    value: "dark",
    label: "Dark",
    icon: <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />,
  },
];

export function ThemeToggle({ floating = false }: { floating?: boolean }) {
  // Device-following stays the default until the first click; the pill shows what is on screen.
  const choice = useResolvedTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={
        floating
          ? "fixed right-3 top-3 z-[1000] flex items-center gap-0.5 rounded-full border border-charcoal/10 bg-paper/90 p-1 shadow-tk-soft backdrop-blur"
          : "flex items-center overflow-hidden rounded-[10px] border-[1.5px] border-forest bg-cream"
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
          className={`flex items-center justify-center transition-colors ${floating ? "h-9 w-9 rounded-full" : "h-11 w-14 first:border-e first:border-tk-hair"} ${
            choice === o.value ? (floating ? "bg-terra text-on-accent" : "bg-forest text-cream") : "text-charcoal/60 hover:text-charcoal"
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
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

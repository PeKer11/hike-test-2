"use client";

import { walkCopy } from "@/lib/walk/walk-copy";

export type SheetTheme = "nature" | "food" | "short" | "back";

/** One direction, as the sheet shows it. */
export interface SheetOption {
  theme: SheetTheme;
  minutes: number;
  distanceM: number;
  /** Stop names (OSM data, so rendered with dir="auto"). */
  stopNames: string[];
}

interface DirectionOptionsSheetProps {
  options: SheetOption[];
  /** The option whose line is highlighted on the map. */
  highlight: number;
  onHighlight: (index: number) => void;
  onChoose: (index: number) => void;
  onBack: () => void;
}

const THEME_ICON: Record<SheetTheme, string> = {
  nature: "🌳",
  food: "🍴",
  short: "🏠",
  back: "↩",
};

const THEME_KEY = {
  nature: "options.nature",
  food: "options.food",
  short: "options.short",
  back: "options.back",
} as const;

const t = (key: Parameters<typeof walkCopy.discovery.text>[1], vars?: Record<string, string | number>) =>
  walkCopy.discovery.text("en", key, vars);

/**
 * The one card the HUD shows once a walker has clearly gone a different way: up
 * to three directions to pick from, and a small "Back to my plan". Tapping a card
 * only highlights its dashed preview on the map; nothing is chosen until the
 * walker presses "Go this way" — an option is never picked for them.
 */
export function DirectionOptionsSheet({
  options,
  highlight,
  onHighlight,
  onChoose,
  onBack,
}: DirectionOptionsSheetProps) {
  return (
    <section
      data-testid="direction-options"
      aria-label={t("options.title")}
      className="pointer-events-auto rounded-2xl bg-cream/95 p-3 text-forest shadow-[0_4px_20px_rgba(30,61,47,0.12)] backdrop-blur"
    >
      <p className="text-sm font-semibold leading-snug">{t("options.title")}</p>
      <p className="mt-0.5 text-xs text-charcoal/70">{t("options.hint")}</p>

      <div className="-mx-1 mt-2 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1">
        {options.map((option, index) => {
          const selected = index === highlight;
          return (
            <button
              key={`${option.theme}-${index}`}
              type="button"
              aria-pressed={selected}
              onClick={() => onHighlight(index)}
              className={`w-44 shrink-0 snap-start rounded-xl p-2 text-start transition ${
                selected
                  ? "bg-terra/10 shadow-[0_2px_10px_rgba(193,95,60,0.25)]"
                  : "bg-white/70 hover:bg-forest/5"
              }`}
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                <span aria-hidden>{THEME_ICON[option.theme]}</span>
                {t(THEME_KEY[option.theme])}
              </span>
              <span className="mt-0.5 block text-xs text-charcoal/70">
                {t("options.stats", {
                  min: Math.round(option.minutes),
                  km: (option.distanceM / 1000).toFixed(1),
                  n: option.stopNames.length,
                })}
              </span>
              {option.stopNames.length > 0 ? (
                <span className="mt-1 flex flex-wrap gap-1">
                  {option.stopNames.slice(0, 3).map((name) => (
                    <span
                      key={name}
                      dir="auto"
                      className="max-w-full truncate rounded-full bg-forest/10 px-2 py-0.5 text-[11px]"
                    >
                      {name}
                    </span>
                  ))}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChoose(highlight)}
          className="flex-1 rounded-lg bg-terra px-3 py-2 text-xs font-semibold text-white transition hover:bg-terra/90"
        >
          {t("options.choose")}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-forest/25 px-3 py-1.5 text-xs font-semibold text-forest transition hover:bg-forest/10"
        >
          {t("options.back")}
        </button>
      </div>
    </section>
  );
}

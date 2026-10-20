"use client";

import { useMemo } from "react";

import { Button, Card } from "@/components/ui";

export interface WalkFinishData {
  stops: number;
  elapsedMin: number;
  walkedKm: number;
}

const COLORS = ["#c15f3c", "#1e3d2f", "#f59e0b", "#16a34a", "#e8a87c", "#2563eb"];

/** Confetti (CSS only, ~4 s, never blocks a tap) over a short "you finished" card. */
export function WalkFinishCard({
  data,
  lang,
  onClose,
}: {
  data: WalkFinishData;
  lang: "he" | "en";
  onClose: () => void;
}) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 48 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 1.2,
        duration: 2.6 + Math.random() * 1.8,
        size: 6 + Math.random() * 6,
        color: COLORS[i % COLORS.length],
        round: i % 3 === 0,
      })),
    [],
  );
  const he = lang === "he";
  const h = Math.floor(data.elapsedMin / 60);
  const m = Math.round(data.elapsedMin % 60);
  const duration = h > 0 ? `${h} ${he ? "ש׳" : "h"} ${m} ${he ? "דק׳" : "min"}` : `${m} ${he ? "דק׳" : "min"}`;

  return (
    <>
      <style>{`@keyframes traike-confetti{0%{transform:translateY(-12vh) rotate(0);opacity:1}100%{transform:translateY(105vh) rotate(720deg);opacity:.9}}`}</style>
      <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
        {pieces.map((p, i) => (
          <span
            key={i}
            style={{
              position: "absolute",
              top: 0,
              left: `${p.left}%`,
              width: p.size,
              height: p.size * (p.round ? 1 : 0.5),
              background: p.color,
              borderRadius: p.round ? "9999px" : 2,
              animation: `traike-confetti ${p.duration}s ${p.delay}s ease-in forwards`,
            }}
          />
        ))}
      </div>
      <Card className="space-y-3 bg-gradient-to-b from-terra/10 to-cream text-center">
        <h2 className="font-display text-2xl font-bold text-forest">
          {he ? "סיימת את ההליכה! 🎉" : "You finished your walk! 🎉"}
        </h2>
        <p className="text-sm text-charcoal/70">
          {he ? "איזו הליכה! גילית מקומות חדשים והכרת את האזור כמו מקומי." : "What a great walk! You explored new places and saw the area like a local."}
        </p>
        <div className="grid grid-cols-3 divide-x divide-charcoal/10 rounded-xl bg-white/70 py-3">
          <div>
            <div className="font-display text-lg font-bold text-forest">{duration}</div>
            <div className="text-xs text-charcoal/60">{he ? "משך" : "Duration"}</div>
          </div>
          <div>
            <div className="font-display text-lg font-bold text-forest">{data.walkedKm.toFixed(1)} km</div>
            <div className="text-xs text-charcoal/60">{he ? "מרחק" : "Distance"}</div>
          </div>
          <div>
            <div className="font-display text-lg font-bold text-forest">{data.stops}</div>
            <div className="text-xs text-charcoal/60">{he ? "עצירות" : "Stops"}</div>
          </div>
        </div>
        <Button variant="secondary" fullWidth onClick={onClose}>
          {he ? "תכנן הליכה נוספת" : "Plan another walk"}
        </Button>
      </Card>
    </>
  );
}

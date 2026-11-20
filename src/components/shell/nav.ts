import type { AppView } from "@/lib/shell/planner-bridge";

/** The five destinations, in bar order (round 13): the same on the phone bar and the desktop rail. */
export const NAV_ITEMS: { id: "home" | "plan" | "walk" | "walks" | "me"; en: string; he: string }[] = [
  { id: "home", en: "Home", he: "בית" },
  { id: "plan", en: "Plan", he: "תכנון" },
  { id: "walk", en: "Walk", he: "הליכה" },
  { id: "walks", en: "Walks", he: "מסלולים" },
  { id: "me", en: "Me", he: "פרופיל" },
];

/** Which bar item lights for a screen: Friends lives under Walks. */
export function navFor(view: AppView): (typeof NAV_ITEMS)[number]["id"] {
  return view === "social" ? "walks" : view;
}

/** Walk opens the live walk when one is running; with none, it goes to Plan, where a walk is started. */
export function navTarget(id: (typeof NAV_ITEMS)[number]["id"], walkLive: boolean): AppView {
  return id === "walk" && !walkLive ? "plan" : id;
}

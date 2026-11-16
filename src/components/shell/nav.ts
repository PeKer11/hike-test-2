import type { AppView } from "@/lib/shell/planner-bridge";

/** The four hub destinations, in tab order (the raised "+" for a new route sits between the second and third). */
export const HUB_ITEMS: { view: AppView; en: string; he: string }[] = [
  { view: "home", en: "Home", he: "בית" },
  { view: "walks", en: "Walks", he: "הליכות" },
  { view: "social", en: "Social", he: "חברים" },
  { view: "me", en: "Me", he: "אני" },
];

/** Screens with the tab bar: the hubs. Plan and Live walk are full-screen task screens. */
export const HUB_VIEWS: readonly AppView[] = ["home", "walks", "social", "me"];

export const NEW_ROUTE = { en: "New route", he: "מסלול חדש" };

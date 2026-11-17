import type { SavedStop, SavedWalk } from "@/lib/walks/saved-walks";
import type { ActiveWalkSnapshot } from "@/lib/walk/active-walk-store";
import type { MeetChoice, MeetPlace, WalkRequest } from "@/lib/social/walk-requests";
import type { WalkSettings } from "@/lib/types/walk-settings";

export type AppView = "home" | "plan" | "walk" | "walks" | "social" | "me";

export const APP_VIEWS: readonly AppView[] = ["home", "plan", "walk", "walks", "social", "me"];

export function parseView(value: string | null | undefined): AppView {
  return APP_VIEWS.includes(value as AppView) ? (value as AppView) : "home";
}

export type WalksTab = "history" | "saved" | "places";

export function parseWalksTab(value: string | null | undefined): WalksTab {
  return value === "saved" || value === "places" ? value : "history";
}

/** What the screens around the planner can ask of it. The planner publishes these; it never unmounts. */
export interface PlannerActions {
  walkAgain: (walk: SavedWalk) => void;
  resumeWalk: (snapshot: ActiveWalkSnapshot) => void;
  /** Plan a shared walk (a friend's or a public profile's). Google stops may carry only a place id. */
  planSharedWalk: (walk: { title: string; stops: SavedStop[] }) => void;
  /** Reload walk-together requests now (after answering one). */
  refreshInbox: () => void;
  /** Places the walker could meet at: the next two stops of the current plan and the nearest registered place. */
  meetingChoices: () => MeetChoice[];
  /** Add an agreed meeting place to the live walk (looks a Google place up first). */
  addMeetingToWalk: (place: MeetPlace) => void;
}

interface BridgeState {
  walkLive: boolean;
  settings: WalkSettings | null;
  signedIn: boolean;
  friendRequests: number;
  /** Walk-together requests (last 24 h), and whether the feature is available (flag on and migration C applied). */
  walkRequests: readonly WalkRequest[];
  requestsAvailable: boolean;
}

/**
 * A tiny external store between the one mounted planner and the shell (Home, Me, tab bar).
 * The planner owns all walk state; the shell only reads this and calls `actions`.
 */
export class PlannerBridge {
  private state: BridgeState = { walkLive: false, settings: null, signedIn: false, friendRequests: 0, walkRequests: [], requestsAvailable: false };
  private listeners = new Set<() => void>();
  /** Rebuilt by the planner every render and read only on a tap, so it never notifies. */
  actions: PlannerActions | null = null;
  private setSettingsFn: ((patch: Partial<WalkSettings>) => void) | null = null;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  };

  getState = () => this.state;

  publish(patch: Partial<BridgeState>, setSettings?: (patch: Partial<WalkSettings>) => void, actions?: PlannerActions) {
    if (actions) this.actions = actions;
    const next = { ...this.state, ...patch };
    const changed = (Object.keys(next) as (keyof BridgeState)[]).some((k) => next[k] !== this.state[k]);
    if (setSettings) this.setSettingsFn = setSettings;
    if (!changed) return;
    this.state = next;
    this.listeners.forEach((l) => l());
  }

  setSettings(patch: Partial<WalkSettings>) {
    this.setSettingsFn?.(patch);
  }
}

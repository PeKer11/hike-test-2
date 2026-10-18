import { HABIT_ASK_KEY } from "@/lib/walk/companion/habit-ask-log";

/** Fired on `window` after the server confirmed "forget everything". */
export const FORGOTTEN_EVENT = "traike:forgotten";

/** localStorage keys that hold anything learned about the walker (settings and voice toggle are not learning). */
export const LEARNING_STORAGE_KEYS: readonly string[] = [HABIT_ASK_KEY];

/** Clears the browser-side learned state and tells the planner to drop its in-memory copy. */
export function clearLocalLearning(): void {
  if (typeof window === "undefined") return;
  for (const key of LEARNING_STORAGE_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // blocked storage: nothing to clear
    }
  }
  window.dispatchEvent(new Event(FORGOTTEN_EVENT));
}

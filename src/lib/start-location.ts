import type { Coordinates } from "@/lib/types";

export const START_LOCATION_KEY = "traike.startLocation.v1";

export interface SavedStart {
  coordinates: Coordinates;
  label: string;
}

/** The last start the walker picked, so a coarse location fix on reload does not move it. */
export function loadSavedStart(): SavedStart | null {
  try {
    const raw = window.localStorage.getItem(START_LOCATION_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<SavedStart>;
    const lat = v.coordinates?.lat;
    const lng = v.coordinates?.lng;
    if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { coordinates: { lat, lng }, label: typeof v.label === "string" && v.label ? v.label : "My last location" };
  } catch {
    return null;
  }
}

export function saveStart(coordinates: Coordinates, label: string): void {
  try {
    window.localStorage.setItem(START_LOCATION_KEY, JSON.stringify({ coordinates, label }));
  } catch {
    // blocked storage: the start just is not remembered
  }
}

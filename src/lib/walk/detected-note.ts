import { discoveryCopy } from "@/lib/walk/discovery-copy";

const HAZARD_KEY = {
  private: "hazard.private",
  reserve: "hazard.reserve",
  flood: "hazard.flood",
  fire: "hazard.fire",
  cliff: "hazard.cliff",
  "mixed-area": "hazard.mixed",
} as const;

/** A detected (satellite-only) place can be shown, never added to the walk. */
export function mayAddToWalk(verification: string | undefined, allowed: boolean): boolean {
  return verification !== "detected" && allowed;
}

/**
 * HUD note for a detected place, both languages: the "not a registered place"
 * lead, every hazard (private is the floor) and "check signs".
 */
export function detectedNote(tags: Record<string, string>): string {
  const water = tags["detected:class"] === "water";
  const codes = (tags["detected:hazards"] ?? "")
    .split(",")
    .filter((c): c is keyof typeof HAZARD_KEY => c in HAZARD_KEY);
  const hazards = codes.length > 0 ? codes : (["private"] as const);
  const lead = water ? "detected.leadWater" : "detected.lead";
  return (["en", "he"] as const)
    .map((lang) => {
      const c = discoveryCopy[lang];
      return [c[lead], ...hazards.map((h) => c[HAZARD_KEY[h]]), c["detected.checkSigns"]].join(" ");
    })
    .join("\n");
}

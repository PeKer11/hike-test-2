/** Wildlife records near a point (iNaturalist) and the season's known nuisances. Pure helpers; the assistant tool does the I/O. */

export const HAZARD_RADIUS_KM = 5;
export const HAZARD_ATTRIBUTION = "Wildlife records from iNaturalist observers (counts reflect observer effort, not how many animals live there)";

/** Vipers, scorpions, wild boar, jackal, porcupine, ticks, sand flies. */
const HAZARD_TAXA = [30667, 48894, 42134, 851014, 44175, 51673, 465113];

export const hazardUrl = (lat: number, lng: number, month: number) =>
  `https://api.inaturalist.org/v1/observations/species_counts?lat=${lat}&lng=${lng}&radius=${HAZARD_RADIUS_KM}&month=${month}&taxon_id=${HAZARD_TAXA.join(",")}&quality_grade=research&per_page=10&locale=en`;

export interface HazardRecord {
  species: string;
  records: number;
}

export function parseHazardCounts(json: unknown): HazardRecord[] {
  const results = (json as { results?: Array<{ count?: number; taxon?: { name?: string; preferred_common_name?: string } }> })?.results;
  if (!Array.isArray(results)) return [];
  return results
    .filter((r) => typeof r.count === "number" && r.taxon?.name)
    .map((r) => ({ species: r.taxon?.preferred_common_name || r.taxon!.name!, records: r.count! }));
}

/** Sourced-from-general-knowledge seasonal notes; months are 1-12. No dataset exists for these. */
export function seasonalNotes(month: number): string[] {
  const notes: string[] = [];
  if ([3, 4, 5, 9, 10, 11].includes(month)) notes.push("Tick season (spring and autumn): check skin and clothes after walking in grass or scrub.");
  if (month >= 6 && month <= 8) notes.push("Jellyfish swarms are common on the Israeli coast from late June to August: ask before swimming.");
  if (month >= 4 && month <= 10) notes.push("Snakes and scorpions are most active in the warm months: stay on paths, do not put hands where you cannot see.");
  return notes;
}

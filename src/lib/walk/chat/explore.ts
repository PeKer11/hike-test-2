/**
 * True when the walker's own words ask to discover: surprises, what is around, ideas, recommendations. Everything
 * else is exactly what was asked, with the smallest change (no new kinds, no extra stops, no alternatives).
 */
const EXPLORE = [
  /תפתיע/u,
  /מה\s+יש\s+(?:פה|כאן|בסביבה|באזור|ליד)/u,
  /מה\s+מעניין/u,
  /רעיונות/u,
  /רעיון\s+(?:ל|מ)/u,
  /תמליץ|תמליצי|תמליצו|המלצ|להמליץ/u,
  /לגלות|תגלה|תגלי/u,
  /surprise/i,
  /\bideas?\b/i,
  /what(?:'s|\s+is|\s+are)?\s+(?:there\s+)?(?:nearby|around|interesting|close)/i,
  /\bexplor/i,
  /\brecommend/i,
];

export function isExploreRequest(text: string): boolean {
  return EXPLORE.some((re) => re.test(text.replace(/[’‘]/g, "'")));
}

import rtgTrails from "@/lib/data/rtg-trails.json";
import type { RtgTrail } from "@/lib/types";

export async function getRtgTrails(): Promise<RtgTrail[]> {
  return rtgTrails as RtgTrail[];
}

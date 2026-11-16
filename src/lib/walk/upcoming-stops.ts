/** The stops still ahead, in plan order. Stop 1 is a real stop, so it counts until it is visited. */
export function upcomingStops<T extends { id: string }>(waypoints: readonly T[], visitedIds: readonly string[]): T[] {
  return waypoints.filter((w) => !visitedIds.includes(w.id));
}

const LABELS: Record<string, string> = {
  access: "accessibility",
  accessible_stops: "accessible stops",
  avoid_dangerous: "avoiding dangerous roads",
  avoid_streets: "streets to avoid",
  end_by: "finish time",
  end_distance: "distance from the start at the end",
  loop: "returning to the start",
  max_grade: "slope",
  max_walk: "walking distance",
  meal: "meal stop",
  no_repeat: "not repeating paths",
  no_steps: "stairs",
  open_hours: "opening hours",
  start_moved: "start point",
  stay_in_area: "staying in the area",
  stop_order: "stop order",
  stop_time: "time at stops",
  surface: "surface type",
  time: "walk time",
  transit: "public transport",
  via_streets: "streets to pass through",
};

/** Plain wording for a rule id and status, for text the walker reads. */
export function describeRule(rule: string, status?: string): string {
  const label = LABELS[rule] ?? rule.replace(/_/g, " ");
  if (status === "partial") return `${label} (only partly known)`;
  if (status === "not_checked") return `${label} (no data)`;
  return label;
}

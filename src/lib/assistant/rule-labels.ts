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

const LABELS_HE: Record<string, string> = {
  access: "נגישות",
  accessible_stops: "תחנות נגישות",
  avoid_dangerous: "הימנעות מכבישים מסוכנים",
  avoid_streets: "רחובות להימנע מהם",
  end_by: "שעת סיום",
  end_distance: "מרחק מנקודת ההתחלה בסוף",
  loop: "חזרה לנקודת ההתחלה",
  max_grade: "שיפוע",
  max_walk: "מרחק הליכה",
  meal: "עצירה לאוכל",
  no_repeat: "בלי לחזור על אותם שבילים",
  no_steps: "מדרגות",
  open_hours: "שעות פתיחה",
  start_moved: "נקודת התחלה",
  stay_in_area: "הישארות באזור",
  stop_order: "סדר העצירות",
  stop_time: "זמן בעצירות",
  surface: "סוג המשטח",
  time: "זמן ההליכה",
  transit: "תחבורה ציבורית",
  via_streets: "רחובות לעבור בהם",
};

/** Plain wording for a rule id and status, for text the walker reads. */
export function describeRule(rule: string, status?: string, hebrew = false): string {
  const label = (hebrew ? LABELS_HE[rule] : LABELS[rule]) ?? LABELS[rule] ?? rule.replace(/_/g, " ");
  if (status === "partial") return hebrew ? `${label} (ידוע רק חלקית)` : `${label} (only partly known)`;
  if (status === "not_checked") return hebrew ? `${label} (אין נתונים)` : `${label} (no data)`;
  return label;
}

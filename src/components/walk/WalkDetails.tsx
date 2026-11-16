import type { ReactNode } from "react";

/**
 * The walk's Details are the planner's side panel, re-ordered while walking into the plan's sections
 * (the walk, conditions, places around, display, about the map). The existing blocks keep their place
 * in the tree, so nothing remounts when the walk starts; while walking the column becomes a flex
 * column and each block gets its section order. Off walking, a slot is `display: contents`: no change.
 */
export const DETAILS_ORDER = {
  walk: 10,
  conditions: 30,
  places: 40,
  display: 50,
  settings: 70,
  about: 80,
} as const;

/** A block of the panel with its position inside the walking order. */
export function WalkSlot({ walking, order, children }: { walking: boolean; order: number; children: ReactNode }) {
  return (
    <div className={walking ? "min-w-0" : "contents"} style={walking ? { order } : undefined}>
      {children}
    </div>
  );
}

/** A section heading; only drawn while walking. */
export function WalkSectionTitle({ walking, order, id, children }: { walking: boolean; order: number; id?: string; children: ReactNode }) {
  if (!walking) return null;
  return (
    <h3 id={id} style={{ order }} className="mt-2 font-display text-[20px] leading-[26px] text-tk-ink">
      {children}
    </h3>
  );
}

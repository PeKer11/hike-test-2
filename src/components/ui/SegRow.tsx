"use client";

import { SEG_WRAP, segCell } from "@/components/ui/panel-style";

export interface SegRowItem<T extends string> {
  id: T;
  label: string;
}

/** A connected row of cells for one exclusive choice (time presets, day / night). */
export function SegRow<T extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: readonly SegRowItem<T>[];
  /** The chosen id; null when nothing in the row is chosen. */
  value: T | null;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={SEG_WRAP}>
      {items.map((item) => (
        <button key={item.id} type="button" role="radio" aria-checked={value === item.id} onClick={() => onChange(item.id)} className={segCell(value === item.id)}>
          {item.label}
        </button>
      ))}
    </div>
  );
}

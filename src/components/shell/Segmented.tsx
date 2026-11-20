"use client";

import { SEG_WRAP, segCell } from "@/components/ui/panel-style";

export interface SegmentedItem<T extends string> {
  id: T;
  label: string;
}

/** A connected tab row: forest edge, hairline dividers, the selected tab filled forest. */
export function Segmented<T extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: readonly SegmentedItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={SEG_WRAP}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={value === item.id}
          onClick={() => onChange(item.id)}
          className={segCell(value === item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

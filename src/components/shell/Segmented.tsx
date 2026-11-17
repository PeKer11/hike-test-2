"use client";

export interface SegmentedItem<T extends string> {
  id: T;
  label: string;
}

/** A 48px tab row: the selected tab is a tinted pill with a soft shadow (never a bare border). */
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
    <div role="tablist" aria-label={label} className="flex gap-1 rounded-full bg-charcoal/5 p-1">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={value === item.id}
          onClick={() => onChange(item.id)}
          className={`min-h-12 flex-1 rounded-full px-4 text-[16px] font-medium transition-colors motion-reduce:transition-none ${
            value === item.id ? "bg-paper text-forest shadow-tk-soft" : "text-charcoal/70"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}

export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
      <span className="text-charcoal/80">{label}</span>
      <button
        type="button"
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked ? "bg-terra" : "bg-charcoal/20"
        }`}
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
        aria-label={label}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
            checked ? "left-5" : "left-0.5"
          }`}
        />
      </button>
    </label>
  );
}

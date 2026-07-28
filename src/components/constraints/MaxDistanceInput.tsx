"use client";

import { Slider } from "@/components/ui";

interface MaxDistanceInputProps {
  value: number;
  onChange: (value: number) => void;
}

export function MaxDistanceInput({ value, onChange }: MaxDistanceInputProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-charcoal/70">Max distance</span>
        <span className="font-semibold text-forest">{value} km</span>
      </div>
      <Slider min={1} max={60} step={1} value={value} onChange={onChange} />
    </div>
  );
}

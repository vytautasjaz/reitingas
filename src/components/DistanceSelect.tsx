"use client";

import type { DistanceSetting } from "@/lib/settings";
import { distanceOptions } from "@/lib/distances";

export function DistanceSelect({
  id,
  value,
  onChange,
  distances,
  className = "select",
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  distances: DistanceSetting[];
  className?: string;
}) {
  const options = distanceOptions(distances);
  const known = options.some((o) => o.value === value);
  return (
    <select
      id={id}
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {!known && value ? (
        <option value={value}>{value}</option>
      ) : null}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Shared race-distance helpers — safe for client when given explicit defs. */

import type { DistanceSetting } from "./settings";

/** Distance id stored on races.distance_type (sprint, olympic, custom, …). */
export type DistanceType = string;

/** Fallback defaults (settings override these at runtime on the server). */
export const BASE_POINTS: Record<string, number> = {
  sprint: 900,
  olympic: 1000,
  half: 1100,
  full: 1100,
};

export const DISTANCE_TYPES: DistanceType[] = [
  "sprint",
  "olympic",
  "half",
  "full",
];

export function shortDistance(
  race: { name: string; distance_type: DistanceType },
  distances?: DistanceSetting[]
): string {
  const fromSettings = distances?.find((d) => d.id === race.distance_type);
  if (fromSettings) return fromSettings.shortLabel;
  if (/OD|olimp/i.test(race.name) || race.distance_type === "olympic") return "OD";
  if (/SD|sprint/i.test(race.name) || race.distance_type === "sprint") return "SD";
  if (race.distance_type === "half" || /\bHalf\b/i.test(race.name)) return "Half";
  if (race.distance_type === "full" || /\bFull\b/i.test(race.name)) return "Full";
  return race.distance_type.slice(0, 8) || race.name.slice(0, 3);
}

export function distanceLabel(
  distanceType: DistanceType,
  distances?: DistanceSetting[]
): string {
  const fromSettings = distances?.find((d) => d.id === distanceType);
  if (fromSettings) return fromSettings.label;
  if (distanceType === "olympic") return "Olimpinė (OD)";
  if (distanceType === "sprint") return "Sprint (SD)";
  if (distanceType === "half") return "Half";
  if (distanceType === "full") return "Full";
  return distanceType;
}

export function distanceSuffix(
  distanceType: DistanceType,
  distances?: DistanceSetting[]
): string {
  return shortDistance({ name: "", distance_type: distanceType }, distances);
}

export function distanceOptions(
  distances: DistanceSetting[]
): Array<{ value: string; label: string }> {
  return [...distances]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((d) => ({
      value: d.id,
      label: `${d.label} — ${d.basePoints}`,
    }));
}

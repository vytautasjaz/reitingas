/** Shared race-distance constants — safe for client and server. */

export type DistanceType = "sprint" | "olympic" | "half" | "full";

export const BASE_POINTS: Record<DistanceType, number> = {
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

export function shortDistance(race: {
  name: string;
  distance_type: DistanceType;
}): string {
  if (/OD|olimp/i.test(race.name) || race.distance_type === "olympic") return "OD";
  if (/SD|sprint/i.test(race.name) || race.distance_type === "sprint") return "SD";
  if (race.distance_type === "half" || /\bHalf\b/i.test(race.name)) return "Half";
  if (race.distance_type === "full" || /\bFull\b/i.test(race.name)) return "Full";
  return race.name.slice(0, 3);
}

export function distanceLabel(distanceType: DistanceType): string {
  if (distanceType === "olympic") return "Olimpinė (OD)";
  if (distanceType === "sprint") return "Sprint (SD)";
  if (distanceType === "half") return "Half";
  if (distanceType === "full") return "Full";
  return distanceType;
}

export function distanceSuffix(distanceType: DistanceType): string {
  if (distanceType === "olympic") return "OD";
  if (distanceType === "sprint") return "SD";
  if (distanceType === "half") return "Half";
  if (distanceType === "full") return "Full";
  return distanceType;
}

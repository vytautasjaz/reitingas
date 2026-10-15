import { DistanceType, BASE_POINTS } from "./distances";

export {
  parseTimeToSeconds,
  formatSeconds,
  classifyFinishStatus,
  type FinishStatus,
} from "./time-format";

/**
 * Points relative to race leader:
 * ROUND(leader_time / athlete_time * base)
 */
export function calculatePoints(
  leaderSeconds: number,
  athleteSeconds: number,
  base: number
): number {
  if (leaderSeconds <= 0 || athleteSeconds <= 0 || base <= 0) return 0;
  return Math.round((leaderSeconds / athleteSeconds) * base);
}

export function basePointsForDistance(distance: DistanceType): number {
  return BASE_POINTS[distance];
}

/** Sum of the N best positive scores (default 3). */
export function bestNSum(scores: number[], n = 3): number {
  const positive = scores.filter((s) => s > 0).sort((a, b) => b - a);
  return positive.slice(0, n).reduce((sum, s) => sum + s, 0);
}

export function averagePoints(scores: number[]): number | null {
  const positive = scores.filter((s) => s > 0);
  if (positive.length === 0) return null;
  return positive.reduce((a, b) => a + b, 0) / positive.length;
}

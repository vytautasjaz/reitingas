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

export type ScoredResult = {
  points: number;
  /** Foreign start — at most one such result may enter the best-N sum. */
  foreign?: boolean;
};

/**
 * Best-N sum with at most one foreign-start score.
 * Chooses the better of: top N domestic, or best foreign + top (N-1) domestic.
 */
export function bestNSumWithForeignLimit(
  scores: ScoredResult[],
  n = 3
): number {
  if (n <= 0) return 0;
  const positive = scores.filter((s) => s.points > 0);
  const domestic = positive
    .filter((s) => !s.foreign)
    .map((s) => s.points)
    .sort((a, b) => b - a);
  const foreign = positive
    .filter((s) => s.foreign)
    .map((s) => s.points)
    .sort((a, b) => b - a);

  const sumTop = (arr: number[], count: number) =>
    arr.slice(0, count).reduce((sum, s) => sum + s, 0);

  const withoutForeign = sumTop(domestic, n);
  if (foreign.length === 0 || n === 0) return withoutForeign;

  const withForeign = foreign[0] + sumTop(domestic, n - 1);
  return Math.max(withoutForeign, withForeign);
}

export function averagePoints(scores: number[]): number | null {
  const positive = scores.filter((s) => s > 0);
  if (positive.length === 0) return null;
  return positive.reduce((a, b) => a + b, 0) / positive.length;
}

import { DistanceType, BASE_POINTS } from "./distances";

export {
  parseTimeToSeconds,
  formatSeconds,
  classifyFinishStatus,
  type FinishStatus,
} from "./time-format";

export type CalculatePointsOptions = {
  /** Power on (leader/athlete). Default 1. */
  exponent?: number;
  /** Extra percent for foreign starts (10 → ×1.10). */
  foreignBonusPercent?: number;
};

/**
 * Points relative to race leader:
 * ROUND( (leader_time / athlete_time) ^ exponent * base * foreignMult )
 */
export function calculatePoints(
  leaderSeconds: number,
  athleteSeconds: number,
  base: number,
  opts?: CalculatePointsOptions
): number {
  if (leaderSeconds <= 0 || athleteSeconds <= 0 || base <= 0) return 0;
  const exponent = opts?.exponent ?? 1;
  const ratio = Math.pow(leaderSeconds / athleteSeconds, exponent);
  let points = ratio * base;
  const bonus = opts?.foreignBonusPercent ?? 0;
  if (bonus > 0) points *= 1 + bonus / 100;
  return Math.round(points);
}

/** Fallback only — prefer settings.basePointsForDistanceId on the server. */
export function basePointsForDistance(distance: DistanceType): number {
  return BASE_POINTS[distance] ?? 1000;
}

/** Sum of the N best positive scores (default 3). */
export function bestNSum(scores: number[], n = 3): number {
  const positive = scores.filter((s) => s > 0).sort((a, b) => b - a);
  return positive.slice(0, n).reduce((sum, s) => sum + s, 0);
}

export type ScoredResult = {
  points: number;
  /** Foreign start — limited count may enter the best-N sum. */
  foreign?: boolean;
};

/**
 * Best-N sum with at most `maxForeign` foreign-start scores (default 1).
 * Picks the combination that maximizes the sum.
 */
export function bestNSumWithForeignLimit(
  scores: ScoredResult[],
  n = 3,
  maxForeign = 1
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
    arr.slice(0, Math.max(0, count)).reduce((sum, s) => sum + s, 0);

  const foreignSlots = Math.max(0, Math.min(maxForeign, n, foreign.length));
  let best = sumTop(domestic, n);
  for (let f = 1; f <= foreignSlots; f++) {
    const candidate = sumTop(foreign, f) + sumTop(domestic, n - f);
    if (candidate > best) best = candidate;
  }
  return best;
}

export function averagePoints(scores: number[]): number | null {
  const positive = scores.filter((s) => s > 0);
  if (positive.length === 0) return null;
  return positive.reduce((a, b) => a + b, 0) / positive.length;
}

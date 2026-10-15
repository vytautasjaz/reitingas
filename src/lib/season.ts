import { cookies } from "next/headers";
import { getDb } from "./db";

export const SEASON_COOKIE = "tritonas-season";

/** Years that appear in meets/races, plus the current calendar year. */
export function listSeasonYears(): number[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT DISTINCT CAST(substr(meet_date, 1, 4) AS INTEGER) AS y
       FROM race_meets
       WHERE length(meet_date) >= 4
       UNION
       SELECT DISTINCT CAST(substr(race_date, 1, 4) AS INTEGER) AS y
       FROM races
       WHERE length(race_date) >= 4
       ORDER BY y DESC`
    )
    .all() as Array<{ y: number }>;

  const years = new Set<number>();
  const now = new Date().getFullYear();
  years.add(now);
  for (const row of rows) {
    if (Number.isFinite(row.y) && row.y >= 2000 && row.y <= 2100) {
      years.add(row.y);
    }
  }

  return [...years].sort((a, b) => b - a);
}

export function getDefaultSeasonYear(): number {
  const years = listSeasonYears();
  return years[0] ?? new Date().getFullYear();
}

export function parseSeasonYear(raw: unknown): number | null {
  const n = typeof raw === "string" || typeof raw === "number" ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n < 2000 || n > 2100) return null;
  return Math.trunc(n);
}

/** Active season from cookie, falling back to latest known year. */
export async function getActiveSeasonYear(): Promise<number> {
  const store = await cookies();
  const fromCookie = parseSeasonYear(store.get(SEASON_COOKIE)?.value);
  if (fromCookie != null) return fromCookie;
  return getDefaultSeasonYear();
}

export function yearDatePrefix(year: number): string {
  return `${year}-`;
}

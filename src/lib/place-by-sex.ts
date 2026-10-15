import fs from "fs";
import path from "path";
import { getDb } from "./db";
import { detectCategoryConvention, normalizeSex, Sex } from "./gender";
import { normalizeName } from "./names";
import { parseResultsFileBuffer, ParsedResultRow } from "./parse-results";

function athleteSeconds(row: {
  timeSeconds?: number | null;
  gunTimeSeconds?: number | null;
  time_seconds?: number | null;
  gun_time_seconds?: number | null;
}): number | null {
  return (
    row.timeSeconds ??
    row.gunTimeSeconds ??
    row.time_seconds ??
    row.gun_time_seconds ??
    null
  );
}

export type FieldSizes = {
  total: number;
  m: number;
  f: number;
};

export function computeFieldSizes(rows: ParsedResultRow[]): FieldSizes {
  const convention = detectCategoryConvention(rows.map((r) => r.category));
  let m = 0;
  let f = 0;
  for (const row of rows) {
    const sex = normalizeSex(row.sex, row.category, convention);
    if (sex === "M") m += 1;
    else if (sex === "F") f += 1;
  }
  return { total: rows.length, m, f };
}

/**
 * Place among all same-sex finishers in a full protocol (not only Tritonas).
 * Keyed by normalized athlete name.
 */
export function computePlaceBySexMap(
  rows: ParsedResultRow[]
): Map<string, number> {
  const convention = detectCategoryConvention(rows.map((r) => r.category));
  const withSex = rows
    .map((row) => ({
      row,
      sex: normalizeSex(row.sex, row.category, convention),
      key: normalizeName(row.name),
      secs: athleteSeconds(row),
    }))
    .filter(
      (x): x is typeof x & { sex: Sex; key: string } =>
        (x.sex === "M" || x.sex === "F") && !!x.key
    );

  const bySex = new Map<Sex, typeof withSex>();
  for (const item of withSex) {
    const list = bySex.get(item.sex) ?? [];
    list.push(item);
    bySex.set(item.sex, list);
  }

  const places = new Map<string, number>();
  for (const list of bySex.values()) {
    list.sort((a, b) => {
      if (a.secs != null && b.secs != null && a.secs !== b.secs) {
        return a.secs - b.secs;
      }
      if (a.secs != null && b.secs == null) return -1;
      if (a.secs == null && b.secs != null) return 1;
      const pa = a.row.place;
      const pb = b.row.place;
      if (pa != null && pb != null && pa !== pb) return pa - pb;
      return a.key.localeCompare(b.key, "lt");
    });
    list.forEach((item, i) => {
      places.set(item.key, i + 1);
    });
  }
  return places;
}

function resolveSourceFile(sourceFilename: string | null): string | null {
  if (!sourceFilename) return null;
  const resultsDir = path.join(process.cwd(), "Results");
  const direct = path.join(resultsDir, sourceFilename);
  if (fs.existsSync(direct)) return direct;

  if (!fs.existsSync(resultsDir)) return null;
  const wanted = sourceFilename.replace(/\s+/g, " ").trim().toLowerCase();
  const match = fs.readdirSync(resultsDir).find((f) => {
    const n = f.replace(/\s+/g, " ").trim().toLowerCase();
    return n === wanted || n.includes(wanted) || wanted.includes(n);
  });
  return match ? path.join(resultsDir, match) : null;
}

/** Fill place_by_sex + field sizes from original protocol files in Results/. */
export function backfillPlaceBySexFromSources(): number {
  const db = getDb();
  const races = db
    .prepare(
      `SELECT id, source_filename FROM races
       WHERE source_filename IS NOT NULL AND source_filename != ''`
    )
    .all() as Array<{ id: number; source_filename: string }>;

  const updateResult = db.prepare(
    `UPDATE race_results SET place_by_sex = ?
     WHERE race_id = ? AND lower(raw_name) = lower(?)`
  );
  const updateByMember = db.prepare(
    `UPDATE race_results
     SET place_by_sex = ?
     WHERE race_id = ?
       AND member_id IN (
         SELECT id FROM members WHERE normalized_name = ?
       )`
  );
  const updateRace = db.prepare(
    `UPDATE races
     SET field_size = ?, field_size_m = ?, field_size_f = ?
     WHERE id = ?`
  );

  let updated = 0;
  for (const race of races) {
    const filePath = resolveSourceFile(race.source_filename);
    if (!filePath) continue;
    try {
      const parsed = parseResultsFileBuffer(fs.readFileSync(filePath));
      const places = computePlaceBySexMap(parsed.rows);
      const sizes = computeFieldSizes(parsed.rows);
      updateRace.run(sizes.total, sizes.m, sizes.f, race.id);

      for (const row of parsed.rows) {
        const key = normalizeName(row.name);
        const place = places.get(key);
        if (place == null) continue;
        const a = updateResult.run(place, race.id, row.name);
        updated += a.changes;
        if (a.changes === 0 && key) {
          const b = updateByMember.run(place, race.id, key);
          updated += b.changes;
        }
      }
    } catch {
      // Skip unreadable / mismatched files
    }
  }
  return updated;
}

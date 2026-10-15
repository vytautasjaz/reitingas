import { getDb } from "./db";
import { calculatePoints } from "./scoring";

export type DistanceSetting = {
  id: string;
  label: string;
  shortLabel: string;
  basePoints: number;
  sortOrder: number;
  /** Built-in distances can be edited but not removed while races use them. */
  builtin: boolean;
};

export type AppSettings = {
  /** How many best results count toward the overall sum. */
  bestN: number;
  /** Extra % on points for foreign starts (e.g. 10 = +10%). */
  foreignBonusPercent: number;
  /** Max foreign starts allowed inside the best-N sum. */
  maxForeignInBestN: number;
  /**
   * Points = round( (leader_time / athlete_time) ^ exponent * base * foreignMult )
   */
  formulaExponent: number;
  distances: DistanceSetting[];
};

export const DEFAULT_DISTANCES: DistanceSetting[] = [
  {
    id: "sprint",
    label: "Sprint (SD)",
    shortLabel: "SD",
    basePoints: 900,
    sortOrder: 1,
    builtin: true,
  },
  {
    id: "olympic",
    label: "Olimpinė (OD)",
    shortLabel: "OD",
    basePoints: 1000,
    sortOrder: 2,
    builtin: true,
  },
  {
    id: "half",
    label: "Half",
    shortLabel: "Half",
    basePoints: 1100,
    sortOrder: 3,
    builtin: true,
  },
  {
    id: "full",
    label: "Full",
    shortLabel: "Full",
    basePoints: 1100,
    sortOrder: 4,
    builtin: true,
  },
];

export const DEFAULT_SETTINGS: AppSettings = {
  bestN: 3,
  foreignBonusPercent: 10,
  maxForeignInBestN: 1,
  formulaExponent: 1,
  distances: DEFAULT_DISTANCES,
};

const SETTINGS_KEY = "app";

function slugifyDistanceId(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
}

export function ensureSettingsTable(): void {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function mergeWithDefaults(raw: Partial<AppSettings> | null): AppSettings {
  const distancesIn =
    Array.isArray(raw?.distances) && raw!.distances!.length > 0
      ? raw!.distances!
      : DEFAULT_DISTANCES;

  const byId = new Map<string, DistanceSetting>();
  for (const d of DEFAULT_DISTANCES) byId.set(d.id, { ...d });
  for (const d of distancesIn) {
    if (!d?.id) continue;
    const id = slugifyDistanceId(String(d.id)) || "custom";
    const prev = byId.get(id);
    byId.set(id, {
      id,
      label: String(d.label ?? prev?.label ?? id).trim() || id,
      shortLabel: String(d.shortLabel ?? prev?.shortLabel ?? id).trim() || id,
      basePoints: Math.max(1, Math.round(Number(d.basePoints) || prev?.basePoints || 1000)),
      sortOrder: Number.isFinite(Number(d.sortOrder))
        ? Number(d.sortOrder)
        : (prev?.sortOrder ?? 99),
      builtin: prev?.builtin ?? !!d.builtin,
    });
  }

  const distances = [...byId.values()].sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    bestN: Math.max(1, Math.min(20, Math.round(Number(raw?.bestN) || DEFAULT_SETTINGS.bestN))),
    foreignBonusPercent: Math.max(
      0,
      Math.min(100, Number(raw?.foreignBonusPercent ?? DEFAULT_SETTINGS.foreignBonusPercent))
    ),
    maxForeignInBestN: Math.max(
      0,
      Math.min(
        10,
        Math.round(
          Number(raw?.maxForeignInBestN ?? DEFAULT_SETTINGS.maxForeignInBestN)
        )
      )
    ),
    formulaExponent: Math.max(
      0.1,
      Math.min(5, Number(raw?.formulaExponent) || DEFAULT_SETTINGS.formulaExponent)
    ),
    distances,
  };
}

export function getSettings(): AppSettings {
  ensureSettingsTable();
  const db = getDb();
  const row = db
    .prepare("SELECT value FROM app_settings WHERE key = ?")
    .get(SETTINGS_KEY) as { value: string } | undefined;
  if (!row?.value) {
    const defaults = structuredClone(DEFAULT_SETTINGS);
    db.prepare(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES (?, ?, datetime('now'))`
    ).run(SETTINGS_KEY, JSON.stringify(defaults));
    // Apply foreign bonus / bases to existing results on first boot.
    try {
      recalculateAllPoints(defaults);
    } catch {
      /* DB may be mid-migrate */
    }
    return defaults;
  }
  try {
    return mergeWithDefaults(JSON.parse(row.value) as Partial<AppSettings>);
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export function saveSettings(input: Partial<AppSettings>): AppSettings {
  const next = mergeWithDefaults({ ...getSettings(), ...input });
  ensureSettingsTable();
  getDb()
    .prepare(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = excluded.updated_at`
    )
    .run(SETTINGS_KEY, JSON.stringify(next));
  return next;
}

export function basePointsMap(settings?: AppSettings): Record<string, number> {
  const s = settings ?? getSettings();
  const map: Record<string, number> = {};
  for (const d of s.distances) map[d.id] = d.basePoints;
  return map;
}

export function basePointsForDistanceId(
  distanceId: string,
  settings?: AppSettings
): number {
  const s = settings ?? getSettings();
  const found = s.distances.find((d) => d.id === distanceId);
  return found?.basePoints ?? 1000;
}

export function distanceSetting(
  distanceId: string,
  settings?: AppSettings
): DistanceSetting | undefined {
  const s = settings ?? getSettings();
  return s.distances.find((d) => d.id === distanceId);
}

export function addCustomDistance(input: {
  label: string;
  shortLabel?: string;
  basePoints: number;
}): AppSettings {
  const settings = getSettings();
  const id = slugifyDistanceId(input.label);
  if (!id) throw new Error("Įveskite distancijos pavadinimą");
  if (settings.distances.some((d) => d.id === id)) {
    throw new Error(`Distancija „${id}“ jau egzistuoja`);
  }
  const maxOrder = Math.max(0, ...settings.distances.map((d) => d.sortOrder));
  settings.distances.push({
    id,
    label: input.label.trim(),
    shortLabel: (input.shortLabel ?? input.label).trim().slice(0, 12) || id,
    basePoints: Math.max(1, Math.round(input.basePoints)),
    sortOrder: maxOrder + 1,
    builtin: false,
  });
  return saveSettings(settings);
}

export function removeDistance(distanceId: string): AppSettings {
  const settings = getSettings();
  const dist = settings.distances.find((d) => d.id === distanceId);
  if (!dist) throw new Error("Distancija nerasta");
  if (dist.builtin) throw new Error("Standartinės distancijos negalima ištrinti");

  const used = getDb()
    .prepare("SELECT COUNT(*) AS c FROM races WHERE distance_type = ?")
    .get(distanceId) as { c: number };
  if (used.c > 0) {
    throw new Error(
      `Distancija naudojama ${used.c} varžybose — pirma pakeiskite jas`
    );
  }

  settings.distances = settings.distances.filter((d) => d.id !== distanceId);
  return saveSettings(settings);
}

export type RecalculateResult = {
  racesUpdated: number;
  resultsUpdated: number;
};

/** Recompute base_points and every included result from current settings. */
export function recalculateAllPoints(settings?: AppSettings): RecalculateResult {
  const s = settings ?? getSettings();
  const db = getDb();
  const races = db
    .prepare(
      `SELECT r.id, r.distance_type, r.leader_time_seconds, r.base_points,
              COALESCE(m.foreign_start, 0) AS foreign_start
       FROM races r
       LEFT JOIN race_meets m ON m.id = r.meet_id`
    )
    .all() as Array<{
    id: number;
    distance_type: string;
    leader_time_seconds: number | null;
    base_points: number;
    foreign_start: number;
  }>;

  const updateRace = db.prepare(
    "UPDATE races SET base_points = ? WHERE id = ?"
  );
  const resultsStmt = db.prepare(
    `SELECT id, time_seconds, gun_time_seconds, finish_status, included_in_rating
     FROM race_results WHERE race_id = ?`
  );
  const updateResult = db.prepare(
    "UPDATE race_results SET points = ? WHERE id = ?"
  );

  let racesUpdated = 0;
  let resultsUpdated = 0;

  db.transaction(() => {
    for (const race of races) {
      const base = basePointsForDistanceId(race.distance_type, s);
      if (base !== race.base_points) {
        updateRace.run(base, race.id);
        racesUpdated += 1;
      } else {
        updateRace.run(base, race.id);
        racesUpdated += 1;
      }

      const leader = race.leader_time_seconds;
      const foreignBonus = race.foreign_start ? s.foreignBonusPercent : 0;
      const rows = resultsStmt.all(race.id) as Array<{
        id: number;
        time_seconds: number | null;
        gun_time_seconds: number | null;
        finish_status: string | null;
        included_in_rating: number;
      }>;

      for (const row of rows) {
        if (!row.included_in_rating || row.finish_status === "dns") {
          updateResult.run(null, row.id);
          resultsUpdated += 1;
          continue;
        }
        const secs = row.time_seconds ?? row.gun_time_seconds;
        if (secs == null || leader == null || leader <= 0) {
          updateResult.run(row.finish_status === "dnf" ? 0 : null, row.id);
          resultsUpdated += 1;
          continue;
        }
        const points = calculatePoints(leader, secs, base, {
          exponent: s.formulaExponent,
          foreignBonusPercent: foreignBonus,
        });
        updateResult.run(points, row.id);
        resultsUpdated += 1;
      }
    }
  })();

  return { racesUpdated, resultsUpdated };
}

export function formulaDescription(settings?: AppSettings): string {
  const s = settings ?? getSettings();
  const exp =
    s.formulaExponent === 1
      ? "lyderio_laikas / dalyvio_laikas"
      : `(lyderio_laikas / dalyvio_laikas)^${s.formulaExponent}`;
  const foreign =
    s.foreignBonusPercent > 0
      ? ` · užsienio startas × ${(1 + s.foreignBonusPercent / 100).toFixed(2)}`
      : "";
  return `taškai = ROUND( ${exp} × bazė${foreign} )`;
}

/** Score one finish using current settings (+ optional foreign bonus). */
export function scoreAthlete(
  leaderSeconds: number,
  athleteSeconds: number,
  distanceType: string,
  foreign = false,
  settings?: AppSettings
): number {
  const s = settings ?? getSettings();
  return calculatePoints(
    leaderSeconds,
    athleteSeconds,
    basePointsForDistanceId(distanceType, s),
    {
      exponent: s.formulaExponent,
      foreignBonusPercent: foreign ? s.foreignBonusPercent : 0,
    }
  );
}

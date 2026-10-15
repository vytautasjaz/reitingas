import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DATA_DIR =
  process.env.DATA_DIR?.trim() || path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "tritonas.db");

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  dbInstance = db;
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      display_name TEXT NOT NULL,
      normalized_name TEXT NOT NULL UNIQUE,
      sex TEXT CHECK (sex IN ('M', 'F') OR sex IS NULL),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS races (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      race_date TEXT NOT NULL,
      distance_type TEXT NOT NULL,
      base_points INTEGER NOT NULL,
      source_filename TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS race_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      race_id INTEGER NOT NULL REFERENCES races(id) ON DELETE CASCADE,
      place INTEGER,
      place_by_sex INTEGER,
      bib TEXT,
      raw_name TEXT NOT NULL,
      member_id INTEGER REFERENCES members(id),
      club TEXT,
      sex TEXT CHECK (sex IN ('M', 'F') OR sex IS NULL),
      time_seconds REAL,
      gun_time_seconds REAL,
      points INTEGER,
      included_in_rating INTEGER NOT NULL DEFAULT 0,
      finish_status TEXT CHECK (finish_status IN ('ok', 'dnf', 'dns') OR finish_status IS NULL),
      UNIQUE(race_id, raw_name, bib)
    );

    CREATE INDEX IF NOT EXISTS idx_race_results_race ON race_results(race_id);
    CREATE INDEX IF NOT EXISTS idx_race_results_member ON race_results(member_id);
    CREATE INDEX IF NOT EXISTS idx_members_normalized ON members(normalized_name);
  `);

  // Additive migrations for existing DBs created before sex columns.
  const memberCols = db.prepare("PRAGMA table_info(members)").all() as Array<{ name: string }>;
  if (!memberCols.some((c) => c.name === "sex")) {
    db.exec("ALTER TABLE members ADD COLUMN sex TEXT");
  }
  if (!memberCols.some((c) => c.name === "sex_manual")) {
    db.exec("ALTER TABLE members ADD COLUMN sex_manual INTEGER NOT NULL DEFAULT 0");
  }
  const resultCols = db.prepare("PRAGMA table_info(race_results)").all() as Array<{
    name: string;
  }>;
  if (!resultCols.some((c) => c.name === "sex")) {
    db.exec("ALTER TABLE race_results ADD COLUMN sex TEXT");
  }
  if (!resultCols.some((c) => c.name === "place_by_sex")) {
    db.exec("ALTER TABLE race_results ADD COLUMN place_by_sex INTEGER");
  }
  if (!resultCols.some((c) => c.name === "finish_status")) {
    db.exec("ALTER TABLE race_results ADD COLUMN finish_status TEXT");
  }

  // DNF (started, no finish): 0 points, keep in rating. DNS stays excluded.
  db.exec(`
    UPDATE race_results
    SET points = 0,
        finish_status = COALESCE(finish_status, 'dnf')
    WHERE included_in_rating = 1
      AND member_id IS NOT NULL
      AND points IS NULL
      AND time_seconds IS NULL
      AND gun_time_seconds IS NULL
      AND (finish_status IS NULL OR finish_status = 'dnf')
  `);
  db.exec(`
    UPDATE race_results
    SET finish_status = 'ok'
    WHERE finish_status IS NULL
      AND COALESCE(time_seconds, gun_time_seconds) IS NOT NULL
  `);

  const raceCols = db.prepare("PRAGMA table_info(races)").all() as Array<{ name: string }>;
  if (!raceCols.some((c) => c.name === "leader_time_seconds")) {
    db.exec("ALTER TABLE races ADD COLUMN leader_time_seconds REAL");
  }
  if (!raceCols.some((c) => c.name === "field_size")) {
    db.exec("ALTER TABLE races ADD COLUMN field_size INTEGER");
  }
  if (!raceCols.some((c) => c.name === "field_size_m")) {
    db.exec("ALTER TABLE races ADD COLUMN field_size_m INTEGER");
  }
  if (!raceCols.some((c) => c.name === "field_size_f")) {
    db.exec("ALTER TABLE races ADD COLUMN field_size_f INTEGER");
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS race_meets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      meet_date TEXT NOT NULL,
      foreign_start INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const meetCols = db.prepare("PRAGMA table_info(race_meets)").all() as Array<{
    name: string;
  }>;
  if (!meetCols.some((c) => c.name === "foreign_start")) {
    db.exec(
      "ALTER TABLE race_meets ADD COLUMN foreign_start INTEGER NOT NULL DEFAULT 0"
    );
  }

  if (!raceCols.some((c) => c.name === "meet_id")) {
    db.exec(
      "ALTER TABLE races ADD COLUMN meet_id INTEGER REFERENCES race_meets(id) ON DELETE CASCADE"
    );
  }

  migrateRacesDistanceAllowFull(db);
  migrateRacesAllowCustomDistances(db);
  backfillRaceMeets(db);
  clearClubRosterFauxPlaces(db);

  // Settings table (lazy defaults on first read).
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

/**
 * Compact Tritonas-only imports used to store place 1..N and field_size = N.
 * That looks like "4/17" but is only club order — strip it so UI shows "—".
 * Full protocols keep field_size (hundreds) while only Tritonas rows are stored.
 */
function clearClubRosterFauxPlaces(db: Database.Database) {
  const races = db
    .prepare(
      `SELECT r.id, r.field_size,
              (SELECT COUNT(*) FROM race_results rr WHERE rr.race_id = r.id) AS result_count
       FROM races r
       WHERE r.field_size IS NOT NULL`
    )
    .all() as Array<{ id: number; field_size: number; result_count: number }>;

  const clearRace = db.prepare(
    `UPDATE races
     SET field_size = NULL, field_size_m = NULL, field_size_f = NULL
     WHERE id = ?`
  );
  const clearPlaces = db.prepare(
    `UPDATE race_results
     SET place = NULL, place_by_sex = NULL
     WHERE race_id = ?`
  );

  db.transaction(() => {
    for (const race of races) {
      if (
        race.result_count > 0 &&
        race.field_size === race.result_count
      ) {
        clearRace.run(race.id);
        clearPlaces.run(race.id);
      }
    }
  })();
}

/** SQLite cannot ALTER CHECK — rebuild races table to allow distance_type = 'full'. */
function migrateRacesDistanceAllowFull(db: Database.Database) {
  const row = db
    .prepare(
      `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'races'`
    )
    .get() as { sql: string } | undefined;
  if (!row?.sql || row.sql.includes("'full'")) return;

  db.exec(`
    PRAGMA foreign_keys = OFF;
    BEGIN;
    CREATE TABLE races_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      race_date TEXT NOT NULL,
      distance_type TEXT NOT NULL CHECK (distance_type IN ('sprint', 'olympic', 'half', 'full')),
      base_points INTEGER NOT NULL,
      source_filename TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      leader_time_seconds REAL,
      meet_id INTEGER REFERENCES race_meets(id) ON DELETE CASCADE
    );
    INSERT INTO races_new (
      id, name, race_date, distance_type, base_points, source_filename,
      created_at, leader_time_seconds, meet_id
    )
    SELECT
      id, name, race_date, distance_type, base_points, source_filename,
      created_at, leader_time_seconds, meet_id
    FROM races;
    DROP TABLE races;
    ALTER TABLE races_new RENAME TO races;
    COMMIT;
    PRAGMA foreign_keys = ON;
  `);
}

/** Drop distance_type CHECK so custom distances (aquathlon, …) are allowed. */
function migrateRacesAllowCustomDistances(db: Database.Database) {
  const row = db
    .prepare(
      `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'races'`
    )
    .get() as { sql: string } | undefined;
  if (!row?.sql) return;
  if (!/CHECK\s*\(\s*distance_type/i.test(row.sql)) return;

  const oldCols = new Set(
    (
      db.prepare("PRAGMA table_info(races)").all() as Array<{ name: string }>
    ).map((c) => c.name)
  );
  const newCols = [
    "id",
    "name",
    "race_date",
    "distance_type",
    "base_points",
    "source_filename",
    "created_at",
    "leader_time_seconds",
    "meet_id",
    "field_size",
    "field_size_m",
    "field_size_f",
  ];
  const shared = newCols.filter((c) => oldCols.has(c));
  const list = shared.join(", ");

  db.exec(`
    PRAGMA foreign_keys = OFF;
    BEGIN;
    CREATE TABLE races_anydist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      race_date TEXT NOT NULL,
      distance_type TEXT NOT NULL,
      base_points INTEGER NOT NULL,
      source_filename TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      leader_time_seconds REAL,
      meet_id INTEGER REFERENCES race_meets(id) ON DELETE CASCADE,
      field_size INTEGER,
      field_size_m INTEGER,
      field_size_f INTEGER
    );
    INSERT INTO races_anydist (${list})
    SELECT ${list} FROM races;
    DROP TABLE races;
    ALTER TABLE races_anydist RENAME TO races;
    COMMIT;
    PRAGMA foreign_keys = ON;
  `);
}

/** Group legacy races (no meet) by calendar day into one meet. */
function backfillRaceMeets(db: Database.Database) {
  const orphans = db
    .prepare(
      `SELECT * FROM races WHERE meet_id IS NULL ORDER BY race_date ASC, id ASC`
    )
    .all() as Array<{
    id: number;
    name: string;
    race_date: string;
    distance_type: string;
  }>;
  if (orphans.length === 0) return;

  const byDate = new Map<string, typeof orphans>();
  for (const race of orphans) {
    const list = byDate.get(race.race_date) ?? [];
    list.push(race);
    byDate.set(race.race_date, list);
  }

  const insertMeet = db.prepare(
    "INSERT INTO race_meets (name, meet_date) VALUES (?, ?)"
  );
  const setMeet = db.prepare("UPDATE races SET meet_id = ? WHERE id = ?");

  db.transaction(() => {
    for (const [date, dayRaces] of byDate) {
      const name = meetNameFromRaces(dayRaces);
      const info = insertMeet.run(name, date);
      const meetId = Number(info.lastInsertRowid);
      for (const race of dayRaces) {
        setMeet.run(meetId, race.id);
      }
    }
  })();
}

function meetNameFromRaces(
  races: Array<{ name: string; distance_type: string }>
): string {
  if (races.length === 1) {
    return races[0].name.replace(/\s+(OD|SD|OL|Sprint|Half|Full)$/i, "").trim() || races[0].name;
  }
  const bases = races.map((r) =>
    r.name.replace(/\s+(OD|SD|OL|Sprint|Half|Full)$/i, "").trim()
  );
  return bases[0] || "Varžybos";
}

export type { DistanceType } from "./distances";
export { BASE_POINTS } from "./distances";

import type { DistanceType } from "./distances";

export type Member = {
  id: number;
  display_name: string;
  normalized_name: string;
  sex: "M" | "F" | null;
  sex_manual: number;
  active: number;
  created_at: string;
};

export type RaceMeet = {
  id: number;
  name: string;
  meet_date: string;
  /** 1 = foreign start; at most one such meet counts in best-3. */
  foreign_start: number;
  created_at: string;
};

export type Race = {
  id: number;
  name: string;
  race_date: string;
  distance_type: DistanceType;
  base_points: number;
  source_filename: string | null;
  leader_time_seconds: number | null;
  meet_id: number | null;
  /** Total finishers in full protocol (if known). */
  field_size: number | null;
  field_size_m: number | null;
  field_size_f: number | null;
  created_at: string;
};

export type RaceResult = {
  id: number;
  race_id: number;
  place: number | null;
  bib: string | null;
  raw_name: string;
  member_id: number | null;
  club: string | null;
  sex: "M" | "F" | null;
  time_seconds: number | null;
  gun_time_seconds: number | null;
  points: number | null;
  included_in_rating: number;
  finish_status: "ok" | "dnf" | "dns" | null;
};

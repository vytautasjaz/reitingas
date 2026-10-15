import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import {
  OFFICIAL_ROSTER,
  ROSTER_ALIASES,
  ROSTER_SYNC_VERSION,
} from "@/data/official-roster";
import { getDb, Member } from "./db";
import { inferSexFromName, Sex } from "./gender";
import { normalizeName, toDisplayName } from "./names";

const ROSTER_SYNC_KEY = "official_roster_version";
const EXTRA_ROSTER_KEY = "roster_extras";
const EXCLUDED_ROSTER_KEY = "roster_excluded";
let rosterSyncDone = false;

function ensureAppSettingsTable(): void {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function readJsonSetting<T>(key: string, fallback: T): T {
  ensureAppSettingsTable();
  const row = getDb()
    .prepare("SELECT value FROM app_settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  if (!row?.value) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

function writeJsonSetting(key: string, value: unknown): void {
  ensureAppSettingsTable();
  getDb()
    .prepare(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = datetime('now')`
    )
    .run(key, JSON.stringify(value));
}

/** Extra rated members added via UI (persist across sync / deploy). */
export function getExtraRosterNames(): string[] {
  const raw = readJsonSetting<unknown>(EXTRA_ROSTER_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .map((n) => String(n ?? "").trim())
    .filter(Boolean);
}

function setExtraRosterNames(names: string[]): void {
  const unique = new Map<string, string>();
  for (const n of names) {
    const display = toDisplayName(n.trim());
    const key = normalizeName(display);
    if (!key) continue;
    unique.set(key, display);
  }
  writeJsonSetting(EXTRA_ROSTER_KEY, [...unique.values()]);
}

/** Official-list names removed via UI (normalized keys). */
function getExcludedRosterKeys(): Set<string> {
  const raw = readJsonSetting<unknown>(EXCLUDED_ROSTER_KEY, []);
  if (!Array.isArray(raw)) return new Set();
  return new Set(
    raw.map((n) => normalizeName(String(n ?? ""))).filter(Boolean)
  );
}

function setExcludedRosterKeys(keys: Set<string>): void {
  writeJsonSetting(EXCLUDED_ROSTER_KEY, [...keys]);
}

/** Built-in roster + UI extras − UI exclusions. */
export function getEffectiveRoster(): string[] {
  const excluded = getExcludedRosterKeys();
  const out = new Map<string, string>();
  for (const raw of OFFICIAL_ROSTER) {
    const display = toDisplayName(raw.trim());
    const key = normalizeName(display);
    if (!key || excluded.has(key)) continue;
    out.set(key, display);
  }
  for (const raw of getExtraRosterNames()) {
    const display = toDisplayName(raw.trim());
    const key = normalizeName(display);
    if (!key) continue;
    out.set(key, display);
  }
  return [...out.values()].sort((a, b) =>
    a.localeCompare(b, "lt", { sensitivity: "base" })
  );
}

/**
 * Apply official roster to the DB once per process (and again after roster version bumps).
 * Deploy updates code only — Fly volume DB needs this to catch up.
 */
export function ensureOfficialRosterApplied(): void {
  if (rosterSyncDone) return;
  ensureAppSettingsTable();
  const row = getDb()
    .prepare("SELECT value FROM app_settings WHERE key = ?")
    .get(ROSTER_SYNC_KEY) as { value: string } | undefined;
  if (row?.value === ROSTER_SYNC_VERSION) {
    rosterSyncDone = true;
    return;
  }
  syncOfficialRoster();
  ensureAppSettingsTable();
  getDb()
    .prepare(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = datetime('now')`
    )
    .run(ROSTER_SYNC_KEY, ROSTER_SYNC_VERSION);
  rosterSyncDone = true;
}

export function findMemberByName(rawName: string): Member | undefined {
  const db = getDb();
  const key = normalizeName(rawName);
  return db
    .prepare("SELECT * FROM members WHERE normalized_name = ?")
    .get(key) as Member | undefined;
}

/**
 * Resolve a protocol / typed name to an active official-roster member.
 * Does not create members. Alias spellings are remapped first.
 */
export function findActiveRosterMember(
  rawName: string
): Member | undefined {
  const key = normalizeName(rawName);
  if (!key) return undefined;

  const aliasOfficial = ROSTER_ALIASES[key];
  const lookupName = aliasOfficial ?? rawName;
  const member =
    findMemberByName(lookupName) ??
    (aliasOfficial ? undefined : findMemberByName(rawName));

  if (!member || !member.active) return undefined;
  return member;
}

export function getMember(id: number): Member | undefined {
  return getDb().prepare("SELECT * FROM members WHERE id = ?").get(id) as
    | Member
    | undefined;
}

export function setMemberSex(
  memberId: number,
  sex: Sex | null,
  opts: { overwrite?: boolean; manual?: boolean } = {}
) {
  if (!sex && !opts.manual) return;
  const db = getDb();
  const row = getMember(memberId);
  if (!row) return;

  // Respect manually corrected sex unless this update is also manual.
  if (row.sex_manual && !opts.manual) return;

  if (opts.manual) {
    db.prepare("UPDATE members SET sex = ?, sex_manual = 1 WHERE id = ?").run(
      sex,
      memberId
    );
    return;
  }

  if (opts.overwrite) {
    db.prepare(
      "UPDATE members SET sex = ? WHERE id = ? AND (sex_manual IS NULL OR sex_manual = 0)"
    ).run(sex, memberId);
    return;
  }

  db.prepare(
    `UPDATE members SET sex = ?
     WHERE id = ? AND (sex IS NULL OR sex = '') AND (sex_manual IS NULL OR sex_manual = 0)`
  ).run(sex, memberId);
}

export function ensureMember(rawName: string, sex?: Sex | null): Member {
  const existing = findMemberByName(rawName);
  if (existing) {
    if (sex && !existing.sex) setMemberSex(existing.id, sex);
    return getMember(existing.id) ?? existing;
  }

  const db = getDb();
  const display = toDisplayName(rawName);
  const key = normalizeName(rawName);
  const resolvedSex = sex ?? inferSexFromName(display);
  const info = db
    .prepare(
      "INSERT INTO members (display_name, normalized_name, sex, sex_manual, active) VALUES (?, ?, ?, 0, 1)"
    )
    .run(display, key, resolvedSex);

  return getDb()
    .prepare("SELECT * FROM members WHERE id = ?")
    .get(info.lastInsertRowid) as Member;
}

export function listMembers(): Member[] {
  ensureOfficialRosterApplied();
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM members WHERE active = 1 ORDER BY display_name COLLATE NOCASE"
    )
    .all() as Member[];
}

export type UpdateMemberInput = {
  displayName?: string;
  sex?: Sex | null;
  active?: boolean;
};

export function updateMember(id: number, input: UpdateMemberInput): Member {
  const db = getDb();
  const existing = getMember(id);
  if (!existing) throw new Error("Narys nerastas");

  let displayName = existing.display_name;
  let normalized = existing.normalized_name;

  if (input.displayName !== undefined) {
    const trimmed = input.displayName.trim();
    if (!trimmed) throw new Error("Vardas negali būti tuščias");
    displayName = toDisplayName(trimmed);
    normalized = normalizeName(trimmed);
    if (!normalized) throw new Error("Neteisingas vardas");

    const clash = db
      .prepare(
        "SELECT id FROM members WHERE normalized_name = ? AND id != ? LIMIT 1"
      )
      .get(normalized, id) as { id: number } | undefined;
    if (clash) {
      throw new Error("Narys su tokiu vardu jau egzistuoja");
    }
  }

  const sex = input.sex !== undefined ? input.sex : existing.sex;
  const sexManual =
    input.sex !== undefined ? 1 : existing.sex_manual ? 1 : 0;
  const active =
    input.active !== undefined ? (input.active ? 1 : 0) : existing.active;

  db.prepare(
    `UPDATE members
     SET display_name = ?, normalized_name = ?, sex = ?, sex_manual = ?, active = ?
     WHERE id = ?`
  ).run(displayName, normalized, sex, sexManual, active, id);

  return getMember(id)!;
}

export function deactivateMember(id: number): void {
  const db = getDb();
  const existing = getMember(id);
  if (!existing) throw new Error("Narys nerastas");
  db.prepare("UPDATE members SET active = 0 WHERE id = ?").run(id);

  // Keep sync from bringing them back / drop from UI extras.
  const key = existing.normalized_name;
  setExtraRosterNames(
    getExtraRosterNames().filter((n) => normalizeName(n) !== key)
  );
  const excluded = getExcludedRosterKeys();
  excluded.add(key);
  setExcludedRosterKeys(excluded);

  db.prepare(
    `UPDATE race_results
     SET included_in_rating = 0
     WHERE member_id = ? AND included_in_rating = 1`
  ).run(id);
}

/**
 * Add (or re-activate) a rated member from the UI.
 * Persists in roster extras so sync / deploy keep them.
 */
export function addRatedMember(
  rawName: string,
  sex?: Sex | null
): Member {
  const trimmed = rawName.trim();
  if (!trimmed) throw new Error("Įveskite vardą ir pavardę");
  const display = toDisplayName(trimmed);
  const key = normalizeName(display);
  if (!key) throw new Error("Neteisingas vardas");

  const db = getDb();
  const existing = findMemberByName(display);
  const resolvedSex =
    sex === "M" || sex === "F"
      ? sex
      : existing?.sex ?? inferSexFromName(display);

  let member: Member;
  if (existing) {
    db.prepare(
      `UPDATE members
       SET display_name = ?, normalized_name = ?, active = 1,
           sex = COALESCE(?, sex),
           sex_manual = CASE WHEN ? IS NOT NULL THEN 1 ELSE sex_manual END
       WHERE id = ?`
    ).run(
      display,
      key,
      resolvedSex,
      sex === "M" || sex === "F" ? sex : null,
      existing.id
    );
    member = getMember(existing.id)!;
  } else {
    const info = db
      .prepare(
        `INSERT INTO members (display_name, normalized_name, sex, sex_manual, active)
         VALUES (?, ?, ?, ?, 1)`
      )
      .run(
        display,
        key,
        resolvedSex,
        sex === "M" || sex === "F" ? 1 : 0
      );
    member = getMember(Number(info.lastInsertRowid))!;
  }

  const extras = getExtraRosterNames().filter((n) => normalizeName(n) !== key);
  extras.push(display);
  setExtraRosterNames(extras);

  const excluded = getExcludedRosterKeys();
  if (excluded.delete(key)) setExcludedRosterKeys(excluded);

  return member;
}

export type SyncOfficialRosterResult = {
  ensured: number;
  inserted: number;
  reactivated: number;
  deactivated: number;
  remappedResults: number;
  excludedFromRating: number;
  names: string[];
};

/**
 * Make the members table match the official TRItonas roster.
 * - Ensures every official name exists and is active
 * - Deactivates anyone not on the roster (keeps rows + race history)
 * - Remaps alias results onto the official member
 * - Drops non-roster athletes from the rating (included_in_rating = 0)
 */
export function syncOfficialRoster(
  roster: readonly string[] = getEffectiveRoster()
): SyncOfficialRosterResult {
  const db = getDb();
  const officialKeys = new Set<string>();
  const names: string[] = [];
  let inserted = 0;
  let reactivated = 0;
  let ensured = 0;
  let remappedResults = 0;

  const insert = db.prepare(
    `INSERT INTO members (display_name, normalized_name, sex, sex_manual, active)
     VALUES (?, ?, ?, 0, 1)`
  );
  const activate = db.prepare(
    `UPDATE members
     SET display_name = ?, normalized_name = ?, active = 1
     WHERE id = ?`
  );
  const findByNorm = db.prepare(
    "SELECT * FROM members WHERE normalized_name = ? LIMIT 1"
  );

  const tx = db.transaction(() => {
    for (const raw of roster) {
      const display = toDisplayName(raw.trim());
      const key = normalizeName(display);
      if (!key) continue;
      officialKeys.add(key);
      names.push(display);

      let row = findByNorm.get(key) as Member | undefined;
      if (!row) {
        // Alias: e.g. Valdemaras → Valdemar
        for (const [aliasKey, officialName] of Object.entries(ROSTER_ALIASES)) {
          if (normalizeName(officialName) !== key) continue;
          const aliased = findByNorm.get(aliasKey) as Member | undefined;
          if (aliased) {
            row = aliased;
            break;
          }
        }
      }

      const sex = row?.sex ?? inferSexFromName(display);
      if (!row) {
        insert.run(display, key, sex);
        inserted += 1;
      } else {
        const wasActive = !!row.active;
        activate.run(display, key, row.id);
        if (!wasActive) reactivated += 1;
      }
      ensured += 1;
    }

    // Remap alias result rows onto the official member id.
    for (const [aliasKey, officialName] of Object.entries(ROSTER_ALIASES)) {
      const official = findByNorm.get(normalizeName(officialName)) as
        | Member
        | undefined;
      const alias = findByNorm.get(aliasKey) as Member | undefined;
      if (!official || !alias || official.id === alias.id) continue;

      const info = db
        .prepare(
          `UPDATE race_results
           SET member_id = ?, raw_name = ?
           WHERE member_id = ?`
        )
        .run(official.id, official.display_name, alias.id);
      remappedResults += Number(info.changes ?? 0);
    }

    const all = db
      .prepare("SELECT id, normalized_name, active FROM members")
      .all() as Array<{ id: number; normalized_name: string; active: number }>;

    let deactivated = 0;
    const deactivate = db.prepare(
      "UPDATE members SET active = 0 WHERE id = ? AND active = 1"
    );
    for (const m of all) {
      if (officialKeys.has(m.normalized_name)) continue;
      // Also keep alias rows inactive (already remapped)
      const info = deactivate.run(m.id);
      deactivated += Number(info.changes ?? 0);
    }

    // Non-roster (inactive) athletes stay in protocols but leave the rating.
    const exclude = db
      .prepare(
        `UPDATE race_results
         SET included_in_rating = 0
         WHERE member_id IS NOT NULL
           AND member_id IN (SELECT id FROM members WHERE active = 0)
           AND included_in_rating = 1`
      )
      .run();

    return {
      deactivated,
      excludedFromRating: Number(exclude.changes ?? 0),
    };
  });

  const { deactivated, excludedFromRating } = tx();
  backfillMemberSexFromNames();

  return {
    ensured,
    inserted,
    reactivated,
    deactivated,
    remappedResults,
    excludedFromRating,
    names,
  };
}

/** Fill missing member.sex from Lithuanian surname heuristics. */
export function backfillMemberSexFromNames(): number {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, display_name FROM members
       WHERE (sex IS NULL OR sex = '')
         AND (sex_manual IS NULL OR sex_manual = 0)`
    )
    .all() as Array<{ id: number; display_name: string }>;
  const update = db.prepare("UPDATE members SET sex = ? WHERE id = ?");
  let n = 0;
  const tx = db.transaction(() => {
    for (const row of rows) {
      const sex = inferSexFromName(row.display_name);
      if (!sex) continue;
      update.run(sex, row.id);
      n += 1;
    }
  });
  tx();
  return n;
}

/**
 * Repair wrong sexes (e.g. intl M30 misread as LT moterys).
 * Does not touch sex_manual = 1 rows.
 */
export function repairMemberSexes(): {
  membersFixed: number;
  resultsFixed: number;
  details: string[];
} {
  const db = getDb();
  const details: string[] = [];
  let membersFixed = 0;
  let resultsFixed = 0;

  const members = db
    .prepare(
      `SELECT id, display_name, sex, sex_manual FROM members WHERE active = 1`
    )
    .all() as Array<{
    id: number;
    display_name: string;
    sex: Sex | null;
    sex_manual: number;
  }>;

  const updateMember = db.prepare(
    "UPDATE members SET sex = ? WHERE id = ? AND (sex_manual IS NULL OR sex_manual = 0)"
  );
  const updateResult = db.prepare(
    "UPDATE race_results SET sex = ? WHERE member_id = ? AND (sex IS NULL OR sex != ?)"
  );

  const tx = db.transaction(() => {
    for (const m of members) {
      if (m.sex_manual) continue;
      const inferred = inferSexFromName(m.display_name);
      if (!inferred) continue;
      if (m.sex !== inferred) {
        updateMember.run(inferred, m.id);
        membersFixed += 1;
        details.push(
          `${m.display_name}: ${m.sex ?? "?"} → ${inferred}`
        );
      }
      // Align stored race_result sexes with corrected member sex when they disagree
      const info = updateResult.run(inferred, m.id, inferred);
      resultsFixed += Number(info.changes ?? 0);
    }
  });
  tx();

  backfillMemberSexFromNames();
  return { membersFixed, resultsFixed, details };
}

export function seedMembersFromWorkbook(
  workbookPath = path.join(process.cwd(), "Sample", "Tritono-reitingas-2026.xlsx")
): { inserted: number; skipped: number; names: string[] } {
  if (!fs.existsSync(workbookPath)) {
    throw new Error(`Sample workbook not found: ${workbookPath}`);
  }

  const wb = XLSX.readFile(workbookPath);
  const sheetName =
    wb.SheetNames.find((n) => n.toLowerCase().includes("bendra") && !n.includes("202")) ??
    wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
  });

  let nameCol = -1;
  let headerRow = -1;
  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const row = rows[r] ?? [];
    for (let c = 0; c < row.length; c++) {
      if (String(row[c] ?? "").trim().toLowerCase() === "dalyvis") {
        nameCol = c;
        headerRow = r;
        break;
      }
    }
    if (nameCol >= 0) break;
  }

  if (nameCol < 0) {
    throw new Error('Could not find "Dalyvis" column in Bendra įskaita');
  }

  const db = getDb();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO members (display_name, normalized_name, sex, sex_manual, active)
     VALUES (?, ?, ?, 0, 1)`
  );

  let inserted = 0;
  let skipped = 0;
  const names: string[] = [];

  const tx = db.transaction(() => {
    for (let r = headerRow + 1; r < rows.length; r++) {
      const raw = rows[r]?.[nameCol];
      if (raw == null) continue;
      const text = String(raw).trim();
      if (!text || text.toLowerCase() === "dalyvis") continue;

      const display = toDisplayName(text);
      const key = normalizeName(text);
      if (!key) continue;

      const sex = inferSexFromName(display);
      const result = insert.run(display, key, sex);
      if (result.changes > 0) {
        inserted += 1;
        names.push(display);
      } else {
        skipped += 1;
      }
    }
  });
  tx();

  backfillMemberSexFromNames();
  return { inserted, skipped, names };
}

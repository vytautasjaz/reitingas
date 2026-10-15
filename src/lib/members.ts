import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { getDb, Member } from "./db";
import { inferSexFromName, Sex } from "./gender";
import { normalizeName, toDisplayName } from "./names";

export function findMemberByName(rawName: string): Member | undefined {
  const db = getDb();
  const key = normalizeName(rawName);
  return db
    .prepare("SELECT * FROM members WHERE normalized_name = ?")
    .get(key) as Member | undefined;
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

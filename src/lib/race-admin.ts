import {
  getDb,
  DistanceType,
  BASE_POINTS,
  Race,
  RaceResult,
  Member,
} from "./db";
import { ensureMember } from "./members";
import {
  calculatePoints,
  classifyFinishStatus,
  parseTimeToSeconds,
} from "./scoring";
import { Sex } from "./gender";

export type UpdateRaceInput = {
  name: string;
  raceDate: string;
  distanceType: DistanceType;
  leaderTimeSeconds?: number | null;
};

export type AddResultInput = {
  memberId?: number | null;
  name?: string;
  club?: string;
  sex?: Sex | null;
  timeText?: string | null;
  points?: number | null;
  place?: number | null;
  includedInRating?: boolean;
};

function athleteSeconds(row: {
  time_seconds: number | null;
  gun_time_seconds: number | null;
}): number | null {
  return row.time_seconds ?? row.gun_time_seconds;
}

/** Recover protocol leader time from stored points when column is empty. */
export function resolveLeaderTime(race: Race): number | null {
  if (race.leader_time_seconds != null && race.leader_time_seconds > 0) {
    return race.leader_time_seconds;
  }

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT time_seconds, gun_time_seconds, points
       FROM race_results
       WHERE race_id = ? AND points IS NOT NULL AND points > 0`
    )
    .all(race.id) as Array<{
    time_seconds: number | null;
    gun_time_seconds: number | null;
    points: number;
  }>;

  let best: { leader: number; score: number } | null = null;
  for (const row of rows) {
    const secs = athleteSeconds(row);
    if (secs == null || secs <= 0) continue;
    // points ≈ ROUND(leader / athlete * base) ⇒ leader ≈ athlete * points / base
    const estimated = (secs * row.points) / race.base_points;
    const closeness = Math.abs(row.points - race.base_points);
    if (!best || closeness < best.score || (closeness === best.score && estimated < best.leader)) {
      best = { leader: estimated, score: closeness };
    }
  }

  if (best) {
    db.prepare("UPDATE races SET leader_time_seconds = ? WHERE id = ?").run(
      best.leader,
      race.id
    );
    return best.leader;
  }

  const minRow = db
    .prepare(
      `SELECT MIN(COALESCE(time_seconds, gun_time_seconds)) AS m
       FROM race_results
       WHERE race_id = ? AND COALESCE(time_seconds, gun_time_seconds) > 0`
    )
    .get(race.id) as { m: number | null };

  if (minRow.m != null && minRow.m > 0) {
    db.prepare("UPDATE races SET leader_time_seconds = ? WHERE id = ?").run(
      minRow.m,
      race.id
    );
    return minRow.m;
  }

  return null;
}

export function recalculateRacePoints(raceId: number): void {
  const db = getDb();
  const race = db.prepare("SELECT * FROM races WHERE id = ?").get(raceId) as
    | Race
    | undefined;
  if (!race) throw new Error("Varžybos nerastos");

  const leader = resolveLeaderTime(race);
  if (leader == null) return;

  const rows = db
    .prepare("SELECT * FROM race_results WHERE race_id = ?")
    .all(raceId) as RaceResult[];

  const update = db.prepare(
    "UPDATE race_results SET points = ? WHERE id = ?"
  );

  const updateStatus = db.prepare(
    "UPDATE race_results SET points = ?, finish_status = ? WHERE id = ?"
  );

  db.transaction(() => {
    for (const row of rows) {
      if (!row.included_in_rating || row.finish_status === "dns") {
        update.run(null, row.id);
        continue;
      }
      const secs = athleteSeconds(row);
      if (secs == null) {
        // Started but no finish → DNF, 0 points
        updateStatus.run(0, "dnf", row.id);
        continue;
      }
      updateStatus.run(
        calculatePoints(leader, secs, race.base_points),
        "ok",
        row.id
      );
    }
  })();
}

export function updateRace(raceId: number, input: UpdateRaceInput): Race {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM races WHERE id = ?").get(raceId) as
    | Race
    | undefined;
  if (!existing) throw new Error("Varžybos nerastos");

  const base = BASE_POINTS[input.distanceType];
  const distanceChanged = existing.distance_type !== input.distanceType;
  const leader =
    input.leaderTimeSeconds !== undefined
      ? input.leaderTimeSeconds
      : existing.leader_time_seconds;

  db.prepare(
    `UPDATE races
     SET name = ?, race_date = ?, distance_type = ?, base_points = ?, leader_time_seconds = ?
     WHERE id = ?`
  ).run(
    input.name.trim(),
    input.raceDate,
    input.distanceType,
    base,
    leader,
    raceId
  );

  if (distanceChanged || input.leaderTimeSeconds !== undefined) {
    recalculateRacePoints(raceId);
  }

  return db.prepare("SELECT * FROM races WHERE id = ?").get(raceId) as Race;
}

export function removeRaceResult(
  raceId: number,
  resultId: number
): void {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM race_results WHERE id = ?")
    .get(resultId) as RaceResult | undefined;
  if (!row) throw new Error("Rezultatas nerastas");
  if (row.race_id !== raceId) {
    throw new Error("Rezultatas nepriklauso šioms varžyboms");
  }

  db.prepare("DELETE FROM race_results WHERE id = ?").run(resultId);
}

export type UpdateResultInput = {
  name?: string;
  club?: string | null;
  place?: number | null;
  timeText?: string | null;
  points?: number | null;
  includedInRating?: boolean;
  /** If true and time is set, recalculate points from leader (unless points explicitly provided). */
  recalcPoints?: boolean;
};

export function updateRaceResult(
  raceId: number,
  resultId: number,
  input: UpdateResultInput
): RaceResult {
  const db = getDb();
  const race = db.prepare("SELECT * FROM races WHERE id = ?").get(raceId) as
    | Race
    | undefined;
  if (!race) throw new Error("Varžybos nerastos");

  const row = db
    .prepare("SELECT * FROM race_results WHERE id = ?")
    .get(resultId) as RaceResult | undefined;
  if (!row) throw new Error("Rezultatas nerastas");
  if (row.race_id !== raceId) {
    throw new Error("Rezultatas nepriklauso šioms varžyboms");
  }

  let rawName = row.raw_name;
  let memberId = row.member_id;
  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) throw new Error("Vardas negali būti tuščias");
    const member = ensureMember(trimmed, row.sex);
    rawName = member.display_name;
    memberId = member.id;
  }

  const club =
    input.club !== undefined
      ? (input.club?.trim() || null)
      : row.club;

  const place = input.place !== undefined ? input.place : row.place;

  let timeSeconds = row.time_seconds;
  let finishStatus = row.finish_status ?? "ok";
  if (input.timeText !== undefined) {
    if (input.timeText == null || input.timeText.trim() === "") {
      timeSeconds = null;
      finishStatus = "dnf";
    } else {
      const status = classifyFinishStatus(input.timeText);
      if (status === "dnf" || status === "dns") {
        timeSeconds = null;
        finishStatus = status;
      } else {
        const parsed = parseTimeToSeconds(input.timeText);
        if (parsed == null) {
          throw new Error("Neteisingas laiko formatas (pvz. 1:08:19.0 arba DNF)");
        }
        timeSeconds = parsed;
        finishStatus = "ok";
      }
    }
  }

  let included =
    input.includedInRating !== undefined
      ? input.includedInRating
        ? 1
        : 0
      : row.included_in_rating;
  if (finishStatus === "dns") included = 0;

  let points = input.points !== undefined ? input.points : row.points;
  const shouldRecalc =
    input.recalcPoints === true ||
    (input.points === undefined &&
      input.timeText !== undefined &&
      timeSeconds != null &&
      included === 1);

  if (shouldRecalc && timeSeconds != null && included === 1) {
    const leader = resolveLeaderTime(race);
    if (leader == null) {
      throw new Error(
        "Nėra lyderio laiko — įveskite taškus rankiniu būdu"
      );
    }
    points = calculatePoints(leader, timeSeconds, race.base_points);
    finishStatus = "ok";
  }

  if (included === 0) {
    points = null;
  } else if (finishStatus === "dnf" && input.points === undefined) {
    points = 0;
  } else if (points == null && timeSeconds == null) {
    throw new Error("Įveskite laiką, DNF arba taškus");
  }

  db.prepare(
    `UPDATE race_results
     SET raw_name = ?, member_id = ?, club = ?, place = ?,
         time_seconds = ?, points = ?, included_in_rating = ?, finish_status = ?
     WHERE id = ?`
  ).run(
    rawName,
    memberId,
    club,
    place,
    timeSeconds,
    points,
    included,
    finishStatus,
    resultId
  );

  return db
    .prepare("SELECT * FROM race_results WHERE id = ?")
    .get(resultId) as RaceResult;
}

export function addManualResult(
  raceId: number,
  input: AddResultInput
): RaceResult {
  const db = getDb();
  const race = db.prepare("SELECT * FROM races WHERE id = ?").get(raceId) as
    | Race
    | undefined;
  if (!race) throw new Error("Varžybos nerastos");

  let member: Member | undefined;
  if (input.memberId != null) {
    member = db
      .prepare("SELECT * FROM members WHERE id = ?")
      .get(input.memberId) as Member | undefined;
    if (!member) throw new Error("Narys nerastas");
  } else if (input.name?.trim()) {
    member = ensureMember(input.name.trim(), input.sex ?? null);
  } else {
    throw new Error("Pasirinkite narį arba įveskite vardą");
  }

  const statusFromTime = input.timeText
    ? classifyFinishStatus(input.timeText)
    : null;
  let finishStatus: "ok" | "dnf" | "dns" =
    statusFromTime === "dnf" || statusFromTime === "dns"
      ? statusFromTime
      : "ok";
  const timeSeconds =
    finishStatus === "ok" && input.timeText
      ? parseTimeToSeconds(input.timeText)
      : null;
  if (
    input.timeText?.trim() &&
    finishStatus === "ok" &&
    timeSeconds == null
  ) {
    throw new Error("Neteisingas laiko formatas (pvz. 1:08:19.0 arba DNF)");
  }

  let included = input.includedInRating !== false ? 1 : 0;
  if (finishStatus === "dns") included = 0;

  let points = input.points ?? null;

  if (included && points == null && timeSeconds != null) {
    const leader = resolveLeaderTime(race);
    if (leader == null) {
      throw new Error(
        "Nėra lyderio laiko — įveskite taškus rankiniu būdu arba lyderio laiką"
      );
    }
    points = calculatePoints(leader, timeSeconds, race.base_points);
    finishStatus = "ok";
  }

  if (included && finishStatus === "dnf" && points == null) {
    points = 0;
  }

  if (included && points == null && timeSeconds == null) {
    throw new Error("Įveskite laiką, DNF arba taškus");
  }

  const club = (input.club?.trim() || "TRItonas").slice(0, 200);
  const rawName = member.display_name;
  const sex = input.sex ?? member.sex;

  const existing = db
    .prepare(
      `SELECT id FROM race_results
       WHERE race_id = ? AND member_id = ?
       LIMIT 1`
    )
    .get(raceId, member.id) as { id: number } | undefined;
  if (existing) {
    throw new Error("Šis dalyvis jau yra šiose varžybose");
  }

  const info = db
    .prepare(
      `INSERT INTO race_results (
        race_id, place, bib, raw_name, member_id, club, sex,
        time_seconds, gun_time_seconds, points, included_in_rating, finish_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      raceId,
      input.place ?? null,
      `manual-${Date.now()}`,
      rawName,
      member.id,
      club,
      sex,
      timeSeconds,
      null,
      included ? points : null,
      included,
      finishStatus
    );

  return db
    .prepare("SELECT * FROM race_results WHERE id = ?")
    .get(Number(info.lastInsertRowid)) as RaceResult;
}

import { getDb, DistanceType, Race, RaceMeet } from "./db";
import { clubMentionsTritonas, isMixedTritonasClub, isPureTritonasClub } from "./club";
import { detectCategoryConvention, normalizeSex } from "./gender";
import { ensureMember, findMemberByName, setMemberSex } from "./members";
import { parseResultsFileBuffer, ParsedResultRow } from "./parse-results";
import { computeFieldSizes, computePlaceBySexMap } from "./place-by-sex";
import { formatSeconds } from "./scoring";
import { normalizeName, toDisplayName } from "./names";
import { basePointsForDistanceId, scoreAthlete } from "./settings";

export type ImportLegInput = {
  distanceType: DistanceType;
  sourceFilename?: string;
  fileBuffer: Buffer;
};

export type ImportMeetInput = {
  name: string;
  meetDate: string; // YYYY-MM-DD
  /** Foreign start — at most one counts in best-3. */
  foreignStart?: boolean;
  legs: ImportLegInput[];
};

export type ImportMeetResult = {
  meet: RaceMeet;
  races: Race[];
  totalRows: number;
  tritonasRows: number;
  included: number;
  newMembers: string[];
  skippedMixed: string[];
};

/** @deprecated single-file import — prefer importMeet */
export type ImportRaceInput = {
  name: string;
  raceDate: string;
  distanceType: DistanceType;
  sourceFilename?: string;
  fileBuffer: Buffer;
  meetId?: number;
};

export type ImportRaceResult = {
  race: Race;
  totalRows: number;
  tritonasRows: number;
  included: number;
  newMembers: string[];
  skippedMixed: string[];
};

function athleteSeconds(row: ParsedResultRow): number | null {
  return row.timeSeconds ?? row.gunTimeSeconds;
}

function legSuffix(distanceType: DistanceType): string {
  if (distanceType === "olympic") return "OD";
  if (distanceType === "sprint") return "SD";
  if (distanceType === "half") return "Half";
  if (distanceType === "full") return "Full";
  return distanceType;
}

function legRaceName(meetName: string, distanceType: DistanceType): string {
  const base = meetName.trim();
  const suffix = legSuffix(distanceType);
  if (new RegExp(`\\b${suffix}$`, "i").test(base)) return base;
  return `${base} ${suffix}`;
}

/** Guard against attaching a sprint protocol to olympic (or vice versa). */
export function assertLeaderMatchesDistance(
  distanceType: DistanceType,
  leaderSeconds: number,
  sourceFilename?: string
) {
  const label = sourceFilename ? `„${sourceFilename}“` : "protokolas";
  const timeLabel = formatSeconds(leaderSeconds);
  // Only validate built-in triathlon distances.
  const known = new Set(["sprint", "olympic", "half", "full"]);
  if (!known.has(distanceType)) return;

  // Olympic / half winners are typically well over 1.5h; sprint under ~1.5h.
  if (distanceType === "olympic" && leaderSeconds < 5400) {
    throw new Error(
      `${label} lyderio laikas ${timeLabel} panašus į sprintą, o pasirinkta olimpinė distancija. Patikrinkite failą.`
    );
  }
  if (
    (distanceType === "half" || distanceType === "full") &&
    leaderSeconds < 9000
  ) {
    throw new Error(
      `${label} lyderio laikas ${timeLabel} per trumpas ${
        distanceType === "full" ? "Full" : "Half"
      } distancijai. Patikrinkite failą.`
    );
  }
  if (distanceType === "sprint" && leaderSeconds > 7200) {
    throw new Error(
      `${label} lyderio laikas ${timeLabel} panašus į olimpinę, o pasirinktas sprintas. Patikrinkite failą.`
    );
  }
}

export function importMeet(input: ImportMeetInput): ImportMeetResult {
  if (!input.legs.length) {
    throw new Error("Pridėkite bent vieną rezultatų failą");
  }

  const db = getDb();
  const newMembers: string[] = [];
  const skippedMixed: string[] = [];
  let totalRows = 0;
  let tritonasRows = 0;
  let included = 0;
  const raceIds: number[] = [];
  let meetId = 0;

  db.transaction(() => {
    const meetInfo = db
      .prepare(
        "INSERT INTO race_meets (name, meet_date, foreign_start) VALUES (?, ?, ?)"
      )
      .run(input.name.trim(), input.meetDate, input.foreignStart ? 1 : 0);
    meetId = Number(meetInfo.lastInsertRowid);

    for (const leg of input.legs) {
      const result = insertRaceLeg({
        meetId,
        name: legRaceName(input.name, leg.distanceType),
        raceDate: input.meetDate,
        distanceType: leg.distanceType,
        sourceFilename: leg.sourceFilename,
        fileBuffer: leg.fileBuffer,
        foreign: !!input.foreignStart,
      });
      raceIds.push(result.raceId);
      totalRows += result.totalRows;
      tritonasRows += result.tritonasRows;
      included += result.included;
      newMembers.push(...result.newMembers);
      skippedMixed.push(...result.skippedMixed);
    }
  })();

  const meet = db
    .prepare("SELECT * FROM race_meets WHERE id = ?")
    .get(meetId) as RaceMeet;
  const races = raceIds.map(
    (id) => db.prepare("SELECT * FROM races WHERE id = ?").get(id) as Race
  );

  return {
    meet,
    races,
    totalRows,
    tritonasRows,
    included,
    newMembers: [...new Set(newMembers)],
    skippedMixed: [...new Set(skippedMixed)],
  };
}

type LegInsertResult = {
  raceId: number;
  totalRows: number;
  tritonasRows: number;
  included: number;
  newMembers: string[];
  skippedMixed: string[];
};

function fillRaceResults(
  raceId: number,
  parsed: { rows: ParsedResultRow[] },
  leader: number,
  distanceType: DistanceType,
  foreign: boolean
): Omit<LegInsertResult, "raceId"> {
  const db = getDb();
  const newMembers: string[] = [];
  const skippedMixed: string[] = [];
  let tritonasRows = 0;
  let included = 0;

  const insertResult = db.prepare(
    `INSERT INTO race_results (
      race_id, place, place_by_sex, bib, raw_name, member_id, club, sex,
      time_seconds, gun_time_seconds, points, included_in_rating, finish_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const categoryConvention = detectCategoryConvention(
    parsed.rows.map((r) => r.category)
  );
  // Only store field sizes / sex places when the file has real protocol places
  // (not a Tritonas-only name+time roster).
  const hasProtocolPlaces = parsed.rows.some(
    (r) => r.place != null && Number.isFinite(r.place)
  );
  const placeBySex = hasProtocolPlaces
    ? computePlaceBySexMap(parsed.rows)
    : new Map<string, number>();
  if (hasProtocolPlaces) {
    const fieldSizes = computeFieldSizes(parsed.rows);
    db.prepare(
      `UPDATE races SET field_size = ?, field_size_m = ?, field_size_f = ? WHERE id = ?`
    ).run(fieldSizes.total, fieldSizes.m, fieldSizes.f, raceId);
  }

  for (const row of parsed.rows) {
    const club = row.club;
    if (!clubMentionsTritonas(club)) continue;
    tritonasRows += 1;

    const sex = normalizeSex(row.sex, row.category, categoryConvention);
    const existing = findMemberByName(row.name);
    let include = false;
    let memberId: number | null = null;

    if (isPureTritonasClub(club)) {
      const before = existing;
      const member = ensureMember(row.name, sex);
      memberId = member.id;
      if (sex) setMemberSex(member.id, sex, { overwrite: true });
      include = true;
      if (!before) newMembers.push(member.display_name);
    } else if (isMixedTritonasClub(club)) {
      if (existing) {
        memberId = existing.id;
        if (sex) setMemberSex(existing.id, sex, { overwrite: true });
        include = true;
      } else {
        skippedMixed.push(`${toDisplayName(row.name)} (${club})`);
      }
    }

    const secs = athleteSeconds(row);
    const finishStatus = row.finishStatus;
    // DNS does not count toward the rating even for Tritonas athletes.
    if (finishStatus === "dns") {
      include = false;
    }

    let points: number | null = null;
    if (include) {
      if (secs != null) {
        points = scoreAthlete(leader, secs, distanceType, foreign);
      } else if (finishStatus === "dnf") {
        points = 0;
      }
    }

    if (include) included += 1;

    const sexPlace = placeBySex.get(normalizeName(row.name)) ?? null;

    insertResult.run(
      raceId,
      row.place,
      sexPlace,
      row.bib,
      row.name,
      memberId,
      club,
      sex,
      row.timeSeconds,
      row.gunTimeSeconds,
      points,
      include ? 1 : 0,
      finishStatus
    );
  }

  return {
    totalRows: parsed.rows.length,
    tritonasRows,
    included,
    newMembers,
    skippedMixed,
  };
}

function insertRaceLeg(input: {
  meetId: number;
  name: string;
  raceDate: string;
  distanceType: DistanceType;
  sourceFilename?: string;
  fileBuffer: Buffer;
  foreign?: boolean;
}): LegInsertResult {
  const parsed = parseResultsFileBuffer(input.fileBuffer);
  const base = basePointsForDistanceId(input.distanceType);
  const leader = parsed.leaderTimeSeconds;

  if (leader == null) {
    throw new Error(
      `Nepavyko rasti lyderio laiko protokole (${input.sourceFilename ?? input.name})`
    );
  }
  assertLeaderMatchesDistance(
    input.distanceType,
    leader,
    input.sourceFilename
  );

  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO races (
        name, race_date, distance_type, base_points, source_filename,
        leader_time_seconds, meet_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.name,
      input.raceDate,
      input.distanceType,
      base,
      input.sourceFilename ?? null,
      leader,
      input.meetId
    );
  const id = Number(info.lastInsertRowid);
  const filled = fillRaceResults(
    id,
    parsed,
    leader,
    input.distanceType,
    !!input.foreign
  );

  return { raceId: id, ...filled };
}

/** Replace an existing race leg's protocol (e.g. wrong OD/SD file was uploaded). */
export function replaceRaceProtocol(
  raceId: number,
  fileBuffer: Buffer,
  sourceFilename?: string
): LegInsertResult {
  const db = getDb();
  const race = db.prepare("SELECT * FROM races WHERE id = ?").get(raceId) as
    | Race
    | undefined;
  if (!race) throw new Error("Varžybos nerastos");

  const parsed = parseResultsFileBuffer(fileBuffer);
  const leader = parsed.leaderTimeSeconds;
  if (leader == null) {
    throw new Error(
      `Nepavyko rasti lyderio laiko protokole (${sourceFilename ?? race.name})`
    );
  }
  assertLeaderMatchesDistance(race.distance_type, leader, sourceFilename);

  return db.transaction(() => {
    db.prepare("DELETE FROM race_results WHERE race_id = ?").run(raceId);
    db.prepare(
      `UPDATE races
       SET source_filename = ?, leader_time_seconds = ?
       WHERE id = ?`
    ).run(sourceFilename ?? null, leader, raceId);

    const meet = race.meet_id
      ? (db
          .prepare("SELECT foreign_start FROM race_meets WHERE id = ?")
          .get(race.meet_id) as { foreign_start: number } | undefined)
      : undefined;
    const filled = fillRaceResults(
      raceId,
      parsed,
      leader,
      race.distance_type,
      !!meet?.foreign_start
    );
    return { raceId, ...filled };
  })();
}

export function importRace(input: ImportRaceInput): ImportRaceResult {
  const db = getDb();
  let meetId = input.meetId ?? null;

  const result = db.transaction(() => {
    if (meetId == null) {
      const meetInfo = db
        .prepare("INSERT INTO race_meets (name, meet_date) VALUES (?, ?)")
        .run(
          input.name.replace(/\s+(OD|SD|OL|Sprint|Half|Full)$/i, "").trim() || input.name,
          input.raceDate
        );
      meetId = Number(meetInfo.lastInsertRowid);
    }

    return insertRaceLeg({
      meetId,
      name: input.name,
      raceDate: input.raceDate,
      distanceType: input.distanceType,
      sourceFilename: input.sourceFilename,
      fileBuffer: input.fileBuffer,
    });
  })();

  const race = db.prepare("SELECT * FROM races WHERE id = ?").get(result.raceId) as Race;

  return {
    race,
    totalRows: result.totalRows,
    tritonasRows: result.tritonasRows,
    included: result.included,
    newMembers: result.newMembers,
    skippedMixed: result.skippedMixed,
  };
}

export function deleteRace(raceId: number) {
  const db = getDb();
  const row = db
    .prepare("SELECT meet_id FROM races WHERE id = ?")
    .get(raceId) as { meet_id: number | null } | undefined;
  db.prepare("DELETE FROM races WHERE id = ?").run(raceId);
  if (row?.meet_id != null) {
    const left = db
      .prepare("SELECT COUNT(*) AS c FROM races WHERE meet_id = ?")
      .get(row.meet_id) as { c: number };
    if (left.c === 0) {
      db.prepare("DELETE FROM race_meets WHERE id = ?").run(row.meet_id);
    }
  }
}

export function deleteMeet(meetId: number) {
  const db = getDb();
  // CASCADE from meet_id — but FK may not cascade if added via ALTER on SQLite
  db.transaction(() => {
    db.prepare("DELETE FROM races WHERE meet_id = ?").run(meetId);
    db.prepare("DELETE FROM race_meets WHERE id = ?").run(meetId);
  })();
}

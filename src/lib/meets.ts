import { getDb, DistanceType, Race, RaceMeet } from "./db";
import { ensureMember } from "./members";
import {
  classifyFinishStatus,
  parseTimeToSeconds,
} from "./scoring";
import {
  basePointsForDistanceId,
  distanceSetting,
  scoreAthlete,
} from "./settings";

export type MeetWithRaces = RaceMeet & { races: Race[] };

export type ManualParticipantInput = {
  memberId?: number | null;
  name?: string;
  place?: number | null;
  timeText: string;
  club?: string;
};

export type ManualLegInput = {
  distanceType: DistanceType;
  leaderTimeText: string;
  /** Total finishers in the full field (optional; useful with places). */
  fieldSize?: number | null;
  participants?: ManualParticipantInput[];
};

export type CreateManualMeetInput = {
  name: string;
  meetDate: string;
  /** Foreign start — at most one counts in best-3. */
  foreignStart?: boolean;
  legs: ManualLegInput[];
};

export type CreateManualMeetResult = {
  meetId: number;
  raceIds: number[];
  included: number;
};

function legSuffix(distanceType: DistanceType): string {
  const fromSettings = distanceSetting(distanceType);
  if (fromSettings) return fromSettings.shortLabel;
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

export function listMeets(year?: number): RaceMeet[] {
  const db = getDb();
  if (year != null) {
    return db
      .prepare(
        `SELECT * FROM race_meets
         WHERE substr(meet_date, 1, 4) = ?
         ORDER BY meet_date ASC, id ASC`
      )
      .all(String(year)) as RaceMeet[];
  }
  return db
    .prepare("SELECT * FROM race_meets ORDER BY meet_date ASC, id ASC")
    .all() as RaceMeet[];
}

export function getMeet(id: number): RaceMeet | undefined {
  return getDb()
    .prepare("SELECT * FROM race_meets WHERE id = ?")
    .get(id) as RaceMeet | undefined;
}

export function getMeetRaces(meetId: number): Race[] {
  return getDb()
    .prepare(
      `SELECT * FROM races WHERE meet_id = ?
       ORDER BY
         CASE distance_type
           WHEN 'olympic' THEN 1
           WHEN 'sprint' THEN 2
           WHEN 'half' THEN 3
           WHEN 'full' THEN 4
           ELSE 5
         END,
         id ASC`
    )
    .all(meetId) as Race[];
}

export function listMeetsWithRaces(year?: number): MeetWithRaces[] {
  const meets = listMeets(year);
  return meets.map((m) => ({
    ...m,
    races: getMeetRaces(m.id),
  }));
}

export function updateMeet(
  meetId: number,
  input: { name: string; meetDate: string; foreignStart?: boolean }
): RaceMeet {
  const db = getDb();
  const name = input.name.trim();
  const foreign =
    input.foreignStart === undefined
      ? null
      : input.foreignStart
        ? 1
        : 0;
  if (foreign == null) {
    db.prepare("UPDATE race_meets SET name = ?, meet_date = ? WHERE id = ?").run(
      name,
      input.meetDate,
      meetId
    );
  } else {
    db.prepare(
      "UPDATE race_meets SET name = ?, meet_date = ?, foreign_start = ? WHERE id = ?"
    ).run(name, input.meetDate, foreign, meetId);
  }
  // Keep race_date in sync for ranking / display
  db.prepare("UPDATE races SET race_date = ? WHERE meet_id = ?").run(
    input.meetDate,
    meetId
  );
  // Keep per-distance race names in sync (used in athlete stats, meet detail).
  const races = getMeetRaces(meetId);
  const rename = db.prepare("UPDATE races SET name = ? WHERE id = ?");
  for (const race of races) {
    rename.run(legRaceName(name, race.distance_type), race.id);
  }
  return getMeet(meetId)!;
}

/** Create a meet + race legs without a protocol file (manual entry). */
export function createManualMeet(
  input: CreateManualMeetInput
): CreateManualMeetResult {
  const name = input.name.trim();
  if (!name) throw new Error("Įveskite varžybų pavadinimą");
  if (!input.meetDate) throw new Error("Įveskite datą");
  if (!input.legs.length) throw new Error("Pridėkite bent vieną distanciją");

  const db = getDb();
  const raceIds: number[] = [];
  let included = 0;
  let meetId = 0;

  db.transaction(() => {
    const meetInfo = db
      .prepare(
        "INSERT INTO race_meets (name, meet_date, foreign_start) VALUES (?, ?, ?)"
      )
      .run(name, input.meetDate, input.foreignStart ? 1 : 0);
    meetId = Number(meetInfo.lastInsertRowid);

    const insertRace = db.prepare(
      `INSERT INTO races (
        name, race_date, distance_type, base_points, source_filename,
        leader_time_seconds, meet_id, field_size
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const insertResult = db.prepare(
      `INSERT INTO race_results (
        race_id, place, bib, raw_name, member_id, club, sex,
        time_seconds, gun_time_seconds, points, included_in_rating, finish_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
    );

    for (const [legIndex, leg] of input.legs.entries()) {
      const leader = parseTimeToSeconds(leg.leaderTimeText);
      if (leader == null || leader <= 0) {
        throw new Error(
          `Distancija ${legIndex + 1}: neteisingas nugalėtojo laikas (pvz. 1:08:19.0)`
        );
      }

      const base = basePointsForDistanceId(leg.distanceType);
      const fieldSize =
        leg.fieldSize != null &&
        Number.isFinite(leg.fieldSize) &&
        leg.fieldSize > 0
          ? Math.round(leg.fieldSize)
          : null;
      const raceInfo = insertRace.run(
        legRaceName(name, leg.distanceType),
        input.meetDate,
        leg.distanceType,
        base,
        "rankinis įvedimas",
        leader,
        meetId,
        fieldSize
      );
      const raceId = Number(raceInfo.lastInsertRowid);
      raceIds.push(raceId);

      const seenMembers = new Set<number>();
      for (const [pIndex, p] of (leg.participants ?? []).entries()) {
        if (!p.timeText?.trim() && p.place == null && !p.name?.trim() && p.memberId == null) {
          continue;
        }

        let member;
        if (p.memberId != null) {
          member = db
            .prepare("SELECT * FROM members WHERE id = ?")
            .get(p.memberId) as { id: number; display_name: string; sex: string | null } | undefined;
          if (!member) {
            throw new Error(
              `Distancija ${legIndex + 1}, dalyvis ${pIndex + 1}: narys nerastas`
            );
          }
        } else if (p.name?.trim()) {
          member = ensureMember(p.name.trim());
        } else {
          throw new Error(
            `Distancija ${legIndex + 1}, dalyvis ${pIndex + 1}: pasirinkite narį arba įveskite vardą`
          );
        }

        if (seenMembers.has(member.id)) {
          throw new Error(
            `Distancija ${legIndex + 1}: dalyvis „${member.display_name}“ kartojasi`
          );
        }
        seenMembers.add(member.id);

        const status = classifyFinishStatus(p.timeText);
        if (status === "dns") {
          throw new Error(
            `Distancija ${legIndex + 1}, ${member.display_name}: DNS į reitingą neįtraukiamas`
          );
        }
        const timeSeconds =
          status === "dnf" ? null : parseTimeToSeconds(p.timeText);
        if (status !== "dnf" && (timeSeconds == null || timeSeconds <= 0)) {
          throw new Error(
            `Distancija ${legIndex + 1}, ${member.display_name}: neteisingas laikas (arba DNF)`
          );
        }

        const points =
          status === "dnf"
            ? 0
            : scoreAthlete(
                leader,
                timeSeconds!,
                leg.distanceType,
                !!input.foreignStart
              );
        const club = (p.club?.trim() || "TRItonas").slice(0, 200);

        insertResult.run(
          raceId,
          p.place ?? null,
          `manual-${raceId}-${member.id}`,
          member.display_name,
          member.id,
          club,
          member.sex,
          timeSeconds,
          null,
          points,
          status === "dnf" ? "dnf" : "ok"
        );
        included += 1;
      }
    }
  })();

  return { meetId, raceIds, included };
}

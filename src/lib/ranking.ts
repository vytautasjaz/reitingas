import { getDb, Race } from "./db";
import { Sex } from "./gender";
import { shortDistance } from "./distances";
import { getMeetRaces, listMeets } from "./meets";
import {
  averagePoints,
  bestNSumWithForeignLimit,
  type ScoredResult,
} from "./scoring";

export { shortDistance };

export type StandingRaceDetail = {
  raceId: number;
  /** Overall place in the full race protocol. */
  place: number | null;
  /** Total finishers in the full race protocol. */
  placeTotal: number | null;
  /** Place among same sex in the full race protocol. */
  placeBySex: number | null;
  /** Total same-sex finishers in the full race protocol. */
  placeBySexTotal: number | null;
  timeSeconds: number | null;
  points: number;
  /** ok finish, dnf (0 pts), or null when unknown. */
  finishStatus: "ok" | "dnf" | "dns" | null;
};

export type StandingRow = {
  place: number;
  memberId: number;
  displayName: string;
  sex: Sex | null;
  raceCount: number;
  eventCount: number;
  totalPoints: number;
  average: number | null;
  best3Sum: number;
  pointsByRace: Record<number, number | null>;
  /** Protocol place/time/points per race (only included rating results). */
  detailsByRace: Record<number, StandingRaceDetail>;
  /** Positive = climbed vs previous event day; negative = dropped. */
  change: number | null;
  isNew: boolean;
  /** Place after each event day in the active filter (null = dar nebuvo reitinge). */
  placeHistory: Array<number | null>;
  /** Place in overall (all sexes) ranking after each event. */
  placeHistoryOverall: Array<number | null>;
  /** Place within same-sex ranking after each event (empty if sex unknown). */
  placeHistoryBySex: Array<number | null>;
};

export type SexFilter = "all" | Sex;

export type RaceEvent = {
  id: number;
  date: string;
  races: Race[];
  label: string;
  foreignStart: boolean;
};

export function listRaces(year?: number): Race[] {
  const db = getDb();
  if (year != null) {
    return db
      .prepare(
        `SELECT * FROM races
         WHERE substr(race_date, 1, 4) = ?
         ORDER BY race_date ASC, id ASC`
      )
      .all(String(year)) as Race[];
  }
  return db
    .prepare("SELECT * FROM races ORDER BY race_date ASC, id ASC")
    .all() as Race[];
}

/** One meet = one ranking event (OD + SD share a column / stage). */
export function groupRacesIntoEvents(races?: Race[], year?: number): RaceEvent[] {
  const allRaces = races ?? listRaces(year);

  // Production: use race_meets table when caller didn't pass an explicit list.
  if (races === undefined) {
    const meets = listMeets(year);
    if (meets.length > 0) {
      return meets
        .map((m) => {
          const meetRaces = getMeetRaces(m.id);
          return {
            id: m.id,
            date: m.meet_date,
            races: meetRaces,
            label: formatMeetLabel(m.name, meetRaces),
            foreignStart: !!m.foreign_start,
          };
        })
        .filter((e) => e.races.length > 0);
    }
  }

  const foreignMeetIds = loadForeignMeetIds();

  // Group by meet_id when present (tests / partial lists)
  if (allRaces.some((r) => r.meet_id != null)) {
    const byMeet = new Map<number, Race[]>();
    for (const race of allRaces) {
      if (race.meet_id == null) continue;
      const list = byMeet.get(race.meet_id) ?? [];
      list.push(race);
      byMeet.set(race.meet_id, list);
    }
    return [...byMeet.entries()]
      .map(([id, meetRaces]) => {
        const sorted = [...meetRaces].sort(
          (a, b) => distanceOrder(a) - distanceOrder(b)
        );
        return {
          id,
          date: sorted[0].race_date,
          races: sorted,
          label: formatMeetLabel(sorted[0].name, sorted),
          foreignStart: foreignMeetIds.has(id),
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  }

  // Legacy: same calendar day = one event
  const byDate = new Map<string, Race[]>();
  for (const race of allRaces) {
    const list = byDate.get(race.race_date) ?? [];
    list.push(race);
    byDate.set(race.race_date, list);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayRaces], i) => ({
      id: -(i + 1),
      date,
      races: dayRaces,
      label: formatMeetLabel(dayRaces[0]?.name ?? date, dayRaces),
      foreignStart: false,
    }));
}

function loadForeignMeetIds(): Set<number> {
  try {
    const rows = getDb()
      .prepare("SELECT id FROM race_meets WHERE foreign_start = 1")
      .all() as Array<{ id: number }>;
    return new Set(rows.map((r) => r.id));
  } catch {
    return new Set();
  }
}

function distanceOrder(race: Race): number {
  if (race.distance_type === "olympic") return 1;
  if (race.distance_type === "sprint") return 2;
  if (race.distance_type === "half") return 3;
  if (race.distance_type === "full") return 4;
  return 5;
}

function formatMeetLabel(name: string, races: Race[]): string {
  const base =
    name.replace(/\s+(OD|SD|OL|Sprint|Half|Full)$/i, "").trim() || name;
  if (races.length <= 1) return base;
  return `${base} (${races.map((r) => shortDistance(r)).join("+")})`;
}

export function getRace(id: number): Race | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM races WHERE id = ?").get(id) as Race | undefined;
}

export function getRaceResults(raceId: number) {
  const db = getDb();
  return db
    .prepare(
      `SELECT rr.*, m.display_name AS member_display_name, COALESCE(rr.sex, m.sex) AS resolved_sex
       FROM race_results rr
       LEFT JOIN members m ON m.id = rr.member_id
       WHERE rr.race_id = ?
       ORDER BY
         CASE WHEN rr.included_in_rating = 1 THEN 0 ELSE 1 END,
         CASE WHEN rr.points IS NULL THEN 1 ELSE 0 END,
         rr.points DESC,
         CASE WHEN rr.place IS NULL THEN 1 ELSE 0 END,
         rr.place ASC`
    )
    .all(raceId) as Array<{
    id: number;
    race_id: number;
    place: number | null;
    bib: string | null;
    raw_name: string;
    member_id: number | null;
    club: string | null;
    sex: Sex | null;
    resolved_sex: Sex | null;
    time_seconds: number | null;
    gun_time_seconds: number | null;
    points: number | null;
    included_in_rating: number;
    member_display_name: string | null;
  }>;
}

type MemberRow = {
  id: number;
  display_name: string;
  sex: Sex | null;
};

type ResultRow = {
  member_id: number;
  race_id: number;
  points: number;
  place: number | null;
  place_by_sex: number | null;
  time_seconds: number | null;
  gun_time_seconds: number | null;
  sex: Sex | null;
  field_size: number | null;
  field_size_m: number | null;
  field_size_f: number | null;
  finish_status: "ok" | "dnf" | "dns" | null;
};

function loadMembers(): MemberRow[] {
  return getDb()
    .prepare("SELECT id, display_name, sex FROM members WHERE active = 1")
    .all() as MemberRow[];
}

function loadResults(year?: number): ResultRow[] {
  const db = getDb();
  // Include DNF (0 points). DNS is stored with included_in_rating = 0.
  const where = `rr.included_in_rating = 1
           AND rr.member_id IS NOT NULL
           AND rr.points IS NOT NULL
           AND rr.points >= 0
           AND COALESCE(rr.finish_status, 'ok') != 'dns'`;
  const select = `SELECT rr.member_id, rr.race_id, rr.points, rr.place, rr.place_by_sex,
                rr.time_seconds, rr.gun_time_seconds,
                COALESCE(rr.sex, m.sex) AS sex,
                r.field_size, r.field_size_m, r.field_size_f,
                rr.finish_status
         FROM race_results rr
         JOIN races r ON r.id = rr.race_id
         LEFT JOIN members m ON m.id = rr.member_id
         WHERE ${where}`;
  if (year != null) {
    return db
      .prepare(`${select} AND substr(r.race_date, 1, 4) = ?`)
      .all(String(year)) as ResultRow[];
  }
  return db.prepare(select).all() as ResultRow[];
}

function standingsFromResults(
  members: MemberRow[],
  races: Race[],
  results: ResultRow[],
  allowedRaceIds: Set<number>,
  sexFilter: SexFilter,
  bestN: number
): StandingRow[] {
  const byMember = new Map<
    number,
    {
      scores: ScoredResult[];
      pointsByRace: Record<number, number | null>;
      detailsByRace: Record<number, StandingRaceDetail>;
      meetKeys: Set<string>;
    }
  >();

  const raceById = new Map(races.map((r) => [r.id, r]));
  const foreignMeetIds = loadForeignMeetIds();

  for (const m of members) {
    if (sexFilter !== "all" && m.sex !== sexFilter) continue;
    const pointsByRace: Record<number, number | null> = {};
    for (const r of races) {
      if (allowedRaceIds.has(r.id)) pointsByRace[r.id] = null;
    }
    byMember.set(m.id, {
      scores: [],
      pointsByRace,
      detailsByRace: {},
      meetKeys: new Set(),
    });
  }

  for (const row of results) {
    if (!allowedRaceIds.has(row.race_id)) continue;
    const bucket = byMember.get(row.member_id);
    if (!bucket) continue;
    const race = raceById.get(row.race_id);
    const foreign =
      race?.meet_id != null ? foreignMeetIds.has(race.meet_id) : false;
    // DNF (0) counts as a stage but not toward best-3 / average positives.
    if (row.points > 0) bucket.scores.push({ points: row.points, foreign });
    bucket.pointsByRace[row.race_id] = row.points;
    const sexTotal =
      row.sex === "F"
        ? row.field_size_f
        : row.sex === "M"
          ? row.field_size_m
          : null;
    const finishStatus =
      row.finish_status ??
      (row.points === 0 && row.time_seconds == null && row.gun_time_seconds == null
        ? "dnf"
        : "ok");
    bucket.detailsByRace[row.race_id] = {
      raceId: row.race_id,
      place: row.place,
      placeTotal: row.field_size,
      placeBySex: row.place_by_sex,
      placeBySexTotal: sexTotal,
      timeSeconds: row.time_seconds ?? row.gun_time_seconds,
      points: row.points,
      finishStatus,
    };
    if (race) {
      bucket.meetKeys.add(
        race.meet_id != null ? `m:${race.meet_id}` : `d:${race.race_date}`
      );
    }
  }

  const standings: StandingRow[] = [];

  for (const m of members) {
    if (sexFilter !== "all" && m.sex !== sexFilter) continue;
    const bucket = byMember.get(m.id);
    // Include athletes with only DNF stages (eventCount > 0, best3 = 0).
    if (!bucket || bucket.meetKeys.size === 0) continue;

    const pointValues = bucket.scores.map((s) => s.points);
    standings.push({
      place: 0,
      memberId: m.id,
      displayName: m.display_name,
      sex: m.sex,
      raceCount: Object.values(bucket.detailsByRace).length,
      eventCount: bucket.meetKeys.size,
      totalPoints: pointValues.reduce((a, b) => a + b, 0),
      average: averagePoints(pointValues),
      best3Sum: bestNSumWithForeignLimit(bucket.scores, bestN),
      pointsByRace: bucket.pointsByRace,
      detailsByRace: bucket.detailsByRace,
      change: null,
      isNew: false,
      placeHistory: [],
      placeHistoryOverall: [],
      placeHistoryBySex: [],
    });
  }

  standings.sort((a, b) => {
    if (b.best3Sum !== a.best3Sum) return b.best3Sum - a.best3Sum;
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    return a.displayName.localeCompare(b.displayName, "lt");
  });

  standings.forEach((row, i) => {
    row.place = i + 1;
  });

  return standings;
}

function buildCumulativeSnapshots(
  members: MemberRow[],
  races: Race[],
  results: ResultRow[],
  events: RaceEvent[],
  sexFilter: SexFilter,
  bestN: number
): StandingRow[][] {
  const snapshots: StandingRow[][] = [];
  const cumulativeIds = new Set<number>();
  for (const event of events) {
    for (const r of event.races) cumulativeIds.add(r.id);
    snapshots.push(
      standingsFromResults(
        members,
        races,
        results,
        new Set(cumulativeIds),
        sexFilter,
        bestN
      )
    );
  }
  return snapshots;
}

function historyFromSnapshots(
  snapshots: StandingRow[][],
  memberId: number
): Array<number | null> {
  return snapshots.map((snap) => {
    const found = snap.find((s) => s.memberId === memberId);
    return found ? found.place : null;
  });
}

/**
 * Full standings with place change vs previous *event day*
 * (all races on the same date count as one stage).
 */
export function computeStandings(
  bestN = 3,
  sexFilter: SexFilter = "all",
  year?: number
): StandingRow[] {
  const races = listRaces(year);
  const events = groupRacesIntoEvents(races, year);
  const members = loadMembers();
  const results = loadResults(year);

  if (events.length === 0) return [];

  const snapshots = buildCumulativeSnapshots(
    members,
    races,
    results,
    events,
    sexFilter,
    bestN
  );
  const snapshotsOverall = buildCumulativeSnapshots(
    members,
    races,
    results,
    events,
    "all",
    bestN
  );
  const snapshotsMen = buildCumulativeSnapshots(
    members,
    races,
    results,
    events,
    "M",
    bestN
  );
  const snapshotsWomen = buildCumulativeSnapshots(
    members,
    races,
    results,
    events,
    "F",
    bestN
  );

  const current = snapshots[snapshots.length - 1];
  const previous = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null;
  const prevPlace = new Map(previous?.map((s) => [s.memberId, s.place]) ?? []);

  // Rebuild pointsByRace for ALL races (not only cumulative filter display)
  const full = standingsFromResults(
    members,
    races,
    results,
    new Set(races.map((r) => r.id)),
    sexFilter,
    bestN
  );
  const fullById = new Map(full.map((s) => [s.memberId, s]));

  for (const row of current) {
    const fullRow = fullById.get(row.memberId);
    if (fullRow) {
      row.pointsByRace = fullRow.pointsByRace;
      row.detailsByRace = fullRow.detailsByRace;
      row.raceCount = fullRow.raceCount;
      row.eventCount = fullRow.eventCount;
      row.totalPoints = fullRow.totalPoints;
      row.average = fullRow.average;
      row.best3Sum = fullRow.best3Sum;
    }

    row.placeHistory = historyFromSnapshots(snapshots, row.memberId);
    row.placeHistoryOverall = historyFromSnapshots(
      snapshotsOverall,
      row.memberId
    );
    row.placeHistoryBySex =
      row.sex === "M"
        ? historyFromSnapshots(snapshotsMen, row.memberId)
        : row.sex === "F"
          ? historyFromSnapshots(snapshotsWomen, row.memberId)
          : [];

    if (!previous) {
      row.change = null;
      row.isNew = events.length === 1;
      continue;
    }

    const prev = prevPlace.get(row.memberId);
    if (prev == null) {
      row.isNew = true;
      row.change = null;
    } else {
      row.isNew = false;
      // Higher place number = worse; positive change = climbed
      row.change = prev - row.place;
    }
  }

  return current;
}

export function countStandingsBySex(year?: number): {
  all: number;
  M: number;
  F: number;
} {
  const all = computeStandings(3, "all", year);
  return {
    all: all.length,
    M: all.filter((s) => s.sex === "M").length,
    F: all.filter((s) => s.sex === "F").length,
  };
}

export function topStandings(
  sex: Sex,
  limit?: number,
  year?: number
): StandingRow[] {
  const rows = computeStandings(3, sex, year);
  return limit == null ? rows : rows.slice(0, limit);
}

export function listEventDates(year?: number): string[] {
  return groupRacesIntoEvents(undefined, year).map((e) => e.date);
}

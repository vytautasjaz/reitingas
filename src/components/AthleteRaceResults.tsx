import { formatDateLt } from "@/lib/dates";
import { shortDistance } from "@/lib/distances";
import type { RaceEvent, StandingRow } from "@/lib/ranking";
import { formatSeconds } from "@/lib/time-format";

const BEST_N = 3;

function meetDisplayName(ev: RaceEvent, raceName: string): string {
  const fromEvent = ev.label
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/\s+(OD|SD|OL|Sprint|Half|Full)$/i, "")
    .trim();
  if (fromEvent) return fromEvent;
  return (
    raceName.replace(/\s+(OD|SD|OL|Sprint|Half|Full)$/i, "").trim() || raceName
  );
}

function bestRaceIdSet(
  results: Array<{ race: { id: number }; detail: { points: number } }>,
  n = BEST_N
): Set<number> {
  return new Set(
    [...results]
      .sort((a, b) => b.detail.points - a.detail.points)
      .slice(0, n)
      .map((r) => r.race.id)
  );
}

function formatPlace(place: number | null, total: number | null): string {
  if (place == null) return "—";
  if (total != null) return `${place}/${total}`;
  return String(place);
}

export function collectAthleteResults(row: StandingRow, events: RaceEvent[]) {
  return events.flatMap((ev) =>
    ev.races
      .map((race) => {
        const detail = row.detailsByRace?.[race.id];
        if (!detail) return null;
        return { ev, race, detail };
      })
      .filter((x): x is NonNullable<typeof x> => x != null)
  );
}

export function AthleteRaceResults({
  row,
  events,
  className,
}: {
  row: StandingRow;
  events: RaceEvent[];
  className?: string;
}) {
  const results = collectAthleteResults(row, events);
  const bestIds = bestRaceIdSet(results);
  const sexPlaceHeader =
    row.sex === "F"
      ? "Tarp moterų"
      : row.sex === "M"
        ? "Tarp vyrų"
        : "Pagal lytį";

  if (results.length === 0) {
    return (
      <div className="muted" style={{ fontSize: "0.85rem" }}>
        Nėra varžybų taškų.
      </div>
    );
  }

  return (
    <div className={`athlete-results-wrap${className ? ` ${className}` : ""}`}>
      <table className="athlete-results-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Varžybos</th>
            <th>Distancija</th>
            <th>{sexPlaceHeader}</th>
            <th>Bendroje įskaitoje</th>
            <th>Rezultatas</th>
            <th>Taškai</th>
          </tr>
        </thead>
        <tbody>
          {results.map(({ ev, race, detail }) => {
            const isBest = bestIds.has(race.id);
            const label = meetDisplayName(ev, race.name);
            return (
              <tr
                key={race.id}
                className={isBest ? "is-best" : undefined}
              >
                <td className="athlete-results-date">
                  {formatDateLt(ev.date)}
                </td>
                <td className="athlete-results-name" title={label}>
                  {label}
                </td>
                <td className="athlete-results-dist">
                  {shortDistance(race)}
                </td>
                <td className="athlete-results-place">
                  {formatPlace(detail.placeBySex, detail.placeBySexTotal)}
                </td>
                <td className="athlete-results-place">
                  {formatPlace(detail.place, detail.placeTotal)}
                </td>
                <td className="athlete-results-time font-mono">
                  {detail.finishStatus === "dnf"
                    ? "DNF"
                    : formatSeconds(detail.timeSeconds) || "—"}
                </td>
                <td className="athlete-results-points font-mono">
                  {detail.points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

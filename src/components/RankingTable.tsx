"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Race } from "@/lib/db";
import { sexLabel, sexTitle } from "@/lib/gender";
import { formatDateLt } from "@/lib/dates";
import { shortDistance } from "@/lib/distances";
import type { RaceEvent, StandingRow } from "@/lib/ranking";
import { AthleteRaceResults } from "./AthleteRaceResults";
import { ChangeIndicator } from "./ChangeIndicator";
import { PlaceHistoryChart } from "./PlaceHistoryChart";

const STORAGE_KEY = "tritonas-ranking-show-races";

type SortKey =
  | "place"
  | "change"
  | "name"
  | "eventCount"
  | "best3"
  | `event:${number}`;

type SortDir = "asc" | "desc";

function bestEventPoints(row: StandingRow, event: RaceEvent): number | null {
  let best: number | null = null;
  for (const race of event.races) {
    const pts = row.pointsByRace[race.id];
    if (pts == null) continue;
    if (best == null || pts > best) best = pts;
  }
  return best;
}

function compareNullableNumber(
  a: number | null,
  b: number | null,
  dir: SortDir,
  emptyLast = true
): number {
  if (a == null && b == null) return 0;
  if (a == null) return emptyLast ? 1 : -1;
  if (b == null) return emptyLast ? -1 : 1;
  return dir === "asc" ? a - b : b - a;
}

function sortStandings(
  rows: StandingRow[],
  key: SortKey,
  dir: SortDir,
  events: RaceEvent[]
): StandingRow[] {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    let cmp = 0;
    if (key === "place") {
      cmp = compareNullableNumber(a.place, b.place, dir, false);
    } else if (key === "change") {
      const av = a.isNew ? null : a.change;
      const bv = b.isNew ? null : b.change;
      // Higher change = climbed more; default desc wants climbers first
      cmp = compareNullableNumber(av, bv, dir);
    } else if (key === "name") {
      cmp = a.displayName.localeCompare(b.displayName, "lt");
      if (dir === "desc") cmp = -cmp;
    } else if (key === "eventCount") {
      cmp = compareNullableNumber(a.eventCount, b.eventCount, dir);
    } else if (key === "best3") {
      cmp = compareNullableNumber(a.best3Sum, b.best3Sum, dir);
    } else if (key.startsWith("event:")) {
      const eventId = Number(key.slice(6));
      const event = events.find((e) => e.id === eventId);
      const av = event ? bestEventPoints(a, event) : null;
      const bv = event ? bestEventPoints(b, event) : null;
      cmp = compareNullableNumber(av, bv, dir);
    }
    if (cmp !== 0) return cmp;
    // Stable tie-breakers
    if (a.best3Sum !== b.best3Sum) return b.best3Sum - a.best3Sum;
    return a.displayName.localeCompare(b.displayName, "lt");
  });
  return sorted;
}

function SortTh({
  label,
  title,
  sortKey,
  activeKey,
  dir,
  onSort,
  className,
  children,
}: {
  label?: string;
  title?: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
  children?: React.ReactNode;
}) {
  const active = activeKey === sortKey;
  return (
    <th
      className={`sortable-th${active ? " sorted" : ""}${className ? ` ${className}` : ""}`}
      title={title}
    >
      <button
        type="button"
        className="sort-btn"
        onClick={() => onSort(sortKey)}
        aria-pressed={active}
      >
        <span className="sort-btn-label">{children ?? label}</span>
        <span className="sort-indicator" aria-hidden>
          {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}

export function RankingTable({
  standings,
  events,
}: {
  standings: StandingRow[];
  races?: Race[];
  events: RaceEvent[];
}) {
  const [showRaces, setShowRaces] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("place");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // Default: expanded. Only collapse when user previously chose so.
      if (raw === "0") setShowRaces(false);
      else setShowRaces(true);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  function toggleRaces() {
    setShowRaces((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function onSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    // Sensible defaults: places ascending, scores/stages descending
    if (key === "place" || key === "name") setSortDir("asc");
    else setSortDir("desc");
  }

  const sorted = useMemo(
    () => sortStandings(standings, sortKey, sortDir, events),
    [standings, sortKey, sortDir, events]
  );

  if (standings.length === 0) {
    return (
      <div className="card card-pad muted">
        Dar nėra rezultatų šiam filtrui.{" "}
        <Link href="/races" className="text-link">
          Įkelkite varžybas
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="ranking-block">
      <div className="ranking-toolbar">
        <span className="ranking-toolbar-hint">
          Spauskite dalyvio eilutę statistikai · antraštę — rikiavimui
          {showRaces
            ? ` · ${events.length} varžybos (OD/SD toje pačioje kolonoje)`
            : " · kompaktiškas vaizdas"}
        </span>
        <button
          type="button"
          className={`btn text-sm ${showRaces ? "btn-primary" : "btn-ghost"}`}
          onClick={toggleRaces}
          aria-pressed={showRaces}
          disabled={!hydrated && events.length === 0}
        >
          {showRaces ? "Sutraukti varžybas" : "Išskleisti varžybas"}
        </button>
      </div>

      <div className="card table-wrap">
        <table className={`ranking ranking-compact${showRaces ? " ranking-wide" : ""}`}>
          <thead>
            <tr>
              <SortTh
                sortKey="place"
                activeKey={sortKey}
                dir={sortDir}
                onSort={onSort}
                className="col-narrow sticky-col sticky-1"
                title="Reitingo vieta"
                label="Nr."
              />
              <SortTh
                sortKey="change"
                activeKey={sortKey}
                dir={sortDir}
                onSort={onSort}
                className="col-narrow sticky-col sticky-2"
                title="Pokytis nuo praėjusio etapo"
                label="Δ"
              />
              <SortTh
                sortKey="name"
                activeKey={sortKey}
                dir={sortDir}
                onSort={onSort}
                className="sticky-col sticky-3"
                title="Dalyvis"
                label="Dalyvis"
              />
              {showRaces &&
                events.map((ev) => (
                  <SortTh
                    key={ev.id}
                    sortKey={`event:${ev.id}`}
                    activeKey={sortKey}
                    dir={sortDir}
                    onSort={onSort}
                    className="race-col meet-col"
                    title={`${ev.label} — rikiuoti pagal geriausią rezultata šiame etape`}
                  >
                    <span className="race-col-stack">
                      <span className="race-col-name">{shortMeetName(ev)}</span>
                      <span className="race-col-meta">
                        {formatDateLt(ev.date)}
                        {ev.races.length > 1
                          ? ` · ${ev.races.map((r) => shortDistance(r)).join("+")}`
                          : ev.races[0]
                            ? ` · ${shortDistance(ev.races[0])}`
                            : ""}
                      </span>
                    </span>
                  </SortTh>
                ))}
              <SortTh
                sortKey="eventCount"
                activeKey={sortKey}
                dir={sortDir}
                onSort={onSort}
                className="col-narrow"
                title="Dalyvautų etapų skaičius"
                label="Et."
              />
              <SortTh
                sortKey="best3"
                activeKey={sortKey}
                dir={sortDir}
                onSort={onSort}
                className="col-narrow"
                title="3 geriausių suma"
                label="Top 3"
              />
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const rowClass =
                row.sex === "M" ? "row-male" : row.sex === "F" ? "row-female" : "";
              const open = expandedId === row.memberId;
              return (
                <StandingBlock
                  key={row.memberId}
                  row={row}
                  events={events}
                  rowClass={rowClass}
                  showRaces={showRaces}
                  open={open}
                  onToggle={() =>
                    setExpandedId((id) => (id === row.memberId ? null : row.memberId))
                  }
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StandingBlock({
  row,
  events,
  rowClass,
  showRaces,
  open,
  onToggle,
}: {
  row: StandingRow;
  events: RaceEvent[];
  rowClass: string;
  showRaces: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const detailColSpan = 4 + (showRaces ? events.length : 0);

  return (
    <>
      <tr
        className={`ranking-athlete-row ${rowClass}${open ? " row-open" : ""}`}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        tabIndex={0}
        role="button"
        aria-expanded={open}
        aria-label={`${row.displayName}: ${open ? "sutraukti" : "rodyti"} statistiką`}
      >
        <td className="col-place sticky-col sticky-1">{row.place}</td>
        <td className="sticky-col sticky-2">
          <ChangeIndicator change={row.change} isNew={row.isNew} compact />
        </td>
        <td className="sticky-col sticky-3">
          <span className="athlete-cell">
            <span
              className={`sex-mark sex-${row.sex === "F" ? "f" : row.sex === "M" ? "m" : "u"}`}
              title={sexTitle(row.sex)}
            >
              {sexLabel(row.sex)}
            </span>
            <span className="athlete-name">{row.displayName}</span>
          </span>
        </td>
        {showRaces &&
          events.map((ev) => (
            <td key={ev.id} className="race-col meet-col">
              <MeetCell row={row} event={ev} />
            </td>
          ))}
        <td className="col-narrow">{row.eventCount}</td>
        <td className="font-mono accent-cell col-narrow">{row.best3Sum}</td>
      </tr>
      {open && (
        <tr className="detail-row">
          <td colSpan={detailColSpan}>
            <RaceBreakdown row={row} events={events} />
          </td>
        </tr>
      )}
    </>
  );
}

function MeetCell({ row, event }: { row: StandingRow; event: RaceEvent }) {
  const scores = event.races
    .map((r) => {
      const pts = row.pointsByRace[r.id];
      if (pts == null) return null;
      const detail = row.detailsByRace?.[r.id];
      return { race: r, pts, dnf: detail?.finishStatus === "dnf" || pts === 0 };
    })
    .filter((x): x is { race: Race; pts: number; dnf: boolean } => x != null);

  if (scores.length === 0) {
    return <span className="muted-dash" />;
  }

  return (
    <span className="meet-scores">
      {scores.map(({ race, pts, dnf }) => (
        <span
          key={race.id}
          className="meet-score-line"
          title={dnf ? `${race.name} · DNF` : race.name}
        >
          {event.races.length > 1 && (
            <span className="meet-score-dist">{shortDistance(race)}</span>
          )}
          <span className="font-mono">{dnf ? "DNF" : pts}</span>
        </span>
      ))}
    </span>
  );
}

function RaceBreakdown({
  row,
  events,
}: {
  row: StandingRow;
  events: RaceEvent[];
}) {
  const sexTitleLabel =
    row.sex === "M" ? "Vyrų" : row.sex === "F" ? "Moterų" : null;

  return (
    <div className="race-breakdown">
      <div className="place-charts-grid">
        <PlaceHistoryChart
          placeHistory={row.placeHistoryOverall}
          events={events}
          athleteName={row.displayName}
          title="Vieta bendrame reitinge"
          variant="overall"
          compact
        />
        {sexTitleLabel && row.placeHistoryBySex.length > 0 && (
          <PlaceHistoryChart
            placeHistory={row.placeHistoryBySex}
            events={events}
            athleteName={row.displayName}
            title={`Vieta ${sexTitleLabel.toLowerCase()} reitinge`}
            variant={row.sex === "F" ? "sex-f" : "sex-m"}
            compact
          />
        )}
      </div>

      <div className="race-breakdown-meta">
        Top 3: {row.best3Sum}
        {" · "}
        Suma visų: {row.totalPoints}
        {row.average != null ? ` · Vid. ${Math.round(row.average)}` : ""}
        {" · "}
        {row.eventCount} et.
      </div>

      <AthleteRaceResults row={row} events={events} className="table-results" />
    </div>
  );
}

function shortMeetName(ev: RaceEvent): string {
  const base = ev.label.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return base.length > 18 ? `${base.slice(0, 16)}…` : base;
}

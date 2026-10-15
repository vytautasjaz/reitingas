"use client";

import { useState } from "react";
import type { RaceEvent, StandingRow } from "@/lib/ranking";
import { AthleteRaceResults } from "./AthleteRaceResults";
import { ChangeIndicator } from "./ChangeIndicator";
import { PlaceHistoryChart } from "./PlaceHistoryChart";

const PREVIEW = 10;

function MedalBadge({ place }: { place: number }) {
  const tone = place === 1 ? "gold" : place === 2 ? "silver" : "bronze";
  return (
    <span className={`top-medal top-medal-${tone}`} aria-label={`${place} vieta`}>
      {place}
    </span>
  );
}

function AthleteStats({
  row,
  events,
  bestN,
}: {
  row: StandingRow;
  events: RaceEvent[];
  bestN: number;
}) {
  const sexTitleLabel =
    row.sex === "M" ? "Vyrų" : row.sex === "F" ? "Moterų" : null;

  return (
    <div className="top-athlete-stats">
      <div className="top-athlete-meta">
        <span>
          Top {bestN} <strong>{row.best3Sum}</strong>
        </span>
        <span className="top-sub-sep">·</span>
        <span>
          Viso <strong>{row.totalPoints}</strong>
        </span>
        {row.average != null && (
          <>
            <span className="top-sub-sep">·</span>
            <span>
              Vid. <strong>{Math.round(row.average)}</strong>
            </span>
          </>
        )}
        <span className="top-sub-sep">·</span>
        <span>{row.eventCount} et.</span>
      </div>

      {sexTitleLabel && row.placeHistoryBySex.length > 0 ? (
        <PlaceHistoryChart
          placeHistory={row.placeHistoryBySex}
          events={events}
          athleteName={row.displayName}
          title={`Vieta ${sexTitleLabel.toLowerCase()} reitinge`}
          variant={row.sex === "F" ? "sex-f" : "sex-m"}
          compact
        />
      ) : (
        <PlaceHistoryChart
          placeHistory={row.placeHistoryOverall}
          events={events}
          athleteName={row.displayName}
          title="Vieta bendrame reitinge"
          variant="overall"
          compact
        />
      )}

      <AthleteRaceResults row={row} events={events} />
    </div>
  );
}

function TopRow({
  row,
  variant,
  open,
  onToggle,
  events,
  bestN,
}: {
  row: StandingRow;
  variant: "podium" | "rest";
  open: boolean;
  onToggle: () => void;
  events: RaceEvent[];
  bestN: number;
}) {
  return (
    <li className={`top-item${open ? " is-open" : ""}`}>
      <div className={`top-row top-row-${variant}`}>
        {variant === "podium" && row.place <= 3 ? (
          <MedalBadge place={row.place} />
        ) : (
          <span className="top-place">{row.place}</span>
        )}
        <div className="top-meta">
          <button
            type="button"
            className="top-name"
            aria-expanded={open}
            onClick={onToggle}
          >
            {row.displayName}
          </button>
        </div>
        <span className="top-sub">
          <strong className="top-points">{row.best3Sum}</strong>
          <span className="top-sub-sep">·</span>
          {row.eventCount} et.
        </span>
        <div className="top-right" title="Pokytis vs praėjęs etapas">
          <ChangeIndicator change={row.change} isNew={row.isNew} compact />
        </div>
      </div>
      <div className={`top-detail${open ? " is-open" : ""}`} aria-hidden={!open}>
        <div className="top-detail-inner">
          <AthleteStats row={row} events={events} bestN={bestN} />
        </div>
      </div>
    </li>
  );
}

function TopCard({
  title,
  rows,
  tone,
  events,
  bestN,
  openId,
  onToggleAthlete,
}: {
  title: string;
  rows: StandingRow[];
  tone: "m" | "f";
  events: RaceEvent[];
  bestN: number;
  openId: number | null;
  onToggleAthlete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const podium = rows.slice(0, 3);
  const previewRest = rows.slice(3, PREVIEW);
  const more = rows.slice(PREVIEW);
  const canExpand = more.length > 0;
  const label = expanded ? `Visas sąrašas · ${rows.length}` : "Top 10";

  return (
    <section className={`top-card top-${tone}`}>
      <header className="top-card-head">
        <h3>{title}</h3>
        <span>{label}</span>
      </header>
      {rows.length === 0 ? (
        <p className="top-empty">Dar nėra rezultatų</p>
      ) : (
        <>
          <ol className="top-list top-list-podium">
            {podium.map((row) => (
              <TopRow
                key={row.memberId}
                row={row}
                variant="podium"
                events={events}
                bestN={bestN}
                open={openId === row.memberId}
                onToggle={() => onToggleAthlete(row.memberId)}
              />
            ))}
          </ol>
          {previewRest.length > 0 && (
            <>
              <div className="top-divider" role="separator" aria-hidden="true" />
              <ol className="top-list top-list-rest" start={4}>
                {previewRest.map((row) => (
                  <TopRow
                    key={row.memberId}
                    row={row}
                    variant="rest"
                    events={events}
                    bestN={bestN}
                    open={openId === row.memberId}
                    onToggle={() => onToggleAthlete(row.memberId)}
                  />
                ))}
              </ol>
            </>
          )}
          {canExpand && (
            <>
              <div
                className={`top-more${expanded ? " is-open" : ""}`}
                aria-hidden={!expanded}
              >
                <div className="top-more-inner">
                  <ol className="top-list top-list-rest" start={PREVIEW + 1}>
                    {more.map((row) => (
                      <TopRow
                        key={row.memberId}
                        row={row}
                        variant="rest"
                        events={events}
                        bestN={bestN}
                        open={openId === row.memberId}
                        onToggle={() => onToggleAthlete(row.memberId)}
                      />
                    ))}
                  </ol>
                </div>
              </div>
              <button
                type="button"
                className={`top-expand-btn top-expand-btn-inline${expanded ? " is-open" : ""}`}
                aria-expanded={expanded}
                onClick={() => setExpanded((v) => !v)}
              >
                <span>
                  {expanded
                    ? "Suskleisti"
                    : `Rodyti daugiau · +${more.length}`}
                </span>
                <svg
                  className="top-expand-chevron"
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  aria-hidden
                >
                  <path
                    d="M2.5 4.5 L6 8 L9.5 4.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </>
          )}
        </>
      )}
    </section>
  );
}

export function TopAthletes({
  men,
  women,
  events,
  bestN = 3,
}: {
  men: StandingRow[];
  women: StandingRow[];
  events: RaceEvent[];
  bestN?: number;
}) {
  const [openId, setOpenId] = useState<number | null>(null);

  function toggleAthlete(id: number) {
    setOpenId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="top-block">
      <div className="top-grid">
        <TopCard
          title="Vyrai"
          rows={men}
          tone="m"
          events={events}
          bestN={bestN}
          openId={openId}
          onToggleAthlete={toggleAthlete}
        />
        <TopCard
          title="Moterys"
          rows={women}
          tone="f"
          events={events}
          bestN={bestN}
          openId={openId}
          onToggleAthlete={toggleAthlete}
        />
      </div>
    </div>
  );
}

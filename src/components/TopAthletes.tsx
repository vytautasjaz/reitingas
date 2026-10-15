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
}: {
  row: StandingRow;
  events: RaceEvent[];
}) {
  const sexTitleLabel =
    row.sex === "M" ? "Vyrų" : row.sex === "F" ? "Moterų" : null;

  return (
    <div className="top-athlete-stats">
      <div className="top-athlete-meta">
        <span>
          Top 3 <strong>{row.best3Sum}</strong>
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
}: {
  row: StandingRow;
  variant: "podium" | "rest";
  open: boolean;
  onToggle: () => void;
  events: RaceEvent[];
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
          <AthleteStats row={row} events={events} />
        </div>
      </div>
    </li>
  );
}

function TopCard({
  title,
  rows,
  tone,
  expanded,
  events,
  openId,
  onToggleAthlete,
}: {
  title: string;
  rows: StandingRow[];
  tone: "m" | "f";
  expanded: boolean;
  events: RaceEvent[];
  openId: number | null;
  onToggleAthlete: (id: number) => void;
}) {
  const podium = rows.slice(0, 3);
  const previewRest = rows.slice(3, PREVIEW);
  const more = rows.slice(PREVIEW);
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
                    open={openId === row.memberId}
                    onToggle={() => onToggleAthlete(row.memberId)}
                  />
                ))}
              </ol>
            </>
          )}
          {more.length > 0 && (
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
                      open={openId === row.memberId}
                      onToggle={() => onToggleAthlete(row.memberId)}
                    />
                  ))}
                </ol>
              </div>
            </div>
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
}: {
  men: StandingRow[];
  women: StandingRow[];
  events: RaceEvent[];
}) {
  const [listExpanded, setListExpanded] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const canExpand = men.length > PREVIEW || women.length > PREVIEW;

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
          expanded={listExpanded}
          events={events}
          openId={openId}
          onToggleAthlete={toggleAthlete}
        />
        <TopCard
          title="Moterys"
          rows={women}
          tone="f"
          expanded={listExpanded}
          events={events}
          openId={openId}
          onToggleAthlete={toggleAthlete}
        />
      </div>
      {canExpand && (
        <button
          type="button"
          className={`top-expand-btn${listExpanded ? " is-open" : ""}`}
          aria-expanded={listExpanded}
          onClick={() => setListExpanded((v) => !v)}
        >
          <span>{listExpanded ? "Suskleisti" : "Rodyti viską"}</span>
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
      )}
    </div>
  );
}

"use client";

import { formatDateLt } from "@/lib/dates";
import type { RaceEvent } from "@/lib/ranking";

type Point = {
  event: RaceEvent;
  place: number | null;
  index: number;
};

export function PlaceHistoryChart({
  placeHistory,
  events,
  athleteName,
  title = "Vieta reitinge po etapų",
  variant = "overall",
  compact = false,
}: {
  placeHistory: Array<number | null>;
  events: RaceEvent[];
  athleteName: string;
  title?: string;
  variant?: "overall" | "sex-m" | "sex-f";
  compact?: boolean;
}) {
  const points: Point[] = events.map((event, index) => ({
    event,
    place: placeHistory[index] ?? null,
    index,
  }));

  const placed = points.filter((p) => p.place != null) as Array<
    Point & { place: number }
  >;

  if (placed.length === 0) {
    return (
      <div className="place-chart empty">
        Dar nėra vietos istorijos šiame reitinge.
      </div>
    );
  }

  const width = compact ? 420 : 520;
  const height = compact ? 158 : 180;
  const padL = compact ? 26 : 36;
  const padR = compact ? 18 : 20;
  const padT = compact ? 14 : 18;
  const padB = compact ? 54 : 56;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  // Y: place 1 at top; scale to worst place in this athlete's history
  const yMax = Math.max(5, ...placed.map((p) => p.place));

  const xAt = (i: number) =>
    padL + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const yAt = (place: number) =>
    padT + ((place - 1) / Math.max(yMax - 1, 1)) * innerH;

  const linePath = placed
    .map((p, i) => {
      const cmd = i === 0 ? "M" : "L";
      return `${cmd}${xAt(p.index).toFixed(1)} ${yAt(p.place).toFixed(1)}`;
    })
    .join(" ");

  const areaPath =
    placed.length > 0
      ? [
          `M${xAt(placed[0].index).toFixed(1)} ${yAt(placed[0].place).toFixed(1)}`,
          ...placed.slice(1).map(
            (p) => `L${xAt(p.index).toFixed(1)} ${yAt(p.place).toFixed(1)}`
          ),
          `L${xAt(placed[placed.length - 1].index).toFixed(1)} ${(padT + innerH).toFixed(1)}`,
          `L${xAt(placed[0].index).toFixed(1)} ${(padT + innerH).toFixed(1)}`,
          "Z",
        ].join(" ")
      : "";

  const labelY = height - padB + 12;

  return (
    <div
      className={`place-chart place-chart-${variant}${compact ? " place-chart-compact" : ""}`}
    >
      <div className="place-chart-head">
        <div>
          <div className="place-chart-title">{title}</div>
          {!compact && <div className="place-chart-sub">{athleteName}</div>}
        </div>
      </div>

      <svg
        className="place-chart-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${title}: ${athleteName}`}
      >
        {/* grid lines for places */}
        {[1, Math.ceil(yMax / 2), yMax].map((place) => (
          <g key={place}>
            <line
              x1={padL}
              x2={width - padR}
              y1={yAt(place)}
              y2={yAt(place)}
              className="place-grid"
            />
            <text x={padL - 8} y={yAt(place) + 3} className="place-axis" textAnchor="end">
              {place}
            </text>
          </g>
        ))}

        {areaPath && <path d={areaPath} className="place-area" />}
        <path d={linePath} className="place-line" fill="none" />

        {points.map((p) => {
          if (p.place == null) {
            return (
              <circle
                key={p.event.id}
                cx={xAt(p.index)}
                cy={padT + innerH}
                r={3}
                className="place-dot missing"
              />
            );
          }
          const isLast = p.index === placed[placed.length - 1].index;
          return (
            <g key={p.event.id}>
              <circle
                cx={xAt(p.index)}
                cy={yAt(p.place)}
                r={isLast ? 5.5 : 4}
                className={`place-dot${isLast ? " current" : ""}`}
              />
              <text
                x={xAt(p.index)}
                y={yAt(p.place) - 10}
                className="place-dot-label"
                textAnchor="middle"
              >
                {p.place}
              </text>
            </g>
          );
        })}

        {points.map((p) => {
          const x = xAt(p.index);
          const name = axisMeetName(p.event.label);
          return (
            <text
              key={`label-${p.event.id}`}
              x={x}
              y={labelY}
              className="place-x-label"
              textAnchor="end"
              transform={`rotate(-42 ${x.toFixed(1)} ${labelY})`}
            >
              <title>{`${formatDateLt(p.event.date)} · ${meetBaseName(p.event.label)}`}</title>
              {name}
            </text>
          );
        })}
      </svg>

      {!compact && (
        <ol className="place-chart-legend">
          {points.map((p) => (
            <li key={p.event.id} title={p.event.label}>
              <span className="place-legend-date">{formatDateLt(p.event.date)}</span>
              <span className="place-legend-name">{shortLabel(p.event.label)}</span>
              <span className="place-legend-place">
                {p.place != null ? `${p.place} vieta` : "—"}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function meetBaseName(label: string): string {
  return label.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

/** Short readable meet name for chart X axis. */
function axisMeetName(label: string): string {
  let base = meetBaseName(label);
  base = base.replace(/^LTT\s+/i, "");
  base = base.replace(/\s+triatlonas$/i, "");
  if (base.length > 12) return `${base.slice(0, 11)}…`;
  return base;
}

function shortLabel(label: string): string {
  const base = meetBaseName(label);
  return base.length > 22 ? `${base.slice(0, 20)}…` : base;
}

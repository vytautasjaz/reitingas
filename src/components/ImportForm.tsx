"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DistanceType } from "@/lib/distances";
import type { DistanceSetting } from "@/lib/settings";
import { DistanceSelect } from "./DistanceSelect";

type LegRow = {
  key: string;
  distanceType: DistanceType;
  file: File | null;
};

type ImportResponse = {
  ok: boolean;
  error?: string;
  meetId?: number;
  raceIds?: number[];
  totalRows?: number;
  tritonasRows?: number;
  included?: number;
  newMembers?: string[];
  skippedMixed?: string[];
};

function newLeg(distanceType: DistanceType = "olympic"): LegRow {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    distanceType,
    file: null,
  };
}

export function ImportForm({ distances }: { distances: DistanceSetting[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [legs, setLegs] = useState<LegRow[]>([newLeg()]);

  function updateLeg(key: string, patch: Partial<LegRow>) {
    setLegs((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLeg(key: string) {
    setLegs((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.key !== key)));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setResult(null);

    const form = e.currentTarget;
    const data = new FormData(form);

    const ready = legs.filter((l) => l.file);
    if (ready.length === 0) {
      setResult({ ok: false, error: "Pridėkite bent vieną rezultatų failą" });
      setPending(false);
      return;
    }

    data.set("legCount", String(ready.length));
    ready.forEach((leg, i) => {
      data.set(`legDistance_${i}`, leg.distanceType);
      data.set(`legFile_${i}`, leg.file!);
    });

    try {
      const res = await fetch("/api/import", {
        method: "POST",
        body: data,
      });
      const json = (await res.json()) as ImportResponse;
      setResult(json);
      if (json.ok) {
        form.reset();
        setLegs([newLeg()]);
        router.refresh();
      }
    } catch (err) {
      setResult({
        ok: false,
        error: err instanceof Error ? err.message : "Importas nepavyko",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={onSubmit}
        className="card card-pad"
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        <div style={{ gridColumn: "1 / -1" }}>
          <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800 }}>
            Įkelti varžybas
          </h3>
          <p style={{ margin: "0.35rem 0 0", color: "var(--muted)", fontSize: "0.9rem" }}>
            Pridėkite vieną ar kelis protokolus tai pačiai varžybai. Taškai
            skaičiuojami pagal kiekvienos distancijos bazę, lentelėje — viena
            kolona.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="name">
            Varžybų pavadinimas
          </label>
          <input
            id="name"
            name="name"
            required
            placeholder="pvz. LTT Druskininkai"
            className="input"
          />
        </div>

        <div>
          <label className="label" htmlFor="raceDate">
            Data
          </label>
          <input
            id="raceDate"
            name="raceDate"
            type="date"
            required
            className="input"
            lang="lt"
          />
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <label className="check-label" htmlFor="foreignStart">
            <input
              id="foreignStart"
              name="foreignStart"
              type="checkbox"
              value="1"
            />
            <span>
              <strong>Užsienio startas</strong>
              <span className="check-hint">
                Į geriausių trijų sumą gali įeiti tik vienas užsienio startas
              </span>
            </span>
          </label>
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <label className="label">Protokolai</label>
          <div className="leg-list">
            {legs.map((leg, index) => (
              <div key={leg.key} className="leg-row">
                <div className="leg-index">{index + 1}</div>
                <div>
                  <label className="label" htmlFor={`dist-${leg.key}`}>
                    Distancija
                  </label>
                  <DistanceSelect
                    id={`dist-${leg.key}`}
                    value={leg.distanceType}
                    distances={distances}
                    onChange={(distanceType) =>
                      updateLeg(leg.key, { distanceType })
                    }
                  />
                </div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <label className="label" htmlFor={`file-${leg.key}`}>
                    Rezultatų failas
                  </label>
                  <input
                    id={`file-${leg.key}`}
                    type="file"
                    accept=".xls,.xlsx,.html,.htm"
                    className="input"
                    onChange={(e) =>
                      updateLeg(leg.key, { file: e.target.files?.[0] ?? null })
                    }
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-ghost text-sm"
                  disabled={legs.length <= 1}
                  onClick={() => removeLeg(leg.key)}
                  title="Pašalinti"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              className="leg-row-add"
              onClick={() => setLegs((prev) => [...prev, newLeg()])}
            >
              <div className="leg-index">+</div>
              <div className="leg-row-add-fields">
                <div>
                  <label className="label">Distancija</label>
                  <select className="select" tabIndex={-1} aria-hidden disabled>
                    <option>Olimpinė / OD — 1000</option>
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <label className="label">Rezultatų failas</label>
                  <input className="input" disabled tabIndex={-1} aria-hidden />
                </div>
              </div>
              <span className="leg-row-add-label">Pridėti papildomą protokolą</span>
            </button>
          </div>
        </div>

        <div
          style={{
            gridColumn: "1 / -1",
            display: "flex",
            flexWrap: "wrap",
            gap: "0.65rem",
            alignItems: "center",
          }}
        >
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Importuojama…" : "Įkelti varžybas"}
          </button>
        </div>
      </form>

      {result && (
        <div className="card card-pad space-y-2">
          {result.ok ? (
            <>
              <p style={{ margin: 0, fontWeight: 700, color: "var(--good)" }}>
                Importas sėkmingas
              </p>
              <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--muted)" }}>
                Protokolo eilučių: {result.totalRows} · TRItonas paminėjimų:{" "}
                {result.tritonasRows} · Įtraukta į reitingą: {result.included}
                {result.raceIds ? ` · Distancijos: ${result.raceIds.length}` : ""}
              </p>
              {result.newMembers && result.newMembers.length > 0 && (
                <p style={{ margin: 0, fontSize: "0.9rem" }}>
                  Nauji nariai: {result.newMembers.join(", ")}
                </p>
              )}
              {result.skippedMixed && result.skippedMixed.length > 0 && (
                <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--warn)" }}>
                  Neįtraukti į reitingą (ne oficialiame sąraše):{" "}
                  {result.skippedMixed.join("; ")}
                </p>
              )}
              {result.meetId != null && (
                <a
                  href={`/meets/${result.meetId}`}
                  style={{ color: "var(--accent-strong)", fontWeight: 700 }}
                >
                  Atidaryti varžybas →
                </a>
              )}
            </>
          ) : (
            <p style={{ margin: 0, color: "var(--danger)" }}>{result.error}</p>
          )}
        </div>
      )}
    </div>
  );
}

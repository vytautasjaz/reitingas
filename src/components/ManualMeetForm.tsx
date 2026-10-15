"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { DistanceType } from "@/lib/distances";
import { analyzePaste } from "@/lib/manual-paste";
import type { DistanceSetting } from "@/lib/settings";
import { DistanceSelect } from "./DistanceSelect";

type MemberOption = { id: number; display_name: string };

type ParticipantRow = {
  key: string;
  name: string;
  time: string;
  place: string;
};

type LegRow = {
  key: string;
  distanceType: DistanceType;
  leaderTime: string;
  fieldSize: string;
  participants: ParticipantRow[];
};

type CellField = "place" | "name" | "time";

const MIN_EMPTY_ROWS = 6;

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function emptyRow(): ParticipantRow {
  return { key: newKey(), name: "", time: "", place: "" };
}

function ensureTrailingEmpty(rows: ParticipantRow[]): ParticipantRow[] {
  const filled = rows.filter(
    (r) => r.name.trim() || r.time.trim() || r.place.trim()
  );
  const empties = Math.max(MIN_EMPTY_ROWS - filled.length, 1);
  return [...filled, ...Array.from({ length: empties }, emptyRow)];
}

function newLeg(distanceType: DistanceType = "olympic"): LegRow {
  return {
    key: newKey(),
    distanceType,
    leaderTime: "",
    fieldSize: "",
    participants: ensureTrailingEmpty([]),
  };
}

export function ManualMeetForm({
  members,
  distances,
}: {
  members: MemberOption[];
  distances: DistanceSetting[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [meetDate, setMeetDate] = useState("");
  const [foreignStart, setForeignStart] = useState(false);
  const [legs, setLegs] = useState<LegRow[]>([newLeg()]);

  const memberListId = useMemo(() => `manual-members-${newKey()}`, []);

  function updateLeg(key: string, patch: Partial<LegRow>) {
    setLegs((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function updateParticipant(
    legKey: string,
    rowKey: string,
    patch: Partial<ParticipantRow>
  ) {
    setLegs((prev) =>
      prev.map((leg) => {
        if (leg.key !== legKey) return leg;
        const next = leg.participants.map((p) =>
          p.key === rowKey ? { ...p, ...patch } : p
        );
        return { ...leg, participants: ensureTrailingEmpty(next) };
      })
    );
  }

  function removeParticipant(legKey: string, rowKey: string) {
    setLegs((prev) =>
      prev.map((leg) => {
        if (leg.key !== legKey) return leg;
        const next = leg.participants.filter((p) => p.key !== rowKey);
        return { ...leg, participants: ensureTrailingEmpty(next) };
      })
    );
  }

  function applyPaste(
    legKey: string,
    startRowKey: string,
    text: string,
    targetField: CellField
  ) {
    const analyzed = analyzePaste(text);
    if (!analyzed) return;

    setLegs((prev) =>
      prev.map((leg) => {
        if (leg.key !== legKey) return leg;
        const startIdx = Math.max(
          0,
          leg.participants.findIndex((p) => p.key === startRowKey)
        );
        const next = [...leg.participants];

        const ensureRow = (idx: number): ParticipantRow => {
          while (next.length <= idx) next.push(emptyRow());
          return next[idx];
        };

        if (analyzed.kind === "column") {
          // Paste into the focused column only — keep other columns intact.
          analyzed.values.forEach((value, i) => {
            const row = ensureRow(startIdx + i);
            next[startIdx + i] = { ...row, [targetField]: value };
          });
        } else {
          analyzed.rows.forEach((r, i) => {
            const row = ensureRow(startIdx + i);
            next[startIdx + i] = {
              ...row,
              place: r.place || row.place,
              name: r.name || row.name,
              time: r.time || row.time,
            };
          });
        }

        return { ...leg, participants: ensureTrailingEmpty(next) };
      })
    );
  }

  function onGridPaste(
    e: React.ClipboardEvent,
    legKey: string,
    rowKey: string,
    targetField: CellField
  ) {
    const text = e.clipboardData.getData("text/plain");
    // Multi-line or multi-cell paste → custom merge. Single cell → native input.
    if (!text || (!text.includes("\n") && !text.includes("\t"))) return;
    e.preventDefault();
    applyPaste(legKey, rowKey, text, targetField);
  }

  function focusCell(legKey: string, rowIndex: number, field: CellField) {
    const id = `cell-${legKey}-${rowIndex}-${field}`;
    requestAnimationFrame(() => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      el?.focus();
      el?.select();
    });
  }

  function onCellKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    legKey: string,
    rowIndex: number,
    field: CellField,
    rowCount: number
  ) {
    const order: CellField[] = ["place", "name", "time"];
    const col = order.indexOf(field);

    if (e.key === "Enter") {
      e.preventDefault();
      if (rowIndex + 1 >= rowCount) {
        setLegs((prev) =>
          prev.map((leg) =>
            leg.key === legKey
              ? {
                  ...leg,
                  participants: ensureTrailingEmpty([
                    ...leg.participants,
                    emptyRow(),
                  ]),
                }
              : leg
          )
        );
      }
      focusCell(legKey, rowIndex + 1, field);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (rowIndex + 1 < rowCount) focusCell(legKey, rowIndex + 1, field);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (rowIndex > 0) focusCell(legKey, rowIndex - 1, field);
      return;
    }
    if (e.key === "ArrowRight" && e.currentTarget.selectionStart === e.currentTarget.value.length) {
      if (col < order.length - 1) {
        e.preventDefault();
        focusCell(legKey, rowIndex, order[col + 1]);
      }
      return;
    }
    if (e.key === "ArrowLeft" && e.currentTarget.selectionStart === 0) {
      if (col > 0) {
        e.preventDefault();
        focusCell(legKey, rowIndex, order[col - 1]);
      }
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    try {
      for (const [i, leg] of legs.entries()) {
        const hasPlaces = leg.participants.some((p) => p.place.trim());
        const fieldSize = Number(leg.fieldSize.trim());
        if (
          hasPlaces &&
          (!leg.fieldSize.trim() || !Number.isFinite(fieldSize) || fieldSize <= 0)
        ) {
          throw new Error(
            `Distancija ${i + 1}: jei įvedate vietas, nurodykite dalyvių skaičių`
          );
        }
      }

      const payload = {
        name: name.trim(),
        meetDate,
        foreignStart,
        legs: legs.map((leg) => {
          const participants = leg.participants
            .filter((p) => p.name.trim() || p.time.trim() || p.place.trim())
            .map((p) => ({
              name: p.name.trim() || undefined,
              place: p.place.trim() ? Number(p.place) : null,
              timeText: p.time.trim(),
              club: "TRItonas",
            }));
          const fieldSizeRaw = leg.fieldSize.trim();
          const fieldSize = fieldSizeRaw ? Number(fieldSizeRaw) : null;
          return {
            distanceType: leg.distanceType,
            leaderTimeText: leg.leaderTime.trim(),
            fieldSize:
              fieldSize != null && Number.isFinite(fieldSize) && fieldSize > 0
                ? fieldSize
                : null,
            participants,
          };
        }),
      };

      const res = await fetch("/api/meets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        meetId?: number;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "Nepavyko sukurti");
      }

      router.push(`/meets/${json.meetId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepavyko sukurti");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card card-pad manual-meet-form">
      <datalist id={memberListId}>
        {members.map((m) => (
          <option key={m.id} value={m.display_name} />
        ))}
      </datalist>

      <div>
        <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800 }}>
          Įvesti rankiniu būdu
        </h3>
        <p style={{ margin: "0.35rem 0 0", color: "var(--muted)", fontSize: "0.9rem" }}>
          Nugalėtojo laikas viršuje, lentelėje — vardas ir finišo laikas.
          Galite įklijuoti stulpelius iš Excel (Ctrl/⌘+V).
        </p>
      </div>

      <div className="manual-meet-fields">
        <div>
          <label className="label" htmlFor="manual-name">
            Varžybų pavadinimas
          </label>
          <input
            id="manual-name"
            className="input"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="pvz. Gdansk Half"
          />
        </div>
        <div>
          <label className="label" htmlFor="manual-date">
            Data
          </label>
          <input
            id="manual-date"
            className="input"
            type="date"
            lang="lt"
            required
            value={meetDate}
            onChange={(e) => setMeetDate(e.target.value)}
          />
        </div>
      </div>

      <label className="check-label" htmlFor="manual-foreign">
        <input
          id="manual-foreign"
          type="checkbox"
          checked={foreignStart}
          onChange={(e) => setForeignStart(e.target.checked)}
        />
        <span>
          <strong>Užsienio startas</strong>
          <span className="check-hint">
            Į geriausių trijų sumą gali įeiti tik vienas užsienio startas
          </span>
        </span>
      </label>

      <div className="space-y-3">
        {legs.map((leg, legIndex) => {
          const hasPlaces = leg.participants.some((p) => p.place.trim());
          return (
            <div key={leg.key} className="manual-leg">
              <div className="manual-leg-head">
                <span className="manual-leg-index">{legIndex + 1}</span>
                <div className="manual-meet-fields" style={{ flex: 1 }}>
                  <div>
                    <label className="label" htmlFor={`manual-dist-${leg.key}`}>
                      Distancija
                    </label>
                  <DistanceSelect
                    id={`manual-dist-${leg.key}`}
                    value={leg.distanceType}
                    distances={distances}
                    onChange={(distanceType) =>
                      updateLeg(leg.key, { distanceType })
                    }
                  />
                  </div>
                  <div>
                    <label className="label" htmlFor={`manual-leader-${leg.key}`}>
                      Nugalėtojo laikas
                    </label>
                    <input
                      id={`manual-leader-${leg.key}`}
                      className="input font-mono"
                      required
                      placeholder="pvz. 3:57:55"
                      value={leg.leaderTime}
                      onChange={(e) =>
                        updateLeg(leg.key, { leaderTime: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor={`manual-field-${leg.key}`}>
                      Dalyvių sk. {hasPlaces ? "" : "(nebūtina)"}
                    </label>
                    <input
                      id={`manual-field-${leg.key}`}
                      className="input font-mono"
                      inputMode="numeric"
                      placeholder={hasPlaces ? "pvz. 420" : "jei įvedate vietas"}
                      value={leg.fieldSize}
                      onChange={(e) =>
                        updateLeg(leg.key, { fieldSize: e.target.value })
                      }
                    />
                  </div>
                </div>
                {legs.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-ghost text-sm"
                    onClick={() =>
                      setLegs((prev) => prev.filter((l) => l.key !== leg.key))
                    }
                    title="Pašalinti distanciją"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="sheet-wrap">
                <table className="sheet-table">
                  <thead>
                    <tr>
                      <th className="sheet-col-nr">#</th>
                      <th className="sheet-col-place">Vieta</th>
                      <th className="sheet-col-name">Vardas Pavardė</th>
                      <th className="sheet-col-time">Finišo laikas</th>
                      <th className="sheet-col-act" />
                    </tr>
                  </thead>
                  <tbody>
                    {leg.participants.map((p, rowIndex) => (
                      <tr key={p.key}>
                        <td className="sheet-nr">{rowIndex + 1}</td>
                        <td>
                          <input
                            id={`cell-${leg.key}-${rowIndex}-place`}
                            className="sheet-input font-mono"
                            inputMode="numeric"
                            placeholder="—"
                            value={p.place}
                            onChange={(e) =>
                              updateParticipant(leg.key, p.key, {
                                place: e.target.value,
                              })
                            }
                            onPaste={(e) =>
                              onGridPaste(e, leg.key, p.key, "place")
                            }
                            onKeyDown={(e) =>
                              onCellKeyDown(
                                e,
                                leg.key,
                                rowIndex,
                                "place",
                                leg.participants.length
                              )
                            }
                            aria-label="Vieta"
                          />
                        </td>
                        <td>
                          <input
                            id={`cell-${leg.key}-${rowIndex}-name`}
                            className="sheet-input"
                            list={memberListId}
                            placeholder="Vardas Pavardė"
                            value={p.name}
                            onChange={(e) =>
                              updateParticipant(leg.key, p.key, {
                                name: e.target.value,
                              })
                            }
                            onPaste={(e) =>
                              onGridPaste(e, leg.key, p.key, "name")
                            }
                            onKeyDown={(e) =>
                              onCellKeyDown(
                                e,
                                leg.key,
                                rowIndex,
                                "name",
                                leg.participants.length
                              )
                            }
                            aria-label="Vardas Pavardė"
                          />
                        </td>
                        <td>
                          <input
                            id={`cell-${leg.key}-${rowIndex}-time`}
                            className="sheet-input font-mono"
                            placeholder="4:21:57 / DNF"
                            value={p.time}
                            onChange={(e) =>
                              updateParticipant(leg.key, p.key, {
                                time: e.target.value,
                              })
                            }
                            onPaste={(e) =>
                              onGridPaste(e, leg.key, p.key, "time")
                            }
                            onKeyDown={(e) =>
                              onCellKeyDown(
                                e,
                                leg.key,
                                rowIndex,
                                "time",
                                leg.participants.length
                              )
                            }
                            aria-label="Finišo laikas"
                          />
                        </td>
                        <td className="sheet-act">
                          {(p.name || p.time || p.place) && (
                            <button
                              type="button"
                              className="link-muted"
                              onClick={() => removeParticipant(leg.key, p.key)}
                            >
                              ×
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="sheet-hint">
                  Galite įklijuoti stulpelius atskirai (pirmiausia vardus, tada
                  laikus į laiko stulpelį) arba kartu: „Vardas · Laikas“.
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="manual-meet-actions">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Kuriama…" : "Sukurti varžybas"}
        </button>
        <button
          type="button"
          className="btn btn-ghost text-sm"
          onClick={() => setLegs((prev) => [...prev, newLeg()])}
        >
          + Pridėti distanciją
        </button>
      </div>

      {error && (
        <p style={{ margin: 0, color: "var(--danger)", fontSize: "0.9rem" }}>
          {error}
        </p>
      )}
    </form>
  );
}

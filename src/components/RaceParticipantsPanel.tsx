"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatSeconds } from "@/lib/time-format";
import { sexLabel, sexTitle } from "@/lib/gender";

export type PanelMember = {
  id: number;
  display_name: string;
};

export type PanelResult = {
  id: number;
  place: number | null;
  raw_name: string;
  member_display_name: string | null;
  club: string | null;
  resolved_sex: "M" | "F" | null;
  time_seconds: number | null;
  gun_time_seconds: number | null;
  points: number | null;
  included_in_rating: number;
};

type EditDraft = {
  name: string;
  club: string;
  place: string;
  time: string;
  points: string;
  included: boolean;
};

function draftFromResult(r: PanelResult): EditDraft {
  return {
    name: r.member_display_name ?? r.raw_name,
    club: r.club ?? "",
    place: r.place != null ? String(r.place) : "",
    time: formatSeconds(r.time_seconds ?? r.gun_time_seconds),
    points: r.points != null ? String(r.points) : "",
    included: !!r.included_in_rating,
  };
}

export function RaceParticipantsPanel({
  raceId,
  results,
  members,
  title,
}: {
  raceId: number;
  results: PanelResult[];
  members: PanelMember[];
  title?: string;
}) {
  const router = useRouter();
  const [memberId, setMemberId] = useState("");
  const [customName, setCustomName] = useState("");
  const [club, setClub] = useState("TRItonas");
  const [placeText, setPlaceText] = useState("");
  const [timeText, setTimeText] = useState("");
  const [pointsText, setPointsText] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addErr, setAddErr] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [listErr, setListErr] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);

  const resultNames = new Set(
    results.map((r) => (r.member_display_name ?? r.raw_name).toLowerCase())
  );

  function startEdit(r: PanelResult) {
    setEditingId(r.id);
    setDraft(draftFromResult(r));
    setEditErr(null);
    setListErr(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
    setEditErr(null);
  }

  async function saveEdit(resultId: number) {
    if (!draft) return;
    setSaving(true);
    setEditErr(null);
    try {
      const points =
        draft.points.trim() === ""
          ? null
          : Number(draft.points.replace(",", "."));
      if (draft.points.trim() && !Number.isFinite(points)) {
        throw new Error("Neteisingi taškai");
      }
      const place =
        draft.place.trim() === ""
          ? null
          : Number(draft.place.replace(",", "."));
      if (draft.place.trim() && !Number.isFinite(place)) {
        throw new Error("Neteisinga vieta");
      }

      const hadExplicitPoints = draft.points.trim() !== "";
      const res = await fetch(`/api/races/${raceId}/results/${resultId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name.trim(),
          club: draft.club.trim() || null,
          place,
          timeText: draft.time.trim() || null,
          points: hadExplicitPoints ? points : undefined,
          includedInRating: draft.included,
          recalcPoints: !hadExplicitPoints && draft.time.trim() !== "",
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Nepavyko išsaugoti");
      cancelEdit();
      router.refresh();
    } catch (err) {
      setEditErr(err instanceof Error ? err.message : "Nepavyko išsaugoti");
    } finally {
      setSaving(false);
    }
  }

  async function addParticipant(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setAddErr(null);
    try {
      const points =
        pointsText.trim() === "" ? null : Number(pointsText.replace(",", "."));
      if (pointsText.trim() && !Number.isFinite(points)) {
        throw new Error("Neteisingi taškai");
      }
      const place =
        placeText.trim() === "" ? null : Number(placeText.replace(",", "."));
      if (placeText.trim() && !Number.isFinite(place)) {
        throw new Error("Neteisinga vieta");
      }

      const res = await fetch(`/api/races/${raceId}/results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: memberId ? Number(memberId) : null,
          name: customName.trim() || undefined,
          club: club.trim() || "TRItonas",
          timeText: timeText.trim() || null,
          points,
          place,
          includedInRating: true,
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Nepavyko pridėti");
      setMemberId("");
      setCustomName("");
      setClub("TRItonas");
      setPlaceText("");
      setTimeText("");
      setPointsText("");
      router.refresh();
    } catch (err) {
      setAddErr(err instanceof Error ? err.message : "Nepavyko pridėti");
    } finally {
      setAdding(false);
    }
  }

  async function removeParticipant(result: PanelResult) {
    const label = result.member_display_name ?? result.raw_name;
    const ok = window.confirm(`Pašalinti „${label}“ iš šios distancijos?`);
    if (!ok) return;

    setRemovingId(result.id);
    setListErr(null);
    try {
      const res = await fetch(`/api/races/${raceId}/results/${result.id}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Nepavyko pašalinti");
      if (editingId === result.id) cancelEdit();
      router.refresh();
    } catch (err) {
      setListErr(err instanceof Error ? err.message : "Nepavyko pašalinti");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="card table-wrap">
        {title && (
          <div className="card-pad" style={{ borderBottom: "1px solid var(--line)" }}>
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800 }}>{title}</h3>
          </div>
        )}
        {listErr && (
          <div className="card-pad" style={{ color: "var(--danger)", fontSize: "0.9rem" }}>
            {listErr}
          </div>
        )}
        {results.length === 0 ? (
          <div className="card-pad" style={{ color: "var(--muted)" }}>
            Dalyvių nėra — spauskite „Pridėti dalyvį“.
          </div>
        ) : (
          <table className="ranking ranking-compact">
            <thead>
              <tr>
                <th>Pl.</th>
                <th>Dalyvis</th>
                <th>Klubas</th>
                <th>Laikas</th>
                <th>Taškai</th>
                <th>Reitinge</th>
                <th>Veiksmai</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => {
                const isEditing = editingId === r.id && draft;
                if (isEditing && draft) {
                  return (
                    <tr key={r.id} className="row-editing">
                      <td colSpan={7} style={{ whiteSpace: "normal", padding: "0.75rem" }}>
                        <div className="edit-participant-grid">
                          <div>
                            <label className="label" htmlFor={`edit-name-${r.id}`}>
                              Vardas
                            </label>
                            <input
                              id={`edit-name-${r.id}`}
                              className="input"
                              value={draft.name}
                              onChange={(e) =>
                                setDraft({ ...draft, name: e.target.value })
                              }
                            />
                          </div>
                          <div>
                            <label className="label" htmlFor={`edit-club-${r.id}`}>
                              Klubas
                            </label>
                            <input
                              id={`edit-club-${r.id}`}
                              className="input"
                              value={draft.club}
                              onChange={(e) =>
                                setDraft({ ...draft, club: e.target.value })
                              }
                            />
                          </div>
                          <div>
                            <label className="label" htmlFor={`edit-place-${r.id}`}>
                              Vieta
                            </label>
                            <input
                              id={`edit-place-${r.id}`}
                              className="input"
                              value={draft.place}
                              onChange={(e) =>
                                setDraft({ ...draft, place: e.target.value })
                              }
                              inputMode="numeric"
                            />
                          </div>
                          <div>
                            <label className="label" htmlFor={`edit-time-${r.id}`}>
                              Laikas
                            </label>
                            <input
                              id={`edit-time-${r.id}`}
                              className="input"
                              value={draft.time}
                              onChange={(e) =>
                                setDraft({ ...draft, time: e.target.value })
                              }
                              placeholder="2:03:54.4"
                            />
                          </div>
                          <div>
                            <label className="label" htmlFor={`edit-points-${r.id}`}>
                              Taškai
                            </label>
                            <input
                              id={`edit-points-${r.id}`}
                              className="input"
                              value={draft.points}
                              onChange={(e) =>
                                setDraft({ ...draft, points: e.target.value })
                              }
                              placeholder="auto pagal laiką"
                              inputMode="decimal"
                            />
                          </div>
                          <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 2 }}>
                            <label
                              style={{
                                display: "inline-flex",
                                gap: "0.4rem",
                                alignItems: "center",
                                fontSize: "0.85rem",
                                cursor: "pointer",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={draft.included}
                                onChange={(e) =>
                                  setDraft({ ...draft, included: e.target.checked })
                                }
                              />
                              Reitinge
                            </label>
                          </div>
                        </div>
                        <div className="edit-participant-actions">
                          <button
                            type="button"
                            className="btn btn-primary text-sm"
                            disabled={saving}
                            onClick={() => saveEdit(r.id)}
                          >
                            {saving ? "Saugoma…" : "Išsaugoti"}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost text-sm"
                            disabled={saving}
                            onClick={cancelEdit}
                          >
                            Atšaukti
                          </button>
                          {editErr && (
                            <span style={{ color: "var(--danger)", fontSize: "0.85rem" }}>
                              {editErr}
                            </span>
                          )}
                          <span className="edit-participant-hint">
                            Tušti taškai + laikas → perskaičiuojama automatiškai
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={r.id}
                    className={
                      r.resolved_sex === "M"
                        ? "row-male"
                        : r.resolved_sex === "F"
                          ? "row-female"
                          : ""
                    }
                    style={{ opacity: r.included_in_rating ? 1 : 0.55 }}
                  >
                    <td>{r.place ?? ""}</td>
                    <td>
                      <span className="athlete-cell">
                        <span
                          className={`sex-mark sex-${r.resolved_sex === "F" ? "f" : r.resolved_sex === "M" ? "m" : "u"}`}
                          title={sexTitle(r.resolved_sex)}
                        >
                          {sexLabel(r.resolved_sex)}
                        </span>
                        <span style={{ fontWeight: 600 }}>
                          {r.member_display_name ?? r.raw_name}
                        </span>
                      </span>
                    </td>
                    <td>{r.club ?? "—"}</td>
                    <td className="font-mono text-sm">
                      {formatSeconds(r.time_seconds ?? r.gun_time_seconds) || "—"}
                    </td>
                    <td className="font-mono accent-cell">
                      {r.points != null ? r.points : "—"}
                    </td>
                    <td>{r.included_in_rating ? "Taip" : "Ne"}</td>
                    <td>
                      <div className="row-actions" style={{ gap: "0.65rem" }}>
                        <button
                          type="button"
                          className="link-muted"
                          disabled={editingId != null || removingId === r.id}
                          onClick={() => startEdit(r)}
                        >
                          redaguoti
                        </button>
                        <button
                          type="button"
                          className="link-danger"
                          disabled={removingId === r.id || editingId === r.id}
                          onClick={() => removeParticipant(r)}
                          title="Pašalinti dalyvį"
                        >
                          {removingId === r.id ? "…" : "šalinti"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {!showAddForm ? (
        <div className="add-participant-trigger">
          <button
            type="button"
            className="link-muted"
            onClick={() => {
              setShowAddForm(true);
              setAddErr(null);
            }}
          >
            + Pridėti dalyvį
          </button>
        </div>
      ) : (
        <form
          onSubmit={addParticipant}
          className="card card-pad"
          style={{
            display: "grid",
            gap: "0.85rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          }}
        >
          <div style={{ gridColumn: "1 / -1" }}>
            <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800 }}>
              Pridėti dalyvį
            </h3>
            <p style={{ margin: "0.25rem 0 0", color: "var(--muted)", fontSize: "0.82rem" }}>
              Pasirinkite narį arba įveskite vardą. Su laiku taškai skaičiuojami
              automatiškai; galima įvesti taškus rankiniu būdu.
            </p>
          </div>

          <div>
            <label className="label" htmlFor={`member-${raceId}`}>
              Narys
            </label>
            <select
              id={`member-${raceId}`}
              className="select"
              value={memberId}
              onChange={(e) => {
                setMemberId(e.target.value);
                if (e.target.value) setCustomName("");
              }}
            >
              <option value="">— pasirinkti —</option>
              {members
                .filter((m) => !resultNames.has(m.display_name.toLowerCase()))
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor={`name-${raceId}`}>
              Arba naujas vardas
            </label>
            <input
              id={`name-${raceId}`}
              className="input"
              value={customName}
              onChange={(e) => {
                setCustomName(e.target.value);
                if (e.target.value) setMemberId("");
              }}
              placeholder="Vardas Pavardė"
              disabled={!!memberId}
            />
          </div>

          <div>
            <label className="label" htmlFor={`club-${raceId}`}>
              Klubas
            </label>
            <input
              id={`club-${raceId}`}
              className="input"
              value={club}
              onChange={(e) => setClub(e.target.value)}
              placeholder="TRItonas"
            />
          </div>

          <div>
            <label className="label" htmlFor={`place-${raceId}`}>
              Vieta
            </label>
            <input
              id={`place-${raceId}`}
              className="input"
              value={placeText}
              onChange={(e) => setPlaceText(e.target.value)}
              placeholder="pvz. 12"
              inputMode="numeric"
            />
          </div>

          <div>
            <label className="label" htmlFor={`time-${raceId}`}>
              Laikas
            </label>
            <input
              id={`time-${raceId}`}
              className="input"
              value={timeText}
              onChange={(e) => setTimeText(e.target.value)}
              placeholder="2:03:54.4"
            />
          </div>

          <div>
            <label className="label" htmlFor={`points-${raceId}`}>
              Taškai
            </label>
            <input
              id={`points-${raceId}`}
              className="input"
              value={pointsText}
              onChange={(e) => setPointsText(e.target.value)}
              placeholder="nebūtina"
              inputMode="decimal"
            />
          </div>

          <div
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              gap: "0.75rem",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <button type="submit" className="btn btn-primary text-sm" disabled={adding}>
              {adding ? "Pridedama…" : "Pridėti dalyvį"}
            </button>
            <button
              type="button"
              className="btn btn-ghost text-sm"
              disabled={adding}
              onClick={() => {
                setShowAddForm(false);
                setAddErr(null);
              }}
            >
              Atšaukti
            </button>
            {addErr && (
              <span style={{ color: "var(--danger)", fontSize: "0.85rem" }}>{addErr}</span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

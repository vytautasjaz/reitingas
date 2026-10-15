"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DistanceType } from "@/lib/distances";
import type { DistanceSetting } from "@/lib/settings";
import { formatSeconds } from "@/lib/time-format";
import { DistanceSelect } from "./DistanceSelect";

export type EditableRace = {
  id: number;
  name: string;
  race_date: string;
  distance_type: DistanceType;
  leader_time_seconds: number | null;
};

export type EditableMember = {
  id: number;
  display_name: string;
};

export type EditableResult = {
  id: number;
  place: number | null;
  raw_name: string;
  member_display_name: string | null;
  club: string | null;
  time_seconds: number | null;
  gun_time_seconds: number | null;
  points: number | null;
  included_in_rating: number;
};

export function RaceEditForm({
  race,
  results,
  members,
  distances,
}: {
  race: EditableRace;
  results: EditableResult[];
  members: EditableMember[];
  distances: DistanceSetting[];
}) {
  const router = useRouter();
  const [name, setName] = useState(race.name);
  const [raceDate, setRaceDate] = useState(race.race_date);
  const [distanceType, setDistanceType] = useState<DistanceType>(race.distance_type);
  const [leaderTime, setLeaderTime] = useState(
    race.leader_time_seconds != null ? formatSeconds(race.leader_time_seconds) : ""
  );
  const [savingRace, setSavingRace] = useState(false);
  const [raceMsg, setRaceMsg] = useState<string | null>(null);
  const [raceErr, setRaceErr] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [memberId, setMemberId] = useState("");
  const [customName, setCustomName] = useState("");
  const [timeText, setTimeText] = useState("");
  const [pointsText, setPointsText] = useState("");
  const [adding, setAdding] = useState(false);
  const [addErr, setAddErr] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [listErr, setListErr] = useState<string | null>(null);

  async function saveRace(e: React.FormEvent) {
    e.preventDefault();
    setSavingRace(true);
    setRaceMsg(null);
    setRaceErr(null);
    try {
      const res = await fetch(`/api/races/${race.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          raceDate,
          distanceType,
          leaderTime: leaderTime.trim() || null,
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Nepavyko išsaugoti");
      setRaceMsg("Varžybų info išsaugota. Taškai perskaičiuoti pagal bazę.");
      router.refresh();
    } catch (err) {
      setRaceErr(err instanceof Error ? err.message : "Nepavyko išsaugoti");
    } finally {
      setSavingRace(false);
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

      const res = await fetch(`/api/races/${race.id}/results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: memberId ? Number(memberId) : null,
          name: customName.trim() || undefined,
          timeText: timeText.trim() || null,
          points,
          includedInRating: true,
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Nepavyko pridėti");
      setMemberId("");
      setCustomName("");
      setTimeText("");
      setPointsText("");
      router.refresh();
    } catch (err) {
      setAddErr(err instanceof Error ? err.message : "Nepavyko pridėti");
    } finally {
      setAdding(false);
    }
  }

  async function removeParticipant(result: EditableResult) {
    const label = result.member_display_name ?? result.raw_name;
    const ok = window.confirm(`Pašalinti „${label}“ iš šių varžybų?`);
    if (!ok) return;

    setRemovingId(result.id);
    setListErr(null);
    try {
      const res = await fetch(`/api/races/${race.id}/results/${result.id}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Nepavyko pašalinti");
      router.refresh();
    } catch (err) {
      setListErr(err instanceof Error ? err.message : "Nepavyko pašalinti");
    } finally {
      setRemovingId(null);
    }
  }

  const resultNames = new Set(
    results.map((r) => (r.member_display_name ?? r.raw_name).toLowerCase())
  );

  return (
    <div className="space-y-6">
      <form
        onSubmit={saveRace}
        className="card card-pad"
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        <div style={{ gridColumn: "1 / -1" }}>
          <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800 }}>
            Varžybų informacija
          </h3>
          <p style={{ margin: "0.35rem 0 0", color: "var(--muted)", fontSize: "0.9rem" }}>
            Pakeitus distanciją, taškai perskaičiuojami pagal lyderio laiką.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="edit-name">
            Pavadinimas
          </label>
          <input
            id="edit-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="edit-date">
            Data
          </label>
          <input
            id="edit-date"
            type="date"
            className="input"
            lang="lt"
            value={raceDate}
            onChange={(e) => setRaceDate(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="edit-distance">
            Distancija (baziniai taškai)
          </label>
          <DistanceSelect
            id="edit-distance"
            value={distanceType}
            distances={distances}
            onChange={setDistanceType}
          />
        </div>

        <div>
          <label className="label" htmlFor="edit-leader">
            Lyderio laikas (protokolo)
          </label>
          <input
            id="edit-leader"
            className="input"
            placeholder="pvz. 1:58:12.4"
            value={leaderTime}
            onChange={(e) => setLeaderTime(e.target.value)}
          />
        </div>

        <div style={{ gridColumn: "1 / -1", display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <button type="submit" className="btn btn-primary" disabled={savingRace}>
            {savingRace ? "Saugoma…" : "Išsaugoti info"}
          </button>
          {raceMsg && (
            <span style={{ color: "var(--good)", fontSize: "0.9rem", fontWeight: 600 }}>
              {raceMsg}
            </span>
          )}
          {raceErr && (
            <span style={{ color: "var(--danger)", fontSize: "0.9rem" }}>{raceErr}</span>
          )}
        </div>
      </form>

      {!showAddForm ? (
        <div>
          <button
            type="button"
            className="btn btn-primary text-sm"
            onClick={() => {
              setShowAddForm(true);
              setAddErr(null);
            }}
          >
            Pridėti dalyvį
          </button>
        </div>
      ) : (
        <form
          onSubmit={addParticipant}
          className="card card-pad"
          style={{
            display: "grid",
            gap: "1rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          }}
        >
          <div style={{ gridColumn: "1 / -1" }}>
            <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800 }}>
              Pridėti dalyvį
            </h3>
            <p style={{ margin: "0.35rem 0 0", color: "var(--muted)", fontSize: "0.9rem" }}>
              Pasirinkite esamą narį arba įveskite naują vardą. Įveskite laiką (taškai
              skaičiuojami automatiškai) arba taškus rankiniu būdu.
            </p>
          </div>

          <div>
            <label className="label" htmlFor="add-member">
              Narys
            </label>
            <select
              id="add-member"
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
            <label className="label" htmlFor="add-name">
              Arba naujas vardas
            </label>
            <input
              id="add-name"
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
            <label className="label" htmlFor="add-time">
              Laikas
            </label>
            <input
              id="add-time"
              className="input"
              value={timeText}
              onChange={(e) => setTimeText(e.target.value)}
              placeholder="2:03:54.4"
            />
          </div>

          <div>
            <label className="label" htmlFor="add-points">
              Taškai (nebūtina, jei yra laikas)
            </label>
            <input
              id="add-points"
              className="input"
              value={pointsText}
              onChange={(e) => setPointsText(e.target.value)}
              placeholder="pvz. 950"
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
            <button type="submit" className="btn btn-primary" disabled={adding}>
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
              <span style={{ color: "var(--danger)", fontSize: "0.9rem" }}>{addErr}</span>
            )}
          </div>
        </form>
      )}

      <div className="card table-wrap">
        <div className="card-pad" style={{ borderBottom: "1px solid var(--line)" }}>
          <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800 }}>
            Dalyviai ({results.length})
          </h3>
          {listErr && (
            <p style={{ margin: "0.5rem 0 0", color: "var(--danger)", fontSize: "0.9rem" }}>
              {listErr}
            </p>
          )}
        </div>
        {results.length === 0 ? (
          <div className="card-pad" style={{ color: "var(--muted)" }}>
            Dalyvių nėra.
          </div>
        ) : (
          <table className="ranking">
            <thead>
              <tr>
                <th>Dalyvis</th>
                <th>Klubas</th>
                <th>Laikas</th>
                <th>Taškai</th>
                <th>Reitinge</th>
                <th>Veiksmai</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id} style={{ opacity: r.included_in_rating ? 1 : 0.55 }}>
                  <td style={{ fontWeight: 600 }}>
                    {r.member_display_name ?? r.raw_name}
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
                    <button
                      type="button"
                      className="link-danger"
                      disabled={removingId === r.id}
                      onClick={() => removeParticipant(r)}
                      title="Pašalinti dalyvį"
                    >
                      {removingId === r.id ? "…" : "šalinti"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type MeetPayload = {
  id: number;
  name: string;
  meet_date: string;
  foreign_start: boolean;
  races: Array<{ id: number; name: string; distance_type: string }>;
};

export default function MeetEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const meetId = Number(params.id);

  const [name, setName] = useState("");
  const [meetDate, setMeetDate] = useState("");
  const [foreignStart, setForeignStart] = useState(false);
  const [races, setRaces] = useState<MeetPayload["races"]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/meets/${meetId}/detail`);
        const json = (await res.json()) as {
          ok: boolean;
          meet?: MeetPayload;
          error?: string;
        };
        if (!res.ok || !json.ok || !json.meet) {
          throw new Error(json.error ?? "Nepavyko įkelti");
        }
        if (cancelled) return;
        setName(json.meet.name);
        setMeetDate(json.meet.meet_date);
        setForeignStart(!!json.meet.foreign_start);
        setRaces(json.meet.races);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Klaida");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [meetId]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/meets/${meetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, meetDate, foreignStart }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Nepavyko");
      setMsg("Išsaugota");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepavyko išsaugoti");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="card card-pad muted">Kraunama…</div>;
  }

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <Link
            href={`/meets/${meetId}`}
            style={{ color: "var(--muted)", fontSize: "0.85rem", fontWeight: 600 }}
          >
            ← Atgal
          </Link>
          <h1 style={{ marginTop: "0.5rem" }}>Redaguoti varžybas</h1>
          <p>Pavadinimas ir data. Distancijų protokolus redaguokite atskirai.</p>
        </div>
      </div>

      <form
        onSubmit={onSave}
        className="card card-pad"
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        <div>
          <label className="label" htmlFor="meet-name">
            Pavadinimas
          </label>
          <input
            id="meet-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="meet-date">
            Data
          </label>
          <input
            id="meet-date"
            type="date"
            className="input"
            lang="lt"
            value={meetDate}
            onChange={(e) => setMeetDate(e.target.value)}
            required
          />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label className="check-label" htmlFor="meet-foreign">
            <input
              id="meet-foreign"
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
        </div>
        <div style={{ gridColumn: "1 / -1", display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saugoma…" : "Išsaugoti"}
          </button>
          {msg && <span style={{ color: "var(--good)", fontWeight: 600 }}>{msg}</span>}
          {error && <span style={{ color: "var(--danger)" }}>{error}</span>}
        </div>
      </form>

      <div className="card table-wrap">
        <div className="card-pad" style={{ borderBottom: "1px solid var(--line)" }}>
          <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800 }}>
            Distancijos
          </h3>
        </div>
        <table className="ranking">
          <thead>
            <tr>
              <th>Pavadinimas</th>
              <th>Tipas</th>
              <th>Veiksmai</th>
            </tr>
          </thead>
          <tbody>
            {races.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>{r.name}</td>
                <td>{r.distance_type}</td>
                <td>
                  <Link href={`/races/${r.id}/edit`} className="btn btn-ghost text-sm">
                    Redaguoti dalyvius / taškus
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

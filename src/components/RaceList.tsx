"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDateLt } from "@/lib/dates";
import { shortDistance } from "@/lib/distances";
import type { MeetWithRaces } from "@/lib/meets";

const DISTANCE_LABEL: Record<string, string> = {
  sprint: "SD · 900",
  olympic: "OD · 1000",
  half: "Half · 1100",
  full: "Full · 1100",
};

export function RaceList({ meets }: { meets: MeetWithRaces[] }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(meet: MeetWithRaces) {
    const ok = window.confirm(
      `Ištrinti varžybas „${meet.name}“ (${meet.meet_date}) ir visas distancijas?\nReitingas bus perskaičiuotas.`
    );
    if (!ok) return;

    setDeletingId(meet.id);
    setError(null);
    try {
      const res = await fetch(`/api/meets/${meet.id}`, { method: "DELETE" });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "Nepavyko ištrinti");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nepavyko ištrinti");
    } finally {
      setDeletingId(null);
    }
  }

  if (meets.length === 0) {
    return (
      <div className="card card-pad" style={{ color: "var(--muted)" }}>
        Varžybų dar nėra — įkelkite protokolą aukščiau.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="card card-pad" style={{ color: "var(--danger)" }}>
          {error}
        </div>
      )}
      <div className="card table-wrap">
        <table className="ranking races-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Varžybos</th>
              <th>Startas</th>
              <th>Nariai</th>
              <th>Distancijos</th>
              <th>Veiksmai</th>
            </tr>
          </thead>
          <tbody>
            {meets.map((meet) => (
              <tr key={meet.id}>
                <td className="font-mono text-sm">{formatDateLt(meet.meet_date)}</td>
                <td>
                  <Link
                    href={`/meets/${meet.id}`}
                    className="text-link"
                    style={{ fontWeight: 600 }}
                  >
                    {meet.name}
                  </Link>
                </td>
                <td>
                  {meet.foreign_start ? (
                    <span className="foreign-tag" title="Į geriausių trijų sumą gali įeiti tik vienas">
                      Užsienio
                    </span>
                  ) : (
                    <span className="muted text-sm">Lietuva</span>
                  )}
                </td>
                <td
                  className="font-mono text-sm"
                  title="Skirtingų klubo narių skaičius"
                >
                  {meet.member_count}
                </td>
                <td>
                  <div className="row-actions">
                    {meet.races.map((race) => (
                      <Link
                        key={race.id}
                        href={`/races/${race.id}`}
                        className="dist-tag"
                        title={race.source_filename ?? race.name}
                      >
                        {DISTANCE_LABEL[race.distance_type] ??
                          shortDistance(race)}
                      </Link>
                    ))}
                  </div>
                </td>
                <td>
                  <div className="row-actions">
                    <Link href={`/meets/${meet.id}`} className="btn btn-ghost text-sm">
                      Peržiūra
                    </Link>
                    <Link
                      href={`/meets/${meet.id}/edit`}
                      className="btn btn-ghost text-sm"
                    >
                      Redaguoti
                    </Link>
                    <button
                      type="button"
                      className="btn btn-danger text-sm"
                      disabled={deletingId === meet.id}
                      onClick={() => handleDelete(meet)}
                    >
                      {deletingId === meet.id ? "Trinama…" : "Ištrinti"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

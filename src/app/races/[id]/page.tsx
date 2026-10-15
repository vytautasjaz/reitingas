import Link from "next/link";
import { notFound } from "next/navigation";
import { RaceParticipantsPanel } from "@/components/RaceParticipantsPanel";
import { getDb } from "@/lib/db";
import { formatDateLt } from "@/lib/dates";
import { listMembers } from "@/lib/members";
import { getRace, getRaceResults } from "@/lib/ranking";
import { DeleteRaceButton } from "./DeleteRaceButton";

export const dynamic = "force-dynamic";

export default async function RaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  getDb();
  const { id } = await params;
  const raceId = Number(id);
  if (!Number.isFinite(raceId)) notFound();

  const race = getRace(raceId);
  if (!race) notFound();

  const results = getRaceResults(raceId);
  const members = listMembers();
  const included = results.filter((r) => r.included_in_rating).length;
  const backHref = race.meet_id != null ? `/meets/${race.meet_id}` : "/races";

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <Link
            href={backHref}
            style={{
              color: "var(--muted)",
              fontSize: "0.85rem",
              fontWeight: 600,
            }}
          >
            ← Atgal
          </Link>
          <h1 style={{ marginTop: "0.5rem" }}>{race.name}</h1>
          <p>
            {formatDateLt(race.race_date)} · bazė {race.base_points} ·{" "}
            {race.distance_type}
            {race.source_filename ? ` · ${race.source_filename}` : ""}
            {" · "}
            reitinge {included}/{results.length}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link href={`/races/${race.id}/edit`} className="btn btn-ghost">
            Redaguoti info
          </Link>
          <DeleteRaceButton raceId={race.id} raceName={race.name} />
        </div>
      </div>

      <RaceParticipantsPanel
        raceId={race.id}
        members={members}
        results={results.map((r) => ({
          id: r.id,
          place: r.place,
          raw_name: r.raw_name,
          member_display_name: r.member_display_name,
          club: r.club,
          resolved_sex: r.resolved_sex,
          time_seconds: r.time_seconds,
          gun_time_seconds: r.gun_time_seconds,
          points: r.points,
          included_in_rating: r.included_in_rating,
        }))}
      />
    </div>
  );
}

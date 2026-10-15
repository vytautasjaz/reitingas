import Link from "next/link";
import { notFound } from "next/navigation";
import { RaceParticipantsPanel } from "@/components/RaceParticipantsPanel";
import { getDb } from "@/lib/db";
import { formatDateLt } from "@/lib/dates";
import { listMembers } from "@/lib/members";
import { getMeet, getMeetRaces } from "@/lib/meets";
import { getRaceResults } from "@/lib/ranking";
import { DeleteMeetButton } from "./DeleteMeetButton";

export const dynamic = "force-dynamic";

const DISTANCE_LABEL: Record<string, string> = {
  sprint: "Sprint · 900",
  olympic: "Olimpinė · 1000",
  half: "Half · 1100",
  full: "Full · 1100",
};

export default async function MeetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  getDb();
  const { id } = await params;
  const meetId = Number(id);
  if (!Number.isFinite(meetId)) notFound();

  const meet = getMeet(meetId);
  if (!meet) notFound();

  const races = getMeetRaces(meetId);
  const members = listMembers();

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <Link
            href="/races"
            style={{
              color: "var(--muted)",
              fontSize: "0.85rem",
              fontWeight: 600,
            }}
          >
            ← Visos varžybos
          </Link>
          <h1 style={{ marginTop: "0.5rem" }}>{meet.name}</h1>
          <p>
            {formatDateLt(meet.meet_date)} · {races.length} distancija
            {races.length === 1 ? "" : "s"}
            {meet.foreign_start ? " · Užsienio startas" : ""}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link href={`/meets/${meet.id}/edit`} className="btn btn-ghost">
            Redaguoti info
          </Link>
          <DeleteMeetButton meetId={meet.id} meetName={meet.name} />
        </div>
      </div>

      {races.map((race) => {
        const results = getRaceResults(race.id);
        const included = results.filter((r) => r.included_in_rating).length;
        return (
          <section key={race.id} className="space-y-2">
            <div>
              <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800 }}>
                {race.name}
              </h2>
              <p style={{ margin: "0.25rem 0 0", color: "var(--muted)", fontSize: "0.85rem" }}>
                {DISTANCE_LABEL[race.distance_type] ?? race.distance_type}
                {race.source_filename ? ` · ${race.source_filename}` : ""}
                {" · "}
                reitinge {included}/{results.length}
              </p>
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
          </section>
        );
      })}
    </div>
  );
}

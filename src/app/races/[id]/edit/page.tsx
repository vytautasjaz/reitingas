import Link from "next/link";
import { notFound } from "next/navigation";
import { RaceEditForm } from "@/components/RaceEditForm";
import { getDb } from "@/lib/db";
import { listMembers } from "@/lib/members";
import { getRace, getRaceResults } from "@/lib/ranking";

export const dynamic = "force-dynamic";

export default async function RaceEditPage({
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

  return (
    <div>
      <div className="page-header">
        <div>
          <Link
            href={`/races/${race.id}`}
            style={{
              color: "var(--muted)",
              fontSize: "0.85rem",
              fontWeight: 600,
            }}
          >
            ← Atgal į varžybas
          </Link>
          <h1 style={{ marginTop: "0.5rem" }}>Redaguoti · {race.name}</h1>
          <p>
            Koreguokite info, taškų bazę ir dalyvių sąrašą. Reitingas
            perskaičiuojamas automatiškai.
          </p>
        </div>
      </div>

      <RaceEditForm race={race} results={results} members={members} />
    </div>
  );
}

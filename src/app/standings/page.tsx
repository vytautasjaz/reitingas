import { GenderFilter } from "@/components/GenderFilter";
import { RankingTable } from "@/components/RankingTable";
import {
  computeStandings,
  countStandingsBySex,
  groupRacesIntoEvents,
  SexFilter,
} from "@/lib/ranking";
import { backfillMemberSexFromNames } from "@/lib/members";
import { getDb } from "@/lib/db";
import { backfillPlaceBySexFromSources } from "@/lib/place-by-sex";
import { getActiveSeasonYear } from "@/lib/season";

export const dynamic = "force-dynamic";

function parseSexFilter(raw: string | string[] | undefined): SexFilter {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "M" || value === "F") return value;
  return "all";
}

export default async function StandingsPage({
  searchParams,
}: {
  searchParams: Promise<{ sex?: string }>;
}) {
  getDb();
  backfillMemberSexFromNames();
  backfillPlaceBySexFromSources();

  const year = await getActiveSeasonYear();
  const params = await searchParams;
  const sexFilter = parseSexFilter(params.sex);
  const events = groupRacesIntoEvents(undefined, year);
  const counts = countStandingsBySex(year);
  const standings = computeStandings(3, sexFilter, year);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Detali įskaita {year}</h1>
          <p>
            Pilna lentelė pagal 3 geriausių varžybų taškų sumą. Galima filtruoti pagal
            lytį ir rūšiuoti stulpelius.
          </p>
        </div>
      </div>

      <GenderFilter active={sexFilter} counts={counts} basePath="/standings" />

      <RankingTable standings={standings} events={events} />
    </div>
  );
}

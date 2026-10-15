import { TopAthletes } from "@/components/TopAthletes";
import {
  groupRacesIntoEvents,
  topStandings,
} from "@/lib/ranking";
import { listMembers, backfillMemberSexFromNames } from "@/lib/members";
import { getDb } from "@/lib/db";
import { backfillPlaceBySexFromSources } from "@/lib/place-by-sex";
import { getActiveSeasonYear } from "@/lib/season";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  getDb();
  backfillMemberSexFromNames();
  backfillPlaceBySexFromSources();

  const year = await getActiveSeasonYear();
  const bestN = getSettings().bestN;
  const members = listMembers();
  const events = groupRacesIntoEvents(undefined, year);
  const topMen = topStandings("M", undefined, year);
  const topWomen = topStandings("F", undefined, year);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Bendra įskaita {year}</h1>
          <p className="page-lead">
            {bestN} geriausių etapų suma · pokytis nuo praėjusio etapo · OD ir SD
            tą pačią dieną skaitomi kaip vienas etapas
          </p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Nariai</div>
          <div className="stat-value">{members.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Etapai</div>
          <div className="stat-value">{events.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Vyrai / moterys</div>
          <div className="stat-value">
            {topMen.length}
            <span className="stat-split">/</span>
            {topWomen.length}
          </div>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="card card-pad muted">
          Šiam sezonui ({year}) dar nėra varžybų. Įkelkite protokolą arba
          suveskite rezultatus skiltyje Varžybos.
        </div>
      ) : (
        <TopAthletes
          men={topMen}
          women={topWomen}
          events={events}
          bestN={bestN}
        />
      )}
    </div>
  );
}

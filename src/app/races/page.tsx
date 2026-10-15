import { RaceList } from "@/components/RaceList";
import { RacesEntrySection } from "@/components/RacesEntrySection";
import { getDb } from "@/lib/db";
import { listMembers } from "@/lib/members";
import { listMeetsWithRaces } from "@/lib/meets";
import { getActiveSeasonYear } from "@/lib/season";

export const dynamic = "force-dynamic";

export default async function RacesPage() {
  getDb();
  const year = await getActiveSeasonYear();
  const meets = listMeetsWithRaces(year);
  const members = listMembers().map((m) => ({
    id: m.id,
    display_name: m.display_name,
  }));

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1>Varžybos {year}</h1>
          <p>
            Sezono ({year}) varžybos. Protokolą ar rankinį įvedimą rasite po
            lentele.
          </p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800 }}>
          {year} m. varžybos ({meets.length})
        </h2>
        <RaceList meets={meets} />
        <RacesEntrySection members={members} />
      </section>
    </div>
  );
}

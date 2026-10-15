import { MembersTable } from "@/components/MembersTable";
import { getDb } from "@/lib/db";
import {
  backfillMemberSexFromNames,
  listMembers,
  repairMemberSexes,
  syncOfficialRoster,
} from "@/lib/members";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

async function syncRosterAction() {
  "use server";
  getDb();
  syncOfficialRoster();
  revalidatePath("/");
  revalidatePath("/members");
  revalidatePath("/standings");
  revalidatePath("/races");
}

async function repairSexAction() {
  "use server";
  getDb();
  repairMemberSexes();
  revalidatePath("/");
  revalidatePath("/members");
}

export default function MembersPage() {
  getDb();
  backfillMemberSexFromNames();
  const members = listMembers();
  const men = members.filter((m) => m.sex === "M").length;
  const women = members.filter((m) => m.sex === "F").length;
  const unknown = members.filter((m) => m.sex == null).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Reitinguojami nariai</h1>
          <p>
            Oficialus klubo sąrašas — tik šie sportininkai patenka į reitingą.
            Protokoluose kiti Tritono vardai gali likti istorijai, bet be taškų.
            Sezono pabaigoje ankstesnių metų įskaitą išsaugo sezonų perjungiklis.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <form action={repairSexAction}>
            <button type="submit" className="btn btn-ghost">
              Sutvarkyti lytis
            </button>
          </form>
          <form action={syncRosterAction}>
            <button type="submit" className="btn btn-primary">
              Sinchronizuoti sąrašą
            </button>
          </form>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Sąraše</div>
          <div className="stat-value">{members.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Vyrai</div>
          <div className="stat-value">{men}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Moterys</div>
          <div className="stat-value">{women}</div>
        </div>
        {unknown > 0 && (
          <div className="stat-card">
            <div className="stat-label">Be lyties</div>
            <div className="stat-value">{unknown}</div>
          </div>
        )}
      </div>

      <MembersTable members={members} />
    </div>
  );
}

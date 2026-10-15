import { MembersTable } from "@/components/MembersTable";
import { getDb } from "@/lib/db";
import {
  backfillMemberSexFromNames,
  listMembers,
  repairMemberSexes,
  seedMembersFromWorkbook,
} from "@/lib/members";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

async function seedAction() {
  "use server";
  getDb();
  seedMembersFromWorkbook();
  backfillMemberSexFromNames();
  revalidatePath("/");
  revalidatePath("/members");
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
          <h1>Nariai</h1>
          <p>
            Redaguokite vardą ir lytį. Rankiniu būdu pataisyta lytis nebus
            perrašyta iš naujų protokolų. V / M — greitas lyties perjungimas.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <form action={repairSexAction}>
            <button type="submit" className="btn btn-primary">
              Sutvarkyti lytis
            </button>
          </form>
          <form action={seedAction}>
            <button type="submit" className="btn btn-ghost">
              Seed iš Sample Excel
            </button>
          </form>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Iš viso</div>
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

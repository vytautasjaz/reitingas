import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getMeet, getMeetRaces } from "@/lib/meets";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    getDb();
    const { id } = await context.params;
    const meetId = Number(id);
    const meet = getMeet(meetId);
    if (!meet) {
      return NextResponse.json({ ok: false, error: "Varžybos nerastos" }, { status: 404 });
    }
    const races = getMeetRaces(meetId);
    return NextResponse.json({
      ok: true,
      meet: {
        id: meet.id,
        name: meet.name,
        meet_date: meet.meet_date,
        races: races.map((r) => ({
          id: r.id,
          name: r.name,
          distance_type: r.distance_type,
        })),
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Klaida",
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { removeRaceResult, updateRaceResult } from "@/lib/race-admin";
import { getRace } from "@/lib/ranking";

export const runtime = "nodejs";

function revalidate(raceId: number) {
  revalidatePath("/");
  revalidatePath("/races");
  revalidatePath(`/races/${raceId}`);
  revalidatePath(`/races/${raceId}/edit`);
  revalidatePath("/meets");
  revalidatePath("/members");
  const race = getRace(raceId);
  if (race?.meet_id != null) {
    revalidatePath(`/meets/${race.meet_id}`);
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; resultId: string }> }
) {
  try {
    getDb();
    const { id, resultId } = await context.params;
    const raceId = Number(id);
    const rid = Number(resultId);
    if (!Number.isFinite(raceId) || !Number.isFinite(rid)) {
      return NextResponse.json({ ok: false, error: "Neteisingas ID" }, { status: 400 });
    }

    if (!getRace(raceId)) {
      return NextResponse.json({ ok: false, error: "Varžybos nerastos" }, { status: 404 });
    }

    const body = (await req.json()) as {
      name?: string;
      club?: string | null;
      place?: number | null;
      timeText?: string | null;
      points?: number | null;
      includedInRating?: boolean;
      recalcPoints?: boolean;
    };

    const result = updateRaceResult(raceId, rid, {
      name: body.name,
      club: body.club,
      place: body.place,
      timeText: body.timeText,
      points: body.points,
      includedInRating: body.includedInRating,
      recalcPoints: body.recalcPoints,
    });

    revalidate(raceId);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Nepavyko išsaugoti",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string; resultId: string }> }
) {
  try {
    getDb();
    const { id, resultId } = await context.params;
    const raceId = Number(id);
    const rid = Number(resultId);
    if (!Number.isFinite(raceId) || !Number.isFinite(rid)) {
      return NextResponse.json({ ok: false, error: "Neteisingas ID" }, { status: 400 });
    }

    if (!getRace(raceId)) {
      return NextResponse.json({ ok: false, error: "Varžybos nerastos" }, { status: 404 });
    }

    removeRaceResult(raceId, rid);
    revalidate(raceId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Nepavyko pašalinti",
      },
      { status: 500 }
    );
  }
}

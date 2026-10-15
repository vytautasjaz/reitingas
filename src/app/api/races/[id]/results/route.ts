import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { Sex } from "@/lib/gender";
import { addManualResult } from "@/lib/race-admin";
import { getRace } from "@/lib/ranking";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    getDb();
    const { id } = await context.params;
    const raceId = Number(id);
    if (!Number.isFinite(raceId)) {
      return NextResponse.json({ ok: false, error: "Neteisingas ID" }, { status: 400 });
    }

    if (!getRace(raceId)) {
      return NextResponse.json({ ok: false, error: "Varžybos nerastos" }, { status: 404 });
    }

    const body = (await req.json()) as {
      memberId?: number | null;
      name?: string;
      club?: string;
      sex?: Sex | null;
      timeText?: string | null;
      points?: number | null;
      place?: number | null;
      includedInRating?: boolean;
    };

    const result = addManualResult(raceId, {
      memberId: body.memberId ?? null,
      name: body.name,
      club: body.club,
      sex: body.sex ?? null,
      timeText: body.timeText,
      points: body.points ?? null,
      place: body.place ?? null,
      includedInRating: body.includedInRating !== false,
    });

    revalidatePath("/");
    revalidatePath("/races");
    revalidatePath(`/races/${raceId}`);
    revalidatePath(`/races/${raceId}/edit`);
    revalidatePath("/members");

    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Nepavyko pridėti",
      },
      { status: 500 }
    );
  }
}

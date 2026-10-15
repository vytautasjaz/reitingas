import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { DistanceType, getDb } from "@/lib/db";
import { deleteRace } from "@/lib/import-race";
import { updateRace } from "@/lib/race-admin";
import { getRace } from "@/lib/ranking";
import { parseTimeToSeconds } from "@/lib/scoring";

export const runtime = "nodejs";

function revalidateRace(raceId: number) {
  revalidatePath("/");
  revalidatePath("/races");
  revalidatePath(`/races/${raceId}`);
  revalidatePath(`/races/${raceId}/edit`);
  revalidatePath("/members");
}

export async function PATCH(
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

    const existing = getRace(raceId);
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Varžybos nerastos" }, { status: 404 });
    }

    const body = (await req.json()) as {
      name?: string;
      raceDate?: string;
      distanceType?: DistanceType;
      leaderTime?: string | null;
    };

    if (!body.name?.trim() || !body.raceDate || !body.distanceType) {
      return NextResponse.json(
        { ok: false, error: "Trūksta privalomų laukų" },
        { status: 400 }
      );
    }

    if (!["sprint", "olympic", "half", "full"].includes(body.distanceType)) {
      return NextResponse.json(
        { ok: false, error: "Neteisinga distancija" },
        { status: 400 }
      );
    }

    let leaderTimeSeconds: number | null | undefined = undefined;
    if (body.leaderTime !== undefined) {
      if (body.leaderTime == null || body.leaderTime.trim() === "") {
        leaderTimeSeconds = null;
      } else {
        const parsed = parseTimeToSeconds(body.leaderTime);
        if (parsed == null) {
          return NextResponse.json(
            { ok: false, error: "Neteisingas lyderio laikas" },
            { status: 400 }
          );
        }
        leaderTimeSeconds = parsed;
      }
    }

    const race = updateRace(raceId, {
      name: body.name,
      raceDate: body.raceDate,
      distanceType: body.distanceType,
      leaderTimeSeconds,
    });

    revalidateRace(raceId);
    return NextResponse.json({ ok: true, race });
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
  context: { params: Promise<{ id: string }> }
) {
  try {
    getDb();
    const { id } = await context.params;
    const raceId = Number(id);
    if (!Number.isFinite(raceId)) {
      return NextResponse.json({ ok: false, error: "Neteisingas ID" }, { status: 400 });
    }

    const race = getRace(raceId);
    if (!race) {
      return NextResponse.json({ ok: false, error: "Varžybos nerastos" }, { status: 404 });
    }

    deleteRace(raceId);

    revalidateRace(raceId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Nepavyko ištrinti",
      },
      { status: 500 }
    );
  }
}

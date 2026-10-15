import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { deleteMeet } from "@/lib/import-race";
import { getMeet, getMeetRaces, updateMeet } from "@/lib/meets";
import { setRaceLeaderTime } from "@/lib/race-admin";
import { parseTimeToSeconds } from "@/lib/scoring";

export const runtime = "nodejs";

function revalidateAll(meetId: number) {
  revalidatePath("/");
  revalidatePath("/races");
  revalidatePath("/meets");
  revalidatePath(`/meets/${meetId}`);
  revalidatePath(`/meets/${meetId}/edit`);
  revalidatePath("/members");
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    getDb();
    const { id } = await context.params;
    const meetId = Number(id);
    if (!Number.isFinite(meetId) || !getMeet(meetId)) {
      return NextResponse.json({ ok: false, error: "Varžybos nerastos" }, { status: 404 });
    }

    const body = (await req.json()) as {
      name?: string;
      meetDate?: string;
      foreignStart?: boolean;
      raceLeaders?: Array<{ raceId: number; leaderTime?: string | null }>;
    };
    if (!body.name?.trim() || !body.meetDate) {
      return NextResponse.json(
        { ok: false, error: "Trūksta privalomų laukų" },
        { status: 400 }
      );
    }

    const meetRaces = getMeetRaces(meetId);
    const meetRaceIds = new Set(meetRaces.map((r) => r.id));

    if (body.raceLeaders?.length) {
      for (const item of body.raceLeaders) {
        if (!meetRaceIds.has(item.raceId)) {
          return NextResponse.json(
            { ok: false, error: "Distancija nepriklauso šioms varžyboms" },
            { status: 400 }
          );
        }
        // Empty field = leave existing leader time alone. Clearing to null
        // used to wipe points via recalculateAllPoints / bad MIN recovery.
        const raw = item.leaderTime?.trim() ?? "";
        if (!raw) continue;
        const parsed = parseTimeToSeconds(raw);
        if (parsed == null || parsed <= 0) {
          return NextResponse.json(
            { ok: false, error: "Neteisingas nugalėtojo laikas" },
            { status: 400 }
          );
        }
        setRaceLeaderTime(item.raceId, parsed);
        revalidatePath(`/races/${item.raceId}`);
        revalidatePath(`/races/${item.raceId}/edit`);
      }
    }

    const meet = updateMeet(meetId, {
      name: body.name,
      meetDate: body.meetDate,
      foreignStart: !!body.foreignStart,
    });
    revalidateAll(meetId);
    return NextResponse.json({ ok: true, meet });
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
    const meetId = Number(id);
    if (!Number.isFinite(meetId) || !getMeet(meetId)) {
      return NextResponse.json({ ok: false, error: "Varžybos nerastos" }, { status: 404 });
    }

    deleteMeet(meetId);
    revalidateAll(meetId);
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

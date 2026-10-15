import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getDb, DistanceType } from "@/lib/db";
import {
  createManualMeet,
  type ManualLegInput,
  type ManualParticipantInput,
} from "@/lib/meets";

export const runtime = "nodejs";

type Body = {
  name?: string;
  meetDate?: string;
  foreignStart?: boolean;
  legs?: Array<{
    distanceType?: DistanceType;
    leaderTimeText?: string;
    fieldSize?: number | null;
    participants?: Array<{
      memberId?: number | null;
      name?: string;
      place?: number | null;
      timeText?: string;
      club?: string;
    }>;
  }>;
};

export async function POST(req: NextRequest) {
  try {
    getDb();
    const body = (await req.json()) as Body;

    if (!body.name?.trim() || !body.meetDate) {
      return NextResponse.json(
        { ok: false, error: "Trūksta pavadinimo arba datos" },
        { status: 400 }
      );
    }
    if (!body.legs?.length) {
      return NextResponse.json(
        { ok: false, error: "Pridėkite bent vieną distanciją" },
        { status: 400 }
      );
    }

    const legs: ManualLegInput[] = body.legs.map((leg, i) => {
      if (
        leg.distanceType !== "sprint" &&
        leg.distanceType !== "olympic" &&
        leg.distanceType !== "half" &&
        leg.distanceType !== "full"
      ) {
        throw new Error(`Distancija ${i + 1}: neteisingas tipas`);
      }
      if (!leg.leaderTimeText?.trim()) {
        throw new Error(`Distancija ${i + 1}: įveskite nugalėtojo laiką`);
      }

      const participants: ManualParticipantInput[] = (leg.participants ?? [])
        .filter(
          (p) =>
            p.memberId != null ||
            !!p.name?.trim() ||
            !!p.timeText?.trim() ||
            p.place != null
        )
        .map((p) => ({
          memberId: p.memberId ?? null,
          name: p.name,
          place: p.place ?? null,
          timeText: p.timeText ?? "",
          club: p.club,
        }));

      const fieldSize =
        leg.fieldSize != null &&
        Number.isFinite(Number(leg.fieldSize)) &&
        Number(leg.fieldSize) > 0
          ? Math.round(Number(leg.fieldSize))
          : null;

      return {
        distanceType: leg.distanceType,
        leaderTimeText: leg.leaderTimeText,
        fieldSize,
        participants,
      };
    });

    const result = createManualMeet({
      name: body.name,
      meetDate: body.meetDate,
      foreignStart: !!body.foreignStart,
      legs,
    });

    revalidatePath("/");
    revalidatePath("/standings");
    revalidatePath("/races");
    revalidatePath("/meets");
    revalidatePath(`/meets/${result.meetId}`);
    revalidatePath("/members");

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Nepavyko sukurti",
      },
      { status: 400 }
    );
  }
}

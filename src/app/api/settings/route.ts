import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import {
  addCustomDistance,
  formulaDescription,
  getSettings,
  recalculateAllPoints,
  removeDistance,
  saveSettings,
  type AppSettings,
  type DistanceSetting,
} from "@/lib/settings";

export const runtime = "nodejs";

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/standings");
  revalidatePath("/races");
  revalidatePath("/meets");
  revalidatePath("/members");
  revalidatePath("/settings");
}

export async function GET() {
  try {
    getDb();
    const settings = getSettings();
    return NextResponse.json({
      ok: true,
      settings,
      formula: formulaDescription(settings),
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

type Body = {
  bestN?: number;
  foreignBonusPercent?: number;
  maxForeignInBestN?: number;
  formulaExponent?: number;
  distances?: DistanceSetting[];
  addDistance?: { label: string; shortLabel?: string; basePoints: number };
  removeDistanceId?: string;
};

export async function PUT(req: NextRequest) {
  try {
    getDb();
    const body = (await req.json()) as Body;

    if (body.removeDistanceId) {
      const settings = removeDistance(body.removeDistanceId);
      const recalc = recalculateAllPoints(settings);
      revalidateAll();
      return NextResponse.json({
        ok: true,
        settings,
        formula: formulaDescription(settings),
        recalc,
      });
    }

    if (body.addDistance) {
      const settings = addCustomDistance(body.addDistance);
      revalidateAll();
      return NextResponse.json({
        ok: true,
        settings,
        formula: formulaDescription(settings),
      });
    }

    const patch: Partial<AppSettings> = {};
    if (body.bestN != null) patch.bestN = body.bestN;
    if (body.foreignBonusPercent != null) {
      patch.foreignBonusPercent = body.foreignBonusPercent;
    }
    if (body.maxForeignInBestN != null) {
      patch.maxForeignInBestN = body.maxForeignInBestN;
    }
    if (body.formulaExponent != null) {
      patch.formulaExponent = body.formulaExponent;
    }
    if (body.distances) patch.distances = body.distances;

    const settings = saveSettings(patch);
    const recalc = recalculateAllPoints(settings);
    revalidateAll();

    return NextResponse.json({
      ok: true,
      settings,
      formula: formulaDescription(settings),
      recalc,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Nepavyko išsaugoti",
      },
      { status: 400 }
    );
  }
}

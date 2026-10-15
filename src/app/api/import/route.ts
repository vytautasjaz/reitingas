import { NextRequest, NextResponse } from "next/server";
import { getDb, DistanceType } from "@/lib/db";
import { importMeet } from "@/lib/import-race";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";

const DISTANCES = new Set(["sprint", "olympic", "half", "full"]);

export async function POST(req: NextRequest) {
  try {
    getDb();
    const form = await req.formData();
    const name = String(form.get("name") ?? "").trim();
    const raceDate = String(form.get("raceDate") ?? "").trim();

    if (!name || !raceDate) {
      return NextResponse.json(
        { ok: false, error: "Pavadinimas ir data privalomi" },
        { status: 400 }
      );
    }

    const legCount = Number(form.get("legCount") ?? 0);
    const legs: Array<{
      distanceType: DistanceType;
      sourceFilename?: string;
      fileBuffer: Buffer;
    }> = [];

    if (legCount > 0) {
      for (let i = 0; i < legCount; i++) {
        const file = form.get(`legFile_${i}`);
        const distanceType = String(
          form.get(`legDistance_${i}`) ?? ""
        ).trim() as DistanceType;
        if (!(file instanceof File)) {
          return NextResponse.json(
            { ok: false, error: `Trūksta failo #${i + 1}` },
            { status: 400 }
          );
        }
        if (!DISTANCES.has(distanceType)) {
          return NextResponse.json(
            { ok: false, error: `Neteisinga distancija #${i + 1}` },
            { status: 400 }
          );
        }
        legs.push({
          distanceType,
          sourceFilename: file.name,
          fileBuffer: Buffer.from(await file.arrayBuffer()),
        });
      }
    } else {
      // Legacy single-file form
      const file = form.get("file");
      const distanceType = String(
        form.get("distanceType") ?? ""
      ).trim() as DistanceType;
      if (!(file instanceof File)) {
        return NextResponse.json(
          { ok: false, error: "Failas privalomas" },
          { status: 400 }
        );
      }
      if (!DISTANCES.has(distanceType)) {
        return NextResponse.json(
          { ok: false, error: "Neteisinga distancija" },
          { status: 400 }
        );
      }
      legs.push({
        distanceType,
        sourceFilename: file.name,
        fileBuffer: Buffer.from(await file.arrayBuffer()),
      });
    }

    const result = importMeet({
      name,
      meetDate: raceDate,
      legs,
    });

    revalidatePath("/");
    revalidatePath("/races");
    revalidatePath("/meets");
    revalidatePath("/members");

    return NextResponse.json({
      ok: true,
      meetId: result.meet.id,
      raceIds: result.races.map((r) => r.id),
      totalRows: result.totalRows,
      tritonasRows: result.tritonasRows,
      included: result.included,
      newMembers: result.newMembers,
      skippedMixed: result.skippedMixed,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Importas nepavyko",
      },
      { status: 500 }
    );
  }
}

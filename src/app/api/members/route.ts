import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { Sex } from "@/lib/gender";
import { addRatedMember } from "@/lib/members";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    getDb();
    const body = (await req.json()) as {
      displayName?: string;
      sex?: Sex | null;
    };
    if (!body.displayName?.trim()) {
      return NextResponse.json(
        { ok: false, error: "Įveskite vardą ir pavardę" },
        { status: 400 }
      );
    }
    if (
      body.sex !== undefined &&
      body.sex !== null &&
      body.sex !== "M" &&
      body.sex !== "F"
    ) {
      return NextResponse.json(
        { ok: false, error: "Neteisinga lytis" },
        { status: 400 }
      );
    }

    const member = addRatedMember(body.displayName, body.sex ?? null);
    revalidatePath("/");
    revalidatePath("/members");
    revalidatePath("/standings");
    revalidatePath("/races");
    return NextResponse.json({ ok: true, member });
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

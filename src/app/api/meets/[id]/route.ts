import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { deleteMeet } from "@/lib/import-race";
import { getMeet, updateMeet } from "@/lib/meets";

export const runtime = "nodejs";

function revalidateAll(meetId: number) {
  revalidatePath("/");
  revalidatePath("/races");
  revalidatePath("/meets");
  revalidatePath(`/meets/${meetId}`);
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

    const body = (await req.json()) as { name?: string; meetDate?: string };
    if (!body.name?.trim() || !body.meetDate) {
      return NextResponse.json(
        { ok: false, error: "Trūksta privalomų laukų" },
        { status: 400 }
      );
    }

    const meet = updateMeet(meetId, {
      name: body.name,
      meetDate: body.meetDate,
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

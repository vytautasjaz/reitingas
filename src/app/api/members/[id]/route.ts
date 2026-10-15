import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { Sex } from "@/lib/gender";
import {
  deactivateMember,
  getMember,
  updateMember,
} from "@/lib/members";

export const runtime = "nodejs";

function revalidate() {
  revalidatePath("/");
  revalidatePath("/members");
  revalidatePath("/races");
  revalidatePath("/meets");
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    getDb();
    const { id } = await context.params;
    const memberId = Number(id);
    if (!Number.isFinite(memberId) || !getMember(memberId)) {
      return NextResponse.json({ ok: false, error: "Narys nerastas" }, { status: 404 });
    }

    const body = (await req.json()) as {
      displayName?: string;
      sex?: Sex | null;
      active?: boolean;
    };

    if (body.sex !== undefined && body.sex !== null && body.sex !== "M" && body.sex !== "F") {
      return NextResponse.json({ ok: false, error: "Neteisinga lytis" }, { status: 400 });
    }

    const member = updateMember(memberId, {
      displayName: body.displayName,
      sex: body.sex,
      active: body.active,
    });

    revalidate();
    return NextResponse.json({ ok: true, member });
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
    const memberId = Number(id);
    if (!Number.isFinite(memberId) || !getMember(memberId)) {
      return NextResponse.json({ ok: false, error: "Narys nerastas" }, { status: 404 });
    }

    deactivateMember(memberId);
    revalidate();
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

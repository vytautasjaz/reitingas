import { NextRequest, NextResponse } from "next/server";
import { parseSeasonYear, SEASON_COOKIE } from "@/lib/season";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { year?: unknown };
    const year = parseSeasonYear(body.year);
    if (year == null) {
      return NextResponse.json(
        { ok: false, error: "Neteisingi metai" },
        { status: 400 }
      );
    }

    const res = NextResponse.json({ ok: true, year });
    res.cookies.set(SEASON_COOKIE, String(year), {
      path: "/",
      maxAge: 60 * 60 * 24 * 400,
      sameSite: "lax",
    });
    return res;
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Nepavyko",
      },
      { status: 500 }
    );
  }
}

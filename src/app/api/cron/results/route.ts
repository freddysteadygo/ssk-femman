import { NextRequest, NextResponse } from "next/server";
import { settleMatches } from "@/lib/ingest";
import { assertCron } from "../_auth";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Kör efter matchdagar. Hämtar matchrapporter, fyller stats och räknar poäng.
export async function GET(req: NextRequest) {
  const denied = assertCron(req);
  if (denied) return denied;
  const force = req.nextUrl.searchParams.get("force") === "1";
  try {
    const result = await settleMatches(force);
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}

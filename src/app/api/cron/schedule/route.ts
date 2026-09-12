import { NextRequest, NextResponse } from "next/server";
import { syncSchedule } from "@/lib/ingest";
import { assertCron } from "../_auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Kör t.ex. dagligen. Uppdaterar omgångar + matcher från swehockey.
export async function GET(req: NextRequest) {
  const denied = assertCron(req);
  if (denied) return denied;
  try {
    const result = await syncSchedule();
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}

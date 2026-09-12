import { NextRequest, NextResponse } from "next/server";

// Skyddar cron-endpoints. Godkänner antingen ?secret=... eller
// Authorization: Bearer <CRON_SECRET>. Vercel Cron skickar headern automatiskt
// om du sätter CRON_SECRET som env-variabel.
export function assertCron(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET saknas" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  const q = req.nextUrl.searchParams.get("secret");
  if (auth === `Bearer ${secret}` || q === secret) return null;
  return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

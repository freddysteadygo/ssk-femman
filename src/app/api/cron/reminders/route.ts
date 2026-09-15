import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { assertCron } from "../_auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Mejlar de som valt notis inför omgångar vars deadline är inom 24h.
// Körs varje timme; reminded_at hindrar dubbla utskick.
export async function GET(req: NextRequest) {
  const denied = assertCron(req);
  if (denied) return denied;

  const sb = createAdminClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://sskfemman.se";
  const now = new Date();
  const in24 = new Date(now.getTime() + 24 * 3600 * 1000);

  const { data: rounds } = await sb
    .from("rounds")
    .select("*")
    .eq("status", "open")
    .is("reminded_at", null)
    .gte("deadline", now.toISOString())
    .lte("deadline", in24.toISOString());

  let sent = 0;
  for (const r of rounds ?? []) {
    const { data: users } = await sb
      .from("profiles")
      .select("email")
      .eq("notify_round", true)
      .not("email", "is", null);

    const deadline = new Date(r.deadline).toLocaleString("sv-SE", { dateStyle: "full", timeStyle: "short" });
    const title = r.name ?? `Omgång ${r.number}`;
    const subject = `Dags att spela: ${title}`;
    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:520px">
        <h2 style="color:#122a6b">${title} är öppen</h2>
        <p>Deadline: <b>${deadline}</b>.</p>
        <p>Välj din femma, gissa målvakten och tippa matcherna innan det stänger.</p>
        <p><a href="${site}/spela" style="background:#1b3fb0;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">Till spelet</a></p>
        <p style="color:#5c6373;font-size:12px">Du får detta för att du valt notiser i SSK-femman. Ändra under Inställningar.</p>
      </div>`;

    for (const u of users ?? []) {
      if (!u.email) continue;
      try {
        await sendEmail(u.email, subject, html);
        sent++;
      } catch (e) {
        console.error("mejlfel:", e);
      }
    }
    await sb.from("rounds").update({ reminded_at: now.toISOString() }).eq("id", r.id);
  }

  return NextResponse.json({ ok: true, rounds: (rounds ?? []).length, sent });
}

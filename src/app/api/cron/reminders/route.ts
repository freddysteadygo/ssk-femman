import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { assertCron } from "../_auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ------------------------------------------------------------
// Påminnelsemejl inför omgång.
//
// Normalfall: skickas på KVÄLLEN innan deadline (19:30–20:30 svensk tid),
// vilket ger spelarna ~23h framförhållning. Pingas ofta av GitHub Actions;
// fönstret nedan avgör när det faktiskt blir ett utskick, så tidszonen
// blir rätt året om (sommar- och vintertid).
//
// Skyddsnät: om en omgångs deadline är inom FALLBACK_HOURS och påminnelsen
// ändå inte gått ut (kvällspingen uteblev), skickas den direkt oavsett
// klockslag. Då kan en påminnelse aldrig helt utebli.
//
// reminded_at sätts bara när minst ett mejl faktiskt gick fram — annars
// görs ett nytt försök vid nästa körning.
// ------------------------------------------------------------

const WINDOW_START_MIN = 19 * 60 + 30; // 19:30
const WINDOW_END_MIN = 20 * 60 + 30;   // 20:30
const FALLBACK_HOURS = 12;

/** Klockslag (minuter sedan midnatt) i Europe/Stockholm, oavsett serverns tidszon. */
function stockholmMinutes(d: Date): number {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}

export async function GET(req: NextRequest) {
  const denied = assertCron(req);
  if (denied) return denied;

  const force = req.nextUrl.searchParams.get("force") === "1";
  const sb = createAdminClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://www.sskfemman.se";
  const now = new Date();
  const in24 = new Date(now.getTime() + 24 * 3600 * 1000);

  const minutes = stockholmMinutes(now);
  const inWindow = minutes >= WINDOW_START_MIN && minutes <= WINDOW_END_MIN;

  const { data: rounds } = await sb
    .from("rounds")
    .select("*")
    .eq("status", "open")
    .is("reminded_at", null)
    .gte("deadline", now.toISOString())
    .lte("deadline", in24.toISOString());

  let sent = 0;
  let failed = 0;
  const handled: string[] = [];
  const waiting: string[] = [];

  for (const r of rounds ?? []) {
    const hoursLeft = (new Date(r.deadline).getTime() - now.getTime()) / 3_600_000;
    const urgent = hoursLeft <= FALLBACK_HOURS;
    const title = r.name ?? `Omgång ${r.number}`;

    // Utanför kvällsfönstret väntar vi — om det inte börjar bli bråttom.
    if (!force && !inWindow && !urgent) {
      waiting.push(title);
      continue;
    }

    const { data: users } = await sb
      .from("profiles")
      .select("email")
      .eq("notify_round", true)
      .not("email", "is", null);

    const deadline = new Date(r.deadline).toLocaleString("sv-SE", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "Europe/Stockholm",
    });
    const subject = `Dags att spela: ${title}`;
    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:520px">
        <h2 style="color:#122a6b">${title} är öppen</h2>
        <p>Deadline: <b>${deadline}</b>.</p>
        <p>
          Din femma från förra omgången följer med automatiskt — men du kan byta spelare, sätta
          kapten (dubbla poäng) och tippa matcherna fram till deadline.
        </p>
        <p><a href="${site}/spela" style="background:#1b3fb0;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">Till spelet</a></p>
        <p style="color:#5c6373;font-size:12px">Du får detta för att du valt notiser i SSK-femman. Ändra under Inställningar.</p>
      </div>`;

    const recipients = (users ?? []).filter((u) => u.email);
    let okThisRound = 0;
    for (const u of recipients) {
      try {
        await sendEmail(u.email as string, subject, html);
        sent++;
        okThisRound++;
      } catch (e) {
        failed++;
        console.error("mejlfel:", e);
      }
    }

    // Markera som påmind bara om något faktiskt gick fram (eller om det inte
    // fanns några mottagare alls) — annars försöker vi igen nästa körning.
    if (okThisRound > 0 || recipients.length === 0) {
      await sb.from("rounds").update({ reminded_at: now.toISOString() }).eq("id", r.id);
      handled.push(title);
    }
  }

  return NextResponse.json({
    ok: true,
    svenskTid: `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`,
    inWindow,
    kandidater: (rounds ?? []).length,
    skickade: sent,
    misslyckade: failed,
    paminda: handled,
    vantar: waiting,
  });
}

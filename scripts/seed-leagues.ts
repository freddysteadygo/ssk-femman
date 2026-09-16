// Skapar de publika lig­orna för säsongen. Kräver att en admin-profil finns
// (gör dig till admin först). Kör: npx tsx scripts/seed-leagues.ts
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

function isoWeekMonday(y: number, w: number): Date {
  const simple = new Date(Date.UTC(y, 0, 1 + (w - 1) * 7));
  const dow = simple.getUTCDay();
  const m = new Date(simple);
  if (dow <= 4) m.setUTCDate(simple.getUTCDate() - dow + 1);
  else m.setUTCDate(simple.getUTCDate() + 8 - dow);
  return m;
}
function weekRange(y1: number, w1: number, y2: number, w2: number) {
  const start = isoWeekMonday(y1, w1);
  const endMon = isoWeekMonday(y2, w2);
  const end = new Date(endMon);
  end.setUTCDate(endMon.getUTCDate() + 6);
  return { starts_on: start.toISOString().slice(0, 10), ends_on: end.toISOString().slice(0, 10) };
}

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const { data: admin } = await sb.from("profiles").select("id").eq("is_admin", true).limit(1).maybeSingle();
  if (!admin) {
    console.error("Ingen admin-profil hittad. Kör först: update profiles set is_admin=true where email='freddy@steadygo.se';");
    process.exit(1);
  }
  const owner = admin.id;

  const leagues = [
    { name: "Hel säsong", description: "Hela grundserien — vecka 38 och framåt.", prize: "Äran", starts_on: null, ends_on: null },
    { name: "SSK-femman #1 – Säsongsstart", description: "Vecka 38–44.", prize: "Presentkort 500:- på sodertaljeskshop.se", ...weekRange(2026, 38, 2026, 44) },
    { name: "SSK-femman #2 – Julrush", description: "Vecka 45–51. Går att anmäla sig till redan nu.", prize: null, ...weekRange(2026, 45, 2026, 51) },
    { name: "SSK-femman #3 – Vinterland", description: "Vecka 52–3. Går att anmäla sig till redan nu.", prize: null, ...weekRange(2026, 52, 2027, 3) },
    { name: "SSK-femman #4 – Slutspurt", description: "Vecka 4–9.", prize: null, ...weekRange(2027, 4, 2027, 9) },
  ];

  for (const L of leagues) {
    const { data: existing } = await sb.from("leagues").select("id").eq("name", L.name).maybeSingle();
    if (existing) {
      await sb.from("leagues").update({ ...L, type: "public" }).eq("id", existing.id);
      console.log("uppdaterade:", L.name);
      continue;
    }
    const { data: created, error } = await sb
      .from("leagues")
      .insert({ ...L, type: "public", owner_id: owner })
      .select("id")
      .single();
    if (error) {
      console.error(L.name, error.message);
      continue;
    }
    await sb.from("league_members").insert({ league_id: created.id, user_id: owner });
    console.log("skapade:", L.name, L.starts_on ? `(${L.starts_on} → ${L.ends_on})` : "(hela säsongen)");
  }
  console.log("Klart.");
}
main().then(() => process.exit(0));

// Rensar alla omgångar + matcher (och därmed stats/tips via cascade).
// Kör: npx tsx scripts/reset-matches.ts
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  // Supabase kräver ett filter på delete → matcha allt med created_at.
  const m = await sb.from("matches").delete().gte("created_at", "2000-01-01");
  const r = await sb.from("rounds").delete().gte("created_at", "2000-01-01");
  if (m.error) console.error("matches:", m.error.message);
  if (r.error) console.error("rounds:", r.error.message);
  console.log("Rensade matcher och omgångar. Kör 'npm run ingest:schedule' igen.");
}
main().then(() => process.exit(0));

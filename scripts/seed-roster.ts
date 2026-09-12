// Seedar SSK-truppen från supabase/roster.seed.json.
//   npm run seed:roster
import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const file = resolve(process.cwd(), "supabase/roster.seed.json");
  const { players } = JSON.parse(readFileSync(file, "utf8"));
  let n = 0;
  for (const p of players) {
    if (!p.full_name) continue;
    const { error } = await sb
      .from("players")
      .upsert(
        { full_name: p.full_name, position: p.position, jersey_no: p.jersey_no, active: true },
        { onConflict: "full_name" as any }
      );
    if (error) console.error(p.full_name, error.message);
    else n++;
  }
  console.log(`Seedade/uppdaterade ${n} spelare.`);
}
main().then(() => process.exit(0));

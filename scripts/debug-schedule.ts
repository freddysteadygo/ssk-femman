// Skriver ut exakt vilka SSK-matcher scrapern hittar i schemat.
// Kör: npx tsx scripts/debug-schedule.ts
import "dotenv/config";
import { getSskSchedule } from "../src/lib/swehockey";

async function main() {
  const id = process.env.SWEHOCKEY_SEASON_ID;
  if (!id) throw new Error("SWEHOCKEY_SEASON_ID saknas i .env");
  const fixtures = await getSskSchedule(id);
  console.log(`\nAntal SSK-matcher parsern hittade: ${fixtures.length}\n`);
  for (const f of fixtures) {
    console.log(
      `${f.date}  ${f.isHome ? "(H)" : "(B)"}  ${f.opponent}` +
        `${f.played ? `  ${f.sskGoals}-${f.oppGoals}` : ""}` +
        `${f.swehockeyGameId ? `  game=${f.swehockeyGameId}` : "  (ingen game-länk)"}`
    );
  }
}
main().then(() => process.exit(0));

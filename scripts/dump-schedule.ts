// Diagnos: hämtar schemat och skriver ut rå-HTML för en borta- och en
// hemmamatch så vi ser hur swehockey formaterar raderna.
// Kör: npx tsx scripts/dump-schedule.ts
import "dotenv/config";
import { writeFileSync } from "node:fs";

async function main() {
  const id = process.env.SWEHOCKEY_SEASON_ID;
  if (!id) throw new Error("SWEHOCKEY_SEASON_ID saknas");
  const res = await fetch(`https://stats.swehockey.se/ScheduleAndResults/Schedule/${id}`, {
    headers: { "User-Agent": "SSK-femman/0.1", "Accept-Language": "sv,en" },
  });
  const html = await res.text();
  writeFileSync("schedule-dump.html", html);
  console.log("Sparade schedule-dump.html (" + html.length + " tecken)\n");

  const trs = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  let leksand = 0;
  let sodertalje = 0;
  for (const tr of trs) {
    const flat = tr.replace(/\s+/g, " ").trim();
    if (/Leksand/i.test(flat) && leksand < 1) {
      console.log("=== RAD MED LEKSAND (borta?) ===");
      console.log(flat.slice(0, 1200), "\n");
      leksand++;
    }
    if (/Visby\/?Roma/i.test(flat) && sodertalje < 1) {
      console.log("=== RAD MED VISBY/ROMA (hemma) ===");
      console.log(flat.slice(0, 1200), "\n");
      sodertalje++;
    }
    if (leksand && sodertalje) break;
  }
  console.log(`Totalt antal <tr> på sidan: ${trs.length}`);
}
main().then(() => process.exit(0));

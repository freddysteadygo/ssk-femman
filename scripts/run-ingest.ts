// Lokal körning av ingest-jobb.
//   npm run ingest:schedule   → syncSchedule
//   npm run ingest:results    → settleMatches
//   npx tsx scripts/run-ingest.ts results --force
import "dotenv/config";
import { syncSchedule, settleMatches } from "../src/lib/ingest";

async function main() {
  const job = process.argv[2];
  const force = process.argv.includes("--force");
  if (job === "schedule") {
    console.log(await syncSchedule());
  } else if (job === "results") {
    console.log(await settleMatches(force));
  } else {
    console.error("Använd: run-ingest.ts <schedule|results> [--force]");
    process.exit(1);
  }
}
main().then(() => process.exit(0));

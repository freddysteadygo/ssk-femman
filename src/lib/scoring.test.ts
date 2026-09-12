// Enkla självtester för poängmotorn. Kör: npx tsx src/lib/scoring.test.ts
import { scoreSkater, scoreGoalie, scoreTip } from "./scoring";

let failed = 0;
function eq(name: string, got: number, want: number) {
  const ok = Math.abs(got - want) < 1e-9;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  got=${got} want=${want}`);
}

const S = (o: Partial<Parameters<typeof scoreSkater>[0]>) =>
  scoreSkater({ goals: 0, assists: 0, pp_points: 0, plus_minus: 0, minor_pen: 0, major_pen: 0, ...o });

// Utespelare
eq("2 mål + 1 assist", S({ goals: 2, assists: 1 }), 8);
eq("1 PP-mål (+0,5)", S({ goals: 1, pp_points: 1 }), 3.5);
eq("+/- +3 på isen", S({ plus_minus: 3 }), 1.5);
eq("+/- −2 (baklänges)", S({ plus_minus: -2 }), -1);
eq("en 2-min", S({ minor_pen: 1 }), -0.5);
eq("ett matchstraff (>2min)", S({ major_pen: 1 }), -2);
eq(
  "allt kombinerat",
  S({ goals: 1, assists: 1, pp_points: 1, plus_minus: 2, minor_pen: 1 }),
  3 + 2 + 0.5 + 1 - 0.5
);

// Målvakt (rätt gissad)
eq(
  "målvakt vinst 30 räddn 2 insl",
  scoreGoalie({ played: true, is_starter: true, saves: 30, goals_against: 2, shutout: false, win: true }, true),
  3 + 3 + 6 - 2
);
eq(
  "målvakt shutout 25 räddn",
  scoreGoalie({ played: true, is_starter: true, saves: 25, goals_against: 0, shutout: true, win: true }, true),
  3 + 3 + 5 + 2
);
eq(
  "fel gissad målvakt = 0",
  scoreGoalie({ played: true, is_starter: true, saves: 25, goals_against: 0, shutout: true, win: true }, false),
  0
);

// Resultattips (nya värden: 2 / 4)
eq("exakt 3-2", scoreTip(3, 2, 3, 2), 4);
eq("rätt vinnare fel siffror", scoreTip(3, 2, 4, 1), 2);
eq("fel vinnare", scoreTip(3, 2, 1, 2), 0);
eq("rätt oavgjort exakt", scoreTip(2, 2, 2, 2), 4);
eq("rätt oavgjort tecken", scoreTip(2, 2, 3, 3), 2);

console.log(failed === 0 ? "\nALLA TESTER OK" : `\n${failed} TEST(ER) MISSLYCKADES`);
if (failed > 0) process.exit(1);

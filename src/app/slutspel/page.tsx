import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const statusLabel = (s: string) =>
  s === "open" ? "Anmälan öppen" : s === "running" ? "Pågår" : "Avgjord";

export default async function SlutspelPage() {
  const sb = createClient();
  const { data: leagues } = await sb
    .from("playoff_leagues")
    .select("id, name, size, status, current_round, total_rounds")
    .order("created_at", { ascending: false });

  const ids = (leagues ?? []).map((l) => l.id);
  const counts = new Map<string, number>();
  if (ids.length) {
    const { data: parts } = await sb.from("playoff_participants").select("league_id").in("league_id", ids);
    for (const p of parts ?? []) counts.set(p.league_id, (counts.get(p.league_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Slutspel</h1>
        <p className="label mt-1">
          Utslagsträd — du möter en annan spelare varje omgång, den med flest femmapoäng går vidare.
        </p>
      </div>

      {(leagues ?? []).length === 0 && (
        <p className="label">Inga slutspelsligor än. Håll utkik — de startas upp löpande!</p>
      )}

      <div className="grid gap-2">
        {(leagues ?? []).map((l) => (
          <Link
            key={l.id}
            href={`/slutspel/${l.id}`}
            className="card flex items-center justify-between p-4 hover:border-ssk-orange"
          >
            <div>
              <div className="font-medium">{l.name}</div>
              <div className="label">
                {statusLabel(l.status)} · {counts.get(l.id) ?? 0}/{l.size} deltagare
              </div>
            </div>
            <span className="text-sm text-ssk-orange">Visa träd →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

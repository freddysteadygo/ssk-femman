import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FemmaPicker } from "@/components/FemmaPicker";

export const dynamic = "force-dynamic";

export default async function SpelaPage() {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/login");

  // Aktiv omgång: närmaste med deadline i framtiden, annars senaste öppna.
  const nowIso = new Date().toISOString();
  let { data: round } = await sb
    .from("rounds")
    .select("*")
    .gte("deadline", nowIso)
    .order("deadline", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!round) {
    const r = await sb
      .from("rounds")
      .select("*")
      .order("deadline", { ascending: false })
      .limit(1)
      .maybeSingle();
    round = r.data;
  }

  if (!round) {
    return (
      <div className="card p-6">
        <h1 className="text-xl font-bold">Ingen omgång ännu</h1>
        <p className="mt-2 text-sm text-ssk-muted">
          Spelschemat är inte inläst än. En admin behöver köra schema-synken (eller lägga in en omgång).
        </p>
      </div>
    );
  }

  const [{ data: players }, { data: matches }, { data: entry }] = await Promise.all([
    sb.from("players").select("*").eq("active", true).order("position").order("full_name"),
    // Tips: alla kommande matcher (flera omgångar fram), inte bara aktuell omgång
    sb.from("matches").select("*").eq("status", "upcoming").gte("starts_at", nowIso).order("starts_at").limit(40),
    sb.from("entries").select("id, goalie_id").eq("round_id", round.id).eq("user_id", user.id).maybeSingle(),
  ]);

  let picks: string[] = [];
  if (entry) {
    const { data: p } = await sb.from("entry_picks").select("player_id").eq("entry_id", entry.id);
    picks = (p ?? []).map((x) => x.player_id);
  }

  const matchIds = (matches ?? []).map((m) => m.id);
  const { data: tips } = matchIds.length
    ? await sb.from("result_tips").select("*").eq("user_id", user.id).in("match_id", matchIds)
    : { data: [] as any[] };

  const locked = round.status !== "open" || new Date(round.deadline) < new Date();

  return (
    <FemmaPicker
      round={round}
      players={players ?? []}
      matches={matches ?? []}
      initialPicks={picks}
      initialGoalie={entry?.goalie_id ?? null}
      initialTips={(tips ?? []).map((t) => ({ match_id: t.match_id, pred_ssk: t.pred_ssk, pred_opp: t.pred_opp }))}
      locked={locked}
    />
  );
}

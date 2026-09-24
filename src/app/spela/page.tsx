import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FemmaPicker } from "@/components/FemmaPicker";
import { loadPlayerPoints } from "@/lib/player-points";

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

  const [{ data: players }, { data: matches }, entryRes] = await Promise.all([
    sb.from("players").select("*").eq("active", true).order("position").order("full_name"),
    // Tips: alla kommande matcher (flera omgångar fram), inte bara aktuell omgång
    sb.from("matches").select("*").eq("status", "upcoming").gte("starts_at", nowIso).order("starts_at").limit(120),
    sb
      .from("entries")
      .select("id, goalie_id, captain_id, carried_over")
      .eq("round_id", round.id)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  // Skyddsnät: om migration-kapten.sql inte körts saknas captain_id och
  // carried_over, och frågan ovan returnerar fel + null. Utan den här
  // fallbacken skulle spelarens sparade femma se raderad ut.
  let entry = entryRes.data as any;
  if (!entry && entryRes.error) {
    const { data: legacy } = await sb
      .from("entries")
      .select("id, goalie_id")
      .eq("round_id", round.id)
      .eq("user_id", user.id)
      .maybeSingle();
    entry = legacy ? { ...legacy, captain_id: null, carried_over: false } : null;
  }

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

  // ---- Poäng per spelare: senaste avgjorda omgången + totalt ----
  const pts = await loadPlayerPoints(sb);

  // ---- Din femma i den senast avgjorda omgången, spelare för spelare ----
  let lastRound: {
    name: string;
    femmaPoints: number;
    tipPoints: number;
    rows: { id: string; name: string; jersey: number | null; role: string; points: number; captain: boolean }[];
  } | null = null;

  if (pts.lastRoundId) {
    const prevRes = await sb
      .from("entries")
      .select("id, goalie_id, captain_id, points")
      .eq("round_id", pts.lastRoundId)
      .eq("user_id", user.id)
      .maybeSingle();
    let prevEntry = prevRes.data as any;
    if (!prevEntry && prevRes.error) {
      const { data: legacyPrev } = await sb
        .from("entries")
        .select("id, goalie_id, points")
        .eq("round_id", pts.lastRoundId)
        .eq("user_id", user.id)
        .maybeSingle();
      prevEntry = legacyPrev ? { ...legacyPrev, captain_id: null } : null;
    }

    if (prevEntry) {
      const { data: prevPicks } = await sb
        .from("entry_picks")
        .select("player_id")
        .eq("entry_id", prevEntry.id);

      const byId = new Map((players ?? []).map((p: any) => [p.id, p]));
      const rows = (prevPicks ?? []).map((pick: any) => {
        const pl: any = byId.get(pick.player_id);
        const base = pts.last[pick.player_id] ?? 0;
        const isCap = prevEntry.captain_id === pick.player_id;
        return {
          id: pick.player_id,
          name: pl?.full_name ?? "Spelare",
          jersey: pl?.jersey_no ?? null,
          role: pl?.position === "D" ? "Back" : "Forward",
          points: isCap ? Math.round(base * 2 * 100) / 100 : base,
          captain: isCap,
        };
      });

      if (prevEntry.goalie_id) {
        const gp: any = byId.get(prevEntry.goalie_id);
        rows.push({
          id: prevEntry.goalie_id,
          name: gp?.full_name ?? "Målvakt",
          jersey: gp?.jersey_no ?? null,
          role: "Målvakt",
          points: pts.last[prevEntry.goalie_id] ?? 0,
          captain: false,
        });
      }

      // Resultattips ligger utanför entries.points — hämta dem för omgångens
      // matcher så summan stämmer med den i ligatabellen.
      const { data: roundMatches } = await sb
        .from("matches")
        .select("id")
        .eq("round_id", pts.lastRoundId);
      const roundMatchIds = (roundMatches ?? []).map((m: any) => m.id);
      let tipPoints = 0;
      if (roundMatchIds.length) {
        const { data: roundTips } = await sb
          .from("result_tips")
          .select("points")
          .eq("user_id", user.id)
          .in("match_id", roundMatchIds);
        tipPoints = (roundTips ?? []).reduce((a: number, t: any) => a + (Number(t.points) || 0), 0);
      }

      lastRound = {
        name: pts.lastRoundName ?? "Förra omgången",
        femmaPoints: Number(prevEntry.points ?? 0),
        tipPoints: Math.round(tipPoints * 100) / 100,
        rows,
      };
    }
  }

  return (
    <FemmaPicker
      round={round}
      players={players ?? []}
      matches={matches ?? []}
      initialPicks={picks}
      initialGoalie={entry?.goalie_id ?? null}
      initialCaptain={entry?.captain_id ?? null}
      carriedOver={!!entry?.carried_over}
      initialTips={(tips ?? []).map((t) => ({ match_id: t.match_id, pred_ssk: t.pred_ssk, pred_opp: t.pred_opp }))}
      locked={locked}
      pointsLast={pts.last}
      pointsSeason={pts.season}
      lastRound={lastRound}
    />
  );
}

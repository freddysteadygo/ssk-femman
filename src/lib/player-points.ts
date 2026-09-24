// ============================================================
// SSK-femman — spelarpoäng för visning
// ------------------------------------------------------------
// Räknar ihop vad varje spelare gett i poäng, dels senaste avgjorda
// omgången, dels hela säsongen. Används i spelarlistan på /spela och i
// genomgången av förra omgångens femma.
//
// Målvaktspoäng är villkorade: du får dem bara om du gissat den målvakt som
// faktiskt startade. Siffran här är därför exakt vad det gav att välja den
// målvakten — en reserv som inte stod i mål visas som 0, vilket är sant.
// ============================================================

import { scoreGoalie } from "./scoring";

export interface PlayerPointsData {
  /** player_id -> poäng senaste avgjorda omgången */
  last: Record<string, number>;
  /** player_id -> poäng hela säsongen */
  season: Record<string, number>;
  lastRoundId: string | null;
  lastRoundName: string | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function loadPlayerPoints(sb: any): Promise<PlayerPointsData> {
  const { data: finals } = await sb
    .from("matches")
    .select("id, round_id, starts_at")
    .eq("status", "final")
    .order("starts_at", { ascending: false });

  const lastRoundId = finals?.[0]?.round_id ?? null;
  const finalIds = new Set((finals ?? []).map((m: any) => m.id));
  const lastMatchIds = new Set(
    (finals ?? []).filter((m: any) => m.round_id === lastRoundId).map((m: any) => m.id)
  );

  const [{ data: pms }, { data: gms }] = await Promise.all([
    sb.from("player_match_stats").select("player_id, points, match_id"),
    sb
      .from("goalie_match_stats")
      .select("player_id, match_id, played, is_starter, saves, goals_against, shutout, win"),
  ]);

  const last: Record<string, number> = {};
  const season: Record<string, number> = {};
  const add = (bag: Record<string, number>, id: string, v: number) => {
    bag[id] = round2((bag[id] ?? 0) + v);
  };

  for (const r of pms ?? []) {
    if (!finalIds.has(r.match_id)) continue;
    const pts = Number(r.points) || 0;
    add(season, r.player_id, pts);
    if (lastMatchIds.has(r.match_id)) add(last, r.player_id, pts);
  }

  for (const g of gms ?? []) {
    if (!finalIds.has(g.match_id)) continue;
    const pts = scoreGoalie(
      {
        played: g.played,
        is_starter: g.is_starter,
        saves: g.saves,
        goals_against: g.goals_against,
        shutout: g.shutout,
        win: g.win,
      },
      g.is_starter
    );
    add(season, g.player_id, pts);
    if (lastMatchIds.has(g.match_id)) add(last, g.player_id, pts);
  }

  let lastRoundName: string | null = null;
  if (lastRoundId) {
    const { data: r } = await sb
      .from("rounds")
      .select("number, name")
      .eq("id", lastRoundId)
      .maybeSingle();
    lastRoundName = r ? r.name ?? `Omgång ${r.number}` : null;
  }

  return { last, season, lastRoundId, lastRoundName };
}

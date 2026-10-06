// ============================================================
// SSK-femman — omgångshistorik
// ------------------------------------------------------------
// Allt som behövs för /omgangar: hur SSK:s matcher slutade, vilka som
// gjorde poängen, och vad varje deltagare fick ut av sin omgång.
//
// SYNLIGHET: andras femmor och tips visas bara för den man delar liga med,
// och bara för omgångar vars deadline passerat. Reglerna lever i
// visibleUserIds() och pastRounds() — ändra dem där, inte i vyerna.
//
// Läsningen sker med service-role eftersom RLS låser entries och tips till
// ägaren. Därför filtreras urvalet här i koden i stället, och varje fråga
// utgår från en redan begränsad lista av user_id.
// ============================================================

import { createAdminClient } from "./supabase/admin";
import { scoreGoalie } from "./scoring";

type Sb = ReturnType<typeof createAdminClient>;

export interface RoundMatch {
  id: string;
  opponent: string;
  isHome: boolean;
  startsAt: string;
  status: string;
  sskGoals: number | null;
  oppGoals: number | null;
  /** "W" | "L" | "OTW" | "OTL" | "T" | null */
  result: string | null;
  goals: {
    scorer: string;
    assists: string[];
    situation: string;
    time: string;
    isSsk: boolean;
  }[];
}

export interface EntryLine {
  playerId: string;
  name: string;
  jersey: number | null;
  position: string;
  points: number;
  captain: boolean;
  goalie: boolean;
}

export interface TipLine {
  matchId: string;
  opponent: string;
  isHome: boolean;
  predSsk: number;
  predOpp: number;
  actualSsk: number | null;
  actualOpp: number | null;
  points: number;
}

export interface ParticipantRound {
  userId: string;
  teamName: string;
  isMe: boolean;
  femmaPoints: number;
  tipPoints: number;
  total: number;
  carriedOver: boolean;
  lines: EntryLine[];
  tips: TipLine[];
}

export interface RoundSummary {
  id: string;
  number: number;
  name: string;
  deadline: string;
  matches: RoundMatch[];
  /** Inloggad användares egen totalsumma, null om ingen femma fanns. */
  myTotal: number | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Rapporten skriver "Souch, Carter" — vi visar "Carter Souch". */
function shortName(raw: string): string {
  const s = (raw || "").trim();
  if (!s.includes(",")) return s;
  const [last, first] = s.split(",").map((x) => x.trim());
  return first ? `${first} ${last}` : last;
}

/**
 * Omgångar vars deadline passerat, nyast först. En omgång vars deadline
 * ligger i framtiden får aldrig visas — då skulle man kunna se andras
 * femmor innan man låst sin egen.
 */
async function pastRounds(sb: Sb, limit = 30) {
  const { data } = await sb
    .from("rounds")
    .select("id, number, name, deadline")
    .lt("deadline", new Date().toISOString())
    .order("deadline", { ascending: false })
    .limit(limit);
  return data ?? [];
}

/** Användare vars femmor den inloggade får se: en själv + ligakamrater. */
async function visibleUserIds(sb: Sb, userId: string): Promise<Set<string>> {
  const visible = new Set<string>([userId]);

  const { data: myLeagues } = await sb
    .from("league_members")
    .select("league_id")
    .eq("user_id", userId);
  const leagueIds = (myLeagues ?? []).map((r) => r.league_id);
  if (!leagueIds.length) return visible;

  const { data: mates } = await sb
    .from("league_members")
    .select("user_id")
    .in("league_id", leagueIds);
  for (const m of mates ?? []) visible.add(m.user_id);
  return visible;
}

/** Matcher med resultat och SSK:s mål, för en uppsättning omgångar. */
async function matchesForRounds(sb: Sb, roundIds: string[]) {
  if (!roundIds.length) return new Map<string, RoundMatch[]>();

  const { data: matches } = await sb
    .from("matches")
    .select("id, round_id, opponent, is_home, starts_at, status, ssk_goals, opp_goals, result")
    .in("round_id", roundIds)
    .order("starts_at", { ascending: true });

  const matchIds = (matches ?? []).map((m) => m.id);
  const goalsByMatch = new Map<string, RoundMatch["goals"]>();

  if (matchIds.length) {
    const { data: goals } = await sb
      .from("match_goals")
      .select("match_id, second, time_text, situation, is_ssk, scorer, assists")
      .in("match_id", matchIds)
      .order("second", { ascending: true });

    for (const g of goals ?? []) {
      const list = goalsByMatch.get(g.match_id) ?? [];
      list.push({
        scorer: shortName(g.scorer),
        assists: (g.assists ?? []).map(shortName),
        situation: g.situation ?? "EQ",
        time: g.time_text ?? "",
        isSsk: g.is_ssk,
      });
      goalsByMatch.set(g.match_id, list);
    }
  }

  const byRound = new Map<string, RoundMatch[]>();
  for (const m of matches ?? []) {
    const list = byRound.get(m.round_id) ?? [];
    list.push({
      id: m.id,
      opponent: m.opponent,
      isHome: m.is_home,
      startsAt: m.starts_at,
      status: m.status,
      sskGoals: m.ssk_goals,
      oppGoals: m.opp_goals,
      result: m.result,
      goals: goalsByMatch.get(m.id) ?? [],
    });
    byRound.set(m.round_id, list);
  }
  return byRound;
}

/** Listvyn: omgångar med matchresultat och din egen totalsumma. */
export async function loadRoundList(userId: string): Promise<RoundSummary[]> {
  const sb = createAdminClient();
  const rounds = await pastRounds(sb);
  if (!rounds.length) return [];

  const roundIds = rounds.map((r) => r.id);
  const byRound = await matchesForRounds(sb, roundIds);

  const { data: myEntries } = await sb
    .from("entries")
    .select("round_id, points")
    .eq("user_id", userId)
    .in("round_id", roundIds);
  const myPoints = new Map((myEntries ?? []).map((e: any) => [e.round_id, Number(e.points) || 0]));

  // Tipspoäng ligger utanför entries.points — summera dem per omgång.
  const allMatchIds: string[] = [];
  const matchRound = new Map<string, string>();
  for (const [rid, list] of byRound) {
    for (const m of list) {
      allMatchIds.push(m.id);
      matchRound.set(m.id, rid);
    }
  }
  const tipTotals = new Map<string, number>();
  if (allMatchIds.length) {
    const { data: tips } = await sb
      .from("result_tips")
      .select("match_id, points")
      .eq("user_id", userId)
      .in("match_id", allMatchIds);
    for (const t of tips ?? []) {
      const rid = matchRound.get(t.match_id);
      if (!rid) continue;
      tipTotals.set(rid, round2((tipTotals.get(rid) ?? 0) + (Number(t.points) || 0)));
    }
  }

  return rounds.map((r) => {
    const hasEntry = myPoints.has(r.id);
    const total = hasEntry
      ? round2((myPoints.get(r.id) ?? 0) + (tipTotals.get(r.id) ?? 0))
      : null;
    return {
      id: r.id,
      number: r.number,
      name: r.name ?? `Omgång ${r.number}`,
      deadline: r.deadline,
      matches: byRound.get(r.id) ?? [],
      myTotal: total,
    };
  });
}

/** Detaljvyn: en omgång med alla synliga deltagares femmor och tips. */
export async function loadRoundDetail(
  roundId: string,
  userId: string
): Promise<{ round: RoundSummary; participants: ParticipantRound[] } | null> {
  const sb = createAdminClient();

  const { data: round } = await sb
    .from("rounds")
    .select("id, number, name, deadline")
    .eq("id", roundId)
    .maybeSingle();
  if (!round) return null;
  // Spärr: en omgång som inte låsts får inte öppnas, oavsett länk.
  if (new Date(round.deadline) > new Date()) return null;

  const byRound = await matchesForRounds(sb, [roundId]);
  const matches = byRound.get(roundId) ?? [];
  const matchIds = matches.map((m) => m.id);
  const matchById = new Map(matches.map((m) => [m.id, m]));

  const visible = await visibleUserIds(sb, userId);
  const userIds = [...visible];

  const [{ data: entries }, { data: players }] = await Promise.all([
    sb
      .from("entries")
      .select("id, user_id, goalie_id, captain_id, points, carried_over")
      .eq("round_id", roundId)
      .in("user_id", userIds),
    sb.from("players").select("id, full_name, jersey_no, position"),
  ]);
  const playerById = new Map((players ?? []).map((p: any) => [p.id, p]));

  const entryIds = (entries ?? []).map((e: any) => e.id);
  const { data: picks } = entryIds.length
    ? await sb.from("entry_picks").select("entry_id, player_id").in("entry_id", entryIds)
    : { data: [] as any[] };
  const picksByEntry = new Map<string, string[]>();
  for (const p of picks ?? []) {
    const list = picksByEntry.get(p.entry_id) ?? [];
    list.push(p.player_id);
    picksByEntry.set(p.entry_id, list);
  }

  // Poäng per spelare i just den här omgången.
  const skaterPts = new Map<string, number>();
  const goaliePts = new Map<string, number>();
  if (matchIds.length) {
    const [{ data: pms }, { data: gms }] = await Promise.all([
      sb.from("player_match_stats").select("player_id, points").in("match_id", matchIds),
      sb
        .from("goalie_match_stats")
        .select("player_id, played, is_starter, saves, goals_against, shutout, win")
        .in("match_id", matchIds),
    ]);
    for (const r of pms ?? []) {
      skaterPts.set(r.player_id, round2((skaterPts.get(r.player_id) ?? 0) + (Number(r.points) || 0)));
    }
    for (const g of gms ?? []) {
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
      goaliePts.set(g.player_id, round2((goaliePts.get(g.player_id) ?? 0) + pts));
    }
  }

  const { data: tips } = matchIds.length
    ? await sb
        .from("result_tips")
        .select("user_id, match_id, pred_ssk, pred_opp, points")
        .in("match_id", matchIds)
        .in("user_id", userIds)
    : { data: [] as any[] };
  const tipsByUser = new Map<string, any[]>();
  for (const t of tips ?? []) {
    const list = tipsByUser.get(t.user_id) ?? [];
    list.push(t);
    tipsByUser.set(t.user_id, list);
  }

  const { data: profiles } = await sb
    .from("profiles")
    .select("id, username, team_name")
    .in("id", userIds);
  const nameOf = new Map(
    (profiles ?? []).map((p: any) => [p.id, p.team_name || p.username || "Spelare"])
  );

  const participants: ParticipantRound[] = (entries ?? []).map((e: any) => {
    const ids = picksByEntry.get(e.id) ?? [];
    const lines: EntryLine[] = ids
      .map((pid) => {
        const p: any = playerById.get(pid);
        const base = skaterPts.get(pid) ?? 0;
        const isCap = e.captain_id === pid;
        return {
          playerId: pid,
          name: p?.full_name ?? "Spelare",
          jersey: p?.jersey_no ?? null,
          position: p?.position ?? "F",
          points: isCap ? round2(base * 2) : base,
          captain: isCap,
          goalie: false,
        };
      })
      .sort((a, b) => b.points - a.points);

    if (e.goalie_id) {
      const g: any = playerById.get(e.goalie_id);
      lines.push({
        playerId: e.goalie_id,
        name: g?.full_name ?? "Målvakt",
        jersey: g?.jersey_no ?? null,
        position: "G",
        points: goaliePts.get(e.goalie_id) ?? 0,
        captain: false,
        goalie: true,
      });
    }

    const myTips: TipLine[] = (tipsByUser.get(e.user_id) ?? []).map((t: any) => {
      const m = matchById.get(t.match_id);
      return {
        matchId: t.match_id,
        opponent: m?.opponent ?? "Match",
        isHome: m?.isHome ?? true,
        predSsk: t.pred_ssk,
        predOpp: t.pred_opp,
        actualSsk: m?.sskGoals ?? null,
        actualOpp: m?.oppGoals ?? null,
        points: Number(t.points) || 0,
      };
    });

    const femmaPoints = Number(e.points) || 0;
    const tipPoints = round2(myTips.reduce((a, t) => a + t.points, 0));

    return {
      userId: e.user_id,
      teamName: nameOf.get(e.user_id) ?? "Spelare",
      isMe: e.user_id === userId,
      femmaPoints,
      tipPoints,
      total: round2(femmaPoints + tipPoints),
      carriedOver: !!e.carried_over,
      lines,
      tips: myTips,
    };
  });

  participants.sort((a, b) => b.total - a.total);

  const me = participants.find((p) => p.isMe);
  return {
    round: {
      id: round.id,
      number: round.number,
      name: round.name ?? `Omgång ${round.number}`,
      deadline: round.deadline,
      matches,
      myTotal: me ? me.total : null,
    },
    participants,
  };
}

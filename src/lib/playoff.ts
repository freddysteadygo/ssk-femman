// ============================================================
// SSK-femman — slutspelslogik (single-elimination H2H)
// Körs med service-role (förbigår RLS). Endast server-side.
//   startPlayoff()        → seedar deltagare + skapar omgång 1
//   settleCurrentRound()  → avgör aktuell omgång, skapar nästa
// ============================================================

import { createAdminClient } from "./supabase/admin";

type Sb = ReturnType<typeof createAdminClient>;

function isPowerOfTwo(n: number): boolean {
  return n >= 2 && (n & (n - 1)) === 0;
}

/** Seedar deltagarna (anmälningsordning) och skapar omgång 1. */
export async function startPlayoff(sb: Sb, leagueId: string): Promise<void> {
  const { data: league } = await sb.from("playoff_leagues").select("*").eq("id", leagueId).single();
  if (!league) throw new Error("Slutspelsligan finns inte.");
  if (league.status !== "open") throw new Error("Slutspelet är redan startat.");

  const size: number = league.size;
  if (!isPowerOfTwo(size)) throw new Error("Antal deltagare måste vara 2, 4, 8, 16 eller 32.");
  const totalRounds = Math.round(Math.log2(size));

  const { data: parts } = await sb
    .from("playoff_participants")
    .select("user_id")
    .eq("league_id", leagueId)
    .order("joined_at", { ascending: true });
  const users = (parts ?? []).map((p) => p.user_id).slice(0, size);
  if (users.length < 2) throw new Error("Minst 2 anmälda krävs för att starta.");

  // Seed = anmälningsordning
  for (let i = 0; i < users.length; i++) {
    await sb.from("playoff_participants").update({ seed: i + 1 }).eq("league_id", leagueId).eq("user_id", users[i]);
  }

  // Fyll upp till size med frilotter (bye = null)
  const seats: (string | null)[] = [];
  for (let i = 0; i < size; i++) seats.push(users[i] ?? null);

  // Omgång 1: slot j = seats[2j] vs seats[2j+1]
  const matchups = [];
  for (let j = 0; j < size / 2; j++) {
    matchups.push({
      league_id: leagueId,
      round: 1,
      slot: j,
      p1_user: seats[2 * j],
      p2_user: seats[2 * j + 1],
      status: "pending" as const,
    });
  }
  const { error } = await sb.from("playoff_matchups").insert(matchups);
  if (error) throw new Error(error.message);

  await sb
    .from("playoff_leagues")
    .update({ status: "running", current_round: 1, total_rounds: totalRounds })
    .eq("id", leagueId);
}

/**
 * Avgör aktuell omgång: hämtar varje deltagares femmapoäng för den kopplade
 * speleomgången, sätter vinnare, eliminerar förlorare och skapar nästa omgång.
 */
export async function settleCurrentRound(sb: Sb, leagueId: string): Promise<void> {
  const { data: league } = await sb.from("playoff_leagues").select("*").eq("id", leagueId).single();
  if (!league) throw new Error("Slutspelsligan finns inte.");
  if (league.status !== "running") throw new Error("Slutspelet är inte igång.");

  const round: number = league.current_round;
  const { data: ms } = await sb
    .from("playoff_matchups")
    .select("*")
    .eq("league_id", leagueId)
    .eq("round", round)
    .order("slot", { ascending: true });
  const matchups = ms ?? [];
  if (!matchups.length) throw new Error("Inga matcher i omgången.");
  if (matchups.some((m) => !m.gw_round_id)) {
    throw new Error("Koppla en speleomgång till omgången innan den avgörs.");
  }

  async function pointsFor(userId: string | null, gwRoundId: string): Promise<number> {
    if (!userId) return 0;
    const { data } = await sb
      .from("entries")
      .select("points")
      .eq("user_id", userId)
      .eq("round_id", gwRoundId)
      .maybeSingle();
    return Number(data?.points ?? 0);
  }

  const winners: (string | null)[] = [];
  for (const m of matchups) {
    const p1 = m.p1_user as string | null;
    const p2 = m.p2_user as string | null;
    const p1pts = await pointsFor(p1, m.gw_round_id);
    const p2pts = await pointsFor(p2, m.gw_round_id);

    let winner: string | null = null;
    if (p1 && !p2) winner = p1;
    else if (p2 && !p1) winner = p2;
    else if (p1 && p2) winner = p1pts >= p2pts ? p1 : p2; // oavgjort → högre seed (lägre slot-sida)

    await sb
      .from("playoff_matchups")
      .update({ p1_points: p1pts, p2_points: p2pts, winner_user: winner, status: "done" })
      .eq("id", m.id);

    const loser = p1 && p2 ? (winner === p1 ? p2 : p1) : null;
    if (loser) {
      await sb.from("playoff_participants").update({ eliminated_round: round }).eq("league_id", leagueId).eq("user_id", loser);
    }
    winners[m.slot] = winner;
  }

  if (round >= league.total_rounds) {
    await sb.from("playoff_leagues").update({ status: "done" }).eq("id", leagueId);
    return;
  }

  // Nästa omgång: para ihop vinnarna slotvis
  const next = [];
  for (let j = 0; j < winners.length / 2; j++) {
    next.push({
      league_id: leagueId,
      round: round + 1,
      slot: j,
      p1_user: winners[2 * j] ?? null,
      p2_user: winners[2 * j + 1] ?? null,
      status: "pending" as const,
    });
  }
  const { error } = await sb.from("playoff_matchups").insert(next);
  if (error) throw new Error(error.message);
  await sb.from("playoff_leagues").update({ current_round: round + 1 }).eq("id", leagueId);
}

export const ROUND_NAMES: Record<number, string> = {
  1: "Final",
  2: "Semifinal",
  4: "Kvartsfinal",
  8: "Åttondelsfinal",
  16: "Sextondelsfinal",
};

/** Namn på en omgång givet hur många matcher den har. */
export function roundLabel(matchupsInRound: number): string {
  return ROUND_NAMES[matchupsInRound] ?? `Omgång (${matchupsInRound} matcher)`;
}

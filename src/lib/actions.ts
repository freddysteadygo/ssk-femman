"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import { recomputeRound } from "./ingest";
import { startPlayoff, settleCurrentRound } from "./playoff";
import { scoreSkater, scoreTip, regulationScore } from "./scoring";
import type { AdminSkaterLine, AdminGoalieLine } from "./types";

async function requireUser() {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("Inte inloggad");
  return { sb, user };
}

async function requireAdmin() {
  const { sb, user } = await requireUser();
  const { data } = await sb.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!data?.is_admin) throw new Error("Kräver admin");
  return { sb, user };
}

// ------------------------------------------------------------
// INSTÄLLNINGAR
// ------------------------------------------------------------
export async function setNotifyRound(enabled: boolean): Promise<{ ok: boolean; error?: string }> {
  try {
    const { sb, user } = await requireUser();
    const { error } = await sb.from("profiles").update({ notify_round: enabled }).eq("id", user.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/installningar");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

export async function setTeamName(name: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { sb, user } = await requireUser();
    const clean = name.trim().replace(/\s+/g, " ").slice(0, 40);
    if (clean.length < 2) return { ok: false, error: "Lagnamnet måste vara minst 2 tecken." };
    const { error } = await sb.from("profiles").update({ team_name: clean }).eq("id", user.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/installningar");
    revalidatePath("/ligor");
    revalidatePath("/scoreboard");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

// ------------------------------------------------------------
// FEMMA
// ------------------------------------------------------------
export async function saveEntry(
  roundId: string,
  playerIds: string[],
  goalieId: string | null
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { sb, user } = await requireUser();

    if (playerIds.length !== 5) return { ok: false, error: "Välj exakt 5 spelare (2 backar + 3 forwards)." };
    if (new Set(playerIds).size !== 5) return { ok: false, error: "Dubbletter bland spelarna." };

    // Validera sammansättning: exakt 2 backar + 3 forwards
    const { data: chosen } = await sb.from("players").select("id, position").in("id", playerIds);
    const backs = (chosen ?? []).filter((p) => p.position === "D").length;
    const fwds = (chosen ?? []).filter((p) => p.position === "F").length;
    if (backs !== 2 || fwds !== 3) {
      return { ok: false, error: "Femman måste vara exakt 2 backar och 3 forwards." };
    }

    const { data: round } = await sb.from("rounds").select("*").eq("id", roundId).single();
    if (!round) return { ok: false, error: "Omgången finns inte." };
    if (round.status !== "open" || new Date(round.deadline) < new Date()) {
      return { ok: false, error: "Omgången är låst." };
    }

    // upsert entry (RLS: user_id måste vara auth.uid())
    const { data: entry, error: e1 } = await sb
      .from("entries")
      .upsert(
        { user_id: user.id, round_id: roundId, goalie_id: goalieId, submitted_at: new Date().toISOString() },
        { onConflict: "user_id,round_id" }
      )
      .select("id")
      .single();
    if (e1 || !entry) return { ok: false, error: e1?.message ?? "Kunde inte spara." };

    await sb.from("entry_picks").delete().eq("entry_id", entry.id);
    const rows = playerIds.map((pid) => ({ entry_id: entry.id, player_id: pid }));
    const { error: e2 } = await sb.from("entry_picks").insert(rows);
    if (e2) return { ok: false, error: e2.message };

    revalidatePath("/spela");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

// ------------------------------------------------------------
// RESULTATTIPS
// ------------------------------------------------------------
export async function saveTip(
  matchId: string,
  predSsk: number,
  predOpp: number
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { sb, user } = await requireUser();
    const { data: match } = await sb.from("matches").select("*").eq("id", matchId).single();
    if (!match) return { ok: false, error: "Matchen finns inte." };
    if (new Date(match.starts_at) < new Date() || match.status !== "upcoming") {
      return { ok: false, error: "Matchen har startat — tips låst." };
    }
    if (predSsk < 0 || predOpp < 0 || predSsk > 30 || predOpp > 30) {
      return { ok: false, error: "Ogiltigt resultat." };
    }
    const { error } = await sb.from("result_tips").upsert(
      { user_id: user.id, match_id: matchId, pred_ssk: predSsk, pred_opp: predOpp },
      { onConflict: "user_id,match_id" }
    );
    if (error) return { ok: false, error: error.message };
    revalidatePath("/spela");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

export async function saveTips(
  items: { matchId: string; predSsk: number; predOpp: number }[]
): Promise<{ ok: boolean; error?: string; saved?: number }> {
  try {
    const { sb, user } = await requireUser();
    if (!items.length) return { ok: false, error: "Inga tips att spara." };
    const ids = items.map((i) => i.matchId);
    const { data: matchRows } = await sb.from("matches").select("id, starts_at, status").in("id", ids);
    const byId = new Map((matchRows ?? []).map((m: any) => [m.id, m]));
    const now = new Date();
    const rows = items
      .filter((it) => {
        const m = byId.get(it.matchId);
        if (!m) return false;
        if (new Date(m.starts_at) < now || m.status !== "upcoming") return false;
        return it.predSsk >= 0 && it.predOpp >= 0 && it.predSsk <= 30 && it.predOpp <= 30;
      })
      .map((it) => ({ user_id: user.id, match_id: it.matchId, pred_ssk: it.predSsk, pred_opp: it.predOpp }));
    if (!rows.length) return { ok: false, error: "Inga giltiga tips att spara (matcherna kan vara låsta)." };
    const { error } = await sb.from("result_tips").upsert(rows, { onConflict: "user_id,match_id" });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/spela");
    return { ok: true, saved: rows.length };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

// ------------------------------------------------------------
// LIGOR
// ------------------------------------------------------------
export async function createLeague(
  name: string,
  type: "public" | "private"
): Promise<{ ok: boolean; error?: string; id?: string }> {
  try {
    const { sb, user } = await requireUser();
    if (!name.trim()) return { ok: false, error: "Ange ett namn." };
    const { data, error } = await sb
      .from("leagues")
      .insert({ name: name.trim(), type, owner_id: user.id })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: error?.message };
    await sb.from("league_members").insert({ league_id: data.id, user_id: user.id });
    revalidatePath("/ligor");
    return { ok: true, id: data.id };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

export async function joinLeague(joinCode: string): Promise<{ ok: boolean; error?: string; id?: string }> {
  try {
    const { sb, user } = await requireUser();
    const code = joinCode.trim().toUpperCase();
    // service-role för att slå upp privat liga via kod (RLS skulle annars dölja den)
    const admin = createAdminClient();
    const { data: league } = await admin.from("leagues").select("id").eq("join_code", code).single();
    if (!league) return { ok: false, error: "Ingen liga med den koden." };
    const { error } = await sb
      .from("league_members")
      .insert({ league_id: league.id, user_id: user.id });
    if (error && !error.message.includes("duplicate")) return { ok: false, error: error.message };
    revalidatePath("/ligor");
    return { ok: true, id: league.id };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

export async function joinPublicLeague(leagueId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { sb, user } = await requireUser();
    // Anmälan öppnar 4 veckor före ligans start
    const admin = createAdminClient();
    const { data: league } = await admin.from("leagues").select("starts_on").eq("id", leagueId).maybeSingle();
    if (league?.starts_on) {
      const opens = new Date(`${league.starts_on}T00:00:00`);
      opens.setDate(opens.getDate() - 28);
      if (new Date() < opens) return { ok: false, error: "Anmälan har inte öppnat för den här ligan ännu." };
    }
    const { error } = await sb.from("league_members").insert({ league_id: leagueId, user_id: user.id });
    if (error && !error.message.includes("duplicate")) return { ok: false, error: error.message };
    revalidatePath("/ligor");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

export async function leaveLeague(leagueId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { sb, user } = await requireUser();
    await sb.from("league_members").delete().eq("league_id", leagueId).eq("user_id", user.id);
    revalidatePath("/ligor");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

// ------------------------------------------------------------
// ADMIN — hantera publika ligor
// ------------------------------------------------------------
export type AdminLeagueInput = {
  id?: string;
  name: string;
  description?: string;
  prize?: string;
  starts_on?: string | null;
  ends_on?: string | null;
};

export async function adminSaveLeague(
  input: AdminLeagueInput
): Promise<{ ok: boolean; error?: string; id?: string }> {
  try {
    const { user } = await requireAdmin();
    const admin = createAdminClient();
    const name = (input.name ?? "").trim();
    if (!name) return { ok: false, error: "Ange ett namn." };
    if (input.starts_on && input.ends_on && input.ends_on < input.starts_on) {
      return { ok: false, error: "Slutdatum kan inte vara före startdatum." };
    }
    const row = {
      name,
      type: "public" as const,
      description: input.description?.trim() || null,
      prize: input.prize?.trim() || null,
      starts_on: input.starts_on || null,
      ends_on: input.ends_on || null,
    };
    if (input.id) {
      const { error } = await admin.from("leagues").update(row).eq("id", input.id);
      if (error) return { ok: false, error: error.message };
      revalidatePath("/ligor");
      revalidatePath("/admin");
      revalidatePath("/scoreboard");
      return { ok: true, id: input.id };
    }
    const { data, error } = await admin
      .from("leagues")
      .insert({ ...row, owner_id: user.id })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Kunde inte skapa ligan." };
    await admin.from("league_members").insert({ league_id: data.id, user_id: user.id });
    revalidatePath("/ligor");
    revalidatePath("/admin");
    revalidatePath("/scoreboard");
    return { ok: true, id: data.id };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

export async function adminDeleteLeague(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    const { error } = await admin.from("leagues").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/ligor");
    revalidatePath("/admin");
    revalidatePath("/scoreboard");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

// ------------------------------------------------------------
// ADMIN — manuell resultat/statistik-override (fallback om scrape felar)
// ------------------------------------------------------------
export async function adminSaveMatch(
  matchId: string,
  sskGoals: number,
  oppGoals: number,
  skaters: AdminSkaterLine[],
  goalies: AdminGoalieLine[],
  overtime: boolean = false
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    const { data: match } = await admin.from("matches").select("*").eq("id", matchId).single();
    if (!match) return { ok: false, error: "Matchen finns inte." };
    const sskWon = sskGoals > oppGoals;

    await admin.from("player_match_stats").delete().eq("match_id", matchId);
    for (const s of skaters) {
      if (!s.player_id) continue;
      const line = {
        goals: s.goals || 0,
        assists: s.assists || 0,
        pp_points: s.pp_points || 0,
        plus_minus: s.plus_minus || 0,
        minor_pen: s.minor_pen || 0,
        major_pen: s.major_pen || 0,
      };
      await admin.from("player_match_stats").insert({
        match_id: matchId,
        player_id: s.player_id,
        ...line,
        pim: (s.minor_pen || 0) * 2 + (s.major_pen || 0) * 5,
        points: scoreSkater(line),
      });
    }

    await admin.from("goalie_match_stats").delete().eq("match_id", matchId);
    for (const g of goalies) {
      if (!g.player_id) continue;
      const shutout = g.is_starter && sskWon && (g.goals_against || 0) === 0;
      await admin.from("goalie_match_stats").insert({
        match_id: matchId,
        player_id: g.player_id,
        played: true,
        is_starter: g.is_starter,
        saves: g.saves || 0,
        shots_against: (g.saves || 0) + (g.goals_against || 0),
        goals_against: g.goals_against || 0,
        save_pct:
          (g.saves || 0) + (g.goals_against || 0) > 0
            ? Math.round(((g.saves || 0) / ((g.saves || 0) + (g.goals_against || 0))) * 10000) / 100
            : null,
        shutout,
        win: g.is_starter && sskWon,
        points: 0,
      });
    }

    await admin
      .from("matches")
      .update({
        status: "final",
        ssk_goals: sskGoals,
        opp_goals: oppGoals,
        result: overtime ? (sskWon ? "OTW" : "OTL") : sskWon ? "W" : sskGoals === oppGoals ? "T" : "L",
      })
      .eq("id", matchId);

    // tips för matchen — räknas mot ordinarie tid
    const reg = regulationScore(sskGoals, oppGoals, overtime);
    const { data: tips } = await admin.from("result_tips").select("*").eq("match_id", matchId);
    for (const t of tips ?? []) {
      await admin
        .from("result_tips")
        .update({ points: scoreTip(t.pred_ssk, t.pred_opp, reg.ssk, reg.opp) })
        .eq("id", t.id);
    }

    if (match.round_id) await recomputeRound(admin, match.round_id);
    revalidatePath("/admin");
    revalidatePath("/spela");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

// ------------------------------------------------------------
// SLUTSPELSLIGOR (H2H-utslagsträd)
// ------------------------------------------------------------
export async function adminCreatePlayoff(
  name: string,
  size: number
): Promise<{ ok: boolean; error?: string; id?: string }> {
  try {
    const { user } = await requireAdmin();
    const admin = createAdminClient();
    const nm = (name ?? "").trim();
    if (!nm) return { ok: false, error: "Ange ett namn." };
    if (![2, 4, 8, 16, 32].includes(size)) {
      return { ok: false, error: "Antal deltagare måste vara 2, 4, 8, 16 eller 32." };
    }
    const { data, error } = await admin
      .from("playoff_leagues")
      .insert({ name: nm, size, owner_id: user.id, status: "open" })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Kunde inte skapa." };
    revalidatePath("/slutspel");
    revalidatePath("/admin");
    return { ok: true, id: data.id };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

export async function joinPlayoff(leagueId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { sb, user } = await requireUser();
    const admin = createAdminClient();
    const { data: league } = await admin
      .from("playoff_leagues")
      .select("size, status")
      .eq("id", leagueId)
      .maybeSingle();
    if (!league) return { ok: false, error: "Slutspelsligan finns inte." };
    if (league.status !== "open") return { ok: false, error: "Anmälan är stängd — slutspelet har startat." };
    const { data: mine } = await admin
      .from("playoff_participants")
      .select("user_id")
      .eq("league_id", leagueId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!mine) {
      const { count } = await admin
        .from("playoff_participants")
        .select("*", { count: "exact", head: true })
        .eq("league_id", leagueId);
      if ((count ?? 0) >= league.size) return { ok: false, error: "Slutspelsligan är full." };
    }
    const { error } = await sb.from("playoff_participants").insert({ league_id: leagueId, user_id: user.id });
    if (error && !error.message.includes("duplicate")) return { ok: false, error: error.message };
    revalidatePath("/slutspel");
    revalidatePath(`/slutspel/${leagueId}`);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

export async function leavePlayoff(leagueId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { sb, user } = await requireUser();
    const admin = createAdminClient();
    const { data: league } = await admin.from("playoff_leagues").select("status").eq("id", leagueId).maybeSingle();
    if (league?.status !== "open") return { ok: false, error: "Går inte att lämna efter start." };
    await sb.from("playoff_participants").delete().eq("league_id", leagueId).eq("user_id", user.id);
    revalidatePath("/slutspel");
    revalidatePath(`/slutspel/${leagueId}`);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

export async function adminStartPlayoff(leagueId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    await startPlayoff(admin, leagueId);
    revalidatePath("/slutspel");
    revalidatePath(`/slutspel/${leagueId}`);
    revalidatePath("/admin");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

export async function adminSetPlayoffRoundGw(
  leagueId: string,
  round: number,
  gwRoundId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    const { error } = await admin
      .from("playoff_matchups")
      .update({ gw_round_id: gwRoundId })
      .eq("league_id", leagueId)
      .eq("round", round);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/slutspel/${leagueId}`);
    revalidatePath("/admin");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

export async function adminSettlePlayoffRound(leagueId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    await settleCurrentRound(admin, leagueId);
    revalidatePath("/slutspel");
    revalidatePath(`/slutspel/${leagueId}`);
    revalidatePath("/admin");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

export async function adminDeletePlayoff(leagueId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    const { error } = await admin.from("playoff_leagues").delete().eq("id", leagueId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/slutspel");
    revalidatePath("/admin");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

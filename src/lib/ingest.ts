// ============================================================
// SSK-femman — ingest & settlement
// Kör med service-role (förbigår RLS). Endast server-side.
//   syncSchedule()   → uppdaterar rounds + matches från swehockey-schema
//   settleMatches()  → hämtar matchrapport, fyller stats, räknar poäng
// ============================================================

import { createAdminClient } from "./supabase/admin";
import {
  getSskSchedule,
  getGameSummary,
  lookupGameId,
  normalizeName,
  sleep,
  type GameSummary,
} from "./swehockey";
import { scoreSkater, scoreGoalie, scoreTip, regulationScore } from "./scoring";

type Sb = ReturnType<typeof createAdminClient>;

// Hur långt före första matchen omgången låses (minuter).
const LOCK_MINUTES_BEFORE = 30;

// ISO-vecka → rundnyckel (spelenhet = kalendervecka mån–sön)
function isoWeek(d: Date): { year: number; week: number } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((date.getTime() - firstThursday.getTime()) / 86400000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7
    );
  return { year: date.getUTCFullYear(), week };
}

function parseDate(raw: string): Date | null {
  const m = raw.match(/(\d{4}-\d{2}-\d{2})(?:\s+(\d{1,2}[:.]\d{2}))?/);
  if (!m) return null;
  const time = (m[2] || "19:00").replace(".", ":");
  const d = new Date(`${m[1]}T${time}:00+02:00`); // Europe/Stockholm ~ approx
  return isNaN(d.getTime()) ? null : d;
}

// ------------------------------------------------------------
// 1) SCHEMA-SYNK
// ------------------------------------------------------------
export async function syncSchedule(): Promise<{ rounds: number; matches: number }> {
  const seasonId = process.env.SWEHOCKEY_SEASON_ID;
  if (!seasonId) throw new Error("SWEHOCKEY_SEASON_ID saknas");
  const sb = createAdminClient();

  const fixtures = await getSskSchedule(seasonId);
  let roundsUpserted = 0;
  let matchesUpserted = 0;

  // gruppera per ISO-vecka
  const byWeek = new Map<string, typeof fixtures>();
  for (const f of fixtures) {
    const d = parseDate(f.date);
    if (!d) continue;
    const { year, week } = isoWeek(d);
    const key = `${year}-${String(week).padStart(2, "0")}`;
    (byWeek.get(key) ?? byWeek.set(key, []).get(key)!).push(f);
  }

  for (const [key, fs] of byWeek) {
    const [year, week] = key.split("-").map(Number);
    const number = year * 100 + week;
    const starts = fs
      .map((f) => parseDate(f.date))
      .filter((x): x is Date => !!x)
      .sort((a, b) => a.getTime() - b.getTime());
    // Spelet låser LOCK_MINUTES_BEFORE minuter före första matchens start.
    const first = starts[0];
    const deadline = first
      ? new Date(first.getTime() - LOCK_MINUTES_BEFORE * 60_000).toISOString()
      : new Date().toISOString();

    const { data: round } = await sb
      .from("rounds")
      .upsert(
        { number, name: `Omgång v${week}`, deadline },
        { onConflict: "number" }
      )
      .select("id")
      .single();
    roundsUpserted++;

    for (const f of fs) {
      const d = parseDate(f.date);
      if (!d) continue;
      const startIso = d.toISOString();
      const status = f.played ? "final" : d.getTime() < Date.now() ? "live" : "upcoming";
      const payload = {
        round_id: round?.id,
        swehockey_game_id: f.swehockeyGameId,
        opponent: f.opponent,
        is_home: f.isHome,
        starts_at: startIso,
        status,
        ssk_goals: f.sskGoals,
        opp_goals: f.oppGoals,
        result:
          f.played && f.sskGoals != null && f.oppGoals != null
            ? f.sskGoals > f.oppGoals
              ? "W"
              : f.sskGoals < f.oppGoals
              ? "L"
              : "T"
            : null,
      };

      // Idempotent: hitta befintlig match (på game-id, annars motståndare+tid)
      // så upprepade körningar uppdaterar istället för att skapa dubbletter.
      let existing: { id: string } | null = null;
      if (f.swehockeyGameId) {
        const r = await sb.from("matches").select("id").eq("swehockey_game_id", f.swehockeyGameId).maybeSingle();
        existing = r.data;
      }
      if (!existing) {
        const r = await sb
          .from("matches")
          .select("id")
          .eq("opponent", f.opponent)
          .eq("starts_at", startIso)
          .maybeSingle();
        existing = r.data;
      }

      if (existing) await sb.from("matches").update(payload).eq("id", existing.id);
      else await sb.from("matches").insert(payload);
      matchesUpserted++;
    }
  }

  // For over femmorna till narmaste oppna omgang sa ingen behover valja om.
  try {
    const { data: next } = await sb
      .from("rounds")
      .select("id")
      .gte("deadline", new Date().toISOString())
      .order("deadline", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (next) await carryOverEntries(sb, next.id);
  } catch (e) {
    console.error("carry-over-fel:", e);
  }

  return { rounds: roundsUpserted, matches: matchesUpserted };
}

// ------------------------------------------------------------
// 1b) OVERFOR FEMMAN TILL NASTA OMGANG
// ------------------------------------------------------------
/**
 * Kopierar foregaende omgangs femma, malvakt och kapten till `roundId` for
 * alla som inte redan lagt en femma dar. Spelaren behaller alltsa sitt lag
 * tills hen aktivt andrar det.
 *
 * Idempotent: hoppar over alla som redan har en entry i omgangen.
 * Spelare som blivit inaktiva (skadade/lamnat klubben) foljer inte med — da
 * hoppas overforingen over helt sa att anvandaren far valja sjalv.
 */
export async function carryOverEntries(sb: Sb, roundId: string): Promise<number> {
  const { data: round } = await sb
    .from("rounds")
    .select("id, deadline")
    .eq("id", roundId)
    .maybeSingle();
  if (!round) return 0;

  const { data: prev } = await sb
    .from("rounds")
    .select("id")
    .lt("deadline", round.deadline)
    .order("deadline", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!prev) return 0;

  const { data: prevEntries } = await sb
    .from("entries")
    .select("id, user_id, goalie_id, captain_id")
    .eq("round_id", prev.id);
  if (!prevEntries?.length) return 0;

  const { data: already } = await sb.from("entries").select("user_id").eq("round_id", roundId);
  const have = new Set((already ?? []).map((e) => e.user_id));

  const { data: activePlayers } = await sb.from("players").select("id").eq("active", true);
  const active = new Set((activePlayers ?? []).map((p) => p.id));

  let carried = 0;
  for (const pe of prevEntries) {
    if (have.has(pe.user_id)) continue;

    const { data: picks } = await sb.from("entry_picks").select("player_id").eq("entry_id", pe.id);
    const ids = (picks ?? []).map((x) => x.player_id);
    // Bara hela, fortfarande giltiga femmor foljer med.
    if (ids.length !== 5 || ids.some((id) => !active.has(id))) continue;

    const goalieOk = pe.goalie_id && active.has(pe.goalie_id) ? pe.goalie_id : null;
    const captainOk = pe.captain_id && ids.includes(pe.captain_id) ? pe.captain_id : null;

    const { data: ne, error } = await sb
      .from("entries")
      .insert({
        user_id: pe.user_id,
        round_id: roundId,
        goalie_id: goalieOk,
        captain_id: captainOk,
        carried_over: true,
      })
      .select("id")
      .single();
    if (error || !ne) continue;

    const { error: pickErr } = await sb
      .from("entry_picks")
      .insert(ids.map((pid) => ({ entry_id: ne.id, player_id: pid })));
    if (pickErr) {
      // Halvfardig entry ar varre an ingen — stada upp.
      await sb.from("entries").delete().eq("id", ne.id);
      continue;
    }
    carried++;
  }
  return carried;
}

// ------------------------------------------------------------
// 2) SETTLEMENT — matchrapport → stats → poäng
// ------------------------------------------------------------
// Hur lange efter matchstart vi fortsatter leta spel-id.
const ID_LOOKUP_WINDOW_DAYS = 4;

/**
 * swehockey publicerar ingen matchlank forran kring matchstart — schemasidan
 * for en kommande match ar helt utan lankar. Schema-synken 06:00 hittar alltsa
 * aldrig id:t for kvallens match. Darfor letar resultatkorningen sjalv: den
 * kor efter matchen och da finns lanken.
 */
async function resolveMissingGameIds(sb: Sb): Promise<number> {
  const now = Date.now();
  const since = new Date(now - ID_LOOKUP_WINDOW_DAYS * 86_400_000).toISOString();

  const { data: pending } = await sb
    .from("matches")
    .select("id, opponent, starts_at")
    .is("swehockey_game_id", null)
    .lte("starts_at", new Date(now).toISOString())
    .gte("starts_at", since);
  if (!pending?.length) return 0;

  let found = 0;
  for (const m of pending) {
    const ymd = new Date(m.starts_at).toLocaleDateString("sv-SE", {
      timeZone: "Europe/Stockholm",
    });
    try {
      const gid = await lookupGameId(ymd, m.opponent);
      if (!gid) continue;
      await sb.from("matches").update({ swehockey_game_id: gid }).eq("id", m.id);
      found++;
    } catch (e) {
      console.error(`spel-id-uppslag misslyckades for ${m.opponent} ${ymd}:`, e);
    }
  }
  return found;
}

export async function settleMatches(
  force = false
): Promise<{ settled: string[]; failed: string[]; pending: string[]; idsFound: number }> {
  const sb = createAdminClient();

  // Steg 1: fyll i spel-id for matcher som just spelats.
  const idsFound = await resolveMissingGameIds(sb);

  // Steg 2: matcher som spelats men inte är settlade (eller alla om force)
  const nowIso = new Date().toISOString();
  const { data: matches } = await sb
    .from("matches")
    .select("*")
    .not("swehockey_game_id", "is", null)
    .lte("starts_at", nowIso);

  const settled: string[] = [];
  const failed: string[] = [];
  const pending: string[] = [];
  const roster = await loadRoster(sb);
  // Paus mellan matchrapporterna sa swehockey inte stryper andra anropet.
  const PAUSE_MS = 1200;
  let fetched = 0;

  for (const m of matches ?? []) {
    if (!force && m.status === "final" && m.result) {
      // redan settlad — hoppa (om inte force)
      const { count } = await sb
        .from("player_match_stats")
        .select("*", { count: "exact", head: true })
        .eq("match_id", m.id);
      if ((count ?? 0) > 0) continue;
    }
    try {
      if (fetched > 0) await sleep(PAUSE_MS);
      fetched++;
      const summary = await getGameSummary(m.swehockey_game_id as string);
      // Matchen pagar fortfarande — rapporten visar stallningen sa langt.
      // Settlar vi nu lases en halvfardig match som slutresultat.
      if (!force && !summary.isFinal) {
        pending.push(m.id);
        continue;
      }
      await settleOneMatch(sb, m, summary, roster);
      settled.push(m.id);
    } catch (e) {
      console.error(`settle-fel match ${m.id} (spel ${m.swehockey_game_id}):`, e);
      failed.push(m.id);
    }
  }

  // räkna om alla berörda omgångar + tips
  const roundIds = new Set((matches ?? []).map((m) => m.round_id).filter(Boolean));
  for (const rid of roundIds) await recomputeRound(sb, rid as string);

  return { settled, failed, pending, idsFound };
}

interface RosterEntry {
  id: string;
  key: string; // normaliserat namn
  position: "G" | "D" | "F";
  jersey_no: number | null;
}

async function loadRoster(sb: Sb): Promise<RosterEntry[]> {
  const { data } = await sb.from("players").select("id, full_name, position, jersey_no");
  return (data ?? []).map((p) => ({
    id: p.id,
    key: normalizeName(p.full_name),
    position: p.position,
    jersey_no: p.jersey_no,
  }));
}

function jerseyMap(roster: RosterEntry[]): Map<number, RosterEntry> {
  const m = new Map<number, RosterEntry>();
  for (const r of roster) if (r.jersey_no != null) m.set(r.jersey_no, r);
  return m;
}

function matchPlayer(roster: RosterEntry[], scrapedName: string): RosterEntry | null {
  const key = normalizeName(scrapedName);
  // exakt
  let hit = roster.find((r) => r.key === key);
  if (hit) return hit;
  // efternamnsmatch (unikt)
  const last = key.split(" ").slice(-1)[0];
  const cands = roster.filter((r) => r.key.split(" ").slice(-1)[0] === last);
  if (cands.length === 1) return cands[0];
  return null;
}

async function settleOneMatch(
  sb: Sb,
  match: any,
  summary: GameSummary,
  roster: RosterEntry[]
) {
  // slutresultat ur SSK-perspektiv
  const sskGoals = match.is_home ? summary.homeGoals : summary.awayGoals;
  const oppGoals = match.is_home ? summary.awayGoals : summary.homeGoals;
  const sskWon = sskGoals != null && oppGoals != null && sskGoals > oppGoals;

  // Vilken lagkod är SSK i den här rapporten ("SSK", "LIF" …)? Rapportens
  // lagkolumn är säkrare än att gissa utifrån spelarnamn — en motståndare kan
  // heta samma sak som någon i truppen.
  const sskCode = String(match.is_home ? summary.homeTeam : summary.awayTeam).trim().toLowerCase();
  const isSskTeam = (raw: string): boolean | null => {
    const a = String(raw ?? "").trim().toLowerCase();
    if (!a || !sskCode) return null; // okänd lagkod → låt namnmatchningen avgöra
    return a === sskCode || a.startsWith(sskCode) || sskCode.startsWith(a);
  };

  // ---- Utespelarstatistik ----
  type Acc = { goals: number; assists: number; pp: number; plus: number; minor: number; major: number; pim: number };
  const skater = new Map<string, Acc>();
  const jmap = jerseyMap(roster);
  const acc = (id: string): Acc => {
    let cur = skater.get(id);
    if (!cur) { cur = { goals: 0, assists: 0, pp: 0, plus: 0, minor: 0, major: 0, pim: 0 }; skater.set(id, cur); }
    return cur;
  };

  for (const g of summary.goals) {
    const s = matchPlayer(roster, g.scorer);
    const sskScored = isSskTeam(g.team) ?? !!(s && s.position !== "G");
    if (sskScored && s && s.position !== "G") {
      acc(s.id).goals++;
      if (g.situation === "PP") acc(s.id).pp++;
    }
    if (sskScored) {
      for (const a of g.assists) {
        const ap = matchPlayer(roster, a);
        if (ap && ap.position !== "G") {
          acc(ap.id).assists++;
          if (g.situation === "PP") acc(ap.id).pp++;
        }
      }
    }
    // +/- : SSK-spelare på isen. Vann SSK målet → Pos. Part. (+1), annars Neg. Part. (−1).
    const onIce = sskScored ? g.posPart : g.negPart;
    const delta = sskScored ? 1 : -1;
    for (const no of onIce) {
      const p = jmap.get(no);
      if (p && p.position !== "G") acc(p.id).plus += delta;
    }
  }

  // Utvisningar (endast SSK-spelare): 2 min = minor, > 2 min = major
  for (const pen of summary.penalties) {
    if (isSskTeam(pen.team) === false) continue;
    const p = matchPlayer(roster, pen.player);
    if (!p || p.position === "G") continue;
    const a = acc(p.id);
    a.pim += pen.minutes;
    if (pen.minutes > 2) a.major++;
    else a.minor++;
  }

  // rensa gamla stats för matchen och skriv nya
  await sb.from("player_match_stats").delete().eq("match_id", match.id);
  for (const [playerId, s] of skater) {
    await sb.from("player_match_stats").insert({
      match_id: match.id,
      player_id: playerId,
      goals: s.goals,
      assists: s.assists,
      pp_points: s.pp,
      plus_minus: s.plus,
      minor_pen: s.minor,
      major_pen: s.major,
      pim: s.pim,
      points: scoreSkater({
        goals: s.goals, assists: s.assists, pp_points: s.pp,
        plus_minus: s.plus, minor_pen: s.minor, major_pen: s.major,
      }),
    });
  }

  // ---- Målvakter (endast SSK-målvakter är relevanta) ----
  const allGoalies = [...summary.goalies.home, ...summary.goalies.away];
  const sskGoalies = allGoalies
    .map((gk) => ({ gk, p: matchPlayer(roster, gk.name) }))
    .filter((x) => x.p && x.p.position === "G");

  // startande = flest skott mot
  let starterId: string | null = null;
  let maxShots = -1;
  for (const { gk, p } of sskGoalies) {
    if (gk.shotsAgainst > maxShots) {
      maxShots = gk.shotsAgainst;
      starterId = p!.id;
    }
  }

  await sb.from("goalie_match_stats").delete().eq("match_id", match.id);
  for (const { gk, p } of sskGoalies) {
    const isStarter = p!.id === starterId;
    const shutout = isStarter && sskWon && gk.goalsAgainst === 0;
    await sb.from("goalie_match_stats").insert({
      match_id: match.id,
      player_id: p!.id,
      played: true,
      is_starter: isStarter,
      saves: gk.saves,
      shots_against: gk.shotsAgainst,
      goals_against: gk.goalsAgainst,
      save_pct: gk.savePct,
      shutout,
      win: isStarter && sskWon,
      points: 0, // målvaktspoäng räknas per entry (bara om man gissat rätt)
    });
  }

  const overtime = summary.overtime;

  // uppdatera matchresultat (OT/SO-varianter så tipset kan räknas på ordinarie tid)
  await sb
    .from("matches")
    .update({
      status: "final",
      ssk_goals: sskGoals,
      opp_goals: oppGoals,
      result:
        sskGoals != null && oppGoals != null
          ? overtime
            ? sskWon ? "OTW" : "OTL"
            : sskWon ? "W" : sskGoals === oppGoals ? "T" : "L"
          : null,
    })
    .eq("id", match.id);

  // ---- Resultattips: räknas mot ordinarie tid ----
  if (sskGoals != null && oppGoals != null) {
    const reg = regulationScore(sskGoals, oppGoals, overtime);
    const { data: tips } = await sb.from("result_tips").select("*").eq("match_id", match.id);
    for (const t of tips ?? []) {
      const pts = scoreTip(t.pred_ssk, t.pred_opp, reg.ssk, reg.opp);
      await sb.from("result_tips").update({ points: pts }).eq("id", t.id);
    }
  }
}

// ------------------------------------------------------------
// 3) RÄKNA OM OMGÅNGSPOÄNG FÖR ALLA ENTRIES
// ------------------------------------------------------------
export async function recomputeRound(sb: Sb, roundId: string) {
  const { data: matches } = await sb
    .from("matches")
    .select("id, is_home")
    .eq("round_id", roundId);
  const matchIds = (matches ?? []).map((m) => m.id);
  if (matchIds.length === 0) return;

  // stats för alla matcher i omgången
  const { data: pms } = await sb
    .from("player_match_stats")
    .select("player_id, points, match_id")
    .in("match_id", matchIds);
  const { data: gms } = await sb
    .from("goalie_match_stats")
    .select("player_id, match_id, is_starter, saves, goals_against, shutout, win, played")
    .in("match_id", matchIds);

  const skaterPts = new Map<string, number>(); // player_id -> summa poäng i omgången
  for (const r of pms ?? []) {
    skaterPts.set(r.player_id, (skaterPts.get(r.player_id) ?? 0) + Number(r.points));
  }

  const { data: entries } = await sb
    .from("entries")
    .select("id, goalie_id, captain_id")
    .eq("round_id", roundId);

  for (const e of entries ?? []) {
    const { data: picks } = await sb
      .from("entry_picks")
      .select("player_id")
      .eq("entry_id", e.id);

    // Kaptenen ger dubbla poäng — även när poängen är negativ.
    let total = 0;
    for (const p of picks ?? []) {
      const pts = skaterPts.get(p.player_id) ?? 0;
      total += p.player_id === e.captain_id ? pts * 2 : pts;
    }

    // målvakt: poäng bara om gissad målvakt faktiskt var startande i någon match
    if (e.goalie_id) {
      for (const g of gms ?? []) {
        if (g.player_id !== e.goalie_id) continue;
        total += scoreGoalie(
          {
            played: g.played,
            is_starter: g.is_starter,
            saves: g.saves,
            goals_against: g.goals_against,
            shutout: g.shutout,
            win: g.win,
          },
          g.is_starter // gissade rätt om den gissade målvakten var startande
        );
      }
    }

    await sb.from("entries").update({ points: Math.round(total * 100) / 100 }).eq("id", e.id);
  }
}

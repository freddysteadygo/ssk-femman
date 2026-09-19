// ============================================================
// SSK-femman — swehockey-scraper
// ------------------------------------------------------------
// stats.swehockey.se har ingen öppen API → vi parsar serverrenderad HTML.
//
// Schema  (/ScheduleAndResults/Schedule/{seasonId}) → getSskSchedule()
// Rapport (/Game/Events/{gameId})                    → getGameSummary()
//
// Matchrapporten lägger ALLT i EN kronologisk händelselogg + en
// målvaktssammanfattning, i samma tabell. Varje rad är:
//   [tid, "h-a (situation)" | "N min" | "GK Out", lag, "nr. Namn (…)", detalj]
// Målvaktsrad: [ , , lag, "nr. Namn", "94,74% (30/31)"]
// Parsern nedan är verifierad mot en riktig färdigspelad match
// (BIK Karlskoga–Södertälje SK, game 1113890: 1–2, 3 mål, 9 utv).
//
// OBS: den här vyn exponerar inte "spelare på isen" för +/-, så plus_minus
// lämnas 0 från autoskrapningen. Admin-panelen kan komplettera vid behov.
// ============================================================

import * as cheerio from "cheerio";

const BASE = "https://stats.swehockey.se";
const UA =
  "SSK-femman/0.1 (hobbyprojekt; kontakt: freddy@steadygo.se) polite-scraper";

// Schemasidan har nastlade tabeller vars yttre rader innehaller HELA sidan
// (tusentals celler). Riktiga matchrader har en handfull celler.
const MAX_ROW_CELLS = 20;
// Hur langt fram i tiden vi bryr oss om att sla upp spel-id (matcher som inte
// spelats behover inget id for settlement).
const ID_LOOKUP_DAYS_AHEAD = 14;

export interface ScheduledMatch {
  swehockeyGameId: string | null;
  date: string; // ISO om möjligt, annars rå text
  opponent: string;
  isHome: boolean;
  sskGoals: number | null;
  oppGoals: number | null;
  played: boolean;
}

export interface ScrapedGoalEvent {
  team: string; // rå lagsträng ur rapporten (t.ex. "SSK")
  scorer: string;
  assists: string[];
  situation: "EQ" | "PP" | "SH" | "PS" | "EN" | "UNKNOWN";
  time: string;
  posPart: number[]; // ej tillgängligt i denna vy → tom
  negPart: number[];
}

export interface ScrapedGoalie {
  name: string;
  saves: number;
  shotsAgainst: number;
  goalsAgainst: number;
  savePct: number | null;
}

export interface ScrapedPenalty {
  team: string;
  player: string;
  minutes: number;
}

export interface GameSummary {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number | null;
  awayGoals: number | null;
  goals: ScrapedGoalEvent[];
  penalties: ScrapedPenalty[];
  goalies: { home: ScrapedGoalie[]; away: ScrapedGoalie[] };
  overtime: boolean;
}

// ------------------------------------------------------------
// Låg nivå
// ------------------------------------------------------------
export async function fetchHtml(path: string): Promise<string> {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "sv,en" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`swehockey ${res.status} för ${url}`);
  return res.text();
}

/** Extraherar alla tabeller som matriser av cell-text. */
export function extractTables(html: string): string[][][] {
  const $ = cheerio.load(html);
  const tables: string[][][] = [];
  $("table").each((_, table) => {
    const rows: string[][] = [];
    $(table)
      .find("tr")
      .each((__, tr) => {
        const cells: string[] = [];
        $(tr)
          .find("th,td")
          .each((___, td) => {
            cells.push(clean($(td).text()));
          });
        if (cells.length) rows.push(cells);
      });
    if (rows.length) tables.push(rows);
  });
  return tables;
}

function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function toInt(s: string | undefined): number | null {
  if (!s) return null;
  const m = s.replace(",", ".").match(/-?\d+(\.\d+)?/);
  return m ? Math.round(parseFloat(m[0])) : null;
}

// ------------------------------------------------------------
// SCHEMA  (/ScheduleAndResults/Schedule/{seasonId})
// ------------------------------------------------------------
export async function getSskSchedule(
  seasonId: string,
  teamName = "Södertälje"
): Promise<ScheduledMatch[]> {
  const html = await fetchHtml(`/ScheduleAndResults/Schedule/${seasonId}`);
  const $ = cheerio.load(html);
  const out: ScheduledMatch[] = [];

  // swehockey skriver bara ut datumet på dagens FÖRSTA match → bär med senaste.
  let currentDate = "";

  $("tr").each((_, tr) => {
    const row = $(tr);
    const cells = row
      .find("td")
      .map((__, td) => clean($(td).text()))
      .get();
    if (!cells.length) return;
    // Hoppa over nastlade container-rader som svaljer hela sidan.
    if (cells.length > MAX_ROW_CELLS) return;

    const dateInRow = cells.map((c) => (c.match(/\d{4}-\d{2}-\d{2}/) || [])[0]).find(Boolean);
    if (dateInRow) currentDate = dateInRow;

    if (!cells.some((c) => c.toLowerCase().includes(teamName.toLowerCase()))) return;
    const matchCell = cells.find(
      (c) => c.includes(" - ") && c.toLowerCase().includes(teamName.toLowerCase())
    );
    if (!matchCell) return;

    const link = row.find('a[href*="/Game/"]').attr("href") || "";
    const idMatch = link.match(/\/Game\/\w+\/(\d+)/);
    const gameId = idMatch ? idMatch[1] : null;

    const parsed = parseScheduleRow(cells, matchCell, currentDate, teamName);
    if (parsed) out.push({ ...parsed, swehockeyGameId: gameId });
  });

  return resolveGameIds(dedupeByGameId(out), teamName);
}

/**
 * Sasongsschemat innehaller INGA matchlankar - spel-id finns bara i
 * datumvyn (/GamesByDate/YYYY-MM-DD). Vi slar darfor upp id per datum,
 * med cache sa varje datum bara hamtas en gang.
 */
async function resolveGameIds(
  matches: ScheduledMatch[],
  teamName: string
): Promise<ScheduledMatch[]> {
  const cache = new Map<string, string | null>();
  const cutoff = Date.now() + ID_LOOKUP_DAYS_AHEAD * 86_400_000;

  for (const m of matches) {
    if (m.swehockeyGameId) continue;
    const ymd = (m.date.match(/\d{4}-\d{2}-\d{2}/) || [""])[0];
    if (!ymd) continue;
    // Bara matcher som spelats eller narmar sig - resten far id senare.
    if (new Date(`${ymd}T00:00:00`).getTime() > cutoff) continue;

    if (!cache.has(ymd)) {
      cache.set(ymd, await gameIdForDate(ymd, teamName));
    }
    m.swehockeyGameId = cache.get(ymd) ?? null;
  }
  return matches;
}

/** Plockar SSK:s spel-id for ett datum ur /GamesByDate. */
async function gameIdForDate(ymd: string, teamName: string): Promise<string | null> {
  try {
    const html = await fetchHtml(`/GamesByDate/${ymd}`);
    const $ = cheerio.load(html);
    let found: string | null = null;
    $("tr").each((_, tr) => {
      if (found) return;
      const cells = $(tr).find("td").length;
      if (!cells || cells > MAX_ROW_CELLS) return;
      const txt = clean($(tr).text()).toLowerCase();
      if (!txt.includes(teamName.toLowerCase())) return;
      const href = $(tr).find('a[href*="/Game/"]').attr("href") || "";
      const m = href.match(/\/Game\/\w+\/(\d+)/);
      if (m) found = m[1];
    });
    return found;
  } catch (e) {
    console.error(`kunde inte hamta spel-id for ${ymd}:`, e);
    return null;
  }
}

function parseScheduleRow(
  cells: string[],
  matchCell: string,
  currentDate: string,
  teamName: string
): Omit<ScheduledMatch, "swehockeyGameId"> | null {
  const [homeRaw, awayRaw] = matchCell.split(" - ").map((s) => s.trim());
  if (!homeRaw || !awayRaw) return null;
  const isHome = homeRaw.toLowerCase().includes(teamName.toLowerCase());
  const opponent = isHome ? awayRaw : homeRaw;

  const timeCell =
    cells.find((c) => /^\d{1,2}[:.]\d{2}$/.test(c)) ||
    (cells.map((c) => (c.match(/\b\d{1,2}[:.]\d{2}\b/) || [])[0]).find(Boolean) ?? "");
  const date = clean(`${currentDate} ${timeCell}`);
  if (!currentDate) return null;

  const isScoreCell = (c: string) =>
    !/\d{4}/.test(c) && /^\s*\d{1,2}\s*[-–]\s*\d{1,2}\b/.test(c);
  const scoreCell = cells.find(isScoreCell);
  let sskGoals: number | null = null;
  let oppGoals: number | null = null;
  let played = false;
  if (scoreCell) {
    const m = scoreCell.match(/^\s*(\d{1,2})\s*[-–]\s*(\d{1,2})/);
    if (m) {
      const h = parseInt(m[1], 10);
      const a = parseInt(m[2], 10);
      sskGoals = isHome ? h : a;
      oppGoals = isHome ? a : h;
      played = true;
    }
  }

  return { date, opponent, isHome, sskGoals, oppGoals, played };
}

function dedupeByGameId(arr: ScheduledMatch[]): ScheduledMatch[] {
  const seen = new Set<string>();
  const out: ScheduledMatch[] = [];
  for (const m of arr) {
    const ymd = (m.date.match(/\d{4}-\d{2}-\d{2}/) || [""])[0];
    const key = `${ymd}|${m.opponent.toLowerCase()}|${m.isHome ? "H" : "B"}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

// ------------------------------------------------------------
// MATCHRAPPORT  (/Game/Events/{gameId})
// ------------------------------------------------------------
export async function getGameSummary(gameId: string): Promise<GameSummary> {
  const html = await fetchHtml(`/Game/Events/${gameId}`);
  return parseGameSummary(gameId, html);
}

export function parseGameSummary(gameId: string, html: string): GameSummary {
  const $ = cheerio.load(html);

  // Slutresultat + lag ur sidtiteln: "Hemma - Borta (h-a)"
  const title = clean($("title").text());
  const scoreM = title.match(/\((\d+)\s*-\s*(\d+)\)/);
  const homeGoals = scoreM ? parseInt(scoreM[1], 10) : null;
  const awayGoals = scoreM ? parseInt(scoreM[2], 10) : null;
  const teamsM = title.match(/^\s*(.+?)\s*-\s*(.+?)\s*\(/);
  const homeTeam = teamsM ? clean(teamsM[1]) : "Hemmalag";
  const awayTeam = teamsM ? clean(teamsM[2]) : "Bortalag";
  const homeCode = (homeTeam.split(/\s+/)[0] || "").toLowerCase();

  // Hitta händelseloggen: den "leaf"-tabell (utan nästlad tabell) vars text
  // innehåller matchtider och mål-/utvisningsmarkörer.
  let eventRows: string[][] | null = null;
  $("table").each((_, t) => {
    if (eventRows) return;
    if ($(t).find("table").length) return;
    const rows: string[][] = [];
    $(t)
      .find("tr")
      .each((__, tr) => {
        const cells = $(tr)
          .find("th,td")
          .map((___, td) => clean($(td).text()))
          .get();
        if (cells.length) rows.push(cells);
      });
    const flat = rows.flat().join(" ");
    if (/\d{1,2}:\d{2}/.test(flat) && /\(EQ\)|\(PP\)|\(SH\)| min/i.test(flat)) {
      eventRows = rows;
    }
  });

  const goals: ScrapedGoalEvent[] = [];
  const penalties: ScrapedPenalty[] = [];
  const goaliesHome: ScrapedGoalie[] = [];
  const goaliesAway: ScrapedGoalie[] = [];

  for (const r of eventRows ?? []) {
    if (r.length < 3) continue;
    const c0 = r[0] ?? "";
    const c1 = r[1] ?? "";
    const team = r[2] ?? "";
    const c3 = r[3] ?? "";

    // Målvaktsrad: sista cellen "86,67% (13/15)"
    const gk = (r[4] ?? "").match(/(\d{1,3},\d{1,2})%\s*\((\d+)\/(\d+)\)/);
    if (gk) {
      const saves = parseInt(gk[2], 10);
      const shots = parseInt(gk[3], 10);
      const first = splitPlayers(c3)[0];
      const entry: ScrapedGoalie = {
        name: first ? first.name : c3,
        saves,
        shotsAgainst: shots,
        goalsAgainst: shots - saves,
        savePct: parseFloat(gk[1].replace(",", ".")),
      };
      (team.toLowerCase().startsWith(homeCode) && homeCode ? goaliesHome : goaliesAway).push(entry);
      continue;
    }

    if (!/^\d{1,2}:\d{2}$/.test(c0)) continue;

    // Målrad: c1 = "1-2 (EQ)" / "1-2 (PP1)" / "1-2 (SH)" ...
    const goalM = c1.match(/^(\d+)\s*-\s*(\d+)\s*(?:\(([A-Za-z0-9]+)\))?/);
    if (goalM && !/min/i.test(c1)) {
      const players = splitPlayers(c3);
      if (players.length) {
        const sit = (goalM[3] || "EQ").toUpperCase();
        const situation: ScrapedGoalEvent["situation"] = sit.startsWith("PP")
          ? "PP"
          : sit.startsWith("SH")
          ? "SH"
          : sit === "PS"
          ? "PS"
          : sit === "EN"
          ? "EN"
          : "EQ";
        goals.push({
          team,
          scorer: players[0].name,
          assists: players.slice(1, 3).map((p) => p.name),
          situation,
          time: c0,
          posPart: [],
          negPart: [],
        });
      }
      continue;
    }

    // Utvisningsrad: c1 = "2 min" / "5 min" / "10 min"
    const pen = c1.match(/^(\d+)\s*min/i);
    if (pen) {
      const first = splitPlayers(c3)[0];
      penalties.push({ team, player: first ? first.name : c3, minutes: parseInt(pen[1], 10) });
      continue;
    }
  }

  const overtime =
    /\bgws\b|game\s*winning\s*shots|straffl[aä]ggning|sudden\s*death|efter\s*f[öo]rl[äa]ng|\bövertid\b/i.test(
      html
    );

  return {
    gameId,
    homeTeam,
    awayTeam,
    homeGoals,
    awayGoals,
    goals,
    penalties,
    goalies: { home: goaliesHome, away: goaliesAway },
    overtime,
  };
}

/**
 * Delar en spelarsträng till {nr, namn}.
 * "88. Holst, Filip (1) 91. Vanderbeck, Andrew 19. Muzito Bagenda, Daniel"
 * → scorer först, resten assist. swehockey klistrar ibland ihop
 *   "Namn19. Nästa" utan mellanslag → vi normaliserar det först.
 */
function splitPlayers(str: string): { no: number; name: string }[] {
  const norm = str.replace(/([A-Za-zÅÄÖåäö)])(\d{1,3}\.)/g, "$1 $2");
  return norm
    .split(/\s(?=\d{1,3}\.\s)/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((p) => {
      const m = p.match(/^(\d{1,3})\.\s*(.+?)(?:\s*\(\d+\))?\s*$/);
      return m ? { no: parseInt(m[1], 10), name: clean(m[2]) } : null;
    })
    .filter((x): x is { no: number; name: string } => !!x);
}

// ------------------------------------------------------------
// NAMN-NORMALISERING (matcha scrapade namn mot players-tabellen)
// swehockey: "Efternamn, Förnamn"  →  normaliserad nyckel
// ------------------------------------------------------------
export function normalizeName(name: string): string {
  const n = name.toLowerCase().trim();
  if (n.includes(",")) {
    const [last, first] = n.split(",").map((s) => s.trim());
    return `${first} ${last}`.replace(/\s+/g, " ");
  }
  return n.replace(/\s+/g, " ");
}

export { toInt };

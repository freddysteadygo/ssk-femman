// ============================================================
// SSK-femman — swehockey-scraper
// ------------------------------------------------------------
// stats.swehockey.se har ingen öppen API → vi parsar serverrenderad HTML.
// Sidan är tabelltung; strategin här är:
//   1) hämta HTML,
//   2) extrahera ALLA tabeller som text-matriser (robust mot små ändringar),
//   3) tolka matriserna med tolerant text-matchning i högnivåfunktionerna.
//
// ⚠️  VERIFIERA MOT LIVE-HTML: selektorer/kolumnordning kan skilja per vy.
//     Kör scripts/inspect-game.ts mot en riktig match och justera vid behov.
//     Admin-panelen (manuell inmatning) fungerar oavsett scrapern.
// ============================================================

import * as cheerio from "cheerio";

const BASE = "https://stats.swehockey.se";
const UA =
  "SSK-femman/0.1 (hobbyprojekt; kontakt: freddy@steadygo.se) polite-scraper";

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
  team: string; // rå lagsträng ur rapporten
  scorer: string;
  assists: string[];
  situation: "EQ" | "PP" | "SH" | "PS" | "EN" | "UNKNOWN";
  time: string;
  // Tröjnummer för spelare på isen (för +/-). swehockey-rapporten anger
  // "Pos. Part." (målgörande lagets spelare på isen) och "Neg. Part."
  // (det insläppande lagets spelare på isen).
  posPart: number[];
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
}

// ------------------------------------------------------------
// Låg nivå
// ------------------------------------------------------------
export async function fetchHtml(path: string): Promise<string> {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "sv,en" },
    // Var snäll mot servern: cachas en stund på plattformsnivå om möjligt
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
/**
 * Returnerar SSK:s matcher ur en säsongs schema-sida.
 * Vi filtrerar rader som nämner Södertälje.
 */
export async function getSskSchedule(
  seasonId: string,
  teamName = "Södertälje"
): Promise<ScheduledMatch[]> {
  const html = await fetchHtml(`/ScheduleAndResults/Schedule/${seasonId}`);
  const $ = cheerio.load(html);
  const out: ScheduledMatch[] = [];

  // Varje matchrad har typ: Datum | Tid | Match "Hemma - Borta" | Resultat, med länk /Game/Events/{id}
  $("tr").each((_, tr) => {
    const row = $(tr);
    const text = clean(row.text());
    if (!text.toLowerCase().includes(teamName.toLowerCase())) return;

    const link = row.find('a[href*="/Game/"]').attr("href") || "";
    const idMatch = link.match(/\/Game\/\w+\/(\d+)/);
    const gameId = idMatch ? idMatch[1] : null;

    // Försök hitta "Lag A - Lag B" och ev. "x - y"
    const cells = row
      .find("td")
      .map((__, td) => clean($(td).text()))
      .get();

    const parsed = parseScheduleRow(cells, teamName);
    if (parsed) out.push({ ...parsed, swehockeyGameId: gameId });
  });

  return dedupeByGameId(out);
}

function parseScheduleRow(
  cells: string[],
  teamName: string
): Omit<ScheduledMatch, "swehockeyGameId"> | null {
  // Hitta cellen som innehåller " - " med lagnamn
  const matchCell = cells.find(
    (c) => c.includes(" - ") && /[A-Za-zÅÄÖåäö]/.test(c) && c.toLowerCase().includes(teamName.toLowerCase())
  );
  if (!matchCell) return null;

  const [homeRaw, awayRaw] = matchCell.split(" - ").map((s) => s.trim());
  const isHome = homeRaw.toLowerCase().includes(teamName.toLowerCase());
  const opponent = isHome ? awayRaw : homeRaw;

  // Datum: första cell som ser ut som ett datum
  const dateCell =
    cells.find((c) => /\d{4}-\d{2}-\d{2}/.test(c)) ||
    cells.find((c) => /\d{2}[/.]\d{2}/.test(c)) ||
    "";
  const timeCell = cells.find((c) => /^\d{1,2}[:.]\d{2}$/.test(c)) || "";
  const date = clean(`${dateCell} ${timeCell}`);

  // Resultat: cell som "x - y" med siffror
  const scoreCell = cells.find((c) => /^\d+\s*-\s*\d+/.test(c));
  let sskGoals: number | null = null;
  let oppGoals: number | null = null;
  let played = false;
  if (scoreCell) {
    const m = scoreCell.match(/(\d+)\s*-\s*(\d+)/);
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
    const key = m.swehockeyGameId ?? `${m.date}-${m.opponent}`;
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
  const headerText = clean($("h1, .gameinfo, .teamheader").first().text() || $("title").text());

  // Lag + slutresultat ur rubriken, t.ex. "Lag A - Lag B 3 - 2"
  const { homeTeam, awayTeam, homeGoals, awayGoals } = parseHeader(headerText, $);

  const goals: ScrapedGoalEvent[] = [];
  const penalties: ScrapedPenalty[] = [];
  const goaliesHome: ScrapedGoalie[] = [];
  const goaliesAway: ScrapedGoalie[] = [];

  const tables = extractTables(html);
  for (const rows of tables) {
    const flat = rows.flat().join(" | ").toLowerCase();

    // MÅL-tabell: innehåller ofta "målskytt"/"assist" eller situationskoder
    if (flat.includes("mål") || flat.includes("goal") || /pp1|sh1|\b5-4\b|\b4-5\b/.test(flat)) {
      for (const r of rows) {
        const g = parseGoalRow(r);
        if (g) goals.push(g);
      }
    }

    // UTVISNINGAR
    if (flat.includes("utvisning") || flat.includes("penalt")) {
      for (const r of rows) {
        const p = parsePenaltyRow(r);
        if (p) penalties.push(p);
      }
    }

    // MÅLVAKTER: rad med räddningsprocent (t.ex. "94,74") + skott
    if (flat.includes("målvakt") || flat.includes("goalkeeper") || /\d{2},\d{2}\s*%/.test(flat)) {
      for (const r of rows) {
        const gk = parseGoalieRow(r);
        if (gk) {
          // hemma/borta-tilldelning görs grovt: matcha lagnamn i raden
          const rowText = r.join(" ").toLowerCase();
          if (rowText.includes(homeTeam.toLowerCase().split(" ")[0])) goaliesHome.push(gk);
          else if (rowText.includes(awayTeam.toLowerCase().split(" ")[0])) goaliesAway.push(gk);
          else goaliesHome.push(gk); // fallback
        }
      }
    }
  }

  return {
    gameId,
    homeTeam,
    awayTeam,
    homeGoals,
    awayGoals,
    goals,
    penalties,
    goalies: { home: goaliesHome, away: goaliesAway },
  };
}

function parseHeader(
  headerText: string,
  $: cheerio.CheerioAPI
): { homeTeam: string; awayTeam: string; homeGoals: number | null; awayGoals: number | null } {
  // Försök 1: "Lag A - Lag B 3 - 2"
  let m = headerText.match(/(.+?)\s*-\s*(.+?)\s+(\d+)\s*-\s*(\d+)/);
  if (m) {
    return {
      homeTeam: clean(m[1]),
      awayTeam: clean(m[2]),
      homeGoals: parseInt(m[3], 10),
      awayGoals: parseInt(m[4], 10),
    };
  }
  // Försök 2: bara "Lag A - Lag B"
  m = headerText.match(/(.+?)\s*-\s*(.+)/);
  return {
    homeTeam: m ? clean(m[1]) : "Hemmalag",
    awayTeam: m ? clean(m[2]) : "Bortalag",
    homeGoals: null,
    awayGoals: null,
  };
}

function parseGoalRow(cells: string[]): ScrapedGoalEvent | null {
  const joined = cells.join(" ");
  // En målrad har typiskt en tid (mm:ss) och en spelarnamn med komma
  if (!/\d{1,2}:\d{2}/.test(joined)) return null;
  const nameCell = cells.find((c) => /[A-Za-zÅÄÖåäö]+,\s*[A-Za-zÅÄÖåäö]/.test(c));
  if (!nameCell) return null;

  const time = (joined.match(/\d{1,2}:\d{2}/) || [""])[0];
  const situation = detectSituation(joined);

  // scorer = första namnet, assists = ev. fler namn i samma cell/efterföljande celler
  const names = cells
    .join(" ; ")
    .split(/;|\(|\)/)
    .map((s) => s.trim())
    .filter((s) => /[A-Za-zÅÄÖåäö]+,\s*[A-Za-zÅÄÖåäö]/.test(s));

  const scorer = names[0];
  const assists = names.slice(1).slice(0, 2);

  return {
    team: cells[0] || "",
    scorer,
    assists,
    situation,
    time,
    posPart: parseJerseyList(joined, /pos\.?\s*part\.?:?\s*([\d,\s]+?)(?:neg|$)/i),
    negPart: parseJerseyList(joined, /neg\.?\s*part\.?:?\s*([\d,\s]+)/i),
  };
}

/** Plockar ut tröjnummer ur t.ex. "Pos. Part.: 6, 18, 20, 82". */
function parseJerseyList(text: string, re: RegExp): number[] {
  const m = text.match(re);
  if (!m) return [];
  return m[1]
    .split(/[,\s]+/)
    .map((x) => parseInt(x, 10))
    .filter((n) => !isNaN(n) && n > 0 && n < 100);
}

function detectSituation(s: string): ScrapedGoalEvent["situation"] {
  const t = s.toLowerCase();
  if (/pp\d|5-4|5-3|4-3|powerplay/.test(t)) return "PP";
  if (/sh\d|4-5|3-5|shorthand/.test(t)) return "SH";
  if (/ps\b|straff/.test(t)) return "PS";
  if (/en\b|empty/.test(t)) return "EN";
  if (/5-5|even/.test(t)) return "EQ";
  return "UNKNOWN";
}

function parsePenaltyRow(cells: string[]): ScrapedPenalty | null {
  const joined = cells.join(" ");
  const nameCell = cells.find((c) => /[A-Za-zÅÄÖåäö]+,\s*[A-Za-zÅÄÖåäö]/.test(c));
  const minMatch = joined.match(/\b(\d+)\s*min\b/i) || joined.match(/\b(2|4|5|10)\b/);
  if (!nameCell || !minMatch) return null;
  return {
    team: cells[0] || "",
    player: nameCell,
    minutes: parseInt(minMatch[1], 10),
  };
}

function parseGoalieRow(cells: string[]): ScrapedGoalie | null {
  const joined = cells.join(" ");
  const nameCell = cells.find((c) => /[A-Za-zÅÄÖåäö]+,\s*[A-Za-zÅÄÖåäö]/.test(c));
  if (!nameCell) return null;
  // Räddningsprocent finns ofta som "94,74"
  const pctMatch = joined.match(/(\d{1,3},\d{1,2})\s*%?/);
  // "36 saves on 38 shots" eller "36/38"
  const savesShots =
    joined.match(/(\d+)\s*(?:\/|of|on|av)\s*(\d+)/i) || null;
  let saves = 0;
  let shots = 0;
  if (savesShots) {
    saves = parseInt(savesShots[1], 10);
    shots = parseInt(savesShots[2], 10);
  }
  if (!savesShots && !pctMatch) return null;
  const goalsAgainst = shots && saves ? shots - saves : 0;
  return {
    name: nameCell,
    saves,
    shotsAgainst: shots,
    goalsAgainst,
    savePct: pctMatch ? parseFloat(pctMatch[1].replace(",", ".")) : null,
  };
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

// ============================================================
// SSK-femman — poängmotor ("NHL-anpassat" system)
// All poänglogik samlad här, med värden i SCORING så de är lätta
// att kalibrera på ett ställe.
// ============================================================

export const SCORING = {
  skater: {
    goal: 3,
    assist: 2,
    ppPoint: 0.5, // powerplay-mål eller -assist, bonus ovanpå
    plusMinus: 0.5, // per netto +/- (på isen vid mål: +0,5 / baklänges: −0,5)
    minorPenalty: -0.5, // per 2-min-utvisning
    majorPenalty: -2, // per utvisning över 2 min (5/10/20 etc.)
  },
  goalie: {
    win: 3,
    save: 0.2,
    goalAgainst: -1,
    shutout: 2,
    correctGuess: 3, // vår egen bonus: gissade rätt målvakt
  },
  tip: {
    correctWinner: 2, // rätt 1/X/2
    exactScore: 4, // exakt slutresultat (totalt, ersätter winner-poängen)
  },
} as const;

export interface SkaterLine {
  goals: number;
  assists: number;
  pp_points: number;
  plus_minus: number; // netto: (mål på isen för) − (mål på isen emot)
  minor_pen: number; // antal 2-min-utvisningar
  major_pen: number; // antal utvisningar > 2 min
}

export interface GoalieLine {
  played: boolean;
  is_starter: boolean;
  saves: number;
  goals_against: number;
  shutout: boolean;
  win: boolean;
}

/** Poäng för en utespelare i en match. */
export function scoreSkater(s: SkaterLine): number {
  const p =
    s.goals * SCORING.skater.goal +
    s.assists * SCORING.skater.assist +
    s.pp_points * SCORING.skater.ppPoint +
    s.plus_minus * SCORING.skater.plusMinus +
    s.minor_pen * SCORING.skater.minorPenalty +
    s.major_pen * SCORING.skater.majorPenalty;
  return round2(p);
}

/**
 * Poäng för den gissade målvakten i en match.
 * guessedStarted = stod den gissade målvakten faktiskt i mål (startande).
 * Gissar man fel målvakt ges 0 (ingen minuspoäng).
 */
export function scoreGoalie(g: GoalieLine, guessedStarted: boolean): number {
  if (!guessedStarted || !g.played) return 0;
  let p = SCORING.goalie.correctGuess;
  if (g.win) p += SCORING.goalie.win;
  p += g.saves * SCORING.goalie.save;
  p += g.goals_against * SCORING.goalie.goalAgainst;
  if (g.shutout) p += SCORING.goalie.shutout;
  return round2(p);
}

/** Poäng för ett resultattips mot facit. */
export function scoreTip(
  predSsk: number,
  predOpp: number,
  actualSsk: number,
  actualOpp: number
): number {
  if (predSsk === actualSsk && predOpp === actualOpp) {
    return SCORING.tip.exactScore;
  }
  if (sign(predSsk - predOpp) === sign(actualSsk - actualOpp)) {
    return SCORING.tip.correctWinner;
  }
  return 0;
}

function sign(n: number): number {
  return n > 0 ? 1 : n < 0 ? -1 : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

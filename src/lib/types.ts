// Delade typer som speglar databasschemat.

export type PlayerPosition = "G" | "D" | "F";
export type MatchStatus = "upcoming" | "live" | "final";
export type RoundStatus = "open" | "locked" | "settled";
export type LeagueType = "public" | "private";

export interface Profile {
  id: string;
  username: string;
  email: string | null;
  is_admin: boolean;
  created_at: string;
}

export interface Player {
  id: string;
  swehockey_id: string | null;
  full_name: string;
  position: PlayerPosition;
  jersey_no: number | null;
  active: boolean;
}

export interface Round {
  id: string;
  number: number;
  name: string | null;
  deadline: string;
  status: RoundStatus;
}

export interface Match {
  id: string;
  round_id: string | null;
  swehockey_game_id: string | null;
  opponent: string;
  is_home: boolean;
  starts_at: string;
  status: MatchStatus;
  ssk_goals: number | null;
  opp_goals: number | null;
  result: string | null;
}

export interface PlayerMatchStats {
  match_id: string;
  player_id: string;
  goals: number;
  assists: number;
  pp_points: number;
  plus_minus: number;
  minor_pen: number; // antal 2-min-utvisningar
  major_pen: number; // antal utvisningar > 2 min
  pim: number; // totala utvisningsminuter (info)
  points: number;
}

export interface GoalieMatchStats {
  match_id: string;
  player_id: string;
  played: boolean;
  is_starter: boolean;
  saves: number;
  shots_against: number;
  goals_against: number;
  save_pct: number | null;
  shutout: boolean;
  win: boolean;
  points: number;
}

export interface Entry {
  id: string;
  user_id: string;
  round_id: string;
  goalie_id: string | null;
  points: number;
  submitted_at: string | null;
}

export interface League {
  id: string;
  name: string;
  type: LeagueType;
  owner_id: string;
  join_code: string;
  created_at: string;
}

// Admin manuell inmatning
export interface AdminSkaterLine {
  player_id: string;
  goals: number;
  assists: number;
  pp_points: number;
  plus_minus: number;
  minor_pen: number;
  major_pen: number;
}
export interface AdminGoalieLine {
  player_id: string;
  saves: number;
  goals_against: number;
  is_starter: boolean;
}

-- ============================================================
-- SSK-femman — SLUTSPELSLIGOR (H2H utslagsträd)
-- Kör hela filen i Supabase SQL Editor.
--
-- Modell: single-elimination. Admin skapar en slutspelsliga och sätter
-- antal deltagare (tvåpotens: 2/4/8/16/32). Öppen anmälan tills full.
-- Vid start seedas deltagarna i anmälningsordning och omgång 1 skapas.
-- Varje bracket-omgång kopplas till en vanlig speleomgång (rounds) —
-- den med högst femmapoäng (entries.points) den omgången går vidare.
-- Skrivning (skapa/starta/avgöra) sker via service-role (förbigår RLS).
-- ============================================================

create table if not exists playoff_leagues (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  size          int not null default 8,        -- antal deltagare (2^n)
  status        text not null default 'open',   -- 'open' | 'running' | 'done'
  current_round int not null default 0,         -- 0 = ej startad
  total_rounds  int not null default 0,
  owner_id      uuid not null references profiles(id) on delete cascade,
  created_at    timestamptz not null default now()
);

create table if not exists playoff_participants (
  league_id        uuid not null references playoff_leagues(id) on delete cascade,
  user_id          uuid not null references profiles(id) on delete cascade,
  seed             int,
  eliminated_round int,                          -- null = kvar i spelet
  joined_at        timestamptz not null default now(),
  primary key (league_id, user_id)
);
create index if not exists pp_league_idx on playoff_participants(league_id);

create table if not exists playoff_matchups (
  id           uuid primary key default gen_random_uuid(),
  league_id    uuid not null references playoff_leagues(id) on delete cascade,
  round        int not null,                     -- 1..total_rounds
  slot         int not null,                     -- 0-indexerad position i omgången
  gw_round_id  uuid references rounds(id) on delete set null, -- vilken speleomgång som avgör
  p1_user      uuid references profiles(id) on delete set null,
  p2_user      uuid references profiles(id) on delete set null,
  p1_points    numeric(7,2),
  p2_points    numeric(7,2),
  winner_user  uuid references profiles(id) on delete set null,
  status       text not null default 'pending', -- 'pending' | 'done'
  unique (league_id, round, slot)
);
create index if not exists pm_league_round_idx on playoff_matchups(league_id, round);

-- ============================================================
-- RLS — läsning öppen för alla; anmälan gör användaren själv.
-- Inga policys refererar andra tabeller → ingen rekursionsrisk.
-- ============================================================
alter table playoff_leagues      enable row level security;
alter table playoff_participants enable row level security;
alter table playoff_matchups     enable row level security;

drop policy if exists pl_read on playoff_leagues;
create policy pl_read on playoff_leagues for select using (true);

drop policy if exists pp_read on playoff_participants;
create policy pp_read on playoff_participants for select using (true);

drop policy if exists pp_insert on playoff_participants;
create policy pp_insert on playoff_participants for insert with check (user_id = auth.uid());

drop policy if exists pp_delete on playoff_participants;
create policy pp_delete on playoff_participants for delete using (user_id = auth.uid());

drop policy if exists pm_read on playoff_matchups;
create policy pm_read on playoff_matchups for select using (true);

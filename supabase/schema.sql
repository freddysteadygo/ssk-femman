-- ============================================================
-- SSK-femman — databasschema (Supabase / Postgres)
-- Kör hela filen i Supabase SQL Editor (eller via supabase db push).
-- ============================================================

-- Extensions
create extension if not exists "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================
do $$ begin
  create type match_status as enum ('upcoming', 'live', 'final');
exception when duplicate_object then null; end $$;

do $$ begin
  create type round_status as enum ('open', 'locked', 'settled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type player_position as enum ('G', 'D', 'F');
exception when duplicate_object then null; end $$;

do $$ begin
  create type league_type as enum ('public', 'private');
exception when duplicate_object then null; end $$;

-- ============================================================
-- PROFILES  (1:1 med auth.users)
-- ============================================================
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username     text unique not null,
  email        text,
  is_admin     boolean not null default false,
  notify_round boolean not null default true,  -- mejlnotis inför omgångar
  created_at   timestamptz not null default now()
);

-- ============================================================
-- PLAYERS  (SSK-truppen)
-- ============================================================
create table if not exists players (
  id            uuid primary key default gen_random_uuid(),
  swehockey_id  text unique,
  full_name     text not null unique,
  position      player_position not null,
  jersey_no     int,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists players_active_idx on players(active);

-- ============================================================
-- ROUNDS  (omgångar — spelenhet)
-- ============================================================
create table if not exists rounds (
  id          uuid primary key default gen_random_uuid(),
  number      int not null,               -- omgångsnummer i säsongen
  name        text,                       -- t.ex. "Omgång 12"
  deadline    timestamptz not null,       -- lås för femma/tips (oftast första matchens start)
  status      round_status not null default 'open',
  reminded_at timestamptz,                -- när notis-mejl skickats för omgången
  created_at  timestamptz not null default now(),
  unique (number)
);
create index if not exists rounds_status_idx on rounds(status);

-- ============================================================
-- MATCHES
-- ============================================================
create table if not exists matches (
  id                uuid primary key default gen_random_uuid(),
  round_id          uuid references rounds(id) on delete set null,
  swehockey_game_id text unique,
  opponent          text not null,
  is_home           boolean not null,
  starts_at         timestamptz not null,
  status            match_status not null default 'upcoming',
  ssk_goals         int,
  opp_goals         int,
  -- resultat ur SSK:s perspektiv: 'W','L','OTW','OTL','SOW','SOL'
  result            text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists matches_round_idx on matches(round_id);
create index if not exists matches_starts_idx on matches(starts_at);

-- ============================================================
-- PER-MATCH STATS (fylls av ingest/scraper eller admin)
-- ============================================================
create table if not exists player_match_stats (
  id            uuid primary key default gen_random_uuid(),
  match_id      uuid not null references matches(id) on delete cascade,
  player_id     uuid not null references players(id) on delete cascade,
  goals         int not null default 0,
  assists       int not null default 0,
  pp_points     int not null default 0,   -- powerplay-mål + -assist
  plus_minus    int not null default 0,   -- netto: mål på isen för − emot
  minor_pen     int not null default 0,   -- antal 2-min-utvisningar
  major_pen     int not null default 0,   -- antal utvisningar > 2 min
  pim           int not null default 0,   -- totala utvisningsminuter (info)
  points        numeric(6,2) not null default 0, -- beräknad fantasy-poäng
  unique (match_id, player_id)
);
create index if not exists pms_match_idx on player_match_stats(match_id);

create table if not exists goalie_match_stats (
  id            uuid primary key default gen_random_uuid(),
  match_id      uuid not null references matches(id) on delete cascade,
  player_id     uuid not null references players(id) on delete cascade,
  played        boolean not null default false,
  is_starter    boolean not null default false, -- flest skott mot = startande
  saves         int not null default 0,
  shots_against int not null default 0,
  goals_against int not null default 0,
  save_pct      numeric(5,2),
  shutout       boolean not null default false,
  win           boolean not null default false,
  points        numeric(6,2) not null default 0,
  unique (match_id, player_id)
);
create index if not exists gms_match_idx on goalie_match_stats(match_id);

-- ============================================================
-- ENTRIES  (en femma per user per omgång)
-- ============================================================
create table if not exists entries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  round_id      uuid not null references rounds(id) on delete cascade,
  goalie_id     uuid references players(id),  -- gissad målvakt
  points        numeric(7,2) not null default 0, -- beräknad totalpoäng för omgången
  submitted_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, round_id)
);
create index if not exists entries_round_idx on entries(round_id);
create index if not exists entries_user_idx on entries(user_id);

create table if not exists entry_picks (
  entry_id   uuid not null references entries(id) on delete cascade,
  player_id  uuid not null references players(id) on delete cascade,
  primary key (entry_id, player_id)
);

-- ============================================================
-- RESULTATTIPS (per match)
-- ============================================================
create table if not exists result_tips (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  match_id    uuid not null references matches(id) on delete cascade,
  pred_ssk    int not null,
  pred_opp    int not null,
  points      numeric(6,2) not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, match_id)
);
create index if not exists tips_match_idx on result_tips(match_id);

-- ============================================================
-- LEAGUES
-- ============================================================
create table if not exists leagues (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        league_type not null default 'private',
  owner_id    uuid not null references profiles(id) on delete cascade,
  join_code   text unique not null default upper(substr(encode(gen_random_bytes(6),'hex'),1,8)),
  created_at  timestamptz not null default now()
);
create index if not exists leagues_type_idx on leagues(type);

create table if not exists league_members (
  league_id  uuid not null references leagues(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (league_id, user_id)
);
create index if not exists lm_user_idx on league_members(user_id);

-- ============================================================
-- TRIGGERS: updated_at
-- ============================================================
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

do $$ begin
  create trigger trg_matches_updated before update on matches
    for each row execute function set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_entries_updated before update on entries
    for each row execute function set_updated_at();
exception when duplicate_object then null; end $$;

-- ============================================================
-- AUTO-PROFIL vid ny auth.user
-- ============================================================
create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, email, username)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'username',
      split_part(new.email, '@', 1) || '_' || substr(new.id::text, 1, 4)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

do $$ begin
  create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function handle_new_user();
exception when duplicate_object then null; end $$;

-- ============================================================
-- LEADERBOARD-VY (per liga)
-- ============================================================
create or replace view league_standings as
select
  lm.league_id,
  lm.user_id,
  p.username,
  coalesce(sum(e.points), 0)
    + coalesce((select sum(rt.points) from result_tips rt where rt.user_id = lm.user_id), 0)
    as total_points
from league_members lm
join profiles p on p.id = lm.user_id
left join entries e on e.user_id = lm.user_id
group by lm.league_id, lm.user_id, p.username;

grant select on league_standings to authenticated, anon;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table profiles            enable row level security;
alter table players             enable row level security;
alter table rounds              enable row level security;
alter table matches             enable row level security;
alter table player_match_stats  enable row level security;
alter table goalie_match_stats  enable row level security;
alter table entries             enable row level security;
alter table entry_picks         enable row level security;
alter table result_tips         enable row level security;
alter table leagues             enable row level security;
alter table league_members      enable row level security;

-- Hjälpfunktion: är inloggad användare admin?
create or replace function is_admin() returns boolean as $$
  select exists(select 1 from profiles where id = auth.uid() and is_admin);
$$ language sql stable security definer;

-- ---- PROFILES ----
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select using (true);
drop policy if exists profiles_update on profiles;
create policy profiles_update on profiles for update using (id = auth.uid());

-- ---- PUBLIC READ-ONLY REFERENSDATA (alla inloggade får läsa) ----
drop policy if exists players_read on players;
create policy players_read on players for select using (true);
drop policy if exists rounds_read on rounds;
create policy rounds_read on rounds for select using (true);
drop policy if exists matches_read on matches;
create policy matches_read on matches for select using (true);
drop policy if exists pms_read on player_match_stats;
create policy pms_read on player_match_stats for select using (true);
drop policy if exists gms_read on goalie_match_stats;
create policy gms_read on goalie_match_stats for select using (true);
-- (Skrivning till dessa sker via service-role i ingest/admin, som förbigår RLS.)

-- ---- ENTRIES ----
drop policy if exists entries_select on entries;
create policy entries_select on entries for select using (user_id = auth.uid());
drop policy if exists entries_cud on entries;
create policy entries_cud on entries for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---- ENTRY_PICKS (via ägd entry) ----
drop policy if exists picks_all on entry_picks;
create policy picks_all on entry_picks for all
  using (exists (select 1 from entries e where e.id = entry_id and e.user_id = auth.uid()))
  with check (exists (select 1 from entries e where e.id = entry_id and e.user_id = auth.uid()));

-- ---- RESULT_TIPS ----
drop policy if exists tips_all on result_tips;
create policy tips_all on result_tips for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---- LEAGUES ----
drop policy if exists leagues_select on leagues;
create policy leagues_select on leagues for select
  using (
    type = 'public'
    or owner_id = auth.uid()
    or exists (select 1 from league_members m where m.league_id = id and m.user_id = auth.uid())
  );
drop policy if exists leagues_insert on leagues;
create policy leagues_insert on leagues for insert with check (owner_id = auth.uid());
drop policy if exists leagues_update on leagues;
create policy leagues_update on leagues for update using (owner_id = auth.uid());
drop policy if exists leagues_delete on leagues;
create policy leagues_delete on leagues for delete using (owner_id = auth.uid());

-- ---- LEAGUE_MEMBERS ----
drop policy if exists lm_select on league_members;
create policy lm_select on league_members for select
  using (
    user_id = auth.uid()
    or exists (select 1 from leagues l where l.id = league_id and l.owner_id = auth.uid())
    or exists (select 1 from league_members m2 where m2.league_id = league_id and m2.user_id = auth.uid())
  );
drop policy if exists lm_insert on league_members;
create policy lm_insert on league_members for insert with check (user_id = auth.uid());
drop policy if exists lm_delete on league_members;
create policy lm_delete on league_members for delete
  using (user_id = auth.uid()
    or exists (select 1 from leagues l where l.id = league_id and l.owner_id = auth.uid()));

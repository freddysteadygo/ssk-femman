-- ============================================================
-- SSK-femman — spara enskilda mål
-- ------------------------------------------------------------
-- Vi har hittills bara sparat totaler per spelare och match
-- (player_match_stats). Det räcker för poängen, men inte för att visa
-- "24:17 Souch (Stevens, Fizer)" i omgångshistoriken.
--
-- Skrapan plockar redan ut målskytt, assisterande, tid och spelform ur
-- rapporten — de kastades bara bort efter poängräkningen. Nu sparas de.
--
-- Namnen sparas som text, inte som spelar-id: ett mål av någon som ännu
-- inte finns i truppen ska synas i matchbilden även om det inte gett
-- poäng. Annars försvinner målet helt, vilket är sämre än att visa det.
-- Säker att köra om.
-- ============================================================

create table if not exists match_goals (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references matches(id) on delete cascade,
  second     int  not null default 0,   -- matchtid i sekunder, för sortering
  time_text  text,                      -- "24:17" som det står i rapporten
  situation  text,                      -- EQ / PP / SH / PS / EN
  is_ssk     boolean not null,
  scorer     text not null,
  assists    text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists match_goals_match_idx on match_goals(match_id, second);

alter table match_goals enable row level security;

-- Matchhändelser är lika öppna som matchresultaten i övrigt.
drop policy if exists match_goals_read on match_goals;
create policy match_goals_read on match_goals for select using (true);

select count(*) as sparade_mal from match_goals;

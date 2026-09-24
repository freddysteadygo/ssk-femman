-- ============================================================
-- SSK-femman — kapten + överförd femma
-- Kör hela filen i Supabase → SQL Editor. Säker att köra om.
-- ============================================================

-- Kaptenen bland de fem utespelarna. Ger dubbla poäng (även negativa).
alter table entries
  add column if not exists captain_id uuid references players(id);

-- Markerar en femma som automatiskt överförd från föregående omgång,
-- dvs. spelaren har inte aktivt bekräftat den här omgången.
alter table entries
  add column if not exists carried_over boolean not null default false;

-- Snabbare uppslag när omgångar förs över.
create index if not exists entries_captain_idx on entries(captain_id);

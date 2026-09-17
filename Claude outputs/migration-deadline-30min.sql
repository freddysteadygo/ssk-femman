-- ============================================================
-- SSK-femman — flytta deadline till 30 min före första matchen
-- Kör i Supabase SQL Editor.
-- Koden (syncSchedule) sätter detta automatiskt framöver; den här
-- körningen rättar de omgångar som redan ligger i databasen.
-- ============================================================

update rounds r
set deadline = m.first_start - interval '30 minutes'
from (
  select round_id, min(starts_at) as first_start
  from matches
  where round_id is not null
  group by round_id
) m
where m.round_id = r.id
  and r.deadline is distinct from (m.first_start - interval '30 minutes');

-- Kontroll: deadline ska nu vara 18:30 svensk tid för v38
select number, name, status,
       deadline at time zone 'Europe/Stockholm' as deadline_svensk_tid,
       reminded_at
from rounds
order by deadline
limit 6;

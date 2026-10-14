-- ============================================================
-- SSK-femman — rensa dubblerade matcher
-- ------------------------------------------------------------
-- Schema-synken matchade befintliga matcher på motståndare + EXAKT
-- starttid. Flyttade swehockey en avsparkstid skapades därför en ny rad
-- i stället för att den gamla uppdaterades, och båda låg kvar i tipsvyn.
--
-- Koden matchar nu på speldygn i stället, så nya dubbletter uppstår inte.
-- Den här filen städar dem som redan hunnit skapas.
--
-- Raden som behålls är den med flest resultattips — annars skulle någons
-- tips försvinna när dubbletten tas bort (result_tips har on delete
-- cascade). Tiderna rättas av nästa schema-synk.
--
-- Kör gärna SELECT:en först och titta på vad som skulle tas bort.
-- ============================================================

-- 1) Titta: vilka dubbletter finns?
select
  m.opponent,
  (m.starts_at at time zone 'Europe/Stockholm')::date as speldag,
  count(*) as antal_rader,
  array_agg(
    to_char(m.starts_at at time zone 'Europe/Stockholm', 'HH24:MI')
    order by m.starts_at
  ) as tider
from matches m
where m.status = 'upcoming'
group by m.opponent, (m.starts_at at time zone 'Europe/Stockholm')::date
having count(*) > 1
order by speldag;

-- 2) Ta bort överflödiga rader. Behåll den med flest tips, därefter den
--    som redan har ett swehockey-id, därefter lägsta id (stabil ordning).
with kandidater as (
  select
    m.id,
    m.opponent,
    (m.starts_at at time zone 'Europe/Stockholm')::date as speldag,
    (select count(*) from result_tips t where t.match_id = m.id) as tips,
    (m.swehockey_game_id is not null) as har_spelid
  from matches m
  where m.status = 'upcoming'
),
rankade as (
  select
    id,
    row_number() over (
      partition by opponent, speldag
      order by tips desc, har_spelid desc, id asc
    ) as rn
  from kandidater
)
delete from matches
where id in (select id from rankade where rn > 1);

-- 3) Kontroll: ska ge noll rader.
select
  m.opponent,
  (m.starts_at at time zone 'Europe/Stockholm')::date as speldag,
  count(*) as antal_rader
from matches m
where m.status = 'upcoming'
group by m.opponent, (m.starts_at at time zone 'Europe/Stockholm')::date
having count(*) > 1;

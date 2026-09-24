-- ============================================================
-- SSK-femman — komplettera truppen
-- ------------------------------------------------------------
-- Två spelare saknades helt i players och fick därför noll poäng trots
-- att de gjort mål respektive assist:
--   49 Philip Lantz     (F) — mål mot Visby/Roma 20 sep
--   29 William Håkansson (D) — lån från Luleå HF sedan 16 sep
-- Positioner verifierade mot eliteprospects och swehockeys line up.
-- Säker att köra om.
-- ============================================================

insert into players (full_name, position, jersey_no, active)
values
  ('Philip Lantz', 'F', 49, true),
  ('William Håkansson', 'D', 29, true)
on conflict (full_name) do update
  set jersey_no = excluded.jersey_no,
      position  = excluded.position,
      active    = true;

-- Kontroll: ska ge två rader.
select jersey_no, full_name, position, active
from players
where full_name in ('Philip Lantz', 'William Håkansson');

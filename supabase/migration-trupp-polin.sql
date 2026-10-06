-- ============================================================
-- SSK-femman — lägg till Egor Polin
-- ------------------------------------------------------------
-- 23 Egor Polin (F), inlånad från Örebro HK sedan 2026-10-01.
-- Hade assist på 5-2-målet mot Östersund 2 okt, som inte räknades
-- eftersom han saknades i truppen.
--
-- Position verifierad mot eliteprospects (LW) och swehockeys line up
-- för match 1110358, där han står som forward i tredjekedjan.
-- Säker att köra om.
-- ============================================================

insert into players (full_name, position, jersey_no, active)
values ('Egor Polin', 'F', 23, true)
on conflict (full_name) do update
  set jersey_no = excluded.jersey_no,
      position  = excluded.position,
      active    = true;

-- Räkna om Östersundsmatchen så assisten kommer med. Att nolla
-- statistiken gör att settleMatches plockar matchen igen vid nästa
-- körning — ingen force behövs.
delete from player_match_stats
where match_id in (
  select id from matches where swehockey_game_id = '1110358'
);
delete from goalie_match_stats
where match_id in (
  select id from matches where swehockey_game_id = '1110358'
);

-- Kontroll
select jersey_no, full_name, position from players where jersey_no = 23;

-- Döp om SSK-femman #1 och rätta pris-domänen. Kör i Supabase → SQL Editor.
update leagues
set name  = 'SSK-femman #1 – Säsongsstart',
    prize = 'Presentkort 500:- på sodertaljeskshop.se'
where name = 'SSK-femman #1 – Säsongsinledning';

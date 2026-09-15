-- Kör en gång i Supabase SQL Editor (fält för tidsbegränsade ligor med pris).
alter table leagues add column if not exists description text;
alter table leagues add column if not exists prize       text;
alter table leagues add column if not exists starts_on   date;  -- null = hela säsongen
alter table leagues add column if not exists ends_on     date;

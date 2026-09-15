-- Kör en gång i Supabase SQL Editor (lägger till kolumner för mejlnotiser).
alter table profiles add column if not exists notify_round boolean not null default true;
alter table rounds   add column if not exists reminded_at timestamptz;

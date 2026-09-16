-- Fix: publika ligor blev tomma pga RLS-rekursion mellan leagues och league_members.
-- Lösning: bryt rekursionen med SECURITY DEFINER-hjälpfunktioner (kringgår RLS internt).
-- Kör HELA filen i Supabase → SQL Editor. Idempotent – kan köras flera gånger.

create or replace function public.is_league_member(lid uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from league_members
    where league_id = lid and user_id = auth.uid()
  );
$$;

create or replace function public.is_league_owner(lid uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from leagues
    where id = lid and owner_id = auth.uid()
  );
$$;

grant execute on function public.is_league_member(uuid) to anon, authenticated;
grant execute on function public.is_league_owner(uuid) to anon, authenticated;

alter table leagues enable row level security;
drop policy if exists leagues_select on leagues;
create policy leagues_select on leagues for select
  using (type = 'public' or owner_id = auth.uid() or public.is_league_member(id));

alter table league_members enable row level security;
drop policy if exists lm_select on league_members;
create policy lm_select on league_members for select
  using (user_id = auth.uid() or public.is_league_owner(league_id));

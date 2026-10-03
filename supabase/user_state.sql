-- ============================================================
-- JeTravel+ — connexion Google + sauvegarde cloud (table user_state)
-- À exécuter une fois : Supabase → SQL Editor → New query → coller → Run
-- Sans danger si exécuté plusieurs fois.
-- ============================================================

-- 1. Copie du localStorage de l'app : une ligne par clé et par utilisateur
create table if not exists public.user_state (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  key        text        not null check (key !~ '^sb-' and char_length(key) <= 200),
  value      text        check (octet_length(value) <= 1000000),
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.user_state enable row level security;

drop policy if exists "user_state : lire ses lignes" on public.user_state;
create policy "user_state : lire ses lignes" on public.user_state
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "user_state : ajouter ses lignes" on public.user_state;
create policy "user_state : ajouter ses lignes" on public.user_state
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "user_state : modifier ses lignes" on public.user_state;
create policy "user_state : modifier ses lignes" on public.user_state
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "user_state : supprimer ses lignes" on public.user_state;
create policy "user_state : supprimer ses lignes" on public.user_state
  for delete to authenticated using ((select auth.uid()) = user_id);

-- updated_at est toujours fixé par le serveur (impossible à falsifier depuis le navigateur)
create or replace function public.jt_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists user_state_touch on public.user_state;
create trigger user_state_touch
  before insert or update on public.user_state
  for each row execute function public.jt_touch_updated_at();

-- 2. Profil créé automatiquement à l'inscription
-- (la table profiles existe déjà si supabase/schema.sql a été exécuté ; sinon elle est créée ici)
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text,
  display_name text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles enable row level security;

drop policy if exists "Lire son profil" on public.profiles;
create policy "Lire son profil" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "Modifier son profil" on public.profiles;
create policy "Modifier son profil" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create or replace function public.jt_handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists jt_on_auth_user_created on auth.users;
create trigger jt_on_auth_user_created
  after insert on auth.users
  for each row execute function public.jt_handle_new_user();

-- Profils pour les comptes déjà existants
insert into public.profiles (id, email, display_name)
select id, email, split_part(email, '@', 1) from auth.users
on conflict (id) do nothing;

-- ============================================================
-- JeTravel+ — base de données Supabase
-- À exécuter une fois dans Supabase : SQL Editor → New query → coller → Run
-- ============================================================

-- Un profil par utilisateur : on y enregistre les mêmes données que le navigateur
-- (évaluation, CV, lettre, candidatures, plan, réglages de l'assistant).
create table if not exists public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  email          text,
  display_name   text,
  notify_email   boolean not null default false,   -- rappels quotidiens par courriel
  eval           jsonb,
  computed       jsonb,
  cv             jsonb,
  letter         jsonb,
  apps           jsonb,
  done           jsonb,
  bot            jsonb,
  last_digest_at timestamptz,                       -- dernier courriel de rappels envoyé
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Sécurité : chaque personne ne peut lire et modifier QUE son propre profil.
alter table public.profiles enable row level security;

drop policy if exists "Lire son profil" on public.profiles;
create policy "Lire son profil" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "Créer son profil" on public.profiles;
create policy "Créer son profil" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);

drop policy if exists "Modifier son profil" on public.profiles;
create policy "Modifier son profil" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "Supprimer son profil" on public.profiles;
create policy "Supprimer son profil" on public.profiles
  for delete to authenticated using ((select auth.uid()) = id);

-- Index pour l'envoi des rappels quotidiens
create index if not exists profiles_notify_idx on public.profiles (notify_email) where notify_email;

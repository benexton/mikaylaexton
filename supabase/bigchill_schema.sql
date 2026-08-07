-- =============================================================================
-- The Big Chill: Hanmer Springs walking mystery - Supabase schema
-- A SEPARATE Supabase project from the-rodeo (see docs/04-build-spec.md's
-- "self contained" requirement). Mirrors the-rodeo's conventions: RLS,
-- service-role-only writes for anything a guess could be checked against.
--
-- This is the milestone-5 slice: anonymous auth + a server-verified
-- accusation check, so the culprit id is off the device (it currently lives
-- in plain sight in src/bigchill/game.config.js's `clearedBy: null` marker).
-- Race mode's sessions/teams/progress tables are a later migration, once
-- that UI is designed.
--
-- Run in the Supabase SQL editor on the Big Chill project (dwvsniafixisrfrszjjr).
-- =============================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()

-- 1. Secrets --------------------------------------------------------------
-- Puzzle answers (when/if they need server-side checking) and the culprit id
-- live here, never in the client bundle. RLS is enabled with NO policies at
-- all, so no key (anon or authenticated) can read this table directly -
-- only the service-role edge function can, since the service role bypasses
-- RLS entirely.
create table if not exists public.bigchill_secrets (
  key   text primary key,
  value text not null
);

alter table public.bigchill_secrets enable row level security;

-- Seed the culprit id. If the mystery is ever rerun for another group with a
-- different culprit, update this row (and game.config.js's clearedBy
-- markers) together.
insert into public.bigchill_secrets (key, value) values ('culprit_id', 'bottler')
  on conflict (key) do update set value = excluded.value;

-- 2. Accusations ------------------------------------------------------------
-- One row per guess. user_id is the anonymous auth user
-- (supabase.auth.signInAnonymously()), so a device's guess history is
-- traceable without ever asking for a real identity.
create table if not exists public.bigchill_accusations (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  suspect_id text not null,
  correct    boolean not null
);

create index if not exists bigchill_accusations_user_ix on public.bigchill_accusations (user_id);

alter table public.bigchill_accusations enable row level security;

-- A signed-in (anonymous) user can see their own guesses. There is
-- deliberately NO insert policy - the bigchill-make-accusation edge
-- function (service role) is the only way a row can be written, so hitting
-- this table directly with the anon key can never record a fake "correct"
-- guess, and can never read the culprit id back out via a crafted insert.
drop policy if exists "bigchill accusations read own" on public.bigchill_accusations;
create policy "bigchill accusations read own" on public.bigchill_accusations
  for select to authenticated
  using (user_id = auth.uid());

-- 3. Clips storage bucket -----------------------------------------------
-- Character video clips live here instead of the git repo, per the build
-- spec: swap a clip by re-uploading it in the dashboard, no redeploy
-- needed. Public bucket, so no RLS policy is needed for reads (the public
-- flag serves objects at .../storage/v1/object/public/bigchill-clips/<file>
-- without going through storage.objects RLS at all). Uploads happen only
-- via the dashboard as the project owner, so no client-facing insert
-- policy is needed either - the anon key never needs write access here.
insert into storage.buckets (id, name, public)
  values ('bigchill-clips', 'bigchill-clips', true)
  on conflict (id) do nothing;

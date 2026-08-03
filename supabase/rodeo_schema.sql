-- =============================================================================
-- The Rodeo: Casablanca to Constantinople — Supabase schema
-- Mirrors the VERT (seismicshift) conventions: enums, updated_at trigger, RLS.
-- Run in the Supabase SQL editor on the same project (or a fresh one).
-- =============================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()

-- 1. Enums --------------------------------------------------------------------
do $$ begin
  create type rodeo_team as enum ('ben','miki');          -- team ben+john / team miki+bruce
exception when duplicate_object then null; end $$;

do $$ begin
  create type rodeo_scope as enum ('race','together');    -- raced leg vs collective rest stop
exception when duplicate_object then null; end $$;

-- 2. updated_at helper --------------------------------------------------------
create or replace function public.rodeo_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- 3. Legs ---------------------------------------------------------------------
-- One row per envelope. 'race' legs get two updates (one per team); 'together'
-- legs get a single shared update with team = null and score nothing.
create table if not exists public.rodeo_legs (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  leg_no            int not null,                    -- display order (1,2,3,...)
  scope             rodeo_scope not null default 'race',
  from_place        text,                            -- e.g. 'Casablanca'
  to_place          text,                            -- the envelope destination
  envelope_opened_at timestamptz,
  unique (leg_no)
);

drop trigger if exists trg_rodeo_legs_touch on public.rodeo_legs;
create trigger trg_rodeo_legs_touch before update on public.rodeo_legs
  for each row execute function public.rodeo_touch_updated_at();

-- 4. Updates ------------------------------------------------------------------
-- team = null means a collective ('together') update. money_minor is stored in
-- the smallest currency unit (cents) to avoid float drift. photos is a jsonb
-- array of { url, caption } pointing at objects in the rodeo-media bucket.
create table if not exists public.rodeo_updates (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  leg_id            uuid not null references public.rodeo_legs (id) on delete cascade,
  team              rodeo_team,                      -- null = collective update

  title             text,
  body              text,                            -- markdown (rendered with marked, as in VERT)

  money_minor       int,                             -- spend for this leg, in cents
  currency          text default 'USD',
  duration_minutes  int,                             -- leg time, whole minutes
  countries         text[] default '{}',             -- countries this pair crossed this leg

  lat               double precision,                -- map dot for this update
  lng               double precision,
  arrived_at        timestamptz,

  photos            jsonb not null default '[]'::jsonb,
  submitted_by      text,                            -- display name from user_metadata
  published         boolean not null default false,  -- only published rows reach the public snapshot

  -- one update per team per leg; one collective update per leg
  unique (leg_id, team)
);

create index if not exists rodeo_updates_leg_ix on public.rodeo_updates (leg_id);
create index if not exists rodeo_updates_pub_ix on public.rodeo_updates (published);

drop trigger if exists trg_rodeo_updates_touch on public.rodeo_updates;
create trigger trg_rodeo_updates_touch before update on public.rodeo_updates
  for each row execute function public.rodeo_touch_updated_at();

-- 5. Row Level Security -------------------------------------------------------
-- The team a signed-in user belongs to is stored in user_metadata.team and
-- surfaces in the JWT. This helper reads it once.
create or replace function public.rodeo_current_team()
returns text language sql stable as $$
  select auth.jwt() -> 'user_metadata' ->> 'team'
$$;

alter table public.rodeo_legs    enable row level security;
alter table public.rodeo_updates enable row level security;

-- Any signed-in traveller can read everything (the four of you).
drop policy if exists "rodeo legs read" on public.rodeo_legs;
create policy "rodeo legs read" on public.rodeo_legs
  for select to authenticated using (true);

drop policy if exists "rodeo updates read" on public.rodeo_updates;
create policy "rodeo updates read" on public.rodeo_updates
  for select to authenticated using (true);

-- Any signed-in traveller can create/edit legs (opening an envelope is shared).
drop policy if exists "rodeo legs write" on public.rodeo_legs;
create policy "rodeo legs write" on public.rodeo_legs
  for all to authenticated using (true) with check (true);

-- A traveller may write their OWN team's update, or a collective (team = null)
-- update. They cannot write the other team's row.
drop policy if exists "rodeo updates insert" on public.rodeo_updates;
create policy "rodeo updates insert" on public.rodeo_updates
  for insert to authenticated
  with check (team is null or team::text = public.rodeo_current_team());

drop policy if exists "rodeo updates update" on public.rodeo_updates;
create policy "rodeo updates update" on public.rodeo_updates
  for update to authenticated
  using (team is null or team::text = public.rodeo_current_team())
  with check (team is null or team::text = public.rodeo_current_team());

-- 6. Media bucket -------------------------------------------------------------
-- Public-read bucket for trip photos (mirrors observation-media). Photos are
-- referenced by public URL in rodeo_updates.photos and in the public snapshot.
insert into storage.buckets (id, name, public)
  values ('rodeo-media', 'rodeo-media', true)
  on conflict (id) do nothing;

-- Signed-in travellers can upload; everyone can read (bucket is public).
drop policy if exists "rodeo media upload" on storage.objects;
create policy "rodeo media upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'rodeo-media');

drop policy if exists "rodeo media read" on storage.objects;
create policy "rodeo media read" on storage.objects
  for select to public
  using (bucket_id = 'rodeo-media');

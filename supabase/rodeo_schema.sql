-- =============================================================================
-- The Rodeo: Casablanca to Constantinople - Supabase schema
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
  money_nzd_minor   int,                             -- money_minor converted to NZD cents at filing time
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

-- 7. NZD conversion (idempotent add, for databases created before this column) -
alter table public.rodeo_updates add column if not exists money_nzd_minor int;
comment on column public.rodeo_updates.money_nzd_minor is
  'money_minor converted to NZD cents at filing time via a live FX rate, so cross-currency legs score fairly';

-- 8. Place text (idempotent add) ---------------------------------------------
-- The Town/City + Country a traveller typed, kept as-typed alongside the
-- lat/lng that text was geocoded to - so editing a saved update can prefill
-- these losslessly, and a bad geocode is still visible/editable later instead
-- of just a mystery pin.
alter table public.rodeo_updates add column if not exists place_city text;
alter table public.rodeo_updates add column if not exists place_country text;

-- 9. Waypoints ------------------------------------------------------------
-- A leg summary (rodeo_updates) stays one row per (leg, team) and keeps the
-- scoring fields. Waypoints are any number of extra story/photo dots a team
-- drops along the same leg - no money/time/countries, no scoring impact.
-- leg_id/team are denormalized from the parent update purely so RLS here can
-- mirror rodeo_updates' policies exactly without a join.
create table if not exists public.rodeo_waypoints (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  update_id         uuid not null references public.rodeo_updates (id) on delete cascade,
  leg_id            uuid not null references public.rodeo_legs (id) on delete cascade,
  team              rodeo_team,

  title             text,
  body              text,
  place_city        text,
  place_country     text,
  lat               double precision,
  lng               double precision,
  arrived_at        timestamptz,

  photos            jsonb not null default '[]'::jsonb,
  sort_order        int not null default 0
);

create index if not exists rodeo_waypoints_update_ix on public.rodeo_waypoints (update_id);
create index if not exists rodeo_waypoints_leg_ix on public.rodeo_waypoints (leg_id);

drop trigger if exists trg_rodeo_waypoints_touch on public.rodeo_waypoints;
create trigger trg_rodeo_waypoints_touch before update on public.rodeo_waypoints
  for each row execute function public.rodeo_touch_updated_at();

alter table public.rodeo_waypoints enable row level security;

-- Waypoints have no published flag of their own - they're only ever read
-- through the public snapshot export (service role, bypasses RLS) or by a
-- signed-in traveller in HQ. Same read-everything / write-your-own-team shape
-- as rodeo_updates.
drop policy if exists "rodeo waypoints read" on public.rodeo_waypoints;
create policy "rodeo waypoints read" on public.rodeo_waypoints
  for select to authenticated using (true);

drop policy if exists "rodeo waypoints write" on public.rodeo_waypoints;
create policy "rodeo waypoints write" on public.rodeo_waypoints
  for all to authenticated
  using (team is null or team::text = public.rodeo_current_team())
  with check (team is null or team::text = public.rodeo_current_team());

-- 10. Comments --------------------------------------------------------------
-- Public visitors can comment on a leg. Comments are only ever written by the
-- rodeo-comment edge function (service role, verifies a Turnstile token first
-- and bypasses RLS entirely) - there is deliberately NO insert policy here,
-- so hitting this table directly with the anon key can never write a row,
-- Turnstile or not. New comments land unpublished; a traveller approves and
-- optionally replies from HQ.
create table if not exists public.rodeo_comments (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),

  leg_id            uuid not null references public.rodeo_legs (id) on delete cascade,
  author_name       text,
  body              text not null,
  published         boolean not null default false,

  reply_body        text,
  replied_at        timestamptz,
  replied_by        text
);

create index if not exists rodeo_comments_leg_ix on public.rodeo_comments (leg_id);
create index if not exists rodeo_comments_pub_ix on public.rodeo_comments (published);

alter table public.rodeo_comments enable row level security;

-- Anyone (even signed-out visitors) can read published comments.
drop policy if exists "rodeo comments read published" on public.rodeo_comments;
create policy "rodeo comments read published" on public.rodeo_comments
  for select to anon, authenticated
  using (published = true);

-- Signed-in travellers can also see the unpublished moderation queue.
drop policy if exists "rodeo comments read all" on public.rodeo_comments;
create policy "rodeo comments read all" on public.rodeo_comments
  for select to authenticated using (true);

-- Approve/reply/delete from HQ. No insert policy for anyone - see note above.
drop policy if exists "rodeo comments moderate" on public.rodeo_comments;
create policy "rodeo comments moderate" on public.rodeo_comments
  for update to authenticated using (true) with check (true);

drop policy if exists "rodeo comments delete" on public.rodeo_comments;
create policy "rodeo comments delete" on public.rodeo_comments
  for delete to authenticated using (true);

-- 11. Best/worst meal (idempotent add) ---------------------------------------
-- Free text, one of each per update. Left null when a team didn't file one -
-- that's the only "N/A" state; the public export and viewer both just omit
-- the field entirely when it's null rather than showing it empty.
alter table public.rodeo_updates add column if not exists best_meal text;
alter table public.rodeo_updates add column if not exists worst_meal text;

-- 12. Start/arrive clock + sealed figures ------------------------------------
-- Each pair taps "Start" when they set off and "We've arrived" at the
-- destination; duration_minutes is derived from the two (and recomputed if
-- either time is corrected by hand in HQ).
alter table public.rodeo_updates add column if not exists started_at timestamptz;

-- Spend and timing are sealed: a signed-in traveller can't read the OTHER
-- pair's money or times until both pairs have finished the leg (arrived and
-- logged a spend), so whoever files second can't just undercut. Column grants
-- hide the sensitive columns from direct reads; rodeo_figures() hands them
-- back only where allowed. The service role (export script) is unaffected.
revoke select on public.rodeo_updates from anon, authenticated;
grant select (id, created_at, updated_at, leg_id, team, title, body, countries,
              place_city, place_country, lat, lng, photos, submitted_by,
              published, best_meal, worst_meal)
  on public.rodeo_updates to authenticated;

create or replace function public.rodeo_figures()
returns table (
  update_id uuid, leg_id uuid, team rodeo_team,
  has_started boolean, has_arrived boolean, revealed boolean,
  money_minor int, currency text, money_nzd_minor int,
  duration_minutes int, started_at timestamptz, arrived_at timestamptz
)
language sql stable security definer set search_path = public as $$
  with done as (
    select u.leg_id,
           count(*) filter (
             where u.team is not null
               and (u.arrived_at is not null or u.duration_minutes is not null)
               and u.money_minor is not null
           ) = 2 as both_done
    from rodeo_updates u
    group by u.leg_id
  ), vis as (
    select u.*,
           (u.team is null or u.team::text = rodeo_current_team() or d.both_done) as visible
    from rodeo_updates u join done d using (leg_id)
  )
  select id, leg_id, team,
         started_at is not null, arrived_at is not null or duration_minutes is not null, visible,
         case when visible then money_minor end,
         case when visible then currency end,
         case when visible then money_nzd_minor end,
         case when visible then duration_minutes end,
         case when visible then started_at end,
         case when visible then arrived_at end
  from vis
  where auth.uid() is not null
$$;

revoke all on function public.rodeo_figures() from public, anon;
grant execute on function public.rodeo_figures() to authenticated;

-- 13. Deleting an update -----------------------------------------------------
-- HQ's "Delete this update" had no policy to act under, so RLS quietly
-- deleted nothing. Same own-team-or-collective rule as editing. Waypoints
-- under it go too (on delete cascade).
drop policy if exists "rodeo updates delete" on public.rodeo_updates;
create policy "rodeo updates delete" on public.rodeo_updates
  for delete to authenticated
  using (team is null or team::text = public.rodeo_current_team());

-- 14. Deleting photos --------------------------------------------------------
-- Lets HQ remove a photo's file when it's taken off an update or waypoint, or
-- the update/waypoint is deleted. The public/ folder (the published snapshot,
-- written by the publisher with the service role) is off limits.
drop policy if exists "rodeo media delete" on storage.objects;
create policy "rodeo media delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'rodeo-media' and name not like 'public/%');

-- 15. Scheduled publish -------------------------------------------------------
-- HQ republishes the public snapshot straight after every change (the
-- rodeo-publish edge function). This is the safety net: every 3 hours the
-- database calls the same function itself. The project URL and the shared
-- secret live in Vault, NOT in this file - create them once, separately:
--   select vault.create_secret('https://<ref>.supabase.co', 'rodeo_project_url');
--   select vault.create_secret('<long random string>', 'rodeo_publish_secret');
-- and give the function the same secret as RODEO_PUBLISH_SECRET. Until both
-- exist the job just fails quietly (see cron.job_run_details).
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'rodeo-publish',          -- re-running replaces the job of this name
  '0 */3 * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'rodeo_project_url')
           || '/functions/v1/rodeo-publish',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-publish-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'rodeo_publish_secret')
    ),
    body := '{}'::jsonb
  );
  $job$
);

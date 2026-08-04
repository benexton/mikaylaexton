-- =============================================================================
-- The Rodeo: example seed data
-- Six legs, Casablanca to Constantinople, with both teams' updates filled in
-- so you can see the map, timeline and scoreboard fully populated - including
-- multi-photo galleries and the NZD-converted spend used for scoring.
--
-- Requires the money_nzd_minor column from rodeo_schema.sql section 7 (run
-- that first if this is a fresh project, or if you set the project up before
-- that column existed).
--
-- Photos here are placeholder images (picsum.photos) purely so the gallery
-- has something to scroll through - swap in real uploaded URLs later.
--
-- Run this in the Supabase SQL editor for the RODEO project, then trigger the
-- "Publish Rodeo snapshot" GitHub Action (or run scripts/export_rodeo.py) to
-- regenerate the public JSON the site reads.
--
-- Safe to re-run: it deletes any existing rows for these six leg numbers first.
-- =============================================================================

delete from public.rodeo_updates where leg_id in (select id from public.rodeo_legs where leg_no between 1 and 6);
delete from public.rodeo_legs where leg_no between 1 and 6;

-- 1. Legs ----------------------------------------------------------------------
insert into public.rodeo_legs (id, leg_no, scope, from_place, to_place, envelope_opened_at) values
  ('11111111-1111-1111-1111-111111111101', 1, 'race',     'Casablanca', 'Marrakesh',     '2026-06-01 09:00+00'),
  ('11111111-1111-1111-1111-111111111102', 2, 'race',     'Marrakesh',  'Tangier',       '2026-06-04 08:00+00'),
  ('11111111-1111-1111-1111-111111111103', 3, 'together', 'Tangier',    'Algeciras',     '2026-06-06 10:00+00'),
  ('11111111-1111-1111-1111-111111111104', 4, 'race',     'Algeciras',  'Barcelona',     '2026-06-08 07:00+00'),
  ('11111111-1111-1111-1111-111111111105', 5, 'race',     'Barcelona',  'Venice',        '2026-06-12 06:00+00'),
  ('11111111-1111-1111-1111-111111111106', 6, 'race',     'Venice',     'Constantinople','2026-06-18 07:00+00');

-- 2. Updates ---------------------------------------------------------------------

-- Leg 1: Casablanca -> Marrakesh
insert into public.rodeo_updates
  (leg_id, team, title, body, money_minor, currency, money_nzd_minor, duration_minutes, countries, lat, lng, arrived_at, photos, submitted_by, published)
values
  ('11111111-1111-1111-1111-111111111101', 'ben',
   'Grand Taxi Gambit',
   'Split a shared grand taxi with four strangers and a crate of live chickens. John negotiated the fare in broken French and somehow made it worse.',
   45000, 'MAD', 7502, 240, '{Morocco}', 31.6295, -7.9811, '2026-06-01 14:10+00',
   '[{"url":"https://picsum.photos/seed/rodeo-l1-ben-1/900/650","caption":"The grand taxi, fully loaded"},{"url":"https://picsum.photos/seed/rodeo-l1-ben-2/900/650","caption":"John losing the fare negotiation"}]',
   'Ben', true),
  ('11111111-1111-1111-1111-111111111101', 'miki',
   'The Scenic (Expensive) Route',
   'Booked a "direct" CTM bus that stopped in every village between here and Marrakesh. Bruce slept through all of it.',
   62000, 'MAD', 10330, 210, '{Morocco}', 31.6300, -7.9820, '2026-06-01 13:20+00',
   '[{"url":"https://picsum.photos/seed/rodeo-l1-miki-1/900/650","caption":"Bruce, asleep, village number nine"}]',
   'Miki', true);

-- Leg 2: Marrakesh -> Tangier
insert into public.rodeo_updates
  (leg_id, team, title, body, money_minor, currency, money_nzd_minor, duration_minutes, countries, lat, lng, arrived_at, photos, submitted_by, published)
values
  ('11111111-1111-1111-1111-111111111102', 'ben',
   'Overnight Train, Under-Slept',
   'Second class overnight to Tangier. Won the leg on time but lost all feeling in both legs.',
   90000, 'MAD', 15003, 480, '{Morocco}', 35.7595, -5.8340, '2026-06-04 16:00+00',
   '[{"url":"https://picsum.photos/seed/rodeo-l2-ben-1/900/650","caption":"Sunrise somewhere near Rabat"}]',
   'John', true),
  ('11111111-1111-1111-1111-111111111102', 'miki',
   'Hitchhiked Half of It',
   'A very friendly almond truck driver got us three quarters of the way. Walked the rest.',
   75000, 'MAD', 12503, 540, '{Morocco}', 35.7600, -5.8350, '2026-06-04 17:00+00',
   '[{"url":"https://picsum.photos/seed/rodeo-l2-miki-1/900/650","caption":"Our ride, and several tonnes of almonds"},{"url":"https://picsum.photos/seed/rodeo-l2-miki-2/900/650","caption":"The last, unplanned, 9km on foot"}]',
   'Bruce', true);

-- Leg 3: Tangier -> Algeciras (together, ferry across the Strait)
insert into public.rodeo_updates
  (leg_id, team, title, body, money_minor, currency, money_nzd_minor, duration_minutes, countries, lat, lng, arrived_at, photos, submitted_by, published)
values
  ('11111111-1111-1111-1111-111111111103', null,
   'Africa to Europe in 90 Minutes',
   'Everyone on the same ferry for once. Dolphins showed up halfway across, which we are choosing to read as a good omen for the next leg.',
   3500, 'EUR', 6265, 90, '{Spain}', 36.1408, -5.4562, '2026-06-06 15:30+00',
   '[{"url":"https://picsum.photos/seed/rodeo-l3-together-1/900/650","caption":"Dolphins, allegedly a good omen"},{"url":"https://picsum.photos/seed/rodeo-l3-together-2/900/650","caption":"All four of us, briefly, on the same boat"}]',
   'Miki', true);

-- Leg 4: Algeciras -> Barcelona
insert into public.rodeo_updates
  (leg_id, team, title, body, money_minor, currency, money_nzd_minor, duration_minutes, countries, lat, lng, arrived_at, photos, submitted_by, published)
values
  ('11111111-1111-1111-1111-111111111104', 'ben',
   'Budget Airline Roulette',
   'Flew standby out of Malaga for a fraction of the train fare. Carry-on rules nearly ended us at the gate.',
   8500, 'EUR', 15215, 660, '{Spain}', 41.3874, 2.1686, '2026-06-08 18:40+00',
   '[{"url":"https://picsum.photos/seed/rodeo-l4-ben-1/900/650","caption":"The gate argument, mid-negotiation"}]',
   'Ben', true),
  ('11111111-1111-1111-1111-111111111104', 'miki',
   'High-Speed and Horrified',
   'AVE train, first class, fully justified after Morocco. Bruce cried a little at the legroom.',
   12000, 'EUR', 21480, 540, '{Spain}', 41.3880, 2.1690, '2026-06-08 17:20+00',
   '[{"url":"https://picsum.photos/seed/rodeo-l4-miki-1/900/650","caption":"Legroom, at last"},{"url":"https://picsum.photos/seed/rodeo-l4-miki-2/900/650","caption":"Bruce, emotional, first class"}]',
   'Bruce', true);

-- Leg 5: Barcelona -> Venice
insert into public.rodeo_updates
  (leg_id, team, title, body, money_minor, currency, money_nzd_minor, duration_minutes, countries, lat, lng, arrived_at, photos, submitted_by, published)
values
  ('11111111-1111-1111-1111-111111111105', 'ben',
   'Three Countries, One Tank of Gas',
   'Rented a car and drove the coast road through France into Italy. Slept at a rest stop outside Genoa.',
   21000, 'EUR', 37590, 1200, '{France,Italy}', 45.4408, 12.3155, '2026-06-13 06:00+00',
   '[{"url":"https://picsum.photos/seed/rodeo-l5-ben-1/900/650","caption":"The coast road, somewhere in Provence"},{"url":"https://picsum.photos/seed/rodeo-l5-ben-2/900/650","caption":"Rest stop outside Genoa, 3am"}]',
   'John', true),
  ('11111111-1111-1111-1111-111111111105', 'miki',
   'Straight There, No Regrets',
   'Direct flight into Venice Marco Polo. Landed before Ben even crossed the French border.',
   34000, 'EUR', 60860, 150, '{Italy}', 45.4410, 12.3160, '2026-06-12 09:30+00',
   '[{"url":"https://picsum.photos/seed/rodeo-l5-miki-1/900/650","caption":"Venice, twenty-two hours ahead of schedule"}]',
   'Miki', true);

-- Leg 6: Venice -> Constantinople (final leg)
insert into public.rodeo_updates
  (leg_id, team, title, body, money_minor, currency, money_nzd_minor, duration_minutes, countries, lat, lng, arrived_at, photos, submitted_by, published)
values
  ('11111111-1111-1111-1111-111111111106', 'ben',
   'The Overland Gauntlet',
   'Slovenia, Croatia, Serbia, Bulgaria, then Turkey, by train, bus, and one memorable stretch in a stranger''s Skoda. Forty-eight hours of it. Worth it for the country count alone.',
   45000, 'EUR', 80550, 2880, '{Slovenia,Croatia,Serbia,Bulgaria,Turkey}', 41.0082, 28.9784, '2026-06-20 08:00+00',
   '[{"url":"https://picsum.photos/seed/rodeo-l6-ben-1/900/650","caption":"Border number four, Bulgaria into Turkey"},{"url":"https://picsum.photos/seed/rodeo-l6-ben-2/900/650","caption":"The stranger''s Skoda"},{"url":"https://picsum.photos/seed/rodeo-l6-ben-3/900/650","caption":"First sight of the Bosphorus"}]',
   'Ben', true),
  ('11111111-1111-1111-1111-111111111106', 'miki',
   'Straight to the Bosphorus',
   'One flight, no layovers, sitting on the hotel terrace by the time Ben crossed into Serbia. Cheaper AND faster this time.',
   28000, 'EUR', 50120, 210, '{Turkey}', 41.0090, 28.9790, '2026-06-18 12:10+00',
   '[{"url":"https://picsum.photos/seed/rodeo-l6-miki-1/900/650","caption":"Hotel terrace, Bosphorus view, day one"}]',
   'Miki', true);

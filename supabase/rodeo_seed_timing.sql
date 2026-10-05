-- =============================================================================
-- The Rodeo: dummy costs + start/arrive times for the example seed legs
-- Run AFTER rodeo_seed_example.sql and section 12 of rodeo_schema.sql (it
-- needs the started_at column). Overwrites money, timing and countries on the
-- race-leg updates for legs 1-6; stories and photos are left alone.
--
-- Costs are in local currency with money_nzd_minor worked out at the
-- briefing pack's 4 October 2026 rates (10 MAD = NZ$1.80, EUR 1 = NZ$2.01).
-- Each pair starts 30/45 minutes after the envelope opens; arrival is start +
-- duration, so the times line up exactly as the HQ clock would record them.
--
-- Safe to re-run.
-- =============================================================================

update public.rodeo_updates u set
  money_minor      = v.money_minor,
  currency         = v.currency,
  money_nzd_minor  = v.money_nzd_minor,
  duration_minutes = v.mins,
  started_at       = l.envelope_opened_at + make_interval(mins => v.start_offset),
  arrived_at       = l.envelope_opened_at + make_interval(mins => v.start_offset + v.mins),
  countries        = coalesce(v.countries, u.countries)
from (values
  -- leg, team,  spend (minor), cur,   NZD (minor), minutes, start offset, countries (null = keep)
  (1, 'ben',   115000, 'MAD',  20700,  240, 30, null::text[]),
  (1, 'miki',   64000, 'MAD',  11520,  210, 45, null),
  (2, 'ben',   148000, 'MAD',  26640,  480, 30, null),
  (2, 'miki',  196000, 'MAD',  35280,  540, 45, null),
  (4, 'ben',    23800, 'EUR',  47838,  660, 30, null),
  (4, 'miki',   19600, 'EUR',  39396,  540, 45, null),
  (5, 'ben',    31200, 'EUR',  62712, 1320, 30, array['France','Italy']),
  (5, 'miki',   40500, 'EUR',  81405, 1140, 45, array['France','Italy']),
  (6, 'ben',    45500, 'EUR',  91455, 2880, 30, array['Slovenia','Croatia','Serbia','Bulgaria','Türkiye']),
  (6, 'miki',   52000, 'EUR', 104520, 2460, 45, array['Slovenia','Hungary','Romania','Bulgaria','Türkiye'])
) as v(leg_no, team, money_minor, currency, money_nzd_minor, mins, start_offset, countries)
join public.rodeo_legs l on l.leg_no = v.leg_no
where u.leg_id = l.id and u.team = v.team::rodeo_team;

-- Match the HQ pick list's spelling.
update public.rodeo_updates set countries = array_replace(countries, 'Turkey', 'Türkiye')
where 'Turkey' = any(countries);

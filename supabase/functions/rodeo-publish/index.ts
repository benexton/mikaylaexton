// Publishes the public snapshot for The Rodeo: reads PUBLISHED updates and
// all legs with the service role, computes the scoreboard, and writes one
// JSON file to the public rodeo-media bucket, which /the-rodeo fetches
// directly. (Replaces the old scripts/export_rodeo.py GitHub Action, whose
// "every 30 minutes" schedule GitHub only ran every few hours.)
//
// Called two ways:
//   * from HQ straight after every change, as the signed-in traveller
//   * by pg_cron every few hours as a safety net (rodeo_schema.sql section
//     15), proving itself with the x-publish-secret header
// Anyone else gets a 401. Deploy with JWT verification OFF - this function
// checks the caller itself:
//   supabase functions deploy rodeo-publish --no-verify-jwt --project-ref <ref>
//   supabase secrets set RODEO_PUBLISH_SECRET=... --project-ref <ref>
//
// Scoring (race legs only; 'together' legs score nothing):
//   * fastest pair that leg            -> +2
//   * cheapest pair that leg           -> +1
//   * every NEW country a pair crossed -> +1 each (per team, own route). A
//     country scores only the first time that pair crosses it, on the
//     earliest race leg; crossing it again later earns nothing.
// Money/time points need BOTH teams to have a published update for the leg.
// Money is compared on money_nzd_minor (converted at locked rates), never the
// raw money_minor, since the pairs routinely pay in different currencies.
//
// Spend is private: no raw amounts ever reach the public JSON - each race leg
// only carries a spend_summary of which pair spent more per person, in NZD.
// Leg times stay sealed until both pairs have arrived and logged a spend,
// mirroring rodeo_figures() in the schema.
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.112.0';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-publish-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BUCKET = 'rodeo-media';
const OBJECT_PATH = 'public/the-rodeo-public.json';

const TEAMS = {
  ben: { name: 'Ben & John', color: '#2f5fa0' },
  miki: { name: 'Miki & Bruce', color: '#cf6a34' },
} as const;
type Team = keyof typeof TEAMS;
const TEAM_KEYS = Object.keys(TEAMS) as Team[];

const PEOPLE_PER_TEAM = 2; // money is filed per pair; the public summary is per person
const TIME_POINTS = 2;     // keep in step with TIME_PTS / MONEY_PTS in RodeoPublic.jsx
const MONEY_POINTS = 1;

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

async function read(query: PromiseLike<{ data: Row[] | null; error: unknown }>, what: string) {
  const { data, error } = await query;
  if (error) throw new Error(`Read ${what} failed: ${JSON.stringify(error)}`);
  return data ?? [];
}

function byTeam(ups: Row[]) {
  const out: Partial<Record<Team, Row>> = {};
  for (const u of ups) if (u.team) out[u.team as Team] = u;
  return out;
}

// Who spent more on a race leg, per person, in NZD cents - or null until both
// pairs have filed a converted amount. The only spend info made public.
function spendSummary(ups: Partial<Record<Team, Row>>) {
  const mb = ups.ben?.money_nzd_minor, mm = ups.miki?.money_nzd_minor;
  if (mb == null || mm == null) return null;
  return {
    more: mb === mm ? null : (mb > mm ? 'ben' : 'miki'),
    per_person_nzd_minor: Math.round(Math.abs(mb - mm) / PEOPLE_PER_TEAM),
  };
}

function timesRevealed(leg: Row, ups: Partial<Record<Team, Row>>) {
  if (leg.scope !== 'race') return true;
  return TEAM_KEYS.every((t) => {
    const u = ups[t];
    return u && (u.arrived_at || u.duration_minutes != null) && u.money_minor != null;
  });
}

// Mutates each race-leg update with new_countries (the crossings that scored).
// Legs must arrive in leg_no order for "first crossing" to mean first.
function score(legs: Row[], updatesByLeg: Map<string, Row[]>) {
  const perLeg: Record<string, Record<Team, number>> = {};
  const totals = { ben: 0, miki: 0 };
  const breakdown = {
    ben: { money: 0, time: 0, countries: 0 },
    miki: { money: 0, time: 0, countries: 0 },
  };
  const perLegSpend: Record<string, unknown> = {};
  const perLegWinners: Record<string, { time: Team | null; money: Team | null }> = {};
  const seen = { ben: new Set<string>(), miki: new Set<string>() };

  for (const leg of legs) {
    const lid = leg.id;
    const pts = { ben: 0, miki: 0 };
    const ups = byTeam(updatesByLeg.get(lid) ?? []);

    if (leg.scope !== 'race') { perLeg[lid] = pts; continue; }

    perLegSpend[lid] = spendSummary(ups);
    const won = perLegWinners[lid] = { time: null as Team | null, money: null as Team | null };

    for (const t of TEAM_KEYS) {
      const u = ups[t];
      if (!u) continue;
      const fresh: string[] = [];
      for (const c of u.countries ?? []) {
        const key = String(c).trim().toLowerCase();
        if (key && !seen[t].has(key)) { seen[t].add(key); fresh.push(c); }
      }
      u.new_countries = fresh;
      pts[t] += fresh.length;
      breakdown[t].countries += fresh.length;
    }

    if (ups.ben && ups.miki) {
      const mb = ups.ben.money_nzd_minor, mm = ups.miki.money_nzd_minor;
      if (mb != null && mm != null && mb !== mm) {
        const w: Team = mb < mm ? 'ben' : 'miki';
        won.money = w; pts[w] += MONEY_POINTS; breakdown[w].money += MONEY_POINTS;
      }
      const tb = ups.ben.duration_minutes, tm = ups.miki.duration_minutes;
      if (tb != null && tm != null && tb !== tm) {
        const w: Team = tb < tm ? 'ben' : 'miki';
        won.time = w; pts[w] += TIME_POINTS; breakdown[w].time += TIME_POINTS;
      }
    }

    perLeg[lid] = pts;
    for (const t of TEAM_KEYS) totals[t] += pts[t];
  }
  return { perLeg, totals, breakdown, perLegSpend, perLegWinners };
}

async function publish(admin: SupabaseClient) {
  const legs = await read(admin.from('rodeo_legs')
    .select('id,leg_no,scope,from_place,to_place,envelope_opened_at')
    .order('leg_no', { ascending: true }), 'rodeo_legs');
  const updates = await read(admin.from('rodeo_updates')
    .select('id,leg_id,team,title,body,money_minor,currency,money_nzd_minor,duration_minutes,' +
      'countries,place_city,place_country,lat,lng,arrived_at,photos,submitted_by,best_meal,worst_meal')
    .eq('published', true), 'rodeo_updates');
  // Waypoints have no published flag of their own - they ride on their parent.
  const publishedIds = new Set(updates.map((u) => u.id));
  const waypoints = await read(admin.from('rodeo_waypoints')
    .select('update_id,title,body,place_city,place_country,lat,lng,arrived_at,photos')
    .order('sort_order', { ascending: true }), 'rodeo_waypoints');
  const waypointsByUpdate = new Map<string, Row[]>();
  for (const w of waypoints) {
    if (!publishedIds.has(w.update_id)) continue;
    if (!waypointsByUpdate.has(w.update_id)) waypointsByUpdate.set(w.update_id, []);
    waypointsByUpdate.get(w.update_id)!.push(w);
  }

  const updatesByLeg = new Map<string, Row[]>();
  for (const u of updates) {
    if (!updatesByLeg.has(u.leg_id)) updatesByLeg.set(u.leg_id, []);
    updatesByLeg.get(u.leg_id)!.push(u);
  }

  const { perLeg, totals, breakdown, perLegSpend, perLegWinners } = score(legs, updatesByLeg);

  const outLegs = legs.map((leg) => {
    const lid = leg.id;
    const legUpdates = updatesByLeg.get(lid) ?? [];
    const revealed = timesRevealed(leg, byTeam(legUpdates));
    return {
      id: lid, // needed publicly so the comment form knows which leg to attach to
      leg_no: leg.leg_no,
      scope: leg.scope,
      from_place: leg.from_place,
      to_place: leg.to_place,
      envelope_opened_at: leg.envelope_opened_at,
      points: perLeg[lid] ?? {},
      spend_summary: perLegSpend[lid] ?? null,
      winners: perLegWinners[lid] ?? null,
      updates: [...legUpdates]
        .sort((a, b) => (a.team ?? '').localeCompare(b.team ?? '')) // collective first, then ben, miki
        .map((u) => ({
          team: u.team, // null = collective
          title: u.title,
          body: u.body,
          duration_minutes: revealed ? u.duration_minutes : null,
          time_sealed: !revealed && u.duration_minutes != null,
          countries: u.countries ?? [],
          new_countries: u.new_countries ?? null, // the ones that scored; null on together legs
          place_city: u.place_city, place_country: u.place_country,
          lat: u.lat, lng: u.lng,
          arrived_at: revealed ? u.arrived_at : null,
          photos: u.photos ?? [],
          submitted_by: u.submitted_by,
          best_meal: u.best_meal,
          worst_meal: u.worst_meal,
          waypoints: (waypointsByUpdate.get(u.id) ?? []).map((w) => ({
            title: w.title,
            body: w.body,
            place_city: w.place_city, place_country: w.place_country,
            lat: w.lat, lng: w.lng,
            arrived_at: w.arrived_at,
            photos: w.photos ?? [],
          })),
        })),
    };
  });

  const payload = JSON.stringify({
    generatedAt: new Date().toISOString(),
    title: 'The Rodeo: Casablanca to Constantinople',
    teams: TEAMS,
    scoreboard: totals,
    scoreboard_breakdown: breakdown,
    legs: outLegs,
  });

  const { error } = await admin.storage.from(BUCKET).upload(
    OBJECT_PATH,
    new Blob([payload], { type: 'application/json' }),
    // max-age=0: viewers always revalidate, so a publish shows up at once
    { upsert: true, contentType: 'application/json', cacheControl: '0' },
  );
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return { legs: outLegs.length, scoreboard: totals };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  // Either the scheduled job (shared secret) or a signed-in traveller.
  const secret = Deno.env.get('RODEO_PUBLISH_SECRET');
  let allowed = !!secret && req.headers.get('x-publish-secret') === secret;
  if (!allowed) {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (token) {
      const { data } = await admin.auth.getUser(token);
      allowed = !!data?.user?.user_metadata?.team;
    }
  }
  if (!allowed) return json(401, { ok: false, error: 'Not allowed' });

  try {
    const result = await publish(admin);
    return json(200, { ok: true, ...result });
  } catch (err) {
    console.error('rodeo-publish failed', err);
    return json(500, { ok: false, error: 'Publish failed' });
  }
});

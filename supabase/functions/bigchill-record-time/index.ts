// Records how long a group took, next to the code they played with. Only
// ever updates a code that's already been redeemed (used_at is not null) -
// this can never create or unlock a code, just annotate one that's already
// spent. Best-effort from the client's side (see recordElapsedTime in
// bigchillSupabase.js) - a failed write here should never block the
// certificate screen, which already has the time client-side.
//
// Deploy: supabase functions deploy bigchill-record-time --project-ref dwvsniafixisrfrszjjr
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.0';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const code = typeof payload.code === 'string' ? payload.code.trim() : '';
  const elapsedSeconds = Number(payload.elapsed_seconds);
  if (!code) return json(400, { error: 'code is required' });
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
    return json(400, { error: 'elapsed_seconds must be a non-negative number' });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json(401, { error: 'Missing Authorization header' });

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json(401, { error: 'Not signed in' });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data, error } = await admin
    .from('bigchill_passwords')
    .update({ elapsed_seconds: Math.round(elapsedSeconds) })
    .eq('code', code)
    .not('used_at', 'is', null)
    .select('code');

  if (error) {
    console.error('bigchill-record-time: update failed', error);
    return json(500, { error: 'Could not record time' });
  }
  return json(200, { ok: Boolean(data && data.length > 0) });
});

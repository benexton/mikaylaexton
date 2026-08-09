// Atomically marks a one-time play code as used - the only way a code can
// ever move from unredeemed to redeemed, so two devices racing on the same
// code can never both get in. Follows bigchill-make-accusation's auth
// pattern (verify the caller's anonymous-auth JWT) purely to satisfy the API
// gateway's JWT check - the code string itself is what's actually being
// checked, not the caller's identity.
//
// Deploy: supabase functions deploy bigchill-redeem-password --project-ref dwvsniafixisrfrszjjr
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
  if (!code) return json(400, { error: 'code is required' });

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

  // The where-clause is the entire one-time-use guarantee: this only ever
  // touches a row that's still unredeemed, so a second attempt (or two
  // devices racing on the same code) gets zero rows back and fails.
  const { data, error } = await admin
    .from('bigchill_passwords')
    .update({ used_at: new Date().toISOString() })
    .eq('code', code)
    .is('used_at', null)
    .select('code');

  if (error) return json(500, { error: error.message });
  if (!data || data.length === 0) {
    return json(200, { ok: false, error: 'That code is invalid or has already been used.' });
  }
  return json(200, { ok: true });
});

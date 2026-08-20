// Server-side check for "who's the culprit?" - the only place the answer is
// compared, so it never ships in the client bundle (see the security note in
// docs/04-build-spec.md). Verifies the caller's anonymous-auth JWT, looks up
// the culprit id from the protected bigchill_secrets table, records the
// guess, and returns only a correct/incorrect boolean - never the id itself,
// so a wrong guess can't be diffed against a right one to leak it.
//
// Deploy: supabase functions deploy bigchill-make-accusation --project-ref dwvsniafixisrfrszjjr
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

  const suspectId = typeof payload.suspect_id === 'string' ? payload.suspect_id.trim() : '';
  if (!suspectId) return json(400, { error: 'suspect_id is required' });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json(401, { error: 'Missing Authorization header' });

  // Verify the caller as a real (anonymous) auth user, using their own JWT -
  // this is what user_id on the recorded row will trace back to.
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json(401, { error: 'Not signed in' });

  // The service role bypasses RLS - this is the only code path allowed to
  // read bigchill_secrets or write bigchill_accusations.
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: secret, error: secretError } = await admin
    .from('bigchill_secrets')
    .select('value')
    .eq('key', 'culprit_id')
    .single();
  if (secretError || !secret) {
    console.error('bigchill-make-accusation: culprit secret lookup failed', secretError);
    return json(500, { error: 'Culprit id is not configured' });
  }

  const correct = secret.value === suspectId;

  const { error: insertError } = await admin.from('bigchill_accusations').insert({
    user_id: user.id,
    suspect_id: suspectId,
    correct,
  });
  if (insertError) {
    console.error('bigchill-make-accusation: accusation insert failed', insertError);
    return json(500, { error: 'Could not record accusation' });
  }

  return json(200, { correct });
});

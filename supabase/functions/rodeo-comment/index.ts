// Public comment intake for The Rodeo. Verifies the caller's Cloudflare
// Turnstile token server-side (the secret never reaches the browser), then
// inserts the comment with the service role - this is the ONLY way a comment
// row can be created; rodeo_comments has no insert policy for the anon key,
// so this function is the sole write path regardless of Turnstile.
//
// Deploy: supabase functions deploy rodeo-comment --project-ref <ref>
// Secret: supabase secrets set TURNSTILE_SECRET=... --project-ref <ref>
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_BODY_LEN = 2000;
const MAX_NAME_LEN = 80;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

async function verifyTurnstile(token: string, remoteIp: string | null) {
  const secret = Deno.env.get('TURNSTILE_SECRET');
  if (!secret) throw new Error('Server is missing TURNSTILE_SECRET');
  const form = new FormData();
  form.set('secret', secret);
  form.set('response', token);
  if (remoteIp) form.set('remoteip', remoteIp);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form,
  });
  const result = await res.json();
  return !!result.success;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json(400, { ok: false, error: 'Invalid JSON body' });
  }

  const legId = typeof payload.leg_id === 'string' ? payload.leg_id : '';
  const authorName = typeof payload.author_name === 'string' ? payload.author_name.trim().slice(0, MAX_NAME_LEN) : '';
  const body = typeof payload.body === 'string' ? payload.body.trim().slice(0, MAX_BODY_LEN) : '';
  const turnstileToken = typeof payload.turnstileToken === 'string' ? payload.turnstileToken : '';

  if (!legId || !body || !turnstileToken) {
    return json(400, { ok: false, error: 'leg_id, body and turnstileToken are all required' });
  }

  try {
    const verified = await verifyTurnstile(turnstileToken, req.headers.get('cf-connecting-ip'));
    if (!verified) return json(403, { ok: false, error: 'Turnstile verification failed' });
  } catch (err) {
    return json(500, { ok: false, error: err instanceof Error ? err.message : 'Turnstile check failed' });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { error } = await supabase.from('rodeo_comments').insert({
    leg_id: legId,
    author_name: authorName || null,
    body,
    published: false,
  });
  if (error) return json(500, { ok: false, error: error.message });

  return json(200, { ok: true });
});

import { createClient } from '@supabase/supabase-js';

// A SEPARATE Supabase project from the-rodeo (see docs/04-build-spec.md's
// "self contained" requirement). Vite exposes only VITE_* prefixed vars to
// the browser. The custom storageKey keeps this auth session from colliding
// with any other Supabase client in localStorage.
const url = import.meta.env.VITE_BIGCHILL_SUPABASE_URL;
const anonKey = import.meta.env.VITE_BIGCHILL_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn(
    '[bigchill] Missing VITE_BIGCHILL_SUPABASE_URL / VITE_BIGCHILL_SUPABASE_ANON_KEY. ' +
      'Add them to .env.local (dev) and repo secrets (deploy).'
  );
}

export const bigchill = createClient(url ?? '', anonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: 'bigchill-auth',
  },
});

// Character clips live in a public Storage bucket, not the git repo - swap a
// clip by re-uploading it in the dashboard, no redeploy needed. Upload real
// MP4s here with filenames matching game.config.js's `file` values exactly.
const CLIPS_BUCKET = 'bigchill-clips';

export function clipUrl(filename) {
  return `${url ?? ''}/storage/v1/object/public/${CLIPS_BUCKET}/${filename}`;
}

// There's no login screen - every device is just "a player" via Supabase's
// anonymous auth, reused across the session once signed in. Safe to call
// repeatedly.
async function ensureAnonSession() {
  const { data } = await bigchill.auth.getSession();
  if (data.session) return data.session;
  const { data: signInData, error } = await bigchill.auth.signInAnonymously();
  if (error) throw error;
  return signInData.session;
}

const MAKE_ACCUSATION_FN_URL = `${url ?? ''}/functions/v1/bigchill-make-accusation`;

// The only place a guess is checked against the culprit id - see the
// bigchill-make-accusation edge function and the security note in
// docs/04-build-spec.md. Never trust a client-side comparison for this.
export async function submitAccusation(suspectId) {
  const session = await ensureAnonSession();
  const res = await fetch(MAKE_ACCUSATION_FN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey ?? '',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ suspect_id: suspectId }),
  });
  const result = await res.json();
  if (!res.ok || typeof result.correct !== 'boolean') {
    throw new Error(result.error || 'Could not check that guess. Try again.');
  }
  return result.correct;
}

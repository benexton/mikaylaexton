import { ensureAnonSession } from './bigchillSupabase.js';

// Separate from bigchillSupabase.js's game-facing exports on purpose - this
// is the admin page's one and only network call.
const url = import.meta.env.VITE_BIGCHILL_SUPABASE_URL;
const anonKey = import.meta.env.VITE_BIGCHILL_SUPABASE_ANON_KEY;
const ADMIN_LIST_FN_URL = `${url ?? ''}/functions/v1/bigchill-admin-list`;

// The real gate here is admin_password, checked server-side in
// bigchill-admin-list - ensureAnonSession only exists to satisfy the API
// gateway's JWT requirement, same as every other bigchill-* call.
export async function fetchPasswordList(adminPassword) {
  const session = await ensureAnonSession();
  const res = await fetch(ADMIN_LIST_FN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey ?? '',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ admin_password: adminPassword }),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || 'Could not load the list.');
  return result.passwords;
}

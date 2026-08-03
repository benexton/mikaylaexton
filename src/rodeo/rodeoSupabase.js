import { createClient } from '@supabase/supabase-js';

// A SEPARATE Supabase project from anything else. Vite exposes only VITE_*
// prefixed vars to the browser. The custom storageKey keeps this auth session
// from colliding with any other Supabase client in localStorage.
const url = import.meta.env.VITE_RODEO_SUPABASE_URL;
const anonKey = import.meta.env.VITE_RODEO_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn(
    '[rodeo] Missing VITE_RODEO_SUPABASE_URL / VITE_RODEO_SUPABASE_ANON_KEY. ' +
      'Add them to .env.local (dev) and repo secrets (deploy).'
  );
}

export const rodeo = createClient(url ?? '', anonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'rodeo-auth',
  },
});

export const RODEO_MEDIA_BUCKET = 'rodeo-media';

// Team identity. `side` drives the timeline lane; `color` drives map trail,
// markers, cards and scoreboard.
export const TEAMS = {
  ben:  { key: 'ben',  name: 'Ben & John',   color: '#2f5fa0', side: 'left'  },
  miki: { key: 'miki', name: 'Miki & Bruce', color: '#cf6a34', side: 'right' },
};
export const COLLECTIVE_COLOR = '#c9a227'; // gold, for together legs

export function teamOf(session) {
  return session?.user?.user_metadata?.team ?? null;
}

// Upload one photo to the rodeo bucket and return its public URL.
export async function uploadRodeoPhoto(file, prefix = '') {
  const safe = file.name.replace(/[^\w.-]/g, '_');
  const path = `${prefix}${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${safe}`;
  const up = await rodeo.storage.from(RODEO_MEDIA_BUCKET).upload(path, file, { upsert: false });
  if (up.error) throw up.error;
  return rodeo.storage.from(RODEO_MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}

// Public snapshot URL (written by the export_rodeo Action).
export const RODEO_SNAPSHOT_URL =
  `${url ?? ''}/storage/v1/object/public/rodeo-media/public/the-rodeo-public.json`;

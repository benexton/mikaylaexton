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

// Edge Functions require an auth header by default (Supabase's gateway, not
// our own code) - the anon key satisfies that. It's already public (shipped
// in this same bundle for every other Supabase call), so no new exposure.
export const RODEO_ANON_KEY = anonKey ?? '';

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

// Phone photos come off the camera at 3-8 MB, which is slow to upload on
// roaming data and slow to view. Re-encode anything big to a JPEG no larger
// than MAX_EDGE px on its long side. Re-encoding also drops EXIF, so the
// camera's GPS tag doesn't ship with every photo.
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;
const RESIZE_OVER_BYTES = 400 * 1024;

async function shrinkPhoto(file) {
  // GIFs would lose their animation; anything the browser can't decode
  // (e.g. HEIC outside Safari) falls through to the original file below.
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file;
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= RESIZE_OVER_BYTES) { bitmap.close?.(); return file; }

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // transparent PNGs would otherwise turn black as JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
  if (!blob || blob.size >= file.size) return file;
  const name = file.name.replace(/\.[^.]*$/, '') + '.jpg';
  return new File([blob], name, { type: 'image/jpeg' });
}

// Upload one photo to the rodeo bucket and return its public URL.
export async function uploadRodeoPhoto(original, prefix = '') {
  const file = await shrinkPhoto(original);
  const safe = file.name.replace(/[^\w.-]/g, '_');
  const path = `${prefix}${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${safe}`;
  const up = await rodeo.storage.from(RODEO_MEDIA_BUCKET).upload(path, file, {
    upsert: false, contentType: file.type || undefined,
  });
  if (up.error) throw up.error;
  return rodeo.storage.from(RODEO_MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}

// Delete bucket objects for photos that are no longer referenced. Takes
// photo objects ({ url }) and ignores any URL that isn't in our bucket.
// Best-effort: a leftover file only costs storage, so failures are logged,
// never surfaced.
export async function removeRodeoPhotos(photos) {
  const marker = `/storage/v1/object/public/${RODEO_MEDIA_BUCKET}/`;
  const paths = (photos ?? [])
    .map((p) => p?.url ?? '')
    .filter((u) => u.includes(marker))
    .map((u) => decodeURIComponent(u.slice(u.indexOf(marker) + marker.length).split('?')[0]));
  if (!paths.length) return;
  const { error } = await rodeo.storage.from(RODEO_MEDIA_BUCKET).remove(paths);
  if (error) console.warn('[rodeo] Could not remove old photos', error);
}

// Photos in `before` whose URL isn't in `after`.
export function droppedPhotos(before, after) {
  const keep = new Set((after ?? []).map((p) => p.url));
  return (before ?? []).filter((p) => !keep.has(p.url));
}

// Public snapshot URL (written by the rodeo-publish edge function).
export const RODEO_SNAPSHOT_URL =
  `${url ?? ''}/storage/v1/object/public/rodeo-media/public/the-rodeo-public.json`;

// Public comment intake: verifies Turnstile server-side, then writes with the
// service role - see supabase/functions/rodeo-comment. The site key is safe
// to ship to the browser (only the secret, held by the edge function, isn't).
export const RODEO_COMMENT_FN_URL = `${url ?? ''}/functions/v1/rodeo-comment`;
export const RODEO_TURNSTILE_SITE_KEY = import.meta.env.VITE_RODEO_TURNSTILE_SITE_KEY ?? '';

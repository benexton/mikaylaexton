// Scoped to /the-big-chill/ by virtue of living at this path - a service
// worker's max scope is its own directory, so this can never intercept
// requests for the main site or the-rodeo pages even by accident.
//
// Only caches character clips. Full offline app-shell support isn't
// required (see docs/04-build-spec.md) - the goal is just "a hotspot blip
// mid-video doesn't interrupt playback", which a cache-first strategy for
// the clips bucket covers. Clips are cross-origin (Supabase Storage), so
// this is plain-string, not import.meta.env - a service worker file under
// public/ isn't run through Vite's env substitution.
const CACHE_NAME = 'the-big-chill-clips-v2';
const CLIPS_ORIGIN = 'https://dwvsniafixisrfrszjjr.supabase.co';
const CLIPS_PATH_PREFIX = '/storage/v1/object/public/bigchill-clips/';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME && n.startsWith('the-big-chill-')).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== CLIPS_ORIGIN || !url.pathname.startsWith(CLIPS_PATH_PREFIX)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response.ok) cache.put(event.request, response.clone());
      return response;
    })
  );
});

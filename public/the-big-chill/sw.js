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
const CACHE_NAME = 'the-big-chill-clips-v4';
const CLIPS_ORIGIN = 'https://dwvsniafixisrfrszjjr.supabase.co';
const CLIPS_PATH_PREFIX = '/storage/v1/object/public/bigchill-clips/';

self.addEventListener('install', () => {
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
      // Ignore the Range header when matching: the preload stores whole 200
      // responses, but <video> asks for byte ranges.
      const cached = await cache.match(event.request.url);
      if (cached) {
        const range = event.request.headers.get('range');
        return range ? rangeResponse(cached, range) : cached;
      }
      const response = await fetch(event.request);
      // A 206 can't be cache.put(), and only whole files are worth keeping.
      if (response.status === 200) cache.put(event.request.url, response.clone());
      return response;
    })
  );
});

// iOS/iPadOS Safari refuses to play video from a service worker that answers
// a Range request with a plain 200 - it needs a 206 with Content-Range.
async function rangeResponse(cached, rangeHeader) {
  const buf = await cached.arrayBuffer();
  const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
  if (!match) return cached;
  const size = buf.byteLength;
  let start = match[1] ? parseInt(match[1], 10) : 0;
  let end = match[2] ? parseInt(match[2], 10) : size - 1;
  if (!match[1] && match[2]) {
    start = Math.max(0, size - parseInt(match[2], 10));
    end = size - 1;
  }
  end = Math.min(end, size - 1);
  if (start > end) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': cached.headers.get('Content-Type') || 'video/mp4',
      'Content-Length': String(end - start + 1),
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Accept-Ranges': 'bytes',
    },
  });
}

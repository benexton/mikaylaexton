import { GAME_CONFIG } from './game.config.js';
import { clipUrl } from './lib/bigchillSupabase.js';

const CACHE_NAME = 'the-big-chill-clips-v2'; // keep in sync with public/the-big-chill/sw.js

export function getAllClipUrls() {
  const files = new Set();
  Object.values(GAME_CONFIG.narratorClips).forEach((clip) => clip?.file && files.add(clip.file));
  GAME_CONFIG.suspects.forEach((suspect) => {
    if (suspect.introClip?.file) files.add(suspect.introClip.file);
    suspect.questions.forEach((q) => q.answerClip?.file && files.add(q.answerClip.file));
  });
  return [...files].map(clipUrl);
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/the-big-chill/sw.js', { scope: '/the-big-chill/' }).catch(() => {});
}

// Best-effort: clips that don't exist yet (or fail to fetch) are skipped
// and never block progress - matches VideoCharacter's graceful placeholder
// fallback for those same not-recorded-yet clips.
export async function preloadClips(onProgress) {
  const urls = getAllClipUrls();
  if (!('caches' in window) || urls.length === 0) {
    onProgress?.(urls.length, urls.length);
    return;
  }
  const cache = await caches.open(CACHE_NAME);
  let done = 0;
  await Promise.all(
    urls.map(async (url) => {
      try {
        const existing = await cache.match(url);
        if (!existing) {
          const response = await fetch(url);
          if (response.ok) await cache.put(url, response);
        }
      } catch {
        // no clip recorded yet, or offline right now - fine, skip it
      } finally {
        done += 1;
        onProgress?.(done, urls.length);
      }
    })
  );
}

// Best-effort - keeps the iPad screen awake through a 60-90 minute session.
export async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return null;
  try {
    return await navigator.wakeLock.request('screen');
  } catch {
    return null;
  }
}

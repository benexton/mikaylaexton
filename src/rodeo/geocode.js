// Town/city + country -> approximate lat/lng, via OpenStreetMap's free
// Nominatim search (no key needed, matches the OSM tiles the map already
// uses). Meant for one lookup per filed update/waypoint, not autocomplete -
// callers should debounce and only call on blur/settle, not per keystroke.
const cache = new Map(); // "city, country" (lowercased) -> result

export async function geocodePlace(city, country) {
  const q = [city, country].map((s) => (s || '').trim()).filter(Boolean).join(', ');
  if (!q) return null;
  const key = q.toLowerCase();
  if (cache.has(key)) return cache.get(key);

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Location lookup failed (${res.status})`);
  const results = await res.json();
  const result = results.length
    ? { lat: +results[0].lat, lng: +results[0].lon, displayName: results[0].display_name }
    : null;
  cache.set(key, result);
  return result;
}

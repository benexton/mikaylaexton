// Live currency conversion to NZD so every leg's spend is comparable for
// scoring, regardless of what currency it was actually paid in.
// Uses open.er-api.com: free, no key, broad currency coverage (incl. MAD/TRY
// etc, unlike ECB-only sources).
const RATE_TTL_MS = 60 * 60 * 1000; // rates don't move fast enough to refetch every keystroke
const cache = new Map(); // currency code -> { rate, at }

export async function nzdRate(currency) {
  const code = (currency || '').trim().toUpperCase();
  if (!code) return null;
  if (code === 'NZD') return 1;
  const hit = cache.get(code);
  if (hit && Date.now() - hit.at < RATE_TTL_MS) return hit.rate;

  const res = await fetch(`https://open.er-api.com/v6/latest/${code}`);
  if (!res.ok) throw new Error(`Exchange rate lookup failed (${res.status})`);
  const json = await res.json();
  const rate = json?.rates?.NZD;
  if (typeof rate !== 'number') throw new Error(`No NZD rate found for ${code}`);
  cache.set(code, { rate, at: Date.now() });
  return rate;
}

// amountMajor is a plain decimal (e.g. "45.00"), not minor units.
export async function toNzdMinor(amountMajor, currency) {
  if (amountMajor === '' || amountMajor == null || Number.isNaN(+amountMajor)) return null;
  const rate = await nzdRate(currency);
  if (rate == null) return null;
  return Math.round(+amountMajor * rate * 100);
}

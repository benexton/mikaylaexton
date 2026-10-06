// Spend is converted to NZD so every leg is comparable for scoring, whatever
// currency it was paid in. Rates are LOCKED (open.er-api.com, as published
// 6 Oct 2026) rather than fetched live, so a leg's NZD figure never depends on
// which day it was filed or re-saved, and filing works with no signal.
// perNzd = units of that currency per NZ$1.
export const RATES_LOCKED_ON = '6 Oct 2026';

export const CURRENCIES = [
  { code: 'EUR', symbol: '€',   name: 'Euro (Spain, France, Italy, Austria, Slovenia, Croatia, Greece, Bulgaria, Montenegro, Kosovo...)', perNzd: 0.499138 },
  { code: 'MAD', symbol: 'DH',  name: 'Moroccan dirham',         perNzd: 5.582423 },
  { code: 'GBP', symbol: '£',   name: 'Pound (GBP / Gibraltar)', perNzd: 0.423418 },
  { code: 'BAM', symbol: 'KM',  name: 'Bosnian convertible mark', perNzd: 0.976207 },
  { code: 'RSD', symbol: 'din', name: 'Serbian dinar',           perNzd: 58.609153 },
  { code: 'HUF', symbol: 'Ft',  name: 'Hungarian forint',        perNzd: 183.483271 },
  { code: 'RON', symbol: 'lei', name: 'Romanian leu',            perNzd: 2.664326 },
  { code: 'ALL', symbol: 'L',   name: 'Albanian lek',            perNzd: 45.898567 },
  { code: 'MKD', symbol: 'den', name: 'Macedonian denar',        perNzd: 30.385799 },
  { code: 'TRY', symbol: '₺',   name: 'Turkish lira',            perNzd: 27.504545 },
  { code: 'USD', symbol: 'US$', name: 'US dollar',               perNzd: 0.559798 },
  { code: 'NZD', symbol: 'NZ$', name: 'NZ dollar',               perNzd: 1 },
];

const BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

export function currencyInfo(code) {
  return BY_CODE.get((code || '').trim().toUpperCase()) ?? null;
}

// NZ$ per one unit of `code`, or null if it isn't one of ours.
export function nzdRate(code) {
  const c = currencyInfo(code);
  return c ? 1 / c.perNzd : null;
}

// amountMajor is a plain decimal (e.g. "45.00"), not minor units.
export function toNzdMinor(amountMajor, code) {
  if (amountMajor === '' || amountMajor == null || Number.isNaN(+amountMajor)) return null;
  const c = currencyInfo(code);
  if (!c) return null;
  return Math.round((+amountMajor / c.perNzd) * 100);
}

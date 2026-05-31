export const BASE_URL = process.env.LOAD_BASE_URL || 'http://localhost:3000';

/** Browser-like headers — Vercel Hobby challenge часто блокує node fetch без UA */
export const DEFAULT_HEADERS = {
  'User-Agent':
    process.env.LOAD_USER_AGENT ||
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'uk-UA,uk;q=0.9,en;q=0.8',
};

export function mergeHeaders(extra = {}) {
  return { ...DEFAULT_HEADERS, ...extra };
}

export async function loadFetch(path, options = {}) {
  const res = await fetch(url(path), {
    ...options,
    headers: mergeHeaders(options.headers),
  });
  return res;
}

export const DEFAULTS = {
  durationSec: Number(process.env.LOAD_DURATION_SEC || 20),
  connections: Number(process.env.LOAD_CONNECTIONS || 25),
  pipelining: Number(process.env.LOAD_PIPELINING || 1),
};

export function url(path) {
  return `${BASE_URL}${path}`;
}


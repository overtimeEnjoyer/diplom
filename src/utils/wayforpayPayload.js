function tryJson(s) {
  try {
    const p = JSON.parse(s);
    return p?.orderReference ? p : null;
  } catch {
    return null;
  }
}

export function parseWayForPayFromRaw(raw) {
  const t = raw.trim();
  if (!t) return null;
  let p = tryJson(t);
  if (p) return p;

  const firstBrace = t.indexOf('{');
  if (firstBrace >= 0) {
    let depth = 0;
    for (let i = firstBrace; i < t.length; i++) {
      if (t[i] === '{') depth++;
      else if (t[i] === '}') {
        depth--;
        if (depth === 0) {
          p = tryJson(t.slice(firstBrace, i + 1));
          if (p) return p;
          break;
        }
      }
    }
  }

  const eq = t.indexOf('=');
  if (eq > 0) {
    const keyPart = t.slice(0, eq);
    for (const cand of [keyPart, decodeURIComponent(keyPart.replace(/\+/g, ' '))]) {
      p = tryJson(cand);
      if (p) return p;
    }
  }
  return null;
}

function parseFormEncodedString(raw) {
  const out = {};
  const params = new URLSearchParams(raw);
  for (const [k, v] of params.entries()) out[k] = v;
  return out;
}

export function normalizeCallbackPayload(input) {
  if (!input) return {};
  if (typeof input === 'string') {
    const s = input.trim();
    if (!s) return {};
    return tryJson(s) || parseFormEncodedString(s);
  }
  if (typeof input !== 'object') return {};
  const body = input;
  if (body.orderReference) return body;

  for (const key of Object.keys(body)) {
    const fromKey = tryJson(key);
    if (fromKey) return fromKey;
    const value = body[key];
    if (typeof value === 'string') {
      const fromValue = tryJson(value);
      if (fromValue) return fromValue;
    }
  }
  return body;
}

export function mergeCallbackPayload(req) {
  const fromRaw = req.wayforpayRawBody ? parseWayForPayFromRaw(req.wayforpayRawBody) : null;
  const fromBody = normalizeCallbackPayload(req.body);
  return { ...fromBody, ...(fromRaw || {}) };
}

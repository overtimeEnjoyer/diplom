/** Copy only defined keys from data — keeps PATCH/update payloads explicit. */
export function pickDefined(data, keys) {
  const out = {};
  for (const key of keys) {
    if (data[key] !== undefined) out[key] = data[key];
  }
  return out;
}

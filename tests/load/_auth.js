import { url, mergeHeaders } from './_config.js';

async function postJson(path, body) {
  const res = await fetch(url(path), {
    method: 'POST',
    headers: mergeHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }
  if (!res.ok) {
    const msg = data?.error?.message || data?.message || `${res.status} ${res.statusText}`;
    throw new Error(`Auth request failed: ${msg}`);
  }
  return data;
}

export async function loginTestUser() {
  const password = process.env.LOAD_USER_PASSWORD || 'password123';
  const baseEmail = process.env.LOAD_USER_EMAIL || 'loadtest@example.com';
  const identifier = baseEmail;

  try {
    const data = await postJson('/api/auth/local', { identifier, password });
    if (!data?.jwt) throw new Error('Login response missing jwt');
    return data.jwt;
  } catch {
    // If user doesn't exist in the target DB, register a dedicated load user.
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
    const email = baseEmail.includes('@') ? baseEmail.replace('@', `+${unique}@`) : `${unique}@example.com`;
    const username = `load_${unique}`.slice(0, 20);
    await postJson('/api/auth/register', { email, username, password });
    const data = await postJson('/api/auth/local', { identifier: email, password });
    if (!data?.jwt) throw new Error('Login response missing jwt');
    return data.jwt;
  }
}


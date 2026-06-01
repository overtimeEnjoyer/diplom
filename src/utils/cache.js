import { env } from '../config/env.js';

const memoryStore = new Map();
let redisClient = null;
let redisUnavailable = false;

async function getRedis() {
  if (redisUnavailable || !env.redisUrl) return null;
  if (redisClient?.isOpen) return redisClient;

  try {
    const { createClient } = await import('redis');
    const client = createClient({ url: env.redisUrl });
    client.on('error', (err) => {
      console.warn('[cache] Redis error:', err.message);
    });
    await client.connect();
    redisClient = client;
    return client;
  } catch (err) {
    redisUnavailable = true;
    console.warn('[cache] Redis unavailable, using in-memory cache:', err.message);
    return null;
  }
}

function memoryGet(key) {
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memoryStore.delete(key);
    return null;
  }
  return entry.value;
}

function memorySet(key, value, ttlMs) {
  memoryStore.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function cacheKey(prefix, payload) {
  return `${prefix}:${JSON.stringify(payload)}`;
}

/** Catalog cache: Redis when REDIS_URL is set, else per-instance memory (thesis Edge/Redis). */
export async function cacheGet(key) {
  const redis = await getRedis();
  if (redis) {
    try {
      const raw = await redis.get(`rok:${key}`);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return memoryGet(key);
    }
  }
  return memoryGet(key);
}

export async function cacheSet(key, value, ttlMs) {
  const redis = await getRedis();
  const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));

  if (redis) {
    try {
      await redis.setEx(`rok:${key}`, ttlSec, JSON.stringify(value));
      return;
    } catch {
      memorySet(key, value, ttlMs);
      return;
    }
  }
  memorySet(key, value, ttlMs);
}

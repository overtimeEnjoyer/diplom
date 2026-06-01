import { env } from '../config/env.js';

/**
 * fetch with AbortController timeout (thesis §3.4 graceful degradation for external APIs).
 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = env.externalFetchTimeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Runs fn; on failure logs and returns fallback (core API keeps working).
 */
export async function withGracefulFallback(label, fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    console.warn(`[${label}] degraded:`, err.message);
    return fallback;
  }
}

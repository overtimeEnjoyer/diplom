/**
 * Заповнення метрик Vercel Observability штучним навантаженням.
 *
 * Usage (Preview/Production URL):
 *   LOAD_BASE_URL=https://your-app.vercel.app \
 *   ENABLE_LOAD_TEST_ROUTES=true \   # на Vercel Preview — для Errors + CPU/memory probes
 *   pnpm load:vercel-metrics
 *
 * Cold starts (опційно — пауза перед burst, щоб instances заснули):
 *   LOAD_IDLE_SEC=600 pnpm load:vercel-metrics
 *
 * Hobby/Free Vercel (без Security settings — уникнути 403 challenge):
 *   LOAD_GENTLE=true pnpm load:vercel-metrics
 *   або інша мережа (mobile hotspot) після 30–60 хв паузи
 *
 * Metrics filled:
 *   - Function Invocations, Duration, Response Time — read/write mix + burst
 *   - Active CPU — auth/login (bcrypt) + /load-test/cpu
 *   - Memory — burst + /load-test/memory
 *   - Errors — /load-test/simulate-error (потрібен ENABLE_LOAD_TEST_ROUTES на сервері)
 *   - Cold Starts — LOAD_IDLE_SEC + одиночні запити + burst з високим connections
 */
import { BASE_URL, url, loadFetch } from './_config.js';
import { loginTestUser } from './_auth.js';
import { runScenario } from './_runner.js';

const gentle = process.env.LOAD_GENTLE === 'true';

const duration = Number(
  process.env.LOAD_DURATION_SEC || (gentle ? 600 : 180),
);
const connections = Number(
  process.env.LOAD_CONNECTIONS || (gentle ? 8 : 50),
);
const burstConnections = Number(
  process.env.LOAD_BURST_CONNECTIONS || (gentle ? 10 : 100),
);
const maxRate = Number(
  process.env.LOAD_MAX_RATE || (gentle ? 15 : 0),
);
const idleSec = Number(process.env.LOAD_IDLE_SEC || 0);
const pauseMs = Number(process.env.LOAD_PAUSE_MS || (gentle ? 3000 : 0));
const includeErrors = process.env.LOAD_INCLUDE_ERRORS !== 'false';

function scenarioOpts(extra = {}) {
  const opts = { ...extra };
  if (maxRate > 0) opts.overallRate = maxRate;
  return opts;
}

async function pauseBetweenPhases() {
  if (pauseMs <= 0) return;
  await new Promise((r) => setTimeout(r, pauseMs));
}

function phaseDuration(ratio, minSec = 5) {
  return Math.max(minSec, Math.round(duration * ratio));
}

async function sleep(sec) {
  if (sec <= 0) return;
  console.log(`\n⏳ Idle ${sec}s (cold start window)…`);
  await new Promise((r) => setTimeout(r, sec * 1000));
}

const PLACEHOLDER_HOSTS = /your-app|твій-проєкт|example\.com|placeholder/i;

function assertValidTarget() {
  if (!process.env.LOAD_BASE_URL) {
    console.error('❌ LOAD_BASE_URL не задано.');
    console.error('   LOAD_BASE_URL=https://rok-m-backend.vercel.app pnpm load:vercel-metrics');
    process.exit(1);
  }
  if (PLACEHOLDER_HOSTS.test(BASE_URL)) {
    console.error(`❌ LOAD_BASE_URL виглядає як placeholder: ${BASE_URL}`);
    console.error('   Підстав реальний URL з Vercel → Project → Domains');
    process.exit(1);
  }
}

async function assertTargetReachable() {
  const healthUrl = url('/health');
  let res;
  try {
    res = await loadFetch('/health');
  } catch (err) {
    console.error(`❌ Не вдалось підключитись до ${healthUrl}: ${err.message}`);
    process.exit(1);
  }
  if (res.status === 404) {
    console.error(`❌ ${healthUrl} → 404`);
    console.error('   Перевір URL (без /api в кінці). Має бути: https://назва-проєкту.vercel.app');
    process.exit(1);
  }
  if (res.status === 403) {
    const mitigated = res.headers.get('x-vercel-mitigated');
    console.error(`❌ ${healthUrl} → HTTP 403`);
    if (mitigated === 'challenge') {
      console.error('   Vercel Attack Challenge Mode — IP тимчасово заблоковано після load test.');
      console.error('   1) Відкрий https://rok-m-backend.vercel.app/health у браузері (пройди challenge)');
      console.error('   2) Зачекай 15–30 хв');
      console.error('   3) Vercel → Security → зменши Attack Challenge Mode (лише Pro+)');
      console.error('   4) Інша мережа: mobile hotspot / VPN → новий IP');
      console.error('   5) Мʼякий режим: LOAD_GENTLE=true (≤15 req/s, без burst)');
    } else {
      console.error('   Перевір Vercel Firewall / Security settings.');
    }
    process.exit(1);
  }
  if (!res.ok) {
    console.error(`❌ ${healthUrl} → HTTP ${res.status}`);
    console.error('   Перевір деплой на Vercel (Logs) і DATABASE_URL.');
    process.exit(1);
  }
  console.log(`✓ ${healthUrl} → OK`);
}

async function assertApiReady() {
  let res;
  try {
    res = await loadFetch('/api/pricing');
  } catch (err) {
    console.error(`❌ /api/pricing недоступний: ${err.message}`);
    process.exit(1);
  }

  if (res.status >= 500) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body.message || body.error?.message || '';
    } catch {
      /* ignore */
    }
    let dbHint = '';
    try {
      const dbRes = await loadFetch('/health/db');
      const dbBody = await dbRes.json();
      if (dbBody.message) dbHint = `\n   /health/db: ${dbBody.message}`;
    } catch {
      /* ignore */
    }
    console.error(`❌ /api/pricing → HTTP ${res.status}${detail ? `: ${detail}` : ''}${dbHint}`);
    console.error('');
    console.error('   API на Vercel не працює. Load test дасть лише 500 → Errors, без latency-графіків.');
    console.error('   1) git push + redeploy (fix pg у api/index.js + .npmrc)');
    console.error('   2) Vercel env: DATABASE_URL (Neon pooler), JWT_SECRET');
    console.error('   3) pnpm db:migrate на prod БД');
    console.error('   4) Перевір: curl https://rok-m-backend.vercel.app/api/pricing → 200');
    console.error('');
    console.error('   Продовжити все одно: LOAD_FORCE=true pnpm load:vercel-metrics');
    if (process.env.LOAD_FORCE !== 'true') process.exit(1);
  }
  console.log('✓ /api/pricing → OK');
}

async function probeLatency(label, path, headers = {}) {
  const start = Date.now();
  try {
    const res = await loadFetch(path, { headers });
    const ms = Date.now() - start;
    console.log(`  ${label}: HTTP ${res.status} — ${ms}ms`);
    return { status: res.status, ms };
  } catch (err) {
    console.log(`  ${label}: FAILED — ${err.message}`);
    return null;
  }
}

async function runPhase(title, config) {
  await runScenario(title, scenarioOpts(config));
  await pauseBetweenPhases();
}

async function coldStartProbes() {
  console.log('\n=== Cold start / latency probes (single requests) ===');
  await probeLatency('GET /health (no DB)', '/health');
  await probeLatency('GET /api/pricing (DB init)', '/api/pricing');
  await probeLatency('GET /api/method-sections', '/api/method-sections');
}

async function runErrorScenarios() {
  if (!includeErrors) return;

  console.log('\n=== Errors & 4xx (стабільність) ===');

  await runScenario('404: GET /api/endpoint-not-found', {
    url: url('/api/endpoint-not-found'),
    duration: phaseDuration(0.05, 8),
    connections: 10,
  });

  await runScenario('401: GET /api/auth/me (no JWT)', {
    url: url('/api/auth/me'),
    duration: phaseDuration(0.05, 8),
    connections: 10,
  });

  const errProbe = await probeLatency('GET /load-test/simulate-error (500)', '/load-test/simulate-error');
  if (!errProbe || errProbe.status === 404) {
    console.log(
      '  ⚠ Для графіка Errors у Vercel: ENABLE_LOAD_TEST_ROUTES=true на deployment + redeploy',
    );
  }

  await runScenario('500: GET /load-test/simulate-error', {
    url: url('/load-test/simulate-error'),
    duration: phaseDuration(0.04, 6),
    connections: 5,
  });
}

async function runCpuMemoryProbes() {
  console.log('\n=== CPU & Memory probes ===');

  await runScenario('CPU: GET /load-test/cpu', {
    url: url('/load-test/cpu'),
    duration: phaseDuration(0.08, 10),
    connections: Math.min(connections, 30),
  });

  await runScenario('Memory: GET /load-test/memory', {
    url: url('/load-test/memory'),
    duration: phaseDuration(0.06, 8),
    connections: burstConnections,
  });
}

export async function main() {
  assertValidTarget();

  console.log('Vercel metrics fill');
  console.log(`Target: ${BASE_URL}`);
  if (gentle) {
    console.log('Mode: GENTLE (Hobby/Free — ≤15 req/s, без агресивного burst)');
  }
  console.log(
    `Plan: ~${duration}s total, connections=${connections}, burst=${burstConnections}, idle=${idleSec}s` +
      (maxRate > 0 ? `, maxRate=${maxRate}/s` : ''),
  );

  await assertTargetReachable();
  await assertApiReady();

  await coldStartProbes();
  await sleep(idleSec);
  await coldStartProbes();

  console.log('\n=== Phase 1: Invocations + Duration (read-heavy) ===');
  await runPhase('GET /api/method-sections', {
    url: url('/api/method-sections?pageSize=25'),
    duration: phaseDuration(0.25),
    connections,
  });

  await runPhase('GET /api/methods (filter)', {
    url: url('/api/methods?filters[slug][$contains]=a'),
    duration: phaseDuration(0.15),
    connections,
  });

  await runPhase('GET /api/pricing', {
    url: url('/api/pricing'),
    duration: phaseDuration(0.1),
    connections: Math.min(connections, 30),
  });

  console.log('\n=== Phase 2: Active CPU (auth / bcrypt) ===');
  await runPhase('POST /api/auth/local', {
    url: url('/api/auth/local'),
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: process.env.LOAD_USER_EMAIL || 'test@example.com',
      password: process.env.LOAD_USER_PASSWORD || 'password123',
    }),
    duration: phaseDuration(0.12),
    connections: Math.min(connections, 25),
  });

  console.log('\n=== Phase 3: Writes (Duration + DB) ===');
  let jwt;
  try {
    jwt = await loginTestUser();
  } catch (err) {
    console.warn(`Auth for write phase skipped: ${err.message}`);
  }

  if (jwt) {
    const methodId = Number(process.env.LOAD_METHOD_ID || 1);
    await runPhase('POST /api/progress/.../view', {
      url: url(`/api/progress/methods/${methodId}/view`),
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
      duration: phaseDuration(0.08),
      connections: Math.min(connections, 20),
    });

    await runPhase('GET /api/auth/me', {
      url: url('/api/auth/me'),
      method: 'GET',
      headers: { Authorization: `Bearer ${jwt}` },
      duration: phaseDuration(0.06),
      connections: Math.min(connections, 20),
    });
  }

  if (!gentle) {
    console.log('\n=== Phase 4: Burst (autoscale + cold instances) ===');
    await runPhase('BURST GET /api/method-sections', {
      url: url('/api/method-sections'),
      duration: phaseDuration(0.12, 15),
      connections: burstConnections,
    });
  }

  await runCpuMemoryProbes();
  await runErrorScenarios();

  console.log('\n=== Done ===');
  console.log('Vercel → Project → Observability / Analytics (може оновлюватись 1–5 хв)');
  console.log('Для cold starts: повтори з LOAD_IDLE_SEC=600 (10 хв пауза)');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}

import { url } from './_config.js';
import { loginTestUser } from './_auth.js';
import { runScenario } from './_runner.js';

/**
 * Peak academic load (read-heavy) approximation.
 *
 * Instead of probabilistic per-request mixing (autocannon API differences),
 * we run a sequence of short sub-scenarios with durations proportional to 95/5 mix.
 *
 * Total duration is LOAD_DURATION_SEC (default 30):
 * - 55% method-sections (reads)
 * - 30% methods filtering (reads)
 * - 10% pricing (reads)
 * - 5% progress view (writes)
 */
export async function main() {
  const jwt = await loginTestUser();
  const methodId = Number(process.env.LOAD_METHOD_ID || 1);

  const total = Number(process.env.LOAD_DURATION_SEC || 30);
  const dSections = Math.max(1, Math.round(total * 0.55));
  const dMethods = Math.max(1, Math.round(total * 0.3));
  const dPricing = Math.max(1, Math.round(total * 0.1));
  const dProgress = Math.max(1, total - dSections - dMethods - dPricing);

  await runScenario('peak: GET /api/method-sections', {
    url: url('/api/method-sections'),
    duration: dSections,
  });

  await runScenario('peak: GET /api/methods?filters[slug][$contains]=test', {
    url: url('/api/methods?filters[slug][$contains]=test'),
    duration: dMethods,
  });

  await runScenario('peak: GET /api/pricing', {
    url: url('/api/pricing'),
    duration: dPricing,
  });

  await runScenario('peak: POST /api/progress/methods/:id/view', {
    url: url(`/api/progress/methods/${methodId}/view`),
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
    duration: dProgress,
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}


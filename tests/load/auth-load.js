import { url } from './_config.js';
import { runScenario } from './_runner.js';

/**
 * Auth load: login endpoint (CPU-light, DB-heavy due to user lookup + bcrypt compare).
 *
 * Requires seeded user:
 *   test@example.com / password123
 */
export async function main() {
  await runScenario('auth: POST /api/auth/local', {
    url: url('/api/auth/local'),
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: process.env.LOAD_USER_EMAIL || 'test@example.com',
      password: process.env.LOAD_USER_PASSWORD || 'password123',
    }),
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}


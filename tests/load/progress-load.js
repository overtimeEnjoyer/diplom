import { url } from './_config.js';
import { loginTestUser } from './_auth.js';
import { runScenario } from './_runner.js';

export async function main() {
  const jwt = await loginTestUser();
  const methodId = Number(process.env.LOAD_METHOD_ID || 1);

  await runScenario('progress: POST /api/progress/methods/:id/view', {
    url: url(`/api/progress/methods/${methodId}/view`),
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}


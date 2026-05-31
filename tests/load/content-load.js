import { url } from './_config.js';
import { runScenario } from './_runner.js';

export async function main() {
  await runScenario('content: GET /api/method-sections', {
    url: url('/api/method-sections?pageSize=25'),
  });

  await runScenario('content: GET /api/methods (filter slug eq)', {
    url: url('/api/methods?filters[slug][$contains]=test'),
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}


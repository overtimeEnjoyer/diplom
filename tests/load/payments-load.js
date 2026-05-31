import { url } from './_config.js';
import { loginTestUser } from './_auth.js';
import { runScenario } from './_runner.js';

async function startPayment(jwt) {
  const res = await fetch(url('/api/tariffs/medium/activate'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Start payment failed: ${res.status}`);
  return data.payment?.orderReference || data.orderReference;
}

export async function main() {
  const jwt = await loginTestUser();
  const orderReference = await startPayment(jwt);

  await runScenario('payments: POST /api/payments/confirm (mock)', {
    url: url('/api/payments/confirm'),
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderReference }),
  });

  await runScenario('payments: GET /api/payments/status', {
    url: url(`/api/payments/status?orderReference=${encodeURIComponent(orderReference)}`),
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}


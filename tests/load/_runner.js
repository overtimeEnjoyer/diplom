import autocannon from 'autocannon';
import { DEFAULTS, mergeHeaders } from './_config.js';

function ms(n) {
  if (!Number.isFinite(n)) return '-';
  return `${Math.round(n)}ms`;
}

function printSummary(title, result) {
  const latency = result.latency || {};
  const requests = result.requests || {};
  console.log(`\n=== ${title} ===`);
  console.log(`connections=${result.connections} duration=${result.duration}s pipelining=${result.pipelining}`);
  console.log(`req/s avg=${requests.average?.toFixed?.(1) ?? requests.average}`);
  console.log(
    `latency avg=${ms(latency.average)} p50=${ms(latency.p50)} p95=${ms(latency.p95)} p99=${ms(latency.p99)}`,
  );
  if (result.errors || result.timeouts) {
    console.log(`errors=${result.errors} timeouts=${result.timeouts} non2xx=${result.non2xx}`);
  }
}

export async function runScenario(title, config) {
  const duration = config.duration ?? DEFAULTS.durationSec;
  const connections = config.connections ?? DEFAULTS.connections;
  const pipelining = config.pipelining ?? DEFAULTS.pipelining;
  const overallRate =
    config.overallRate ??
    (process.env.LOAD_MAX_RATE ? Number(process.env.LOAD_MAX_RATE) : undefined);

  const opts = {
    url: config.url,
    method: config.method || 'GET',
    body: config.body,
    headers: mergeHeaders(config.headers),
    duration,
    connections,
    pipelining,
  };
  if (overallRate) opts.overallRate = overallRate;

  const res = await autocannon(opts);

  if (process.env.LOAD_DUMP_JSON === 'true') {
    const path = new URL('./.last-result.json', import.meta.url);
    await import('node:fs/promises').then((fs) => fs.writeFile(path, JSON.stringify(res, null, 2)));
  }

  printSummary(title, res);
  return res;
}


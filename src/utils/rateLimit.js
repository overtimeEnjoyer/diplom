/** In-memory sliding-window rate limiter (serverless-safe per warm instance). */

const buckets = new Map();

function pruneBucket(bucket, windowMs, now) {
  while (bucket.length && bucket[0] <= now - windowMs) {
    bucket.shift();
  }
}

export function createRateLimiter({ windowMs = 60_000, max = 30, keyFn = (req) => req.ip || 'unknown' } = {}) {
  return (req, res, next) => {
    const now = Date.now();
    const key = keyFn(req);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = [];
      buckets.set(key, bucket);
    }
    pruneBucket(bucket, windowMs, now);
    if (bucket.length >= max) {
      res.setHeader('Retry-After', String(Math.ceil(windowMs / 1000)));
      return res.status(429).json({
        error: 'too_many_requests',
        message: 'Забагато запитів. Спробуйте пізніше.',
      });
    }
    bucket.push(now);
    next();
  };
}

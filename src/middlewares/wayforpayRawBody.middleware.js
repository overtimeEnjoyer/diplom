/**
 * Buffer raw body for WayForPay callback before JSON/urlencoded parsers alter it.
 */
export function wayforpayRawBody(req, res, next) {
  if (req.method !== 'POST' || !req.path.endsWith('/payments/wayforpay-callback')) {
    return next();
  }

  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    req.wayforpayRawBody = Buffer.concat(chunks).toString('utf8');
    next();
  });
  req.on('error', next);
}

const env = require('../config/env');

const SECRET_KEY = /(authorization|cookie|password|passwd|secret|token|signature|accountno)/i;
const CUSTOMER_KEY = /(address|contact|email|mobile|name|notes|phone)/i;

const scrubString = (value) => String(value)
  .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
  .replace(/(mongodb(?:\+srv)?:\/\/)[^\s/@:]+:[^\s/@]+@/gi, '$1[REDACTED]@');

const redact = (value, options = {}, seen = new WeakSet()) => {
  if (typeof value === 'string') return scrubString(value);
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => redact(item, options, seen));
  return Object.fromEntries(Object.entries(value).map(([key, child]) => {
    if (SECRET_KEY.test(key) || (options.customerData && CUSTOMER_KEY.test(key))) {
      return [key, '[REDACTED]'];
    }
    return [key, redact(child, options, seen)];
  }));
};

const write = (level, event, details = {}) => {
  const record = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...redact(details, { customerData: true }),
  };
  const target = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  target(JSON.stringify(record));
};

const requestLogger = (req, res, next) => {
  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    write('info', 'http_request', {
      requestId: req.id,
      method: req.method,
      route: req.route?.path || req.baseUrl || 'unmatched',
      status: res.statusCode,
      durationMs: Math.round(durationMs),
      userId: req.user?.id,
    });
  });
  next();
};

const errorDetails = (err, requestId) => {
  if (env.NODE_ENV === 'production') {
    return { requestId, errorType: err?.name || 'Error' };
  }
  return { requestId, errorType: err?.name || 'Error', message: err?.message };
};

/**
 * Details for a fatal process-level failure: startup and shutdown.
 *
 * Unlike `errorDetails`, this always includes the message. Suppressing it in
 * production makes a failed deploy undiagnosable — the operator sees only
 * `errorType: "Error"` and has no way to learn which environment variable is
 * wrong. These records never reach an HTTP client; they go to the platform log,
 * visible only to whoever can already read the environment settings. The
 * message is still scrubbed, so a driver error quoting the connection string
 * cannot leak its credentials.
 */
const fatalDetails = (err) => ({
  errorType: err?.name || 'Error',
  message: scrubString(err?.message || 'Unknown error'),
});

module.exports = { write, redact, requestLogger, errorDetails, fatalDetails };

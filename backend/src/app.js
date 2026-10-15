const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const routes = require('./routes');
const env = require('./config/env');
const { isDbReady } = require('./config/db');
const logger = require('./services/logger');
const { assignRequestId, enforceRequestShape } = require('./middleware/requestSecurity');

const app = express();
if (env.TRUST_PROXY) app.set('trust proxy', env.TRUST_PROXY === 'true' ? 1 : env.TRUST_PROXY);

app.disable('x-powered-by');
app.use(helmet());
app.use(assignRequestId);
app.use(logger.requestLogger);
app.use(cors({
  origin(origin, callback) {
    // A missing Origin is a non-browser caller (health checks, curl); those are
    // still gated by the Authorization header on every application route.
    if (!origin) return callback(null, true);
    if (env.CORS_ORIGINS.includes(origin)) return callback(null, true);
    // Reject by withholding Access-Control-Allow-Origin rather than by
    // throwing. The browser blocks the response either way, and this keeps a
    // probe from turning into a 500 in the error log.
    logger.write('warn', 'cors_origin_rejected', { origin });
    return callback(null, false);
  },
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
  maxAge: 600,
}));

app.use(express.json({ limit: '1mb', strict: true }));
app.use(enforceRequestShape);

// A number of legacy controllers build their own 500 responses. Ensure none of
// those responses expose database or provider error details in production.
app.use((_req, res, next) => {
  const sendJson = res.json.bind(res);
  res.json = (body) => {
    if (env.NODE_ENV === 'production' && res.statusCode >= 500) {
      return sendJson({ error: 'Internal server error' });
    }
    return sendJson(body);
  };
  next();
});

const rejectDangerousKeys = (value) => {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(rejectDangerousKeys);
  return Object.entries(value).some(([key, child]) =>
    key.startsWith('$') || key.includes('.') || ['__proto__', 'prototype', 'constructor'].includes(key) || rejectDangerousKeys(child)
  );
};

app.use((req, res, next) => {
  if (rejectDangerousKeys(req.body) || rejectDangerousKeys(req.query)) {
    return res.status(400).json({ error: 'Invalid request structure' });
  }
  return next();
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests; try again later' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many login attempts; try again later' },
});
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many payment requests; try again later' },
});

app.use('/result-analysis', apiLimiter);
app.use('/result-analysis/auth/login', authLimiter);
app.use('/result-analysis/auth/customer/login', authLimiter);
app.use('/result-analysis/payments', paymentLimiter);

// Liveness intentionally reveals no dependency or deployment details.
app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/ready', (_req, res) => {
  const ready = isDbReady();
  return res.status(ready ? 200 : 503).json({ ready });
});

// All application routes below require the owner token.
app.use('/result-analysis', routes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, _next) => {
  logger.write('error', 'request_error', logger.errorDetails(err, req.id));
  const status = err.status || 500;
  const message = status >= 500 && env.NODE_ENV === 'production' ? 'Internal server error' : (err.message || 'Server error');
  res.status(status).json({ error: message });
});

module.exports = app;

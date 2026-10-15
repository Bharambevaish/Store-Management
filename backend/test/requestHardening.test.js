/**
 * Phase 14 transport, CORS, and request-shape regression tests.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const ALLOWED_ORIGIN = 'https://tammewar-pharmacy.pages.dev';
process.env.JWT_SECRET = 'a'.repeat(64);
process.env.CORS_ORIGINS = ALLOWED_ORIGIN;

const app = require('../src/app');
const { startApp, send } = require('./helpers/httpHarness');

const API = '/result-analysis';

const withServer = async (t) => {
  const server = await startApp(app);
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return server;
};

test('CORS permission is granted only to the configured production origin', async (t) => {
  const server = await withServer(t);

  const allowed = await send(server, { path: '/health', headers: { Origin: ALLOWED_ORIGIN } });
  assert.equal(allowed.headers['access-control-allow-origin'], ALLOWED_ORIGIN);

  const hostile = [
    'https://tammewar-pharmacy.pages.dev.attacker.test',
    'https://attacker.pages.dev',
    'http://tammewar-pharmacy.pages.dev',
    'null',
    'http://localhost:3009',
  ];
  for (const origin of hostile) {
    const res = await send(server, { path: '/health', headers: { Origin: origin } });
    assert.equal(
      res.headers['access-control-allow-origin'],
      undefined,
      `${origin} must receive no CORS permission`,
    );
  }
});

test('a preflight from an unapproved origin is not granted', async (t) => {
  const server = await withServer(t);
  const res = await send(server, {
    method: 'OPTIONS',
    path: `${API}/customers`,
    headers: {
      Origin: 'https://attacker.test',
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'authorization',
    },
  });
  assert.equal(res.headers['access-control-allow-origin'], undefined);
  assert.equal(res.headers['access-control-allow-credentials'], undefined);
});

test('credentialed CORS is never enabled', async (t) => {
  const server = await withServer(t);
  const res = await send(server, { path: '/health', headers: { Origin: ALLOWED_ORIGIN } });
  assert.equal(res.headers['access-control-allow-credentials'], undefined);
});

test('security response headers are present and the server is unbranded', async (t) => {
  const server = await withServer(t);
  const res = await send(server, { path: '/health' });
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.equal(res.headers['x-frame-options'], 'SAMEORIGIN');
  assert.match(res.headers['strict-transport-security'], /max-age=\d{6,}/);
  assert.equal(res.headers['x-powered-by'], undefined);
  assert.equal(res.headers['x-dns-prefetch-control'], 'off');
});

test('MongoDB operator payloads and prototype keys are refused', async (t) => {
  const server = await withServer(t);
  // Sent as raw JSON text: an object literal would let the engine consume
  // `__proto__` as a prototype assignment, so the wire payload would never
  // carry the key the server is being tested against.
  const payloads = [
    '{"email": {"$ne": null}, "password": "xxxxxxxxxxxxxxxxxxxx"}',
    '{"email": "a@b.co", "password": {"$gt": ""}}',
    '{"a.b": "dotted key"}',
    '{"__proto__": {"polluted": true}, "email": "a@b.co"}',
    '{"constructor": {"prototype": {"polluted": true}}}',
    '{"nested": {"deep": {"$where": "sleep(1000)"}}}',
    '{"items": [{"$set": {"price": 0}}]}',
  ];
  for (const body of payloads) {
    const res = await send(server, { method: 'POST', path: `${API}/auth/login`, body });
    assert.equal(res.status, 400, `payload ${body} must be refused`);
    assert.equal(res.body.error, 'Invalid request structure');
  }
  assert.equal(Object.prototype.polluted, undefined, 'the prototype must not be polluted');
});

test('malformed identifiers in a body or query are refused before authentication', async (t) => {
  const server = await withServer(t);

  const inBody = await send(server, {
    method: 'POST',
    path: `${API}/payments`,
    body: { customerId: 'not-an-object-id', amount: 1 },
  });
  assert.equal(inBody.status, 400);
  assert.equal(inBody.body.error, 'Invalid resource identifier');

  const inQuery = await send(server, { path: `${API}/payments?customerId=not-an-object-id` });
  assert.equal(inQuery.status, 400);
  assert.equal(inQuery.body.error, 'Invalid resource identifier');

  // A malformed path parameter sits behind the router, so an anonymous caller
  // is refused for the stronger reason first and learns nothing about routing.
  const inPath = await send(server, { method: 'PUT', path: `${API}/customers/not-an-object-id` });
  assert.equal(inPath.status, 401);
});

test('oversized bodies and excessive strings are refused', async (t) => {
  const server = await withServer(t);

  const oversized = await send(server, {
    method: 'POST',
    path: `${API}/auth/login`,
    body: JSON.stringify({ email: 'a@b.co', note: 'x'.repeat(1_200_000) }),
  });
  assert.equal(oversized.status, 413);

  const longString = await send(server, {
    method: 'POST',
    path: `${API}/auth/login`,
    body: { email: 'a@b.co', password: 'p'.repeat(20), note: 'x'.repeat(800_000) },
  });
  assert.equal(longString.status, 400);
  assert.equal(longString.body.error, 'Request text is too long');

  const tooManyItems = await send(server, {
    method: 'POST',
    path: `${API}/orders`,
    body: { items: Array(250).fill({ qty: 1 }) },
  });
  assert.equal(tooManyItems.status, 400);
  assert.equal(tooManyItems.body.error, 'Request contains too many items');
});

test('malformed JSON is refused without leaking a parser stack', async (t) => {
  const server = await withServer(t);
  const res = await send(server, {
    method: 'POST',
    path: `${API}/auth/login`,
    body: '{"email": "a@b.co",,}',
  });
  assert.equal(res.status, 400);
  assert.doesNotMatch(res.raw, /at JSON\.parse|node_modules|\/src\//);
});

test('a caller-supplied request id is echoed only when it is well formed', async (t) => {
  const server = await withServer(t);

  const clean = await send(server, { path: '/health', headers: { 'X-Request-Id': 'trace-123' } });
  assert.equal(clean.headers['x-request-id'], 'trace-123');

  const injected = await send(server, {
    path: '/health',
    headers: { 'X-Request-Id': 'bad value with spaces' },
  });
  assert.match(injected.headers['x-request-id'], /^[0-9a-f-]{36}$/);
});

test('unknown paths reveal nothing about the routing table', async (t) => {
  const server = await withServer(t);

  // Everything under the API prefix is behind the owner token, so a probe
  // cannot distinguish a real route from an invented one.
  const underApi = await send(server, { path: `${API}/does-not-exist` });
  assert.equal(underApi.status, 401);
  assert.deepEqual(underApi.body, { error: 'Authentication required' });

  const outsideApi = await send(server, { path: '/does-not-exist' });
  assert.equal(outsideApi.status, 404);
  assert.deepEqual(outsideApi.body, { error: 'Not found' });
});

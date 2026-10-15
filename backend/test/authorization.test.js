/**
 * Phase 14 authentication and authorization regression tests.
 *
 * Each case corresponds to a line in the "Security regression testing" section
 * of PRODUCTION_DEPLOYMENT_TASKLIST.md.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const JWT_SECRET = 'a'.repeat(64);
process.env.JWT_SECRET = JWT_SECRET;
process.env.CORS_ORIGINS = 'https://tammewar-pharmacy.pages.dev';

const app = require('../src/app');
const env = require('../src/config/env');
const User = require('../src/models/user');
const { startApp, send } = require('./helpers/httpHarness');

const OWNER_ID = new mongoose.Types.ObjectId();
const API = '/result-analysis';

const signOwnerToken = (overrides = {}) => {
  const {
    secret = JWT_SECRET,
    issuer = env.JWT_ISSUER,
    audience = env.JWT_AUDIENCE,
    subject = OWNER_ID.toString(),
    claims = {},
    options = {},
  } = overrides;
  return jwt.sign(
    { role: 'admin', authType: 'owner', ...claims },
    secret,
    { algorithm: 'HS256', subject, issuer, audience, expiresIn: '2h', ...options },
  );
};

// A live owner record, returned by the stubbed User.findById.
const ownerRecord = (passwordChangedAt = new Date(Date.now() - 3600_000)) => ({
  _id: OWNER_ID,
  email: 'owner@example.com',
  name: 'Owner',
  mobile: '9999999999',
  role: 'admin',
  status: 'Active',
  passwordChangedAt,
});

const stubFindById = (t, record) => {
  const original = User.findById;
  User.findById = () => ({ select: async () => record });
  t.after(() => { User.findById = original; });
};

const withServer = async (t) => {
  const server = await startApp(app);
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return server;
};

test('unauthenticated requests to application routes are rejected', async (t) => {
  const server = await withServer(t);
  const paths = ['/customers', '/products', '/settings', '/data/backup', '/reports/sales'];
  for (const path of paths) {
    const res = await send(server, { path: `${API}${path}` });
    assert.equal(res.status, 401, `${path} must require authentication`);
    assert.equal(res.body.error, 'Authentication required');
  }
});

test('a forged tenant header grants no access', async (t) => {
  const server = await withServer(t);
  const res = await send(server, {
    path: `${API}/data/backup`,
    headers: { 'X-Tenant-Id': '000000000000000000000001', 'X-User-Role': 'admin' },
  });
  assert.equal(res.status, 401);
});

test('a token supplied in the query string grants no access', async (t) => {
  const server = await withServer(t);
  const token = signOwnerToken();
  const res = await send(server, { path: `${API}/data/backup?token=${token}&access_token=${token}` });
  assert.equal(res.status, 401);
});

test('invalid, expired, and mis-scoped tokens are rejected', async (t) => {
  const server = await withServer(t);
  stubFindById(t, ownerRecord());

  const cases = {
    garbage: 'not-a-jwt',
    wrongSecret: signOwnerToken({ secret: 'b'.repeat(64) }),
    wrongIssuer: signOwnerToken({ issuer: 'attacker' }),
    wrongAudience: signOwnerToken({ audience: 'attacker' }),
    expired: signOwnerToken({ options: { expiresIn: '-1s' } }),
    notOwnerAuthType: signOwnerToken({ claims: { authType: 'customer' } }),
    notAdminRole: signOwnerToken({ claims: { role: 'staff' } }),
    algNone: jwt.sign(
      { role: 'admin', authType: 'owner', sub: OWNER_ID.toString(), iss: env.JWT_ISSUER, aud: env.JWT_AUDIENCE },
      null,
      { algorithm: 'none' },
    ),
  };

  for (const [name, token] of Object.entries(cases)) {
    const res = await send(server, {
      path: `${API}/data/backup`,
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 401, `${name} must be rejected`);
    assert.equal(res.body.error, 'Invalid or expired auth token');
  }
});

test('an inactive or missing owner account cannot authenticate', async (t) => {
  const server = await withServer(t);
  const token = signOwnerToken();

  stubFindById(t, null);
  const missing = await send(server, { path: `${API}/customers`, headers: { Authorization: `Bearer ${token}` } });
  assert.equal(missing.status, 401);

  User.findById = () => ({ select: async () => ({ ...ownerRecord(), status: 'Inactive' }) });
  const inactive = await send(server, { path: `${API}/customers`, headers: { Authorization: `Bearer ${token}` } });
  assert.equal(inactive.status, 401);
});

test('a token issued before the last password change is rejected', async (t) => {
  const server = await withServer(t);
  const staleToken = signOwnerToken();

  // The owner rotated the password one minute after this token was minted.
  stubFindById(t, ownerRecord(new Date(Date.now() + 60_000)));

  const res = await send(server, {
    path: `${API}/customers`,
    headers: { Authorization: `Bearer ${staleToken}` },
  });
  assert.equal(res.status, 401, 'password rotation must end sessions opened beforehand');
  assert.equal(res.body.error, 'Invalid or expired auth token');
});

test('internal gateway authentication stays disabled', async (t) => {
  const server = await withServer(t);
  assert.equal(env.INTERNAL_AUTH_ENABLED, false);
  const res = await send(server, {
    path: `${API}/data/backup`,
    headers: { 'X-Internal-Token': signOwnerToken() },
  });
  assert.equal(res.status, 401);
  assert.equal(res.body.error, 'Internal authentication is disabled');
});

test('there is no public registration or customer authentication surface', async (t) => {
  const server = await withServer(t);
  const surfaces = [
    { method: 'POST', path: `${API}/auth/register` },
    { method: 'POST', path: `${API}/auth/customer/register` },
    { method: 'POST', path: `${API}/auth/customer/login` },
    { method: 'POST', path: `${API}/users` },
    { method: 'GET', path: `${API}/staff` },
    { method: 'POST', path: `${API}/public/tracking` },
    { method: 'POST', path: `${API}/public/feedback` },
  ];
  for (const surface of surfaces) {
    const res = await send(server, { ...surface, body: { email: 'a@b.co', password: 'x'.repeat(20) } });
    // Either the route does not exist, or it sits behind the owner token.
    assert.ok([401, 404].includes(res.status), `${surface.path} returned ${res.status}`);
  }
});

test('online restore and destructive routes require the owner token', async (t) => {
  const server = await withServer(t);
  assert.equal(env.ONLINE_RESTORE_ENABLED, false);
  const routes = [
    { method: 'POST', path: `${API}/data/restore` },
    { method: 'POST', path: `${API}/data/import-bulk` },
    { method: 'POST', path: `${API}/bulk/delete` },
    { method: 'POST', path: `${API}/bulk/status` },
    { method: 'GET', path: `${API}/data/audit-logs` },
  ];
  for (const route of routes) {
    const res = await send(server, { ...route, body: {} });
    assert.equal(res.status, 401, `${route.path} must require authentication`);
  }
});

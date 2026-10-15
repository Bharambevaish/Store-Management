/**
 * Phase 14 rate-limit regression test.
 *
 * This lives in its own file because `node --test` runs each file in its own
 * process, which gives the login limiter a fresh in-memory store. Sharing a
 * process with the other suites would let their requests consume the budget.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'a'.repeat(64);

const app = require('../src/app');
const User = require('../src/models/user');
const { startApp, send } = require('./helpers/httpHarness');

const LOGIN = '/result-analysis/auth/login';
const CREDENTIALS = { email: 'owner@example.com', password: 'WrongPassword12345' };

test('repeated failed logins are throttled before reaching the database', async (t) => {
  // No MongoDB is available here, so the lookup is stubbed to report "no such
  // account". The limiter must engage regardless of what the lookup returns.
  const originalFindOne = User.findOne;
  let lookups = 0;
  User.findOne = () => ({
    select: async () => {
      lookups += 1;
      return null;
    },
  });
  t.after(() => { User.findOne = originalFindOne; });

  const server = await startApp(app);
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const statuses = [];
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    const res = await send(server, { method: 'POST', path: LOGIN, body: CREDENTIALS });
    statuses.push(res.status);
  }

  const firstThrottled = statuses.indexOf(429);
  assert.notEqual(firstThrottled, -1, 'failed logins must eventually be throttled');
  assert.ok(firstThrottled <= 10, `throttling engaged only after ${firstThrottled + 1} attempts`);
  assert.ok(
    statuses.slice(0, firstThrottled).every((status) => status === 401),
    'every attempt before the limit must be a plain credential rejection',
  );
  assert.ok(
    statuses.slice(firstThrottled).every((status) => status === 429),
    'the limit must stay engaged for the rest of the window',
  );

  // Throttled attempts must not reach the credential lookup.
  assert.equal(lookups, firstThrottled);

  const throttled = await send(server, { method: 'POST', path: LOGIN, body: CREDENTIALS });
  assert.equal(throttled.body.error, 'Too many login attempts; try again later');
  assert.ok(throttled.headers['ratelimit-policy'] || throttled.headers['ratelimit'], 'standard headers are advertised');
  assert.equal(throttled.headers['x-ratelimit-limit'], undefined, 'legacy headers stay off');
});

/**
 * Phase 7 access-verifier tests.
 *
 * `npm run atlas:verify` is the only automated proof that the application
 * credential cannot reach another database. It reported a false failure against
 * real Atlas on 2026-08-22 because it recognised only the self-hosted MongoDB
 * error shape, so its denial detection is pinned here.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { isAuthorizationDenied } = require('../scripts/verifyAtlasAccess');

test('a self-hosted MongoDB denial is recognised', () => {
  assert.equal(isAuthorizationDenied({ code: 13, codeName: 'Unauthorized', message: 'not authorized on probe' }), true);
  assert.equal(isAuthorizationDenied({ code: 13 }), true);
  assert.equal(isAuthorizationDenied({ codeName: 'Unauthorized' }), true);
});

test('an Atlas denial is recognised despite its wrapped error code', () => {
  // Observed verbatim from Atlas on 2026-08-22.
  assert.equal(isAuthorizationDenied({
    code: 8000,
    codeName: 'AtlasError',
    name: 'MongoServerError',
    message: 'user is not allowed to do action [find] on [tammewar_privilege_probe.probe]',
  }), true);
});

test('a connectivity failure is NOT read as a denial', () => {
  // The dangerous direction: an unreachable cluster must never masquerade as a
  // passing privilege check.
  assert.equal(isAuthorizationDenied({ name: 'MongoServerSelectionError', message: 'connection timed out' }), false);
  assert.equal(isAuthorizationDenied({ name: 'MongoNetworkError', message: 'socket hang up' }), false);
  assert.equal(isAuthorizationDenied({ code: 6, codeName: 'HostUnreachable', message: 'host unreachable' }), false);
  assert.equal(isAuthorizationDenied({ message: 'Authentication failed.' }), false);
});

test('an absent or empty error is not a denial', () => {
  assert.equal(isAuthorizationDenied(null), false);
  assert.equal(isAuthorizationDenied(undefined), false);
  assert.equal(isAuthorizationDenied({}), false);
});

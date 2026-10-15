/**
 * Phase 8 audit-detector tests.
 *
 * The credential scan is the check that decides whether a database is safe to
 * migrate. A false negative there is silent, so the detector is tested against
 * both the shapes it must catch and the shapes it must not flag.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { findCredentialPaths, databaseFrom, BCRYPT_HASH, DEMO_MARKER } = require('../scripts/auditDatabase');

const BCRYPT = '$2b$12$abcdefghijklmnopqrstuvABCDEFGHIJKLMNOPQRSTUVWXYZ01234';

test('a correctly hashed password is not reported', () => {
  assert.match(BCRYPT, BCRYPT_HASH);
  assert.deepEqual(findCredentialPaths({ email: 'owner@example.com', password: BCRYPT }), []);
});

test('a plaintext password is reported', () => {
  assert.deepEqual(findCredentialPaths({ password: 'Sup3rSecretOwnerPw' }), ['password']);
  // A too-short or malformed hash is plaintext as far as this check goes.
  assert.deepEqual(findCredentialPaths({ password: '$2b$12$tooshort' }), ['password']);
});

test('provider tokens are reported wherever they sit', () => {
  const found = findCredentialPaths({
    settings: { whatsappToken: 'EAAG...', razorpaySecret: 'rzp_secret' },
    integrations: [{ apiKey: 'k-123' }, { clientSecret: 'cs-456' }],
    nested: { deeper: { refreshToken: 'rt-789' } },
  });
  assert.deepEqual(found.sort(), [
    'integrations.0.apiKey',
    'integrations.1.clientSecret',
    'nested.deeper.refreshToken',
    'settings.razorpaySecret',
    'settings.whatsappToken',
  ]);
});

test('empty values and non-credential fields are not reported', () => {
  assert.deepEqual(findCredentialPaths({
    password: '',
    token: null,
    passwordChangedAt: new Date('2026-01-01'),
    tokenCount: 4,
    name: 'Real Customer',
    notes: 'Delivered the token of appreciation',
  }), []);
});

test('the walk terminates on deep and cyclic-looking structures', () => {
  let deep = { password: 'plaintext-at-depth' };
  for (let i = 0; i < 20; i += 1) deep = { level: deep };
  // Beyond the depth limit nothing is reported, but the call must still return.
  assert.deepEqual(findCredentialPaths(deep), []);

  let shallow = { password: 'plaintext-at-depth' };
  for (let i = 0; i < 3; i += 1) shallow = { level: shallow };
  assert.deepEqual(findCredentialPaths(shallow), ['level.level.level.password']);
});

test('demo markers match whole words, not fragments', () => {
  for (const value of ['Test Customer', 'demo account', 'Sample Product', 'ASDF asdf']) {
    assert.match(value, DEMO_MARKER, `${value} should be flagged`);
  }
  // "Contest" and "Testosterone" contain "test" but are not demo records; a
  // pharmacy really does stock things like protest-relief and testing kits.
  for (const value of ['Contest Winner Pharmacy', 'Testosterone Gel 50mg', 'Attestation Fee']) {
    assert.doesNotMatch(value, DEMO_MARKER, `${value} should not be flagged`);
  }
});

test('the audited database name is parsed from its URI', () => {
  assert.equal(
    databaseFrom('mongodb+srv://u:p@cluster.example.mongodb.net/medical_stock?retryWrites=true'),
    'medical_stock',
  );
  assert.throws(() => databaseFrom('mongodb+srv://u:p@cluster.example.mongodb.net/'), /must name the database/);
  assert.throws(() => databaseFrom('nonsense'), /not a valid connection string/);

  // With required:false a missing database name is legal; the caller then
  // lists what the cluster holds instead of auditing.
  assert.equal(databaseFrom('mongodb+srv://u:p@cluster.example.mongodb.net/', { required: false }), '');
  assert.equal(
    databaseFrom('mongodb+srv://u:p@cluster.example.mongodb.net/medical_stock', { required: false }),
    'medical_stock',
  );
});

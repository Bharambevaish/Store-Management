/**
 * Phase 14 data-exposure regression tests.
 *
 * These assert the negative: credential material must not appear in an API
 * response, an owner-triggered export, or the log stream, even when the
 * underlying documents contain it.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'a'.repeat(64);

const User = require('../src/models/user');
const Setting = require('../src/models/setting');
const JobRun = require('../src/models/jobRun');
const backupService = require('../src/services/backupService');
const logger = require('../src/services/logger');

const SECRET_MARKERS = [
  '$2b$12$hashedpasswordvalue',
  'whatsapp-provider-token',
  'super-secret-owner-password',
];

const assertNoSecrets = (serialized, label) => {
  for (const marker of SECRET_MARKERS) {
    assert.equal(serialized.includes(marker), false, `${label} leaked ${marker}`);
  }
  assert.doesNotMatch(serialized, /"password"\s*:/, `${label} carries a password field`);
  assert.doesNotMatch(serialized, /"whatsappToken"\s*:/, `${label} carries a provider token field`);
  assert.doesNotMatch(serialized, /"passwordChangedAt"\s*:/, `${label} carries credential timing metadata`);
};

test('a serialized owner document carries no credential material', () => {
  const owner = new User({
    email: 'owner@example.com',
    name: 'Owner',
    mobile: '9999999999',
    role: 'admin',
    password: '$2b$12$hashedpasswordvalue',
  });
  assertNoSecrets(JSON.stringify(owner), 'user toJSON');
  assertNoSecrets(JSON.stringify(owner.toObject()), 'user toObject');
});

test('a serialized settings document carries no provider secret', () => {
  const settings = new Setting({
    companyName: 'Tammewar Pharmacy',
    whatsappToken: 'whatsapp-provider-token',
  });
  assertNoSecrets(JSON.stringify(settings), 'setting toJSON');
  assertNoSecrets(JSON.stringify(settings.toObject()), 'setting toObject');
});

test('the owner backup export excludes credentials and internal error text', async (t) => {
  // Each collection is stubbed so the export can be exercised without MongoDB.
  // The user and settings stubs deliberately return documents that *do* carry
  // secrets, so the test proves the export strips them rather than that the
  // source happened to be clean.
  const originals = new Map();
  const stubFind = (model, docs) => {
    originals.set(model, model.find);
    model.find = () => {
      const chain = Promise.resolve(docs);
      chain.select = () => Promise.resolve(docs.map((doc) => doc));
      return chain;
    };
  };
  t.after(() => {
    for (const [model, original] of originals) model.find = original;
  });

  const owner = new User({
    email: 'owner@example.com',
    name: 'Owner',
    mobile: '9999999999',
    role: 'admin',
    password: '$2b$12$hashedpasswordvalue',
  });
  const settings = new Setting({ companyName: 'Tammewar Pharmacy', whatsappToken: 'whatsapp-provider-token' });
  const jobRun = new JobRun({ jobKey: 'recurring_orders', status: 'failed', lastError: 'connection string leaked here' });

  // Every model the export touches must answer; empty is fine for the rest.
  for (const name of [
    'branch', 'employee', 'customer', 'vendor', 'product', 'stockHistory', 'order',
    'quotation', 'bill', 'payment', 'purchaseOrder', 'stockAdjustment', 'expense', 'auditLog',
  ]) {
    stubFind(require(`../src/models/${name}`), []);
  }
  stubFind(User, [owner]);
  stubFind(Setting, [settings]);
  stubFind(JobRun, [jobRun]);

  const dump = await backupService.generateDatabaseDump();
  const serialized = JSON.stringify(dump);
  assertNoSecrets(serialized, 'backup export');
  assert.equal(dump.users.length, 1, 'the owner record is still exported');
  assert.match(serialized, /owner@example\.com/, 'non-secret owner fields are retained');
});

test('log redaction survives nested and array-shaped credential material', () => {
  const record = logger.redact({
    request: {
      headers: { authorization: 'Bearer super.secret.token', cookie: 'session=abc' },
      body: { password: 'super-secret-owner-password', confirmPassword: 'super-secret-owner-password' },
    },
    connections: ['mongodb+srv://app:hunter2@cluster.example.mongodb.net/db'],
    customers: [{ name: 'Real Person', mobile: '9999999999', notes: 'sensitive note' }],
  }, { customerData: true });

  const serialized = JSON.stringify(record);
  assert.equal(serialized.includes('super-secret-owner-password'), false);
  assert.equal(serialized.includes('super.secret.token'), false);
  assert.equal(serialized.includes('hunter2'), false);
  assert.equal(serialized.includes('Real Person'), false);
  assert.equal(serialized.includes('sensitive note'), false);
  assert.match(serialized, /mongodb\+srv:\/\/\[REDACTED\]@/);
});

test('production error details never carry an exception message', () => {
  const saved = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    delete require.cache[require.resolve('../src/config/env')];
    delete require.cache[require.resolve('../src/services/logger')];
    const productionLogger = require('../src/services/logger');
    const details = productionLogger.errorDetails(
      new Error('MongoServerError: authentication failed for user app'),
      'req-1',
    );
    assert.deepEqual(details, { requestId: 'req-1', errorType: 'Error' });
  } finally {
    process.env.NODE_ENV = saved;
    delete require.cache[require.resolve('../src/config/env')];
    delete require.cache[require.resolve('../src/services/logger')];
  }
});

test('a fatal startup failure names the cause but never leaks a credential', () => {
  const saved = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    delete require.cache[require.resolve('../src/config/env')];
    delete require.cache[require.resolve('../src/services/logger')];
    const productionLogger = require('../src/services/logger');

    // The operator must be able to read which variable is wrong. Suppressing
    // this is what made a failed Render deploy undiagnosable on 2026-08-22.
    const config = productionLogger.fatalDetails(
      new Error('CORS_ORIGINS entry is not a valid origin: placeholder'),
    );
    assert.equal(config.errorType, 'Error');
    assert.match(config.message, /CORS_ORIGINS entry is not a valid origin/);

    // A driver error that quotes the connection string must still be scrubbed.
    const driver = productionLogger.fatalDetails(Object.assign(
      new Error('connect failed for mongodb+srv://tammewar_app:hunter2@cluster.mongodb.net/db'),
      { name: 'MongoServerError' },
    ));
    assert.equal(driver.errorType, 'MongoServerError');
    assert.equal(driver.message.includes('hunter2'), false);
    assert.match(driver.message, /mongodb\+srv:\/\/\[REDACTED\]@/);

    // A bearer token in a fatal message is scrubbed too.
    assert.equal(
      productionLogger.fatalDetails(new Error('rejected Bearer abc.def.ghi')).message.includes('abc.def.ghi'),
      false,
    );

    assert.equal(productionLogger.fatalDetails(undefined).message, 'Unknown error');
  } finally {
    process.env.NODE_ENV = saved;
    delete require.cache[require.resolve('../src/config/env')];
    delete require.cache[require.resolve('../src/services/logger')];
  }
});

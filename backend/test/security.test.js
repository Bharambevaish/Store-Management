const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

process.env.JWT_SECRET = 'a'.repeat(64);

const app = require('../src/app');
const Customer = require('../src/models/customer');
const Order = require('../src/models/order');
const Product = require('../src/models/product');
const Setting = require('../src/models/setting');
const Expense = require('../src/models/expense');
const User = require('../src/models/user');
const JobRun = require('../src/models/jobRun');
const { inspectValue } = require('../src/middleware/requestSecurity');
const { redact } = require('../src/services/logger');
const env = require('../src/config/env');
const { getTriggerDate, processCandidates } = require('../src/services/recurringOrderService');
const Notification = require('../src/models/notification');

const request = (server, path) => new Promise((resolve, reject) => {
  const address = server.address();
  const req = http.get({ hostname: '127.0.0.1', port: address.port, path }, (res) => {
    let body = '';
    res.on('data', (chunk) => { body += chunk; });
    res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body), headers: res.headers }));
  });
  req.on('error', reject);
});

test('liveness is minimal and readiness fails closed without MongoDB', async (t) => {
  const server = await new Promise((resolve) => {
    const listeningServer = app.listen(0, '127.0.0.1', () => resolve(listeningServer));
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const health = await request(server, '/health');
  assert.equal(health.status, 200);
  assert.deepEqual(health.body, { ok: true });
  assert.match(health.headers['x-request-id'], /^[0-9a-f-]{36}$/);

  const ready = await request(server, '/ready');
  assert.equal(ready.status, 503);
  assert.deepEqual(ready.body, { ready: false });
});

test('request security rejects malformed identifiers and oversized collections', () => {
  assert.equal(inspectValue({ customerId: 'not-an-object-id' }), 'Invalid resource identifier');
  assert.equal(inspectValue({ items: Array(201).fill('x') }), 'Request contains too many items');
  assert.equal(inspectValue({ search: 'x'.repeat(750001) }), 'Request text is too long');
});

test('MongoDB URI database parsing is explicit and credential-safe', () => {
  assert.equal(
    env.getMongoDatabaseName('mongodb+srv://user:secret@example.mongodb.net/tammewar_pharmacy_prod?retryWrites=true'),
    'tammewar_pharmacy_prod',
  );
  assert.equal(env.getMongoDatabaseName('not-a-mongodb-uri'), '');
});

test('structured log redaction removes secrets, credentials, and customer fields', () => {
  const output = redact({
    authorization: 'Bearer abc.def.ghi',
    mongo: 'mongodb://user:password@example.test/db',
    customer: { name: 'Customer Name', mobile: '9999999999' },
  }, { customerData: true });
  assert.equal(output.authorization, '[REDACTED]');
  assert.equal(output.mongo, 'mongodb://[REDACTED]@example.test/db');
  assert.equal(output.customer.name, '[REDACTED]');
  assert.equal(output.customer.mobile, '[REDACTED]');
});

test('pharmacy schemas enforce bounded customer, order, setting, and credential fields', () => {
  assert.ok(new Customer({ name: 'Valid Name', mobile: '9999999999', address: 'x'.repeat(501) }).validateSync());
  assert.ok(new Order({ items: [] }).validateSync());
  assert.ok(new Setting({ companyName: 'x'.repeat(151) }).validateSync());
  assert.ok(new User({ email: 'owner@example.com', password: 'A'.repeat(64), role: 'admin', name: 'Owner', mobile: 'invalid' }).validateSync());
  assert.equal(new User({ email: 'owner@example.com', password: 'A'.repeat(64), role: 'admin', name: 'Owner', mobile: '9999999999' }).toJSON().password, undefined);
  assert.equal(new Setting({ whatsappToken: 'provider-secret' }).toJSON().whatsappToken, undefined);
  assert.equal(new Product({ hsnCode: 'HSN3004' }).validateSync()?.errors.hsnCode, undefined);
});

test('an expense receipt must be an image or PDF data URI', () => {
  const receipt = (value) => new Expense({
    category: 'fuel',
    amount: 1,
    branch: '000000000000000000000001',
    receiptImage: value,
  }).validateSync()?.errors?.receiptImage?.message;

  // The stored value is rendered in an iframe and opened in a new tab, so a
  // scheme or markup payload must never survive validation.
  assert.match(receipt('javascript:alert(1)'), /image or PDF data URI/);
  assert.match(receipt('"><img src=x onerror=alert(1)>'), /image or PDF data URI/);
  assert.match(receipt('data:text/html;base64,PHNjcmlwdD4='), /image or PDF data URI/);
  assert.match(receipt('https://attacker.test/receipt.png'), /image or PDF data URI/);

  assert.equal(receipt('data:image/png;base64,iVBORw0KGgo='), undefined);
  assert.equal(receipt('data:application/pdf;base64,JVBERi0='), undefined);
  assert.equal(receipt(''), undefined, 'an expense may have no receipt');
});

test('recurring-order scheduling state and due-date calculation are bounded', () => {
  const deliveredAt = new Date('2026-01-01T00:00:00.000Z');
  assert.equal(
    getTriggerDate({ deliveredAt, recurringIntervalDays: 30 }).toISOString(),
    '2026-01-31T00:00:00.000Z',
  );
  assert.ok(new JobRun({
    jobKey: 'recurring_orders',
    status: 'invalid',
    lastStartedAt: new Date(),
  }).validateSync());
});

test('recurring-order processing skips an order that another request claimed', async (t) => {
  const originalFind = Order.find;
  const originalFindOneAndUpdate = Order.findOneAndUpdate;
  const originalCreate = Order.create;
  const originalNotificationUpdate = Notification.findOneAndUpdate;
  t.after(() => {
    Order.find = originalFind;
    Order.findOneAndUpdate = originalFindOneAndUpdate;
    Order.create = originalCreate;
    Notification.findOneAndUpdate = originalNotificationUpdate;
  });

  let createCalls = 0;
  Order.find = async () => [{
    _id: 'source-order',
    deliveredAt: new Date('2026-01-01T00:00:00.000Z'),
    recurringIntervalDays: 1,
  }];
  Order.findOneAndUpdate = async () => null;
  Order.create = async () => { createCalls += 1; };
  Notification.findOneAndUpdate = async () => {};

  const output = await processCandidates({
    triggeredBy: 'owner',
    now: new Date('2026-01-03T00:00:00.000Z'),
  });
  assert.deepEqual(output.result, { scanned: 1, due: 1, created: 0, skipped: 1 });
  assert.equal(createCalls, 0);
});

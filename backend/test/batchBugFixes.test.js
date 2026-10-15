/**
 * Batch bug-fix regression tests.
 *
 * These tests exercise the fixes from the batch cleanup plan:
 *   1. Credit-limit enforcement (dynamic outstanding calculation)
 *   2. Ledger summary including non-order (Counter Sale) bills
 *   3. Quotation-to-invoice stock deduction
 *   4. Payment reminder API endpoint
 *
 * Each test uses a dedicated, isolated test database to avoid
 * interfering with the live result_analysis_db.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// ── Environment ────────────────────────────────────────────────────
const JWT_SECRET = 'a'.repeat(64);
process.env.JWT_SECRET = JWT_SECRET;
process.env.CORS_ORIGINS = 'https://tammewar-pharmacy.pages.dev';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/batch_bugfix_test_db';
process.env.MONGO_DB_NAME = 'batch_bugfix_test_db';

const app = require('../src/app');
const env = require('../src/config/env');
const { startApp, send } = require('./helpers/httpHarness');

// Models
const Customer = require('../src/models/customer');
const Product = require('../src/models/product');
const Bill = require('../src/models/bill');
const Payment = require('../src/models/payment');
const Order = require('../src/models/order');
const Vendor = require('../src/models/vendor');
const Quotation = require('../src/models/quotation');
const Setting = require('../src/models/setting');
const StockHistory = require('../src/models/stockHistory');
const User = require('../src/models/user');
const Branch = require('../src/models/branch');
const PurchaseOrder = require('../src/models/purchaseOrder');

const API = '/result-analysis';
const OWNER_ID = new mongoose.Types.ObjectId();

const signOwnerToken = () =>
  jwt.sign(
    { role: 'admin', authType: 'owner' },
    JWT_SECRET,
    {
      algorithm: 'HS256',
      subject: OWNER_ID.toString(),
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      expiresIn: '2h',
    },
  );

// Stub User.findById to return a synthetic owner record without
// needing a real user in the database.
const stubFindById = (t) => {
  const original = User.findById;
  User.findById = () => ({
    select: async () => ({
      _id: OWNER_ID,
      email: 'owner@test.com',
      name: 'Test Owner',
      mobile: '9999999999',
      role: 'admin',
      status: 'Active',
      passwordChangedAt: new Date(Date.now() - 3600_000),
    }),
  });
  t.after(() => { User.findById = original; });
};

const withServer = async (t) => {
  const server = await startApp(app);
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return server;
};

// ── Database lifecycle ──────────────────────────────────────────────
let dbConnected = false;

const ensureDb = async () => {
  if (!dbConnected) {
    await mongoose.connect(process.env.MONGO_URI);
    dbConnected = true;
  }
};

const cleanCollections = async () => {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
};

test.after(async () => {
  if (dbConnected) {
    await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
  }
});

// ════════════════════════════════════════════════════════════════════
// TEST 1: Credit-limit enforcement
// ════════════════════════════════════════════════════════════════════
test('credit limit: order exceeding dynamic outstanding is rejected', async (t) => {
  await ensureDb();
  await cleanCollections();
  stubFindById(t);
  const server = await withServer(t);
  const token = signOwnerToken();
  const headers = { Authorization: `Bearer ${token}` };

  // Create a vendor (required for product)
  const vendor = await Vendor.create({ name: 'Test Vendor', contact: '9000000001', address: 'Test Addr' });

  // Create a product with enough stock
  const product = await Product.create({
    name: 'Test Product',
    category: 'Cleaning',
    unit: 'Litre',
    price: 100,
    currentStock: 1000,
    lowStockThreshold: 5,
    linkedVendor: vendor._id,
    hsnCode: '3402',
  });

  // Create a customer with creditLimit = 1000
  const customer = await Customer.create({
    name: 'Credit Test Customer',
    mobile: '9111111111',
    address: 'Test Address',
    creditLimit: 1000,
  });

  // Create an existing bill for Rs.800 (simulates outstanding of 800)
  await Bill.create({
    invoiceNumber: 'TEST-001',
    customer: customer._id,
    items: [{ product: product._id, quantity: 8, price: 100 }],
    subtotal: 800,
    totalAmount: 800,
  });

  // Attempt order of Rs.500 → total outstanding would be 1300 > 1000 → should reject
  const rejectRes = await send(server, {
    method: 'POST',
    path: `${API}/orders`,
    headers,
    body: {
      customer: customer._id.toString(),
      items: [{ product: product._id.toString(), quantity: 5 }],
      deliveryDate: new Date(Date.now() + 86400000).toISOString(),
    },
  });

  assert.equal(rejectRes.status, 400, 'Order exceeding credit limit should be rejected with 400');
  assert.ok(rejectRes.body.error.includes('credit limit'), `Error should mention credit limit, got: ${rejectRes.body.error}`);

  // Attempt order of Rs.150 → total outstanding would be 950 <= 1000 → should succeed
  const acceptRes = await send(server, {
    method: 'POST',
    path: `${API}/orders`,
    headers,
    body: {
      customer: customer._id.toString(),
      items: [{ product: product._id.toString(), quantity: 1 }],
      deliveryDate: new Date(Date.now() + 86400000).toISOString(),
    },
  });

  // Note: product price is 100, qty 1 → totalAmount = 100, outstanding = 800+100=900 <= 1000
  assert.equal(acceptRes.status, 201, `Order within credit limit should succeed, got ${acceptRes.status}: ${JSON.stringify(acceptRes.body)}`);
});

test('credit limit: creditLimit=0 means no limit (unlimited)', async (t) => {
  await ensureDb();
  await cleanCollections();
  stubFindById(t);
  const server = await withServer(t);
  const token = signOwnerToken();
  const headers = { Authorization: `Bearer ${token}` };

  const vendor = await Vendor.create({ name: 'Test Vendor', contact: '9000000002', address: 'Test Addr' });
  const product = await Product.create({
    name: 'Unlimited Product',
    category: 'Cleaning',
    unit: 'Litre',
    price: 50000,
    currentStock: 1000,
    lowStockThreshold: 5,
    linkedVendor: vendor._id,
    hsnCode: '3402',
  });

  // Customer with creditLimit = 0 (means unlimited)
  const customer = await Customer.create({
    name: 'Unlimited Customer',
    mobile: '9222222222',
    address: 'Test Address',
    creditLimit: 0,
  });

  // Even a large order should succeed
  const res = await send(server, {
    method: 'POST',
    path: `${API}/orders`,
    headers,
    body: {
      customer: customer._id.toString(),
      items: [{ product: product._id.toString(), quantity: 10 }],
      deliveryDate: new Date(Date.now() + 86400000).toISOString(),
    },
  });

  assert.equal(res.status, 201, `creditLimit=0 should be treated as unlimited, got ${res.status}: ${JSON.stringify(res.body)}`);
});

// ════════════════════════════════════════════════════════════════════
// TEST 2: Ledger summary includes Counter Sale (non-order) bills
// ════════════════════════════════════════════════════════════════════
test('ledger summary: customer with only a Counter Sale bill appears in the summary', async (t) => {
  await ensureDb();
  await cleanCollections();
  stubFindById(t);
  const server = await withServer(t);
  const token = signOwnerToken();
  const headers = { Authorization: `Bearer ${token}` };

  const vendor = await Vendor.create({ name: 'Ledger Vendor', contact: '9000000003', address: 'Addr' });
  const product = await Product.create({
    name: 'Ledger Product',
    category: 'Cleaning',
    unit: 'Piece',
    price: 200,
    currentStock: 500,
    lowStockThreshold: 5,
    linkedVendor: vendor._id,
    hsnCode: '3402',
  });

  // Customer with only a Counter Sale bill (no order)
  const customer = await Customer.create({
    name: 'Counter Sale Customer',
    mobile: '9333333333',
    address: 'Counter Addr',
  });

  // Create a Counter Sale bill (no linked order)
  await Bill.create({
    invoiceNumber: 'CS-001',
    customer: customer._id,
    items: [{ product: product._id, quantity: 3, price: 200 }],
    subtotal: 600,
    totalAmount: 600,
    order: null,
  });

  const res = await send(server, {
    method: 'GET',
    path: `${API}/customer-ledgers/summary`,
    headers,
  });

  assert.equal(res.status, 200);
  const ledgers = res.body;
  assert.ok(Array.isArray(ledgers), 'Response should be an array');

  const entry = ledgers.find(l => l.customer._id === customer._id.toString());
  assert.ok(entry, 'Customer with Counter Sale bill should appear in ledger summary');
  assert.equal(entry.totalBilled, 600, 'totalBilled should include Counter Sale bill amount');
  assert.equal(entry.pendingBalance, 600, 'pendingBalance should reflect unpaid Counter Sale');
  assert.equal(entry.status, 'Pending Payment');
});

// ════════════════════════════════════════════════════════════════════
// TEST 3: Quotation-to-Invoice stock deduction
// ════════════════════════════════════════════════════════════════════
test('quotation-to-invoice: stock is deducted and StockHistory is created', async (t) => {
  await ensureDb();
  await cleanCollections();
  stubFindById(t);
  const server = await withServer(t);
  const token = signOwnerToken();
  const headers = { Authorization: `Bearer ${token}` };

  // Set up settings for GST calculation
  await Setting.create({ companyName: 'NARESH ENTERPRISES', state: 'Maharashtra' });

  const vendor = await Vendor.create({ name: 'Stock Vendor', contact: '9000000004', address: 'Addr' });
  const product = await Product.create({
    name: 'Stock Product',
    category: 'Cleaning',
    unit: 'Bottle',
    price: 150,
    currentStock: 50,
    lowStockThreshold: 5,
    linkedVendor: vendor._id,
    hsnCode: '3402',
  });

  const customer = await Customer.create({
    name: 'Stock Customer',
    mobile: '9444444444',
    address: 'Stock Addr',
    state: 'Maharashtra',
  });

  // Create a quotation
  const quotation = await Quotation.create({
    customer: customer._id,
    items: [{ product: product._id, quantity: 10, price: 150 }],
    totalAmount: 1500,
    validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: 'Sent',
  });

  // Convert quotation to invoice
  const res = await send(server, {
    method: 'POST',
    path: `${API}/quotations/${quotation._id}/convert-invoice`,
    headers,
  });

  assert.equal(res.status, 201, `Should succeed, got ${res.status}: ${JSON.stringify(res.body)}`);

  // Verify stock was deducted
  const updatedProduct = await Product.findById(product._id);
  assert.equal(updatedProduct.currentStock, 40, 'Stock should be decremented from 50 to 40');

  // Verify StockHistory entry was created
  const stockHistoryEntries = await StockHistory.find({ product: product._id });
  assert.ok(stockHistoryEntries.length >= 1, 'StockHistory entry should be created');
  const entry = stockHistoryEntries.find(e => e.type === 'out' && e.quantity === 10);
  assert.ok(entry, 'Should have an "out" entry with quantity 10');
  assert.equal(entry.reason, 'sale');
});

test('quotation-to-invoice: insufficient stock prevents conversion', async (t) => {
  await ensureDb();
  await cleanCollections();
  stubFindById(t);
  const server = await withServer(t);
  const token = signOwnerToken();
  const headers = { Authorization: `Bearer ${token}` };

  await Setting.create({ companyName: 'NARESH ENTERPRISES', state: 'Maharashtra' });

  const vendor = await Vendor.create({ name: 'OOS Vendor', contact: '9000000005', address: 'Addr' });
  const product = await Product.create({
    name: 'OOS Product',
    category: 'Cleaning',
    unit: 'Bottle',
    price: 150,
    currentStock: 3, // Only 3 in stock
    lowStockThreshold: 5,
    linkedVendor: vendor._id,
    hsnCode: '3402',
  });

  const customer = await Customer.create({
    name: 'OOS Customer',
    mobile: '9555555555',
    address: 'OOS Addr',
    state: 'Maharashtra',
  });

  const quotation = await Quotation.create({
    customer: customer._id,
    items: [{ product: product._id, quantity: 10, price: 150 }], // Needs 10, only 3 available
    totalAmount: 1500,
    validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: 'Sent',
  });

  const res = await send(server, {
    method: 'POST',
    path: `${API}/quotations/${quotation._id}/convert-invoice`,
    headers,
  });

  assert.equal(res.status, 400, 'Should reject when stock is insufficient');
  assert.ok(res.body.error.includes('Insufficient stock'), `Error should mention stock, got: ${res.body.error}`);

  // Verify stock was NOT changed
  const unchanged = await Product.findById(product._id);
  assert.equal(unchanged.currentStock, 3, 'Stock should remain unchanged on failure');
});

// ════════════════════════════════════════════════════════════════════
// TEST 4: Payment reminder API endpoint
// ════════════════════════════════════════════════════════════════════
test('POST /payments/reminder returns formatted message without error', async (t) => {
  await ensureDb();
  await cleanCollections();
  stubFindById(t);
  const server = await withServer(t);
  const token = signOwnerToken();
  const headers = { Authorization: `Bearer ${token}` };

  // Create settings with smsTemplates
  await Setting.create({
    companyName: 'NARESH ENTERPRISES',
    smsTemplates: {
      english: 'Dear {customer_name}, your outstanding payment of Rs. {amount} is pending. Please pay at the earliest. Thank you, {company_name}.',
      marathi: 'प्रिय {customer_name}, तुमचे थकीत बिल {amount} रुपये प्रलंबित आहे. कृपया लवकरात लवकर भरणा करावा. धन्यवाद, {company_name}.',
    },
  });

  const customer = await Customer.create({
    name: 'Reminder Customer',
    mobile: '9666666666',
    address: 'Reminder Addr',
  });

  // Test English template
  const res = await send(server, {
    method: 'POST',
    path: `${API}/payments/reminder`,
    headers,
    body: {
      customerId: customer._id.toString(),
      language: 'english',
      outstandingAmount: 5000,
    },
  });

  assert.equal(res.status, 200, `Reminder should succeed, got ${res.status}: ${JSON.stringify(res.body)}`);
  assert.ok(res.body.text, 'Response should include the formatted text');
  assert.ok(res.body.text.includes('Reminder Customer'), 'Text should include customer name');
  assert.ok(res.body.text.includes('5000'), 'Text should include outstanding amount');
  assert.ok(res.body.text.includes('NARESH ENTERPRISES'), 'Text should include company name');
});

test('POST /payments/reminder rejects missing customer', async (t) => {
  await ensureDb();
  await cleanCollections();
  stubFindById(t);
  const server = await withServer(t);
  const token = signOwnerToken();
  const headers = { Authorization: `Bearer ${token}` };

  const res = await send(server, {
    method: 'POST',
    path: `${API}/payments/reminder`,
    headers,
    body: { language: 'english', outstandingAmount: 1000 },
  });

  assert.equal(res.status, 400, 'Should reject when customerId is missing');
});

// ════════════════════════════════════════════════════════════════════
// TEST 5: Customer statement ledger PDF generation
// ════════════════════════════════════════════════════════════════════
test('GET /reports/ledger?pdf=true returns 200 valid PDF for customer with zero transactions', async (t) => {
  await ensureDb();
  await cleanCollections();
  stubFindById(t);
  const server = await withServer(t);
  const token = signOwnerToken();
  const headers = { Authorization: `Bearer ${token}` };

  await Setting.create({ companyName: 'NARESH ENTERPRISES', state: 'Maharashtra' });

  const customer = await Customer.create({
    name: 'Zero Transactions Customer',
    mobile: '9777777777',
    address: 'Zero Tx Addr',
  });

  const res = await send(server, {
    method: 'GET',
    path: `${API}/reports/ledger?customerId=${customer._id.toString()}&pdf=true`,
    headers,
  });

  assert.equal(res.status, 200, `Should return 200, got ${res.status}: ${JSON.stringify(res.body || res.raw)}`);
  assert.ok(res.headers['content-type'].includes('application/pdf'), 'Content-Type should be application/pdf');
  assert.ok(res.raw.startsWith('%PDF'), 'Response body should be a valid PDF starting with %PDF');
});

test('GET /reports/ledger?pdf=true returns 200 valid PDF for customer with transaction history', async (t) => {
  await ensureDb();
  await cleanCollections();
  stubFindById(t);
  const server = await withServer(t);
  const token = signOwnerToken();
  const headers = { Authorization: `Bearer ${token}` };

  await Setting.create({ companyName: 'NARESH ENTERPRISES', state: 'Maharashtra' });

  const vendor = await Vendor.create({ name: 'Statement Vendor', contact: '9000000006', address: 'Addr' });
  const product = await Product.create({
    name: 'Statement Product',
    category: 'Cleaning',
    unit: 'Litre',
    price: 250,
    currentStock: 100,
    lowStockThreshold: 5,
    linkedVendor: vendor._id,
    hsnCode: '3402',
  });

  const customer = await Customer.create({
    name: 'Active Statement Customer',
    mobile: '9888888888',
    address: 'Active Tx Addr',
    creditLimit: 5000,
  });

  // Create an invoice bill
  await Bill.create({
    invoiceNumber: 'STMT-001',
    customer: customer._id,
    items: [{ product: product._id, quantity: 4, price: 250 }],
    subtotal: 1000,
    totalAmount: 1000,
  });

  // Create a payment
  await Payment.create({
    customer: customer._id,
    amountPaid: 400,
    paymentMode: 'UPI',
    referenceNumber: 'UPI-123456',
    date: new Date(),
  });

  const res = await send(server, {
    method: 'GET',
    path: `${API}/reports/ledger?customerId=${customer._id.toString()}&pdf=true`,
    headers,
  });

  assert.equal(res.status, 200, `Should return 200, got ${res.status}: ${JSON.stringify(res.body || res.raw)}`);
  assert.ok(res.headers['content-type'].includes('application/pdf'), 'Content-Type should be application/pdf');
  assert.ok(res.raw.startsWith('%PDF'), 'Response body should be a valid PDF starting with %PDF');
});

test('Regression: POST /purchases with supplierId as populated object succeeds', async (t) => {
  await ensureDb();
  await cleanCollections();
  stubFindById(t);
  const server = await withServer(t);
  const token = signOwnerToken();
  const headers = {
    Authorization: `Bearer ${token}`,
    Origin: 'https://tammewar-pharmacy.pages.dev',
    'Content-Type': 'application/json',
  };

  const branch = await Branch.create({
    name: 'Main Warehouse',
    address: 'Warehouse Lane 1',
    contact: '9111111111',
  });

  const vendor = await Vendor.create({
    name: 'Ansh Ahire',
    contact: '9222222222',
    address: 'Shop 12, Market Yard, Nanded',
    email: 'ansh@vendor.test',
  });

  const product = await Product.create({
    name: 'Phenyl Test',
    category: 'Sanitation',
    unit: 'Bottle',
    price: 150,
    currentStock: 200,
    lowStockThreshold: 15,
    linkedVendor: vendor._id,
    hsnCode: '3808',
  });

  // Exactly matches the reproduced payload where supplierId was a populated object
  const payload = {
    supplierId: {
      _id: vendor._id.toString(),
      name: vendor.name,
    },
    items: [{
      product: product._id.toString(),
      quantity: 15,
      costPrice: 150,
    }],
    expectedDeliveryDate: '2026-09-20',
    branchId: branch._id.toString(),
  };

  const res = await send(server, {
    method: 'POST',
    path: `${API}/purchases`,
    headers,
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 201, `Should return 201 Created, got ${res.status}: ${JSON.stringify(res.body || res.raw)}`);
  assert.ok(res.body?._id, 'Response should include the created purchase order ID');
  assert.equal(res.body.supplier?.toString(), vendor._id.toString(), 'PO supplier should match vendor ID');
  assert.equal(res.body.status, 'Ordered');
  assert.equal(res.body.totalCost, 2250);

  // Verify stored in DB
  const savedPO = await PurchaseOrder.findById(res.body._id);
  assert.ok(savedPO, 'Purchase order should be saved in DB');
  assert.equal(savedPO.supplier.toString(), vendor._id.toString());
  assert.equal(savedPO.items[0].product.toString(), product._id.toString());
  assert.equal(savedPO.items[0].quantity, 15);
});



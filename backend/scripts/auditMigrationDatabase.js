'use strict';

const { MongoClient } = require('mongodb');

const uri = process.env.MIGRATION_SOURCE_URI;
const requestedDatabase = process.env.MIGRATION_DB_NAME;

if (!uri) {
  console.error('[migration-audit] MIGRATION_SOURCE_URI is required');
  process.exit(1);
}

const SYSTEM_DATABASES = new Set(['admin', 'config', 'local']);
const BUSINESS_COLLECTIONS = [
  'users', 'customers', 'vendors', 'products', 'orders', 'bills', 'payments',
  'quotations', 'expenses', 'branches', 'stockhistories', 'stockadjustments',
  'settings', 'jobruns'
];
const REQUIRED_FIELDS = {
  users: ['email', 'password', 'role', 'name', 'mobile'],
  customers: ['name', 'mobile', 'address'],
  vendors: ['name', 'contact', 'address'],
  products: ['name', 'category', 'unit', 'price', 'currentStock', 'linkedVendor'],
  orders: ['customer', 'items', 'totalAmount', 'deliveryDate'],
  bills: ['invoiceNumber', 'customer', 'items', 'subtotal', 'totalAmount'],
  payments: ['customer', 'amountPaid', 'paymentMode'],
  quotations: ['customer', 'items', 'totalAmount', 'validUntil']
};
const SENSITIVE_KEY = /(?:password|token|secret|api[_-]?key|private[_-]?key)/i;
const HASH_PREFIX = /^(?:\$2[aby]\$|\$argon2|\$scrypt\$)/;

function number(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function rounded(value) {
  return Math.round((number(value) + Number.EPSILON) * 100) / 100;
}

function getPath(document, path) {
  return path.split('.').reduce((value, part) => value == null ? undefined : value[part], document);
}

function scanSensitiveFields(value, prefix, result) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (SENSITIVE_KEY.test(key) && child !== null && child !== undefined && child !== '') {
      const item = result[path] || { nonEmpty: 0, recognizedHash: 0, plaintextOrOpaque: 0 };
      item.nonEmpty += 1;
      if (typeof child === 'string' && HASH_PREFIX.test(child)) item.recognizedHash += 1;
      else item.plaintextOrOpaque += 1;
      result[path] = item;
    }
    if (child && typeof child === 'object') scanSensitiveFields(child, path, result);
  }
}

async function collectionExists(db, name) {
  return (await db.listCollections({ name }, { nameOnly: true }).toArray()).length === 1;
}

async function aggregateOne(db, collection, pipeline, fallback = {}) {
  if (!(await collectionExists(db, collection))) return fallback;
  return (await db.collection(collection).aggregate(pipeline).next()) || fallback;
}

async function groupedCounts(db, collection, field) {
  if (!(await collectionExists(db, collection))) return [];
  return db.collection(collection).aggregate([
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $project: { _id: 0, value: { $ifNull: ['$_id', '<missing>'] }, count: 1 } }
  ]).toArray();
}

async function duplicateSummary(db, collection, expression) {
  if (!(await collectionExists(db, collection))) return { groups: 0, documents: 0 };
  const result = await db.collection(collection).aggregate([
    { $project: { value: expression } },
    { $match: { value: { $nin: [null, ''] } } },
    { $group: { _id: '$value', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $group: { _id: null, groups: { $sum: 1 }, documents: { $sum: '$count' } } }
  ]).next();
  return result ? { groups: result.groups, documents: result.documents } : { groups: 0, documents: 0 };
}

async function dateRange(db, collection) {
  if (!(await collectionExists(db, collection))) return null;
  const field = collection === 'payments' ? { $ifNull: ['$date', '$createdAt'] } : '$createdAt';
  const result = await db.collection(collection).aggregate([
    { $group: { _id: null, earliest: { $min: field }, latest: { $max: field } } }
  ]).next();
  return result ? { earliest: result.earliest || null, latest: result.latest || null } : null;
}

async function auditDatabase(client, databaseName) {
  const db = client.db(databaseName);
  const collectionInfo = await db.listCollections({}, { nameOnly: true }).toArray();
  const collectionNames = collectionInfo.map(({ name }) => name).sort();
  const collections = [];
  const indexes = {};

  for (const name of collectionNames) {
    const collection = db.collection(name);
    collections.push({ name, documents: await collection.countDocuments({}) });
    indexes[name] = (await collection.indexes()).map((index) => ({
      name: index.name,
      key: index.key,
      unique: index.unique === true
    }));
  }

  const inventory = await aggregateOne(db, 'products', [{
    $group: {
      _id: null,
      unitsOnHand: { $sum: { $ifNull: ['$currentStock', 0] } },
      unitsReserved: { $sum: { $ifNull: ['$reservedStock', 0] } },
      retailValue: { $sum: { $multiply: [{ $ifNull: ['$currentStock', 0] }, { $ifNull: ['$price', 0] }] } },
      purchaseValue: { $sum: { $multiply: [{ $ifNull: ['$currentStock', 0] }, { $ifNull: ['$purchasePrice', 0] }] } }
    }
  }]);
  const bills = await aggregateOne(db, 'bills', [
    { $lookup: { from: 'payments', localField: '_id', foreignField: 'bill', as: 'recordedPayments' } },
    { $project: {
      totalAmount: { $ifNull: ['$totalAmount', 0] },
      status: 1,
      recordedPaid: { $sum: '$recordedPayments.amountPaid' }
    } },
    { $group: {
      _id: null,
      totalBilled: { $sum: '$totalAmount' },
      outstanding: { $sum: { $cond: [
        { $eq: ['$status', 'Paid'] }, 0,
        { $max: [{ $subtract: ['$totalAmount', '$recordedPaid'] }, 0] }
      ] } }
    } }
  ]);
  const payments = await aggregateOne(db, 'payments', [{
    $group: { _id: null, totalRecorded: { $sum: { $ifNull: ['$amountPaid', 0] } } }
  }]);
  const orders = await aggregateOne(db, 'orders', [{
    $group: { _id: null, totalOrdered: { $sum: { $ifNull: ['$totalAmount', 0] } } }
  }]);
  const expenses = await aggregateOne(db, 'expenses', [{
    $group: { _id: null, totalExpenses: { $sum: { $ifNull: ['$amount', 0] } } }
  }]);

  const duplicates = {
    customerMobile: await duplicateSummary(db, 'customers', '$mobile'),
    userEmail: await duplicateSummary(db, 'users', { $toLower: { $ifNull: ['$email', ''] } }),
    invoiceNumber: await duplicateSummary(db, 'bills', '$invoiceNumber'),
    productName: await duplicateSummary(db, 'products', { $toLower: { $trim: { input: { $ifNull: ['$name', ''] } } } })
  };

  const demoPattern = /(?:^|\b)(?:test|demo|dummy|sample|faker)(?:\b|$)/i;
  const seededCustomerNames = ['City Hospital', 'Green Cross Clinic', 'Dr. Sharma', 'Wellness Pharmacy', 'Apex Care Center', 'LifeLine Hospital'];
  const seededProductNames = ['Paracetamol 500mg', 'Amoxicillin 250mg', 'Cetirizine 10mg', 'Vitamin C 1000mg', 'Ibuprofen 400mg', 'Omeprazole 20mg', 'Aspirin 75mg', 'Cough Syrup 100ml', 'Bandages Pack', 'Surgical Masks (Box of 50)', 'Hand Sanitizer 500ml', 'Digital Thermometer'];
  const demoIndicators = {};
  for (const [collection, filter] of Object.entries({
    users: { $or: [{ name: demoPattern }, { email: demoPattern }] },
    customers: { $or: [{ name: demoPattern }, { name: { $in: seededCustomerNames } }] },
    vendors: { $or: [{ name: demoPattern }, { name: { $in: ['PharmaCorp', 'MediLife Supplies', 'HealthCare Distributors', 'Global Meds'] } }] },
    products: { $or: [{ name: demoPattern }, { name: { $in: seededProductNames } }] },
    branches: { $or: [{ name: demoPattern }, { name: /^Branch [123] - (?:North|South|East) Zone$/ }] }
  })) {
    demoIndicators[collection] = await collectionExists(db, collection)
      ? await db.collection(collection).countDocuments(filter)
      : 0;
  }

  const credentialRisks = {};
  for (const name of collectionNames) {
    const fields = {};
    const cursor = db.collection(name).find({});
    for await (const document of cursor) scanSensitiveFields(document, '', fields);
    if (Object.keys(fields).length) credentialRisks[name] = fields;
  }

  const dateRanges = {};
  for (const name of BUSINESS_COLLECTIONS.filter((candidate) => collectionNames.includes(candidate))) {
    dateRanges[name] = await dateRange(db, name);
  }

  const representativeReview = [];
  for (const name of BUSINESS_COLLECTIONS.filter((candidate) => collectionNames.includes(candidate))) {
    if (representativeReview.length >= 10) break;
    const remaining = 10 - representativeReview.length;
    const documents = await db.collection(name).find({}).limit(Math.min(2, remaining)).toArray();
    for (const document of documents) {
      const required = REQUIRED_FIELDS[name] || [];
      representativeReview.push({
        collection: name,
        keyCount: Object.keys(document).length,
        missingRequiredFields: required.filter((field) => getPath(document, field) == null),
        sensitiveFieldPresent: Object.keys(document).some((key) => SENSITIVE_KEY.test(key))
      });
    }
  }

  return {
    database: databaseName,
    collections,
    businessTotals: {
      inventory: {
        unitsOnHand: rounded(inventory.unitsOnHand),
        unitsReserved: rounded(inventory.unitsReserved),
        retailValue: rounded(inventory.retailValue),
        purchaseValue: rounded(inventory.purchaseValue)
      },
      totalBilled: rounded(bills.totalBilled),
      outstandingBalance: rounded(bills.outstanding),
      totalPaymentsRecorded: rounded(payments.totalRecorded),
      totalOrdered: rounded(orders.totalOrdered),
      totalExpenses: rounded(expenses.totalExpenses)
    },
    statuses: {
      usersByRole: await groupedCounts(db, 'users', 'role'),
      usersByStatus: await groupedCounts(db, 'users', 'status'),
      bills: await groupedCounts(db, 'bills', 'status'),
      orders: await groupedCounts(db, 'orders', 'status')
    },
    duplicates,
    demoIndicators,
    credentialRisks,
    dateRanges,
    indexes,
    representativeReview
  };
}

async function main() {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000, appName: 'tammewar-migration-audit' });
  try {
    await client.connect();
    const names = requestedDatabase
      ? [requestedDatabase]
      : (await client.db('admin').admin().listDatabases({ nameOnly: true })).databases
          .map(({ name }) => name)
          .filter((name) => !SYSTEM_DATABASES.has(name));
    const reports = [];
    for (const name of names) reports.push(await auditDatabase(client, name));
    console.log(JSON.stringify({ generatedAt: new Date().toISOString(), reports }, null, 2));
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(`[migration-audit] ${error.message}`);
  process.exitCode = 1;
});

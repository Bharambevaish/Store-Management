/**
 * Phase 8: inventory a database so it can be judged authoritative, cleaned,
 * and later reconciled against the migrated copy.
 *
 * This is strictly read-only. It never writes, drops, or modifies anything, so
 * it is safe to point at a candidate source database, at production, or at a
 * restored verification copy.
 *
 *   AUDIT_MONGO_URI='<uri ending /<database>>' node scripts/auditDatabase.js
 *   AUDIT_MONGO_URI='...' node scripts/auditDatabase.js --json > audit.json
 *
 * Run it against every candidate before deciding which database is
 * authoritative — the task list warns specifically against assuming the
 * currently connected one is.
 *
 * What it reports:
 *   - every collection with its document count and storage size
 *   - the business totals that must match after migration
 *   - indexes and uniqueness constraints
 *   - demo/test-looking records and unused accounts
 *   - any field that looks like a plaintext credential or provider token
 *
 * Counts and totals are printed; customer-identifying values are not.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { redact } = require('../src/services/logger');

const asJson = process.argv.includes('--json');

// Field names that should never hold a readable secret in a document.
const CREDENTIAL_FIELD = /^(password|passwd|pwd|secret|token|apikey|api_key|accesstoken|refreshtoken|whatsapptoken|razorpaykey|razorpaysecret|privatekey|clientsecret)$/i;
// A bcrypt hash is expected in `password`; anything else there is plaintext.
const BCRYPT_HASH = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
const DEMO_MARKER = /\b(test|demo|sample|dummy|example|lorem|asdf|qwerty|foobar|xxx+)\b/i;

const fail = (message) => {
  const error = new Error(message);
  error.expected = true;
  throw error;
};

// Returns '' when the URI names no database. That is a supported way to run
// the script: it then lists what the cluster holds so the right source
// database can be chosen on evidence rather than guessed.
const databaseFrom = (uri, { required = true } = {}) => {
  let parsed;
  try {
    parsed = new URL(uri);
  } catch (_err) {
    return fail('AUDIT_MONGO_URI is not a valid connection string');
  }
  const name = decodeURIComponent(parsed.pathname.replace(/^\//, '').split('/')[0] || '');
  if (!name && required) fail('AUDIT_MONGO_URI must name the database to audit');
  return name;
};

/** Lists the databases on the cluster with their sizes, then stops. */
const listDatabases = async () => {
  const { databases } = await mongoose.connection.db.admin().command({ listDatabases: 1 });
  const business = databases
    .filter((d) => !['admin', 'local', 'config'].includes(d.name))
    .sort((a, b) => (b.sizeOnDisk || 0) - (a.sizeOnDisk || 0));

  console.log('\nAUDIT_MONGO_URI names no database, so nothing was audited.');
  console.log('This cluster holds:\n');
  console.log('Database'.padEnd(34) + 'Size on disk'.padStart(14));
  console.log('-'.repeat(48));
  for (const d of business) {
    const mb = d.sizeOnDisk == null ? 'unknown' : `${(d.sizeOnDisk / 1048576).toFixed(2)} MB`;
    console.log(d.name.padEnd(34) + mb.padStart(14));
  }
  if (!business.length) console.log('(no application databases)');
  console.log('\nAdd the chosen name to the end of the URI path and re-run.');
};

// Field names come from the Mongoose models in src/models, not from guesses.
// A total that silently reads 0 because the field does not exist is worse than
// no total at all, so `sumField` reports how many documents actually carried a
// numeric value alongside the sum.
const sumField = async (db, collection, field, filter = {}) => {
  const [row] = await db.collection(collection).aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        total: { $sum: `$${field}` },
        present: { $sum: { $cond: [{ $isNumber: `$${field}` }, 1, 0] } },
        documents: { $sum: 1 },
      },
    },
  ]).toArray();
  return {
    total: Number((row?.total || 0).toFixed(2)),
    present: row?.present || 0,
    documents: row?.documents || 0,
  };
};

const sumProduct = async (db, collection, fieldA, fieldB) => {
  const [row] = await db.collection(collection).aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: { $multiply: [{ $ifNull: [`$${fieldA}`, 0] }, { $ifNull: [`$${fieldB}`, 0] }] } },
      },
    },
  ]).toArray();
  return Number((row?.total || 0).toFixed(2));
};

// Flags a total whose field was missing from every document, so a misnamed
// field shows up as a finding rather than as a confident zero.
const recordTotal = (report, key, result) => {
  report.businessTotals[key] = result.total;
  if (result.documents > 0 && result.present === 0) {
    report.findings.push({
      severity: 'high',
      collection: key,
      issue: 'total could not be computed',
      note: `No document carried a numeric value for this field across ${result.documents} documents. The field name is wrong for this schema; do not reconcile against this zero.`,
    });
  }
};

const collectionExists = (names, name) => names.includes(name);

/** Walks a document and reports paths that look like readable credentials. */
const findCredentialPaths = (value, path = '', found = [], depth = 0) => {
  if (depth > 8 || value === null || typeof value !== 'object') return found;
  for (const [key, child] of Object.entries(value)) {
    const here = path ? `${path}.${key}` : key;
    if (CREDENTIAL_FIELD.test(key) && typeof child === 'string' && child) {
      // A bcrypt hash in `password` is the expected, correct state.
      const hashed = /^password$/i.test(key) && BCRYPT_HASH.test(child);
      if (!hashed) found.push(here);
    }
    findCredentialPaths(child, here, found, depth + 1);
  }
  return found;
};

const scanCollection = async (db, name, sampleSize) => {
  const docs = await db.collection(name).find({}, { limit: sampleSize }).toArray();
  const credentialPaths = new Set();
  let demoLooking = 0;

  for (const doc of docs) {
    findCredentialPaths(doc).forEach((p) => credentialPaths.add(p));
    // Only short, name-like strings are checked, so a legitimate note that
    // happens to contain "sample" in prose is not flagged.
    const candidate = [doc.name, doc.companyName, doc.email, doc.title, doc.productName]
      .filter((v) => typeof v === 'string' && v.length <= 120);
    if (candidate.some((v) => DEMO_MARKER.test(v))) demoLooking += 1;
  }

  return {
    sampled: docs.length,
    credentialFields: [...credentialPaths].sort(),
    demoLookingSampled: demoLooking,
  };
};

const main = async () => {
  const uri = process.env.AUDIT_MONGO_URI || '';
  if (!uri) fail('AUDIT_MONGO_URI is required');
  const expectedDb = databaseFrom(uri, { required: false });

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000, maxPoolSize: 1 });
  if (!expectedDb) {
    await listDatabases();
    return;
  }

  const db = mongoose.connection.db;
  if (db.databaseName !== expectedDb) fail('Connected to an unexpected database');

  const report = {
    database: db.databaseName,
    generatedAt: new Date().toISOString(),
    collections: {},
    indexes: {},
    businessTotals: {},
    findings: [],
  };

  const infos = await db.listCollections({}, { nameOnly: false }).toArray();
  const names = infos.map((c) => c.name).sort();
  report.collectionCount = names.length;

  for (const name of names) {
    const collection = db.collection(name);
    const count = await collection.countDocuments();
    let storageBytes = null;
    try {
      const [stats] = await collection.aggregate([
        { $collStats: { storageStats: {} } },
      ]).toArray();
      storageBytes = stats?.storageStats?.size ?? null;
    } catch (_err) {
      // $collStats is unavailable to some least-privilege roles; counts still work.
    }
    report.collections[name] = { documents: count, storageBytes };

    const indexes = await collection.indexes();
    report.indexes[name] = indexes.map((index) => ({
      name: index.name,
      key: index.key,
      unique: Boolean(index.unique),
    }));

    if (count > 0) {
      const scan = await scanCollection(db, name, Math.min(count, 500));
      if (scan.credentialFields.length) {
        report.findings.push({
          severity: 'high',
          collection: name,
          issue: 'readable credential-shaped field',
          fields: scan.credentialFields,
          note: 'A password must be a bcrypt hash; provider tokens must not be migrated.',
        });
      }
      if (scan.demoLookingSampled > 0) {
        report.findings.push({
          severity: 'medium',
          collection: name,
          issue: 'demo or test-looking records',
          matched: scan.demoLookingSampled,
          sampled: scan.sampled,
          note: 'Review and remove before migration.',
        });
      }
    }
  }

  // The figures that must match exactly on the destination.
  const totals = report.businessTotals;
  if (collectionExists(names, 'products')) {
    totals.productCount = report.collections.products.documents;
    recordTotal(report, 'stockUnits', await sumField(db, 'products', 'currentStock'));
    // Inventory value at cost, matching how the stock report values it.
    totals.stockValueAtCost = await sumProduct(db, 'products', 'currentStock', 'purchasePrice');
    totals.stockValueAtSale = await sumProduct(db, 'products', 'currentStock', 'price');
  }
  if (collectionExists(names, 'customers')) totals.customerCount = report.collections.customers.documents;
  if (collectionExists(names, 'bills')) {
    totals.billCount = report.collections.bills.documents;
    recordTotal(report, 'billedAmount', await sumField(db, 'bills', 'totalAmount'));
  }
  if (collectionExists(names, 'payments')) {
    totals.paymentCount = report.collections.payments.documents;
    recordTotal(report, 'paidAmount', await sumField(db, 'payments', 'amountPaid'));
  }
  if (totals.billedAmount !== undefined && totals.paidAmount !== undefined) {
    totals.outstandingBalance = Number((totals.billedAmount - totals.paidAmount).toFixed(2));
  }
  if (collectionExists(names, 'orders')) totals.orderCount = report.collections.orders.documents;
  if (collectionExists(names, 'users')) {
    const users = await db.collection('users').find({}, { projection: { role: 1, status: 1 } }).toArray();
    totals.userCount = users.length;
    totals.usersByRole = users.reduce((acc, u) => {
      const key = `${u.role || 'unknown'}/${u.status || 'unknown'}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    if (users.length > 1) {
      report.findings.push({
        severity: 'high',
        collection: 'users',
        issue: 'more than one account exists',
        count: users.length,
        note: 'The production pilot must have exactly one owner account.',
      });
    }
  }

  report.totalDocuments = Object.values(report.collections)
    .reduce((sum, c) => sum + c.documents, 0);

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`\nDatabase: ${report.database}`);
    console.log(`Collections: ${report.collectionCount}   Documents: ${report.totalDocuments}\n`);
    console.log('Collection'.padEnd(28) + 'Documents'.padStart(10) + '   Unique indexes');
    console.log('-'.repeat(72));
    for (const [name, info] of Object.entries(report.collections)) {
      const unique = report.indexes[name].filter((i) => i.unique).map((i) => i.name).join(', ') || '-';
      console.log(name.padEnd(28) + String(info.documents).padStart(10) + '   ' + unique);
    }
    console.log('\nBusiness totals to reconcile after migration:');
    for (const [key, value] of Object.entries(report.businessTotals)) {
      console.log(`  ${key.padEnd(24)} ${typeof value === 'object' ? JSON.stringify(value) : value}`);
    }
    console.log(`\nFindings: ${report.findings.length}`);
    for (const finding of report.findings) {
      console.log(`  [${finding.severity}] ${finding.collection}: ${finding.issue}`);
      if (finding.fields) console.log(`      fields: ${finding.fields.join(', ')}`);
      if (finding.matched !== undefined) console.log(`      ${finding.matched} of ${finding.sampled} sampled`);
      console.log(`      ${finding.note}`);
    }
    console.log('\nRe-run with --json and keep the output; it is the baseline the');
    console.log('post-migration reconciliation is compared against.');
  }
};

if (require.main === module) {
  run();
}

module.exports = { findCredentialPaths, databaseFrom, CREDENTIAL_FIELD, BCRYPT_HASH, DEMO_MARKER };

function run() {
  main()
  .catch((err) => {
    console.error(`[audit] ${redact(err.expected ? err.message : `${err.name}: ${err.message}`)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
}

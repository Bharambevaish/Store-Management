/**
 * Phase 9: restore an encrypted backup into an isolated database and report
 * what came back.
 *
 * A backup is not a backup until it has been restored. This decrypts an
 * archive, verifies its manifest digest, restores it into a *separate*
 * verification database, and prints per-collection document counts so they can
 * be compared against the production figures.
 *
 *   RESTORE_MONGO_URI=<atlas uri, pointing at the verification database> \
 *   RESTORE_ARCHIVE=/path/to/tammewar-....archive.gz.enc \
 *   node scripts/restoreBackup.js
 *
 * The target database must not be the production one; the script refuses to
 * run if it is, so a verification drill can never overwrite live data.
 */
require('dotenv').config();
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const mongoose = require('mongoose');

const { decryptFile } = require('./lib/archiveCrypto');
const { promptSecret } = require('./lib/promptSecret');
const { redact } = require('../src/services/logger');

const PRODUCTION_DATABASE = 'tammewar_pharmacy_prod';

const fail = (message) => {
  const error = new Error(message);
  error.expected = true;
  throw error;
};

const databaseFrom = (uri) => {
  let parsed;
  try {
    parsed = new URL(uri);
  } catch (_err) {
    return fail('RESTORE_MONGO_URI is not a valid connection string');
  }
  const name = decodeURIComponent(parsed.pathname.replace(/^\//, '').split('/')[0] || '');
  if (!name) fail('RESTORE_MONGO_URI must name the verification database');
  return name;
};

const sha256Of = (filePath) => new Promise((resolve, reject) => {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);
  stream.on('data', (chunk) => hash.update(chunk));
  stream.on('error', reject);
  stream.on('end', () => resolve(hash.digest('hex')));
});

const spawnMongorestore = (args) => new Promise((resolve, reject) => {
  const child = spawn('mongorestore', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stdout.on('data', () => {});
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  child.on('error', (err) => reject(
    err.code === 'ENOENT'
      ? new Error('mongorestore was not found. Install the MongoDB Database Tools on this device.')
      : err,
  ));
  child.on('close', (code) => (code === 0
    ? resolve()
    : reject(new Error(`mongorestore exited with code ${code}: ${redact(stderr).trim().slice(-800) || 'no diagnostics'}`))));
});

const runMongorestore = async ({ uri, archivePath, sourceDatabase, targetDatabase, scratch }) => {
  const configPath = path.join(scratch, 'mongorestore.config.yaml');
  // The database must be stripped from the URI. If mongorestore is given both a
  // database in the connection string and an --nsFrom/--nsTo remap, it filters
  // the archive to the URI's database name — which is the *target*, a name the
  // archive never contains — and silently restores nothing.
  const clusterUri = new URL(uri);
  clusterUri.pathname = '/';
  await fs.promises.writeFile(configPath, `uri: ${JSON.stringify(clusterUri.toString())}\n`, { mode: 0o600 });
  try {
    await spawnMongorestore([
      `--config=${configPath}`,
      `--archive=${archivePath}`,
      '--gzip',
      // Redirect the dump's namespaces into the verification database.
      `--nsFrom=${sourceDatabase}.*`,
      `--nsTo=${targetDatabase}.*`,
      // Atlas manages its own users and roles; a dump must never reintroduce them.
      '--nsExclude=admin.*',
      '--drop',
    ]);
  } finally {
    await fs.promises.rm(configPath, { force: true });
  }
};

const readManifest = async (archivePath) => {
  const manifestPath = archivePath.replace(/\.archive\.gz\.enc$/, '.manifest.json');
  try {
    return JSON.parse(await fs.promises.readFile(manifestPath, 'utf8'));
  } catch (_err) {
    return null;
  }
};

/**
 * Decides whether a completed mongorestore actually restored the archive.
 *
 * mongorestore can exit 0 having written nothing — that is how the first drill
 * of this tooling passed while producing an empty database. Success therefore
 * has to be asserted from the resulting counts, never inferred from the exit
 * code.
 */
const assertRestoreComplete = (counts, manifest) => {
  const restoredDocuments = Object.values(counts).reduce((total, count) => total + count, 0);
  if (restoredDocuments === 0) {
    fail(`Restore produced an empty database. ${Object.keys(counts).length} collection(s), 0 documents. Do not treat this backup as verified.`);
  }
  if (manifest?.sourceDocuments !== undefined && manifest.sourceDocuments !== restoredDocuments) {
    fail(`Document count mismatch: the archive was taken from ${manifest.sourceDocuments} documents but ${restoredDocuments} were restored. Do not treat this backup as verified.`);
  }
  return restoredDocuments;
};

const main = async () => {
  const uri = process.env.RESTORE_MONGO_URI || '';
  const archivePath = process.env.RESTORE_ARCHIVE || '';
  if (!uri) fail('RESTORE_MONGO_URI is required');
  if (!archivePath) fail('RESTORE_ARCHIVE is required');
  if (!fs.existsSync(archivePath)) fail(`No archive at ${archivePath}`);

  const targetDatabase = databaseFrom(uri);
  if (targetDatabase === PRODUCTION_DATABASE) {
    fail(`Refusing to restore into ${PRODUCTION_DATABASE}. Point RESTORE_MONGO_URI at an isolated verification database.`);
  }

  const manifest = await readManifest(archivePath);
  const sourceDatabase = manifest?.database || PRODUCTION_DATABASE;

  if (manifest?.sha256) {
    const actual = await sha256Of(archivePath);
    if (actual !== manifest.sha256) {
      fail('The archive digest does not match its manifest. Treat this copy as damaged and use another generation.');
    }
  }

  const passphrase = process.env.BACKUP_PASSPHRASE
    || await promptSecret('Archive passphrase: ');

  const scratch = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'tammewar-restore-'));
  const plaintextPath = path.join(scratch, 'dump.archive.gz');

  let counts;
  try {
    await decryptFile({ sourcePath: archivePath, targetPath: plaintextPath, passphrase });
    await runMongorestore({ uri, archivePath: plaintextPath, sourceDatabase, targetDatabase, scratch });

    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000, maxPoolSize: 1 });
    const collections = await mongoose.connection.db.listCollections({}, { nameOnly: true }).toArray();
    counts = {};
    for (const { name } of collections.sort((a, b) => a.name.localeCompare(b.name))) {
      counts[name] = await mongoose.connection.db.collection(name).countDocuments();
    }
  } finally {
    await mongoose.disconnect().catch(() => {});
    // The decrypted dump is removed whether the restore succeeded or not.
    await fs.promises.rm(scratch, { recursive: true, force: true });
  }

  const restoredDocuments = assertRestoreComplete(counts, manifest);

  console.log(JSON.stringify({
    restore: 'ok',
    archive: path.basename(archivePath),
    manifestVerified: Boolean(manifest?.sha256),
    sourceDatabase,
    targetDatabase,
    collections: Object.keys(counts).length,
    documents: restoredDocuments,
    sourceDocuments: manifest?.sourceDocuments ?? 'unknown (manifest predates count recording)',
    countsMatchSource: manifest?.sourceDocuments === restoredDocuments,
    counts,
  }, null, 2));
  console.log('\nCompare these counts and the business totals against production, then drop the');
  console.log('verification database. Record the date in the operations log; Phase 16 repeats this quarterly.');
};

if (require.main === module) {
  main().catch((err) => {
    console.error(`[restore] ${redact(err.expected ? err.message : `${err.name}: ${err.message}`)}`);
    process.exitCode = 1;
  });
}

module.exports = { databaseFrom, assertRestoreComplete, PRODUCTION_DATABASE };

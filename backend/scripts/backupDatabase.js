/**
 * Phase 9: produce an encrypted, off-platform backup of the production
 * database.
 *
 * Run this on a trusted administrator device that has MongoDB Database Tools
 * installed and whose public IP is allowlisted in Atlas. Atlas Free has no
 * managed backup, so this is the only copy of the pharmacy's data that exists
 * outside the cluster.
 *
 *   BACKUP_MONGO_URI=<atlas uri for the backup user> \
 *   BACKUP_DIR=/path/to/backups \
 *   node scripts/backupDatabase.js
 *
 * The archive passphrase is read from an interactive prompt, or from
 * BACKUP_PASSPHRASE for an unattended run. The connection string is handed to
 * `mongodump` through a private config file rather than argv, so the database
 * password is not visible in the process list, and every diagnostic printed
 * here has credentials stripped from it.
 */
require('dotenv').config();
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const mongoose = require('mongoose');

const { encryptFile } = require('./lib/archiveCrypto');
const { redact } = require('../src/services/logger');
const { promptSecret } = require('./lib/promptSecret');

// 7 daily, 4 weekly, 3 monthly, as required by the task list.
const RETENTION = { daily: 7, weekly: 4, monthly: 3 };
const ARCHIVE_PATTERN = /^tammewar-(\d{4})-(\d{2})-(\d{2})T(\d{2})(\d{2})(\d{2})Z\.archive\.gz\.enc$/;

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
    return fail('BACKUP_MONGO_URI is not a valid connection string');
  }
  const name = decodeURIComponent(parsed.pathname.replace(/^\//, '').split('/')[0] || '');
  if (!name) fail('BACKUP_MONGO_URI must name the database to dump');
  return name;
};

const spawnMongodump = (configPath, archivePath) => new Promise((resolve, reject) => {
  const child = spawn('mongodump', [`--config=${configPath}`, `--archive=${archivePath}`, '--gzip'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';
  child.stdout.on('data', () => {});
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

  child.on('error', (err) => reject(
    err.code === 'ENOENT'
      ? new Error('mongodump was not found. Install the MongoDB Database Tools on this device.')
      : err,
  ));
  child.on('close', (code) => {
    if (code === 0) return resolve();
    // mongodump echoes the connection string in some diagnostics, so its
    // credentials are stripped before anything is shown.
    return reject(new Error(`mongodump exited with code ${code}: ${redact(stderr).trim().slice(-800) || 'no diagnostics'}`));
  });
});

/**
 * MongoDB Database Tools read `uri` from a `--config` YAML file. Using it keeps
 * the credential out of argv, where any local process could read it from the
 * process list.
 */
const runMongodump = async ({ uri, archivePath, scratch }) => {
  const configPath = path.join(scratch, 'mongodump.config.yaml');
  // JSON-quoting the URI keeps YAML from reinterpreting the ? & : @ characters
  // an Atlas connection string contains.
  await fs.promises.writeFile(configPath, `uri: ${JSON.stringify(uri)}\n`, { mode: 0o600 });
  try {
    await spawnMongodump(configPath, archivePath);
  } finally {
    await fs.promises.rm(configPath, { force: true });
  }
};

// 2026-08-21T09:30:15.123Z -> 2026-08-21T093015Z: sortable, filename-safe, and
// matched by ARCHIVE_PATTERN above.
/**
 * Counts the source documents so the manifest can state what the archive was
 * taken from. Without this the restore drill can only report what came back,
 * with nothing to compare it against.
 */
const countSourceDocuments = async (uri) => {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000, maxPoolSize: 1 });
  try {
    const db = mongoose.connection.db;
    const collections = await db.listCollections({}, { nameOnly: true }).toArray();
    const counts = {};
    for (const { name } of collections.sort((a, b) => a.name.localeCompare(b.name))) {
      counts[name] = await db.collection(name).countDocuments();
    }
    return { counts, total: Object.values(counts).reduce((sum, n) => sum + n, 0) };
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
};

const timestampFor = (date) => date.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/:/g, '');

const parseArchiveDate = (fileName) => {
  const match = ARCHIVE_PATTERN.exec(fileName);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  return new Date(Date.UTC(+year, +month - 1, +day, +hour, +minute, +second));
};

/**
 * Chooses which archives to keep under a grandfather-father-son policy: the
 * newest N dailies, then one per ISO week, then one per calendar month.
 */
const planRetention = (fileNames, now) => {
  const archives = fileNames
    .map((name) => ({ name, at: parseArchiveDate(name) }))
    .filter((entry) => entry.at)
    .sort((a, b) => b.at - a.at);

  const keep = new Set();
  archives.slice(0, RETENTION.daily).forEach((entry) => keep.add(entry.name));

  const weekKey = (date) => {
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    start.setUTCDate(start.getUTCDate() - start.getUTCDay());
    return start.toISOString().slice(0, 10);
  };
  const monthKey = (date) => date.toISOString().slice(0, 7);

  const newestPer = (keyOf, limit) => {
    const seen = new Map();
    for (const entry of archives) {
      const key = keyOf(entry.at);
      if (!seen.has(key)) seen.set(key, entry);
    }
    [...seen.values()].sort((a, b) => b.at - a.at).slice(0, limit)
      .forEach((entry) => keep.add(entry.name));
  };
  newestPer(weekKey, RETENTION.weekly);
  newestPer(monthKey, RETENTION.monthly);

  return {
    keep: archives.filter((entry) => keep.has(entry.name)).map((entry) => entry.name),
    prune: archives.filter((entry) => !keep.has(entry.name) && entry.at < now).map((entry) => entry.name),
  };
};

const main = async () => {
  const uri = process.env.BACKUP_MONGO_URI || '';
  const backupDir = process.env.BACKUP_DIR || '';
  if (!uri) fail('BACKUP_MONGO_URI is required');
  if (!backupDir) fail('BACKUP_DIR is required');

  const database = databaseFrom(uri);
  await fs.promises.mkdir(backupDir, { recursive: true });

  const passphrase = process.env.BACKUP_PASSPHRASE
    || await promptSecret('Archive passphrase (20+ characters, from the password manager): ');

  const startedAt = new Date();
  const stamp = timestampFor(startedAt);
  const encryptedPath = path.join(backupDir, `tammewar-${stamp}.archive.gz.enc`);
  const manifestPath = path.join(backupDir, `tammewar-${stamp}.manifest.json`);

  // The plaintext dump lives only in a private temporary directory and is
  // removed whether or not encryption succeeds.
  const scratch = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'tammewar-dump-'));
  const plaintextPath = path.join(scratch, 'dump.archive.gz');

  // Counted before the dump so the figure describes the same data mongodump
  // is about to read. A busy source could still drift between the two; for a
  // single-owner pharmacy taking a nightly backup, it will not.
  const source = await countSourceDocuments(uri);

  let manifest;
  try {
    await runMongodump({ uri, archivePath: plaintextPath, scratch });
    const encrypted = await encryptFile({ sourcePath: plaintextPath, targetPath: encryptedPath, passphrase });

    manifest = {
      archive: path.basename(encryptedPath),
      database,
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      plaintextBytes: encrypted.plaintextBytes,
      ciphertextBytes: encrypted.ciphertextBytes,
      sha256: encrypted.sha256,
      sourceCollections: Object.keys(source.counts).length,
      sourceDocuments: source.total,
      sourceCounts: source.counts,
      cipher: 'aes-256-gcm',
      keyDerivation: 'scrypt',
      toolVersion: 1,
    };
    await fs.promises.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  } finally {
    await fs.promises.rm(scratch, { recursive: true, force: true });
  }

  const entries = await fs.promises.readdir(backupDir);
  const { keep, prune } = planRetention(entries, new Date());
  for (const name of prune) {
    await fs.promises.rm(path.join(backupDir, name), { force: true });
    await fs.promises.rm(path.join(backupDir, name.replace('.archive.gz.enc', '.manifest.json')), { force: true });
  }

  console.log(JSON.stringify({
    backup: 'ok',
    ...manifest,
    generationsRetained: keep.length,
    generationsPruned: prune.length,
  }, null, 2));
  console.log('\nCopy this archive to the off-site location. The passphrase is not stored with it;');
  console.log('a backup is not verified until scripts/restoreBackup.js has restored it successfully.');
};

if (require.main === module) {
  main().catch((err) => {
    // Every message is redacted before printing: a driver or tools error can
    // quote the connection string it failed on.
    console.error(`[backup] ${redact(err.expected ? err.message : `${err.name}: ${err.message}`)}`);
    process.exitCode = 1;
  });
}

module.exports = { planRetention, parseArchiveDate, timestampFor, RETENTION };

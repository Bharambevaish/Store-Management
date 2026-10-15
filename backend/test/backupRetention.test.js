/**
 * Phase 9 retention and restore-guard tests.
 *
 * Retention is the part of a backup policy that quietly destroys data if it is
 * wrong, so the selection is unit-tested rather than trusted.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { planRetention, parseArchiveDate, timestampFor, RETENTION } = require('../scripts/backupDatabase');
const { databaseFrom, assertRestoreComplete, PRODUCTION_DATABASE } = require('../scripts/restoreBackup');

const archiveName = (isoDate) => `tammewar-${timestampFor(new Date(isoDate))}.archive.gz.enc`;

// One archive per day for a year, newest last.
const dailySeries = (endIso, days) => {
  const end = new Date(endIso).getTime();
  return Array.from({ length: days }, (_, index) =>
    archiveName(new Date(end - index * 86_400_000).toISOString()));
};

test('an archive name round-trips through its timestamp', () => {
  const at = new Date('2026-08-21T09:30:15.123Z');
  const name = archiveName(at.toISOString());
  assert.equal(name, 'tammewar-2026-08-21T093015Z.archive.gz.enc');
  assert.equal(parseArchiveDate(name).toISOString(), '2026-08-21T09:30:15.000Z');
});

test('unrelated files in the backup directory are never pruned', () => {
  const now = new Date('2026-08-21T00:00:00Z');
  const { keep, prune } = planRetention([
    'notes.txt',
    'tammewar-20260821T000000Z.manifest.json',
    'someone-elses-backup.tar.gz',
    archiveName('2026-08-21T00:00:00Z'),
  ], now);

  assert.deepEqual(keep, [archiveName('2026-08-21T00:00:00Z')]);
  assert.deepEqual(prune, [], 'only recognised archives are candidates for deletion');
});

test('a short history is kept in full', () => {
  const now = new Date('2026-08-21T12:00:00Z');
  const names = dailySeries('2026-08-21T00:00:00Z', 5);
  const { keep, prune } = planRetention(names, now);
  assert.equal(keep.length, 5);
  assert.deepEqual(prune, []);
});

test('a year of dailies collapses to the 7/4/3 policy', () => {
  const now = new Date('2026-08-21T12:00:00Z');
  const names = dailySeries('2026-08-21T00:00:00Z', 365);
  const { keep, prune } = planRetention(names, now);

  assert.equal(keep.length + prune.length, 365, 'every archive is either kept or pruned');
  assert.ok(keep.length <= RETENTION.daily + RETENTION.weekly + RETENTION.monthly);
  assert.ok(keep.length >= RETENTION.daily, 'the daily window is always satisfied');

  // The seven most recent days survive intact.
  for (const name of dailySeries('2026-08-21T00:00:00Z', RETENTION.daily)) {
    assert.ok(keep.includes(name), `${name} is inside the daily window and must be kept`);
  }

  // Coverage reaches back beyond the daily window.
  const oldest = keep.map(parseArchiveDate).sort((a, b) => a - b)[0];
  const daysBack = (now - oldest) / 86_400_000;
  assert.ok(daysBack > 30, `retention must reach past a month, reached ${Math.round(daysBack)} days`);
});

test('a gappy history still keeps the newest generations', () => {
  const now = new Date('2026-08-21T12:00:00Z');
  const names = [
    archiveName('2026-08-20T02:00:00Z'),
    archiveName('2026-08-13T02:00:00Z'),
    archiveName('2026-07-04T02:00:00Z'),
    archiveName('2026-02-01T02:00:00Z'),
    archiveName('2025-11-11T02:00:00Z'),
  ];
  const { keep, prune } = planRetention(names, now);
  assert.ok(keep.includes(archiveName('2026-08-20T02:00:00Z')));
  assert.equal(keep.length + prune.length, names.length);
});

test('a future-dated archive is never pruned', () => {
  // Clock skew on the backup device must not delete a real generation.
  const now = new Date('2026-08-21T12:00:00Z');
  const names = [...dailySeries('2026-08-21T00:00:00Z', 40), archiveName('2027-01-01T00:00:00Z')];
  const { prune } = planRetention(names, now);
  assert.equal(prune.includes(archiveName('2027-01-01T00:00:00Z')), false);
});

test('the restore target database is parsed from its URI', () => {
  assert.equal(
    databaseFrom('mongodb+srv://u:p@cluster.example.mongodb.net/tammewar_restore_check?retryWrites=true'),
    'tammewar_restore_check',
  );
  assert.throws(
    () => databaseFrom('mongodb+srv://u:p@cluster.example.mongodb.net/'),
    /must name the verification database/,
  );
  assert.throws(() => databaseFrom('not-a-uri'), /not a valid connection string/);
  assert.equal(PRODUCTION_DATABASE, 'tammewar_pharmacy_prod');
});

// mongorestore can exit 0 having written nothing. The first real drill of this
// tooling did exactly that — the target database was passed in the connection
// string as well as in --nsTo, so the archive's namespaces matched nothing and
// an empty restore was reported as a success. These lock that behaviour out.
test('an empty restore is refused, however cleanly mongorestore exited', () => {
  assert.throws(() => assertRestoreComplete({}, null), /empty database/);
  assert.throws(() => assertRestoreComplete({ customers: 0, bills: 0 }, null), /0 documents/);
  assert.throws(
    () => assertRestoreComplete({ customers: 0 }, { sourceDocuments: 162 }),
    /empty database/,
  );
});

test('a restore that loses documents is refused', () => {
  assert.throws(
    () => assertRestoreComplete({ customers: 6, bills: 6 }, { sourceDocuments: 162 }),
    /taken from 162 documents but 12 were restored/,
  );
});

test('a complete restore returns its document total', () => {
  assert.equal(assertRestoreComplete({ customers: 6, bills: 156 }, { sourceDocuments: 162 }), 162);
  // An archive whose manifest predates count recording cannot be cross-checked,
  // but must still be accepted when it clearly restored something.
  assert.equal(assertRestoreComplete({ customers: 6 }, null), 6);
  assert.equal(assertRestoreComplete({ customers: 6 }, {}), 6);
});

/**
 * Phase 9 backup-encryption tests.
 *
 * A backup is only as good as its ability to come back. These prove the
 * round trip is lossless and that every failure mode a bad archive can present
 * is detected rather than silently restored.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { encryptFile, decryptFile } = require('../scripts/lib/archiveCrypto');

const PASSPHRASE = 'correct horse battery staple 42';

const workspace = async (t) => {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'tammewar-backup-test-'));
  t.after(() => fs.promises.rm(dir, { recursive: true, force: true }));
  return dir;
};

test('an encrypted archive round-trips byte for byte', async (t) => {
  const dir = await workspace(t);
  const source = path.join(dir, 'dump.archive.gz');
  const encrypted = path.join(dir, 'dump.archive.gz.enc');
  const restored = path.join(dir, 'restored.archive.gz');

  // Random bytes stand in for a gzip archive: incompressible and easy to compare.
  const plaintext = crypto.randomBytes(512 * 1024);
  await fs.promises.writeFile(source, plaintext);

  const result = await encryptFile({ sourcePath: source, targetPath: encrypted, passphrase: PASSPHRASE });
  assert.equal(result.plaintextBytes, plaintext.length);
  assert.ok(result.ciphertextBytes > plaintext.length, 'the header and tag add overhead');
  assert.match(result.sha256, /^[0-9a-f]{64}$/);

  // The archive on disk must not contain the plaintext.
  const onDisk = await fs.promises.readFile(encrypted);
  assert.equal(onDisk.includes(plaintext.subarray(0, 64)), false);

  await decryptFile({ sourcePath: encrypted, targetPath: restored, passphrase: PASSPHRASE });
  assert.ok(plaintext.equals(await fs.promises.readFile(restored)), 'the restored archive differs from the source');
});

test('an empty archive round-trips', async (t) => {
  const dir = await workspace(t);
  const source = path.join(dir, 'empty.archive.gz');
  const encrypted = path.join(dir, 'empty.enc');
  const restored = path.join(dir, 'empty.out');
  await fs.promises.writeFile(source, Buffer.alloc(0));

  await encryptFile({ sourcePath: source, targetPath: encrypted, passphrase: PASSPHRASE });
  await decryptFile({ sourcePath: encrypted, targetPath: restored, passphrase: PASSPHRASE });
  assert.equal((await fs.promises.stat(restored)).size, 0);
});

test('two archives of the same input differ, so the passphrase is never a fixed key', async (t) => {
  const dir = await workspace(t);
  const source = path.join(dir, 'dump.archive.gz');
  await fs.promises.writeFile(source, Buffer.from('identical contents'));

  const first = path.join(dir, 'first.enc');
  const second = path.join(dir, 'second.enc');
  const a = await encryptFile({ sourcePath: source, targetPath: first, passphrase: PASSPHRASE });
  const b = await encryptFile({ sourcePath: source, targetPath: second, passphrase: PASSPHRASE });

  assert.notEqual(a.sha256, b.sha256, 'a fresh salt and nonce must be used every time');
});

test('a wrong passphrase is rejected and leaves no plaintext behind', async (t) => {
  const dir = await workspace(t);
  const source = path.join(dir, 'dump.archive.gz');
  const encrypted = path.join(dir, 'dump.enc');
  const restored = path.join(dir, 'restored.gz');
  await fs.promises.writeFile(source, crypto.randomBytes(64 * 1024));
  await encryptFile({ sourcePath: source, targetPath: encrypted, passphrase: PASSPHRASE });

  await assert.rejects(
    () => decryptFile({ sourcePath: encrypted, targetPath: restored, passphrase: 'a different passphrase!!' }),
    /wrong passphrase or the archive was altered/,
  );
  assert.equal(fs.existsSync(restored), false, 'a partial plaintext must not survive a failed decryption');
});

test('a tampered archive is rejected rather than restored', async (t) => {
  const dir = await workspace(t);
  const source = path.join(dir, 'dump.archive.gz');
  const encrypted = path.join(dir, 'dump.enc');
  const restored = path.join(dir, 'restored.gz');
  await fs.promises.writeFile(source, crypto.randomBytes(64 * 1024));
  await encryptFile({ sourcePath: source, targetPath: encrypted, passphrase: PASSPHRASE });

  const bytes = await fs.promises.readFile(encrypted);
  const flipAt = Math.floor(bytes.length / 2);
  bytes[flipAt] ^= 0xff;
  await fs.promises.writeFile(encrypted, bytes);

  await assert.rejects(
    () => decryptFile({ sourcePath: encrypted, targetPath: restored, passphrase: PASSPHRASE }),
    /wrong passphrase or the archive was altered/,
  );
  assert.equal(fs.existsSync(restored), false);
});

test('a truncated archive and a foreign file are both rejected', async (t) => {
  const dir = await workspace(t);
  const source = path.join(dir, 'dump.archive.gz');
  const encrypted = path.join(dir, 'dump.enc');
  const truncated = path.join(dir, 'truncated.enc');
  const foreign = path.join(dir, 'foreign.enc');
  const restored = path.join(dir, 'restored.gz');

  await fs.promises.writeFile(source, crypto.randomBytes(64 * 1024));
  await encryptFile({ sourcePath: source, targetPath: encrypted, passphrase: PASSPHRASE });

  const bytes = await fs.promises.readFile(encrypted);
  await fs.promises.writeFile(truncated, bytes.subarray(0, bytes.length - 32));
  await assert.rejects(
    () => decryptFile({ sourcePath: truncated, targetPath: restored, passphrase: PASSPHRASE }),
    /wrong passphrase or the archive was altered/,
  );

  await fs.promises.writeFile(foreign, Buffer.from('this is somebody else\'s file, not a backup archive'));
  await assert.rejects(
    () => decryptFile({ sourcePath: foreign, targetPath: restored, passphrase: PASSPHRASE }),
    /not a Tammewar backup/,
  );

  await fs.promises.writeFile(foreign, Buffer.from('tiny'));
  await assert.rejects(
    () => decryptFile({ sourcePath: foreign, targetPath: restored, passphrase: PASSPHRASE }),
    /truncated or is not a Tammewar backup/,
  );
});

test('a weak passphrase is refused on both encryption and decryption', async (t) => {
  const dir = await workspace(t);
  const source = path.join(dir, 'dump.archive.gz');
  await fs.promises.writeFile(source, Buffer.from('data'));

  await assert.rejects(
    () => encryptFile({ sourcePath: source, targetPath: path.join(dir, 'x.enc'), passphrase: 'short' }),
    /at least 20 characters/,
  );
  await assert.rejects(
    () => decryptFile({ sourcePath: source, targetPath: path.join(dir, 'x.gz'), passphrase: '' }),
    /at least 20 characters/,
  );
});

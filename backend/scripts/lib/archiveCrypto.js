/**
 * Authenticated encryption for MongoDB backup archives.
 *
 * Atlas Free has no managed backup, so Phase 9 relies on local `mongodump`
 * archives kept off-platform. Those archives contain every customer record, so
 * they are encrypted on the trusted device before they are copied anywhere.
 *
 * Format:
 *   magic   5 bytes   "TPBK1"
 *   salt   16 bytes   scrypt salt
 *   iv     12 bytes   AES-GCM nonce
 *   body    n bytes   ciphertext
 *   tag    16 bytes   AES-GCM authentication tag (trailer)
 *
 * AES-256-GCM is authenticated, so a truncated, corrupted, or tampered archive
 * fails to decrypt rather than restoring silently wrong data. The tag is a
 * trailer so encryption can stream without buffering the whole archive.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');

const MAGIC = Buffer.from('TPBK1', 'ascii');
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const HEADER_BYTES = MAGIC.length + SALT_BYTES + IV_BYTES;

// 32 MiB of memory per derivation: costly for an offline guessing attack,
// unremarkable on an administrator laptop.
const SCRYPT = { N: 32768, r: 8, p: 1, maxmem: 96 * 1024 * 1024 };

const deriveKey = (passphrase, salt) => new Promise((resolve, reject) => {
  crypto.scrypt(passphrase, salt, KEY_BYTES, SCRYPT, (err, key) => (err ? reject(err) : resolve(key)));
});

const assertPassphrase = (passphrase) => {
  if (typeof passphrase !== 'string' || passphrase.length < 20) {
    throw new Error('The archive passphrase must be at least 20 characters');
  }
};

/**
 * Encrypts `sourcePath` to `targetPath`, returning the plaintext and ciphertext
 * sizes plus the ciphertext SHA-256 for the backup manifest.
 */
const encryptFile = async ({ sourcePath, targetPath, passphrase }) => {
  assertPassphrase(passphrase);
  const salt = crypto.randomBytes(SALT_BYTES);
  const iv = crypto.randomBytes(IV_BYTES);
  const key = await deriveKey(passphrase, salt);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const target = fs.createWriteStream(targetPath, { mode: 0o600 });
  const digest = crypto.createHash('sha256');

  // The header is authenticated as additional data so a swapped salt or nonce
  // is detected at decryption time.
  const header = Buffer.concat([MAGIC, salt, iv]);
  cipher.setAAD(header);
  await new Promise((resolve, reject) => target.write(header, (err) => (err ? reject(err) : resolve())));
  digest.update(header);

  cipher.on('data', (chunk) => digest.update(chunk));

  await pipeline(fs.createReadStream(sourcePath), cipher, target, { end: false });

  const tag = cipher.getAuthTag();
  digest.update(tag);
  await new Promise((resolve, reject) => target.end(tag, (err) => (err ? reject(err) : resolve())));

  const { size: plaintextBytes } = await fs.promises.stat(sourcePath);
  const { size: ciphertextBytes } = await fs.promises.stat(targetPath);
  return { plaintextBytes, ciphertextBytes, sha256: digest.digest('hex') };
};

const readExactly = async (handle, length, position) => {
  const buffer = Buffer.alloc(length);
  const { bytesRead } = await handle.read(buffer, 0, length, position);
  if (bytesRead !== length) throw new Error('The archive is truncated or is not a Tammewar backup');
  return buffer;
};

/**
 * Decrypts `sourcePath` to `targetPath`. Throws if the passphrase is wrong or
 * the archive was altered; a failed decryption never leaves a usable file.
 */
const decryptFile = async ({ sourcePath, targetPath, passphrase }) => {
  assertPassphrase(passphrase);
  const handle = await fs.promises.open(sourcePath, 'r');
  try {
    const { size } = await handle.stat();
    if (size < HEADER_BYTES + TAG_BYTES) {
      throw new Error('The archive is truncated or is not a Tammewar backup');
    }

    const header = await readExactly(handle, HEADER_BYTES, 0);
    if (!header.subarray(0, MAGIC.length).equals(MAGIC)) {
      throw new Error('The archive is not a Tammewar backup');
    }
    const salt = header.subarray(MAGIC.length, MAGIC.length + SALT_BYTES);
    const iv = header.subarray(MAGIC.length + SALT_BYTES);
    const tag = await readExactly(handle, TAG_BYTES, size - TAG_BYTES);

    const key = await deriveKey(passphrase, salt);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(header);
    decipher.setAuthTag(tag);

    // A zero-length body still has to run through the decipher so the
    // authentication tag is checked; a byte range of start > end is invalid.
    const bodyBytes = size - HEADER_BYTES - TAG_BYTES;
    const body = bodyBytes === 0
      ? Readable.from([])
      : handle.createReadStream({ start: HEADER_BYTES, end: size - TAG_BYTES - 1, autoClose: false });

    try {
      await pipeline(body, decipher, fs.createWriteStream(targetPath, { mode: 0o600 }));
    } catch (err) {
      // GCM reports tampering or a wrong passphrase only at the end of the
      // stream, by which point a partial plaintext is already on disk.
      await fs.promises.rm(targetPath, { force: true });
      if (/auth/i.test(err.message)) {
        throw new Error('Decryption failed: wrong passphrase or the archive was altered');
      }
      throw err;
    }

    const { size: plaintextBytes } = await fs.promises.stat(targetPath);
    return { plaintextBytes };
  } finally {
    await handle.close();
  }
};

module.exports = { encryptFile, decryptFile, MAGIC, HEADER_BYTES, TAG_BYTES };

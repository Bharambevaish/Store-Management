const { randomBytes } = require('crypto');

// 48 random bytes encode to 64 base64url characters. Send the result directly
// to a password manager or platform secret store; never commit it.
process.stdout.write(`${randomBytes(48).toString('base64url')}\n`);

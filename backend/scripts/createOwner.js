/**
 * Controlled one-time creation of the single named owner account.
 *
 * This is the supported alternative to AUTO_SEED, which must stay false in
 * production. The password is read from an interactive prompt with echo
 * disabled so it never reaches argv, shell history, or the environment, and it
 * is never written to the log stream.
 *
 *   MONGO_URI=... MONGO_DB_NAME=... node scripts/createOwner.js
 *
 * The script refuses to run if any user document already exists. Rotating an
 * existing owner's password is done through the authenticated
 * POST /result-analysis/auth/change-password endpoint, not this script.
 */
require('dotenv').config();
const readline = require('node:readline');
const mongoose = require('mongoose');
const { connectDb, disconnectDb } = require('../src/config/db');
const { promptSecret } = require('./lib/promptSecret');
const User = require('../src/models/user');

const EMAIL_PATTERN = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;
const MOBILE_PATTERN = /^\d{10}$/;

const isStrongPassword = (password) => typeof password === 'string' &&
  password.length >= 16 && password.length <= 128 &&
  /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password);

const prompt = (question) => new Promise((resolve) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(question, (answer) => {
    rl.close();
    resolve(answer.trim());
  });
});

const main = async () => {
  await connectDb();

  const existing = await User.countDocuments();
  if (existing > 0) {
    throw new Error(`Refusing to run: ${existing} user document(s) already exist in this database`);
  }

  const email = (await prompt('Owner email: ')).toLowerCase();
  if (!EMAIL_PATTERN.test(email) || email.length > 254) throw new Error('A valid owner email is required');

  const name = await prompt('Owner full name: ');
  if (!name || name.length > 100) throw new Error('An owner name of 1-100 characters is required');

  const mobile = await prompt('Owner mobile (10 digits): ');
  if (!MOBILE_PATTERN.test(mobile)) throw new Error('A 10-digit mobile number is required');

  const password = await promptSecret('Owner password (16+ chars, upper, lower, digit): ');
  if (!isStrongPassword(password)) {
    throw new Error('Password must be 16-128 characters with an uppercase letter, a lowercase letter, and a digit');
  }
  const confirmation = await promptSecret('Confirm password: ');
  if (password !== confirmation) throw new Error('The two passwords did not match');

  // The pre-save hook hashes the password with bcrypt before it is persisted.
  const owner = new User({ email, name, mobile, password, role: 'admin', status: 'Active' });
  await owner.save();

  console.log(JSON.stringify({
    ownerCreated: 'ok',
    userId: owner._id.toString(),
    database: mongoose.connection.name,
  }));
  console.log('Store this password in the password manager now. It cannot be recovered from the database.');
};

main()
  .catch((err) => {
    // Only the message is printed; it never contains the supplied password.
    console.error(`[create-owner] ${err.message || 'Owner creation failed'}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDb().catch(() => {});
  });

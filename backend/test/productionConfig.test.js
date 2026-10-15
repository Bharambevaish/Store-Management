/**
 * Phase 14 production-configuration regression tests.
 *
 * `assertSafeConfiguration` is the gate that stops the service booting with an
 * unsafe combination. Each case below is a misconfiguration that must refuse to
 * start rather than start with a weaker posture.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ENV_MODULE = path.join(__dirname, '..', 'src', 'config', 'env.js');

const SAFE_PRODUCTION = {
  NODE_ENV: 'production',
  PORT: '10000',
  HOST: '0.0.0.0',
  MONGO_URI: 'mongodb+srv://app:pw@cluster.example.mongodb.net/tammewar_pharmacy_prod?retryWrites=true&w=majority',
  MONGO_DB_NAME: 'tammewar_pharmacy_prod',
  JWT_SECRET: 'z'.repeat(64),
  CORS_ORIGINS: 'https://tammewar-pharmacy.pages.dev',
  AUTO_SEED: 'false',
  WHATSAPP_ENABLED: 'false',
  PAYMENTS_ALLOW_MOCK: 'false',
  ONLINE_RESTORE_ENABLED: 'false',
  INTERNAL_AUTH_ENABLED: 'false',
};

// env.js snapshots process.env at require time, and assertSafeConfiguration
// additionally reads process.env.PORT when it runs. Each case therefore needs a
// fresh module instance *and* the substituted environment still in place while
// the assertion executes.
const withEnv = (overrides, run) => {
  const saved = process.env;
  const replacement = { ...SAFE_PRODUCTION, ...overrides };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete replacement[key];
  }
  process.env = replacement;
  try {
    delete require.cache[require.resolve(ENV_MODULE)];
    return run(require(ENV_MODULE));
  } finally {
    process.env = saved;
    delete require.cache[require.resolve(ENV_MODULE)];
  }
};

const assertRefuses = (overrides, expected) =>
  withEnv(overrides, (env) => assert.throws(() => env.assertSafeConfiguration(), expected));

test('a correct production environment is accepted', () => {
  withEnv({}, (env) => {
    assert.doesNotThrow(() => env.assertSafeConfiguration());
    assert.equal(env.NODE_ENV, 'production');
    assert.equal(env.HOST, '0.0.0.0');
  });
});

test('production refuses a weak, missing, or short JWT secret', () => {
  assertRefuses({ JWT_SECRET: undefined }, /JWT_SECRET/);
  assertRefuses({ JWT_SECRET: 'short' }, /at least 64 characters/);
  assertRefuses({ JWT_SECRET: 'z'.repeat(63) }, /at least 64 characters/);
});

test('production refuses an unsafe feature combination', () => {
  assertRefuses({ AUTO_SEED: 'true', INITIAL_ADMIN_EMAIL: 'a@b.co', INITIAL_ADMIN_MOBILE: '9999999999', INITIAL_ADMIN_PASSWORD: 'A'.repeat(20) }, /AUTO_SEED/);
  assertRefuses({ WHATSAPP_ENABLED: 'true' }, /WhatsApp/);
  assertRefuses({ INTERNAL_AUTH_ENABLED: 'true' }, /Internal multi-tenant auth/);
});

test('mock payments and online restore cannot be switched on in production', () => {
  // These two are forced off by the environment reader itself, so an operator
  // setting them cannot re-enable the behaviour even before the assertion runs.
  withEnv({ PAYMENTS_ALLOW_MOCK: 'true', ONLINE_RESTORE_ENABLED: 'true' }, (env) => {
    assert.equal(env.PAYMENTS_ALLOW_MOCK, false);
    assert.equal(env.ONLINE_RESTORE_ENABLED, false);
    assert.doesNotThrow(() => env.assertSafeConfiguration());
  });
});

test('production requires a platform-supplied port and a public bind address', () => {
  assertRefuses({ PORT: undefined }, /PORT must be supplied/);
  assertRefuses({ HOST: '127.0.0.1' }, /HOST must be 0\.0\.0\.0/);
  assertRefuses({ PORT: 'not-a-number' }, /PORT must be an integer/);
});

test('production requires an Atlas URI that matches the named database', () => {
  assertRefuses({ MONGO_URI: 'mongodb://127.0.0.1:27017/tammewar_pharmacy_prod' }, /mongodb\+srv/);
  assertRefuses(
    { MONGO_URI: 'mongodb+srv://app:pw@cluster.example.mongodb.net/tammewar_pharmacy_prod' },
    /retryWrites=true and w=majority/,
  );
  assertRefuses(
    {
      MONGO_URI: 'mongodb+srv://app:pw@cluster.example.mongodb.net/other_db?retryWrites=true&w=majority',
      MONGO_DB_NAME: 'tammewar_pharmacy_prod',
    },
    /targets database "other_db" but MONGO_DB_NAME is "tammewar_pharmacy_prod"/,
  );
  assertRefuses({ MONGO_DB_NAME: undefined }, /MONGO_DB_NAME/);
});

test('production refuses a shared or development database name', () => {
  for (const name of ['admin', 'config', 'local', 'test', 'development', 'result_analysis_db']) {
    assertRefuses(
      {
        MONGO_DB_NAME: name,
        MONGO_URI: `mongodb+srv://app:pw@cluster.example.mongodb.net/${name}?retryWrites=true&w=majority`,
      },
      /dedicated production database|explicit lowercase production database name/,
    );
  }
});

test('production refuses a wildcard, insecure, or localhost CORS origin', () => {
  assertRefuses({ CORS_ORIGINS: undefined }, /CORS_ORIGINS must be configured/);
  assertRefuses({ CORS_ORIGINS: '*' }, /wildcard/);
  assertRefuses({ CORS_ORIGINS: 'https://*.pages.dev' }, /wildcard/);
  assertRefuses({ CORS_ORIGINS: 'http://tammewar-pharmacy.pages.dev' }, /https/);
  assertRefuses({ CORS_ORIGINS: 'http://localhost:3009' }, /https/);
  assertRefuses({ CORS_ORIGINS: 'https://localhost:3009' }, /Localhost origins/);
  assertRefuses({ CORS_ORIGINS: 'https://127.0.0.1' }, /Localhost origins/);
  assertRefuses({ CORS_ORIGINS: 'tammewar-pharmacy.pages.dev' }, /not a valid origin/);
  assertRefuses({ CORS_ORIGINS: 'https://tammewar-pharmacy.pages.dev/' }, /bare origin/);
  assertRefuses({ CORS_ORIGINS: 'https://tammewar-pharmacy.pages.dev/app' }, /bare origin/);

  // One bad entry in an otherwise valid list is still refused.
  assertRefuses(
    { CORS_ORIGINS: 'https://tammewar-pharmacy.pages.dev,http://localhost:3009' },
    /https/,
  );
});

test('a custom production domain alongside the Pages origin is accepted', () => {
  withEnv({ CORS_ORIGINS: 'https://tammewar-pharmacy.pages.dev, https://shop.tammewar.example' }, (env) => {
    assert.doesNotThrow(() => env.assertSafeConfiguration());
    assert.deepEqual(env.CORS_ORIGINS, ['https://tammewar-pharmacy.pages.dev', 'https://shop.tammewar.example']);
  });
});

test('seeding outside production still demands a strong initial credential', () => {
  assertRefuses(
    { NODE_ENV: 'development', AUTO_SEED: 'true', INITIAL_ADMIN_EMAIL: 'a@b.co', INITIAL_ADMIN_MOBILE: '9999999999', INITIAL_ADMIN_PASSWORD: 'short' },
    /16\+ character INITIAL_ADMIN_PASSWORD/,
  );
});

// The real deployment failure of 2026-08-22: the cluster name was pasted into
// the URI path. Cluster and database differ only by hyphens versus
// underscores, so both messages must quote the values rather than describe
// them abstractly.
test('the cluster-name-in-the-URI-path mistake is named explicitly', () => {
  assertRefuses(
    {
      MONGO_URI: 'mongodb+srv://app:pw@tammewar-pharmacy-prod.zxl08z5.mongodb.net/tammewar-pharmacy-prod?retryWrites=true&w=majority',
      MONGO_DB_NAME: 'tammewar_pharmacy_prod',
    },
    /targets database "tammewar-pharmacy-prod" but MONGO_DB_NAME is "tammewar_pharmacy_prod"/,
  );

  // A URI with no database at all names the omission rather than saying "(none)"
  // cryptically alongside a valid-looking name.
  assertRefuses(
    { MONGO_URI: 'mongodb+srv://app:pw@cluster.example.mongodb.net/?retryWrites=true&w=majority' },
    /targets database "\(none\)"/,
  );
});

test('a hyphenated MONGO_DB_NAME says so, and says why', () => {
  assertRefuses(
    {
      MONGO_DB_NAME: 'tammewar-pharmacy-prod',
      MONGO_URI: 'mongodb+srv://app:pw@c.example.mongodb.net/tammewar-pharmacy-prod?retryWrites=true&w=majority',
    },
    /received "tammewar-pharmacy-prod".+cluster name/s,
  );
});

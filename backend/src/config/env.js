const NODE_ENV = process.env.NODE_ENV || 'development';
const parsedPort = Number(process.env.PORT || 4009);
const getMongoDatabaseName = (uri) => {
  try {
    return decodeURIComponent(new URL(uri).pathname.replace(/^\//, '').split('/')[0] || '');
  } catch (_err) {
    return '';
  }
};

const env = {
  NODE_ENV,
  HOST: process.env.HOST || (NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'),
  PORT: parsedPort,
  MONGO_URI: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/result_analysis_db',
  MONGO_DB_NAME: process.env.MONGO_DB_NAME || 'result_analysis_db',
  JWT_SECRET: process.env.JWT_SECRET || '',
  JWT_ISSUER: process.env.JWT_ISSUER || 'tammewar-pharmacy',
  JWT_AUDIENCE: process.env.JWT_AUDIENCE || 'tammewar-pharmacy-api',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '2h',
  CUSTOMER_JWT_EXPIRES_IN: process.env.CUSTOMER_JWT_EXPIRES_IN || '2h',
  JWT_INTERNAL_PUBLIC_KEY: (process.env.JWT_INTERNAL_PUBLIC_KEY || '').replace(/\\n/g, '\n'),
  CORE_INTERNAL_AUD: process.env.CORE_INTERNAL_AUD || 'result-analysis',
  CORE_INTERNAL_ISSUER: process.env.CORE_INTERNAL_ISSUER || '',
  INTERNAL_AUTH_ENABLED: process.env.INTERNAL_AUTH_ENABLED === 'true',
  AUTO_SEED: process.env.AUTO_SEED === 'true',
  INITIAL_ADMIN_EMAIL: process.env.INITIAL_ADMIN_EMAIL || '',
  INITIAL_ADMIN_PASSWORD: process.env.INITIAL_ADMIN_PASSWORD || '',
  INITIAL_ADMIN_NAME: process.env.INITIAL_ADMIN_NAME || 'Initial Administrator',
  INITIAL_ADMIN_MOBILE: process.env.INITIAL_ADMIN_MOBILE || '',
  WHATSAPP_ENABLED: process.env.WHATSAPP_ENABLED === 'true',
  PAYMENTS_ALLOW_MOCK: NODE_ENV !== 'production' && process.env.PAYMENTS_ALLOW_MOCK === 'true',
  ONLINE_RESTORE_ENABLED: NODE_ENV !== 'production' && process.env.ONLINE_RESTORE_ENABLED === 'true',
  TRUST_PROXY: process.env.TRUST_PROXY || '',
  CORS_ORIGINS: (process.env.CORS_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean),
};

env.assertSafeConfiguration = () => {
  if (!Number.isInteger(env.PORT) || env.PORT < 1 || env.PORT > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  if (env.JWT_SECRET.length < 64) {
    throw new Error('JWT_SECRET must be configured with at least 64 characters');
  }
  if (env.NODE_ENV === 'production') {
    if (!process.env.PORT) throw new Error('PORT must be supplied by the production platform');
    if (env.HOST !== '0.0.0.0') throw new Error('HOST must be 0.0.0.0 in production');
    if (env.AUTO_SEED) throw new Error('AUTO_SEED must be disabled in production');
    if (env.WHATSAPP_ENABLED) throw new Error('Legacy local WhatsApp must be disabled in production');
    if (env.PAYMENTS_ALLOW_MOCK) throw new Error('Mock payments must be disabled in production');
    if (env.ONLINE_RESTORE_ENABLED) throw new Error('Online database restore must be disabled in production');
    if (env.INTERNAL_AUTH_ENABLED) throw new Error('Internal multi-tenant auth cannot be enabled until every pharmacy model is tenant-scoped');
    if (env.CORS_ORIGINS.length === 0) throw new Error('CORS_ORIGINS must be configured in production');
    // Phase 12: production accepts only exact https origins. A wildcard, a
    // localhost entry, or a trailing path would widen the browser boundary
    // beyond the one deployed frontend.
    for (const origin of env.CORS_ORIGINS) {
      if (origin === '*' || origin.includes('*')) {
        throw new Error('CORS_ORIGINS must not contain a wildcard in production');
      }
      let parsed;
      try {
        parsed = new URL(origin);
      } catch (_err) {
        throw new Error(`CORS_ORIGINS entry is not a valid origin: ${origin}`);
      }
      if (parsed.protocol !== 'https:') {
        throw new Error('Every production CORS origin must use https');
      }
      if (['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(parsed.hostname)) {
        throw new Error('Localhost origins must not be allowed in production');
      }
      if (origin !== parsed.origin) {
        throw new Error(`CORS_ORIGINS entry must be a bare origin with no path or trailing slash: ${origin}`);
      }
    }
    if (!process.env.MONGO_URI || !env.MONGO_URI.startsWith('mongodb+srv://')) {
      throw new Error('Production MONGO_URI must be an Atlas mongodb+srv connection string');
    }
    const mongoUrl = new URL(env.MONGO_URI);
    if (mongoUrl.searchParams.get('retryWrites') !== 'true' || mongoUrl.searchParams.get('w') !== 'majority') {
      throw new Error('Production MONGO_URI must enable retryWrites=true and w=majority');
    }
    if (!process.env.MONGO_DB_NAME || !/^[a-z][a-z0-9_]{2,62}$/.test(env.MONGO_DB_NAME)) {
      throw new Error(
        `MONGO_DB_NAME must be an explicit lowercase production database name of 3-63 characters using only letters, digits, and underscores; received "${env.MONGO_DB_NAME || '(unset)'}". `
        + 'A hyphenated value is usually the cluster name, which is not the database name.',
      );
    }
    if (['admin', 'config', 'local', 'test', 'development', 'result_analysis_db'].includes(env.MONGO_DB_NAME)) {
      throw new Error('MONGO_DB_NAME must identify the dedicated production database');
    }
    const uriDatabase = getMongoDatabaseName(env.MONGO_URI);
    if (uriDatabase !== env.MONGO_DB_NAME) {
      // Name both sides. The usual cause is the cluster name being pasted into
      // the URI path, and the two differ only by hyphens versus underscores —
      // which is invisible in a message that does not quote them.
      throw new Error(
        `MONGO_URI targets database "${uriDatabase || '(none)'}" but MONGO_DB_NAME is "${env.MONGO_DB_NAME}". `
        + 'The database name goes at the end of the URI path; the cluster name belongs only in the hostname.',
      );
    }
  }
  if (env.AUTO_SEED) {
    if (!env.INITIAL_ADMIN_EMAIL || !env.INITIAL_ADMIN_MOBILE || env.INITIAL_ADMIN_PASSWORD.length < 16) {
      throw new Error('AUTO_SEED requires INITIAL_ADMIN_EMAIL, INITIAL_ADMIN_MOBILE, and a 16+ character INITIAL_ADMIN_PASSWORD');
    }
  }
};

env.getMongoDatabaseName = getMongoDatabaseName;

module.exports = env;

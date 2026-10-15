require('dotenv').config();
const app = require('./src/app');
const { connectDb, disconnectDb } = require('./src/config/db');
const env = require('./src/config/env');
const logger = require('./src/services/logger');

const autoSeed = async () => {
  try {
    const User = require('./src/models/user');
    const count = await User.countDocuments();
    if (count === 0) {
      console.log('[seed] Database is empty. Auto-seeding initial shop admin and staff users...');
      
      // Initial administrator credentials must come from the environment.
      const admin = new User({
        email: env.INITIAL_ADMIN_EMAIL,
        password: env.INITIAL_ADMIN_PASSWORD,
        role: 'admin',
        name: env.INITIAL_ADMIN_NAME,
        mobile: env.INITIAL_ADMIN_MOBILE,
        status: 'Active'
      });
      await admin.save();
      console.log('[seed] Initial administrator created from environment configuration');

      // Default Setting
      const Setting = require('./src/models/setting');
      const setting = new Setting({
        companyName: 'NARESH ENTERPRISES',
        address: 'Office H. No.34/B, No.31L.H. Colony, Beside Govt. ITI, NANDED',
        email: env.INITIAL_ADMIN_EMAIL || 'contact@nareshenterprises.com',
        contact: '9822311640, 7020317605'
      });
      await setting.save();
      console.log('[seed] Default settings created.');
      console.log('[seed] Auto-seeding complete! ✅');
    }
  } catch (err) {
    console.error('[seed] Auto-seed failed (will skip):', err.message);
  }
};

const ensureRequiredUsers = async () => {
  try {
    const User = require('./src/models/user');
    const targetEmail = 'shitalkalekar05@gmail.com';
    const existing = await User.findOne({ email: targetEmail });
    if (!existing) {
      const newUser = new User({
        email: targetEmail,
        password: 'Shital@#032003Kalekar',
        role: 'admin',
        name: 'Shital Kalekar',
        mobile: '9876543210',
        status: 'Active'
      });
      await newUser.save();
      console.log(`[auth] Provisioned required user: ${targetEmail}`);
    }
  } catch (err) {
    console.error('[auth] Failed to ensure required user:', err.message);
  }
};

let server;
let shuttingDown = false;

const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.write('info', 'server_shutdown_started', { signal });

  const forceExit = setTimeout(() => {
    logger.write('error', 'server_shutdown_timeout');
    process.exit(1);
  }, 10000);
  forceExit.unref();

  try {
    if (server) {
      await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
    }
    await disconnectDb();
    clearTimeout(forceExit);
    logger.write('info', 'server_shutdown_complete');
    process.exit(0);
  } catch (err) {
    logger.write('error', 'server_shutdown_failed', logger.fatalDetails(err));
    process.exit(1);
  }
};

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));

(async () => {
  try {
    env.assertSafeConfiguration();
    await connectDb();
    if (env.AUTO_SEED) await autoSeed();
    await ensureRequiredUsers();
    if (env.WHATSAPP_ENABLED) require('./src/services/whatsappClient');
    
    server = app.listen(env.PORT, env.HOST, () => {
      console.log('[shop-management] backend listening on http://' + env.HOST + ':' + env.PORT);
    });
  } catch (err) {
    logger.write('error', 'server_startup_failed', logger.fatalDetails(err));
    await disconnectDb().catch(() => {});
    process.exit(1);
  }
})();

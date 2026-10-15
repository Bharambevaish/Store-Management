const AuditLog = require('../models/auditLog');
const { redact } = require('./logger');

exports.logAction = async (userId, action, entity, entityId, diff = '') => {
  try {
    const log = new AuditLog({
      user: userId || null,
      action,
      entity,
      entityId,
      diff: typeof diff === 'object'
        ? JSON.stringify(redact(diff, { customerData: true }))
        : redact(diff, { customerData: true })
    });
    await log.save();
    console.log(`[audit-log] Logged: User(${userId || 'System'}) did "${action}" on ${entity}(${entityId})`);
  } catch (err) {
    console.error('[audit-log] Logging action failed:', err.message);
  }
};

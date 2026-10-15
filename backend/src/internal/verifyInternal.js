const jwt = require('jsonwebtoken');
const env = require('../config/env');

// Reject anything that did not come through the ERP Core gateway.
module.exports = function verifyInternal(req, res, next) {
  if (req.isMernAuthenticated) return next();
  const token = req.header('X-Internal-Token');
  if (!token) return res.status(401).json({ error: 'Internal token required' });
  try {
    if (env.JWT_INTERNAL_PUBLIC_KEY) {
      jwt.verify(token, env.JWT_INTERNAL_PUBLIC_KEY, { audience: env.CORE_INTERNAL_AUD, algorithms: ['RS256'] });
    }
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid internal token' });
  }
};

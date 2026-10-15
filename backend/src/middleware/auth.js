const jwt = require('jsonwebtoken');
const User = require('../models/user');
const env = require('../config/env');

const permissionsForRole = (role) => role === 'admin'
  ? ['pharmacy.view', 'pharmacy.create', 'pharmacy.update', 'pharmacy.delete', 'pharmacy.admin']
  : role === 'staff'
    ? ['pharmacy.view', 'pharmacy.create', 'pharmacy.update']
    : ['catalog.view', 'order.create', 'order.view-own'];

const setContext = (req, principal, overrides = {}) => {
  req.user = principal;
  req.ctx = {
    tenantId: overrides.tenantId || 'default',
    tenantCode: overrides.tenantCode || 'STANDALONE',
    tenantDb: null,
    userId: principal.id,
    role: principal.role,
    permissions: overrides.permissions || permissionsForRole(principal.role),
    requestId: req.id,
  };
};

const authenticateLocalToken = async (req, token) => {
  const decoded = jwt.verify(token, env.JWT_SECRET, {
    algorithms: ['HS256'],
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  });

  if (!decoded.sub || decoded.authType !== 'owner' || decoded.role !== 'admin') {
    throw new Error('Invalid token claims');
  }

  const user = await User.findById(decoded.sub).select('_id email name mobile role status +passwordChangedAt');
  if (!user || user.status !== 'Active' || user.role !== 'admin') throw new Error('Owner account is inactive');

  // A password rotation invalidates every token that was issued before it.
  const changedAt = user.passwordChangedAt ? Math.floor(user.passwordChangedAt.getTime() / 1000) : 0;
  if (!decoded.iat || decoded.iat < changedAt) throw new Error('Token predates the current credential');
  setContext(req, {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    mobile: user.mobile,
    role: user.role,
    authType: 'owner',
  });
};

const authenticateInternalToken = (req, token) => {
  if (!env.JWT_INTERNAL_PUBLIC_KEY) throw new Error('Internal authentication is not configured');
  const options = { audience: env.CORE_INTERNAL_AUD, algorithms: ['RS256'] };
  if (env.CORE_INTERNAL_ISSUER) options.issuer = env.CORE_INTERNAL_ISSUER;
  const decoded = jwt.verify(token, env.JWT_INTERNAL_PUBLIC_KEY, options);
  const role = decoded.role;
  const tenantId = decoded.tenantId;
  const userId = decoded.sub || decoded.userId;
  if (!userId || !tenantId || role !== 'admin') {
    throw new Error('Invalid internal token claims');
  }
  setContext(req, {
    id: String(userId),
    email: decoded.email,
    name: decoded.name,
    role,
    authType: 'internal',
  }, {
    tenantId: String(tenantId),
    tenantCode: decoded.tenantCode ? String(decoded.tenantCode) : String(tenantId),
    permissions: Array.isArray(decoded.permissions) ? decoded.permissions : permissionsForRole(role),
  });
};

exports.verifyToken = async function verifyToken(req, res, next) {
  const authHeader = req.header('Authorization');
  const internalToken = req.header('X-Internal-Token');

  try {
    if (authHeader && authHeader.startsWith('Bearer ')) {
      await authenticateLocalToken(req, authHeader.slice(7));
      return next();
    }
    if (internalToken) {
      if (!env.INTERNAL_AUTH_ENABLED) {
        return res.status(401).json({ error: 'Internal authentication is disabled' });
      }
      authenticateInternalToken(req, internalToken);
      return next();
    }
    return res.status(401).json({ error: 'Authentication required' });
  } catch (_err) {
    return res.status(401).json({ error: 'Invalid or expired auth token' });
  }
};

exports.requireStaff = (req, res, next) => {
  if (!req.user || !['admin', 'staff'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Staff access required' });
  }
  return next();
};

exports.requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator access required' });
  }
  return next();
};

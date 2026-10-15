// Build trusted request context from gateway-injected headers.
module.exports = function context(req, _res, next) {
  if (req.isMernAuthenticated) return next();
  req.ctx = {
    tenantId: req.header('X-Tenant-Id'),
    tenantCode: req.header('X-Tenant-Code'),
    tenantDb: req.header('X-Tenant-Db') || null,
    userId: req.header('X-User-Id'),
    role: req.header('X-User-Role'),
    permissions: (req.header('X-Permissions') || '').split(',').filter(Boolean),
    requestId: req.header('X-Request-Id'),
  };
  if (!req.ctx.tenantId) return next(Object.assign(new Error('Tenant context missing'), { status: 400 }));
  next();
};

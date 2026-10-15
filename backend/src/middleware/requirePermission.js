// Fine-grained, object-level permission check (defense in depth after the gateway).
module.exports = (perm) => (req, res, next) => {
  if (!req.ctx || !req.ctx.permissions.includes(perm)) {
    return res.status(403).json({ error: 'Forbidden: ' + perm });
  }
  next();
};

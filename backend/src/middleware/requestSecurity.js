const crypto = require('crypto');
const mongoose = require('mongoose');

const MAX_DEPTH = 12;
const MAX_ARRAY_ITEMS = 200;
const MAX_STRING_LENGTH = 750000;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,100}$/;
const OBJECT_ID_KEYS = new Set([
  'id', 'bill', 'billId', 'branch', 'branchId', 'customer', 'customerId',
  'entityId', 'linkedVendor', 'order', 'product', 'productId', 'quotationRef',
  'staffId', 'supplier', 'supplierId', 'user', 'vendor', 'vendorId',
]);

const inspectValue = (value, depth = 0, key = '') => {
  if (depth > MAX_DEPTH) return 'Request nesting is too deep';
  if (typeof value === 'string' && value.length > MAX_STRING_LENGTH) return 'Request text is too long';
  if (value && OBJECT_ID_KEYS.has(key)) {
    const candidate = (typeof value === 'object' && value !== null && value._id) ? value._id : value;
    if (!mongoose.isValidObjectId(candidate)) return 'Invalid resource identifier';
  }
  if (key === 'ids' && Array.isArray(value) && value.some((id) => {
    const candidate = (id && typeof id === 'object' && id !== null && id._id) ? id._id : id;
    return !mongoose.isValidObjectId(candidate);
  })) {
    return 'Invalid resource identifier';
  }
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY_ITEMS) return 'Request contains too many items';
    for (const item of value) {
      const error = inspectValue(item, depth + 1, key);
      if (error) return error;
    }
    return null;
  }
  for (const [childKey, child] of Object.entries(value)) {
    const error = inspectValue(child, depth + 1, childKey);
    if (error) return error;
  }
  return null;
};

const assignRequestId = (req, res, next) => {
  const supplied = req.header('X-Request-Id');
  req.id = supplied && REQUEST_ID_PATTERN.test(supplied) ? supplied : crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
};

const enforceRequestShape = (req, res, next) => {
  const error = inspectValue(req.body) || inspectValue(req.query);
  if (error) return res.status(400).json({ error });
  return next();
};

module.exports = { assignRequestId, enforceRequestShape, inspectValue };

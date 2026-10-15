// Mandatory tenant isolation — every collection is scoped by tenantId (fail-closed).
module.exports = function tenantScope(schema) {
  schema.add({ tenantId: { type: String, required: true, index: true } });
  const inject = function () {
    const t = this.getOptions().tenantId;
    if (!t) throw new Error('Tenant context missing');
    this.where({ tenantId: t });
  };
  ['find', 'findOne', 'count', 'countDocuments', 'updateOne', 'updateMany',
   'deleteOne', 'deleteMany', 'findOneAndUpdate'].forEach((op) => schema.pre(op, inject));
  schema.pre('save', function (next) {
    if (!this.tenantId) return next(new Error('Tenant context missing'));
    next();
  });
};

// Import models
const User = require('../models/user');
const Customer = require('../models/customer');
const Vendor = require('../models/vendor');
const Product = require('../models/product');
const StockHistory = require('../models/stockHistory');
const Order = require('../models/order');
const Quotation = require('../models/quotation');
const Bill = require('../models/bill');
const Payment = require('../models/payment');
const Branch = require('../models/branch');
const Employee = require('../models/employee');
const PurchaseOrder = require('../models/purchaseOrder');
const StockAdjustment = require('../models/stockAdjustment');
const Expense = require('../models/expense');
const Setting = require('../models/setting');
const AuditLog = require('../models/auditLog');
const JobRun = require('../models/jobRun');

// Fetches all database contents and returns a serialized JSON object
const generateDatabaseDump = async () => {
  return {
    branches: await Branch.find({}),
    users: await User.find({}).select('-password'),
    employees: await Employee.find({}),
    customers: await Customer.find({}),
    vendors: await Vendor.find({}),
    products: await Product.find({}),
    stockHistory: await StockHistory.find({}),
    orders: await Order.find({}),
    quotations: await Quotation.find({}),
    bills: await Bill.find({}),
    payments: await Payment.find({}),
    purchaseOrders: await PurchaseOrder.find({}),
    stockAdjustments: await StockAdjustment.find({}),
    expenses: await Expense.find({}),
    settings: await Setting.find({}).select('-whatsappToken'),
    auditLogs: await AuditLog.find({}),
    jobRuns: await JobRun.find({}).select('-lastError')
  };
};

// Restore database from dump object
const restoreDatabaseDump = async (dump) => {
  console.log('[backup-service] Restoring database from upload dump...');
  
  // Destructive wipe
  await Branch.deleteMany({});
  // Authentication records are never replaced from an online backup payload.
  await Employee.deleteMany({});
  await Customer.deleteMany({});
  await Vendor.deleteMany({});
  await Product.deleteMany({});
  await StockHistory.deleteMany({});
  await Order.deleteMany({});
  await Quotation.deleteMany({});
  await Bill.deleteMany({});
  await Payment.deleteMany({});
  await PurchaseOrder.deleteMany({});
  await StockAdjustment.deleteMany({});
  await Expense.deleteMany({});
  await Setting.deleteMany({});
  await AuditLog.deleteMany({});
  await JobRun.deleteMany({});

  // Restore collections
  if (dump.branches) await Branch.insertMany(dump.branches);
  if (dump.employees) await Employee.insertMany(dump.employees);
  if (dump.customers) await Customer.insertMany(dump.customers);
  if (dump.vendors) await Vendor.insertMany(dump.vendors);
  if (dump.products) await Product.insertMany(dump.products);
  if (dump.stockHistory) await StockHistory.insertMany(dump.stockHistory);
  if (dump.orders) await Order.insertMany(dump.orders);
  if (dump.quotations) await Quotation.insertMany(dump.quotations);
  if (dump.bills) await Bill.insertMany(dump.bills);
  if (dump.payments) await Payment.insertMany(dump.payments);
  if (dump.purchaseOrders) await PurchaseOrder.insertMany(dump.purchaseOrders);
  if (dump.stockAdjustments) await StockAdjustment.insertMany(dump.stockAdjustments);
  if (dump.expenses) await Expense.insertMany(dump.expenses);
  if (dump.settings) await Setting.insertMany(dump.settings);
  if (dump.auditLogs) await AuditLog.insertMany(dump.auditLogs);
  if (dump.jobRuns) await JobRun.insertMany(dump.jobRuns);

  console.log('[backup-service] Database restore execution completed.');
};

module.exports = {
  generateDatabaseDump,
  restoreDatabaseDump
};

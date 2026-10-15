const express = require('express');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const authController = require('../controllers/authController');
const shopController = require('../controllers/shopController');
const advancedShopController = require('../controllers/advancedShopController');

const router = express.Router();

router.param('id', (req, res, next, id) => {
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid resource identifier' });
  }
  return next();
});

// The production pilot has one named owner account and no self-service registration.
router.post('/auth/login', authController.login);

// Every route below this line requires a cryptographically verified token.
router.use(auth.verifyToken);
router.get('/auth/me', authController.me);
router.post('/auth/change-password', authController.changePassword);

// Every application operation is restricted to the named owner account.
router.use(auth.requireAdmin);

router.get('/dashboard/stats', shopController.getDashboardStats);
router.get('/notifications', shopController.getNotifications);
router.put('/notifications/:id/read', shopController.markNotificationRead);

router.get('/products', shopController.getProducts);
router.post('/orders', shopController.createOrder);
router.get('/orders', shopController.getOrders);
router.get('/bills/:id/pdf', shopController.getBillPDF);

router.post('/customers', shopController.createCustomer);
router.get('/customers', shopController.getCustomers);
router.get('/customers/:id', shopController.getCustomerProfile);
router.put('/customers/:id', shopController.updateCustomer);
router.delete('/customers/:id', auth.requireAdmin, shopController.deleteCustomer);

router.post('/vendors', shopController.createVendor);
router.get('/vendors', shopController.getVendors);
router.put('/vendors/:id', shopController.updateVendor);
router.delete('/vendors/:id', auth.requireAdmin, shopController.deleteVendor);

router.post('/batches', advancedShopController.createBatch);
router.get('/batches', advancedShopController.getBatches);
router.get('/products/expiry-alerts', advancedShopController.getExpiryAlerts);

router.post('/products', shopController.createProduct);
router.put('/products/:id', shopController.updateProduct);
router.put('/products/:id/adjust', shopController.adjustStock);
router.post('/products/quick-stock-in', shopController.bulkQuickStockIn);
router.post('/products/quick-issue', shopController.quickExpressIssue);
router.delete('/products/:id', auth.requireAdmin, shopController.deleteProduct);

router.put('/orders/:id', shopController.updateSalesOrder);
router.post('/orders/process-recurring', shopController.processRecurringOrders);
router.post('/orders/:id/process-loop-now', shopController.processSingleRecurringOrder);
router.put('/orders/:id/status', shopController.updateOrderStatus);

router.post('/quotations', shopController.createQuotation);
router.get('/quotations', shopController.getQuotations);
router.put('/quotations/:id', shopController.updateQuotation);
router.post('/quotations/:id/convert', shopController.convertQuotationToOrder);
router.get('/bills', shopController.getBills);
router.get('/quotations/:id/pdf', shopController.getQuotationPDF);

router.post('/payments', shopController.recordPayment);
router.get('/payments', shopController.getPayments);
router.post('/payments/reminder', shopController.sendPaymentReminder);

router.get('/settings', auth.requireAdmin, shopController.getSettings);
router.put('/settings', auth.requireAdmin, shopController.updateSettings);

router.get('/reports/sales', shopController.getSalesReport);
router.get('/reports/stock', shopController.getStockReport);
router.get('/reports/delivery', shopController.getDeliveryReport);
router.get('/reports/outstanding', shopController.getOutstandingReport);
router.get('/reports/ledger', shopController.getCustomerLedgerReport);
router.get('/customer-ledgers/summary', shopController.getCustomerLedgersSummary);
router.post('/customer-ledgers/record-payment', shopController.recordLedgerPayment);

router.post('/branches', auth.requireAdmin, advancedShopController.createBranch);
router.get('/branches', advancedShopController.getBranches);

router.post('/quotations/:id/convert-invoice', advancedShopController.convertQuotationToInvoice);
router.post('/purchases', advancedShopController.createPurchaseOrder);
router.get('/purchases', advancedShopController.getPurchaseOrders);
router.put('/purchases/:id', advancedShopController.updatePurchaseOrder);
router.put('/purchases/:id/receive', advancedShopController.receivePurchaseOrder);

router.put('/products/:id/adjust-manual', advancedShopController.manualAdjustProductStock);
router.get('/products/reorder-list', advancedShopController.getReorderList);
router.get('/products/:id/stock-logs', advancedShopController.getProductStockLog);
router.post('/expenses', advancedShopController.createExpense);
router.get('/expenses', advancedShopController.getExpenses);
router.delete('/expenses/:id', auth.requireAdmin, advancedShopController.deleteExpense);

router.get('/data/backup', auth.requireAdmin, advancedShopController.exportBackupJSON);
router.post('/data/restore', auth.requireAdmin, advancedShopController.importBackupJSON);
router.post('/data/import-bulk', auth.requireAdmin, advancedShopController.bulkImportExcel);
router.get('/data/audit-logs', auth.requireAdmin, advancedShopController.getAuditLogs);
router.post('/bulk/delete', auth.requireAdmin, advancedShopController.bulkDelete);
router.post('/bulk/status', auth.requireAdmin, advancedShopController.bulkUpdateStatus);

module.exports = router;

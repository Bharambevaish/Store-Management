const Branch = require('../models/branch');
const Employee = require('../models/employee');
const User = require('../models/user');
const PurchaseOrder = require('../models/purchaseOrder');
const AuditLog = require('../models/auditLog');
const whatsappClient = require('../services/whatsappClient');
const Product = require('../models/product');
const StockHistory = require('../models/stockHistory');
const StockAdjustment = require('../models/stockAdjustment');
const Expense = require('../models/expense');
const Quotation = require('../models/quotation');
const Bill = require('../models/bill');
const Customer = require('../models/customer');
const Vendor = require('../models/vendor');
const Setting = require('../models/setting');
const Notification = require('../models/notification');
const auditService = require('../services/auditService');
const env = require('../config/env');
const logger = require('../services/logger');

const pick = (source, fields) => Object.fromEntries(
  fields.filter((field) => Object.prototype.hasOwnProperty.call(source, field)).map((field) => [field, source[field]])
);
const isStrongPassword = (password) => typeof password === 'string' && password.length >= 12 &&
  /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password);
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const backupService = require('../services/backupService');
const Order = require('../models/order');
const Payment = require('../models/payment');
const Batch = require('../models/batch');

// ==================== BATCH & EXPIRY MANAGEMENT ====================

exports.createBatch = async (req, res) => {
  try {
    const { productId, batchNumber, expiryDate, mfgDate, quantity, purchasePrice, retailPrice, vendorId, branchId } = req.body;
    if (!productId || !batchNumber || quantity === undefined) {
      return res.status(400).json({ error: 'productId, batchNumber, and quantity are required' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const qty = Number(quantity);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive number greater than 0' });
    }

    if (mfgDate && expiryDate) {
      const mfg = new Date(mfgDate);
      const exp = new Date(expiryDate);
      if (exp <= mfg) {
        return res.status(400).json({ error: 'Expiry Date must be strictly after Manufacturing Date' });
      }
    }

    const batch = new Batch({
      product: productId,
      batchNumber: batchNumber.trim(),
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      mfgDate: mfgDate ? new Date(mfgDate) : null,
      quantity: qty,
      purchasePrice: purchasePrice !== undefined ? Number(purchasePrice) : product.purchasePrice || 0,
      retailPrice: retailPrice !== undefined ? Number(retailPrice) : product.price || 0,
      vendor: vendorId || product.linkedVendor || null,
      branch: branchId || product.branch || null
    });
    await batch.save();

    // Increment product currentStock
    product.currentStock = (product.currentStock || 0) + qty;
    await product.save();

    // Log stock history
    const history = new StockHistory({
      product: productId,
      quantity: qty,
      type: 'in',
      reason: `Batch Registration (${batchNumber.trim()})`
    });
    await history.save();

    res.status(201).json(batch);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getBatches = async (req, res) => {
  try {
    const { productId, category } = req.query;
    const filter = {};
    if (productId) filter.product = productId;

    const batches = await Batch.find(filter)
      .populate('product', 'name category unit price hsnCode hasExpiryTracking')
      .populate('vendor', 'name contact')
      .populate('branch', 'name')
      .sort({ expiryDate: 1 });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const enriched = batches.map(b => {
      const doc = b.toObject();
      if (b.expiryDate) {
        const exp = new Date(b.expiryDate);
        exp.setHours(0, 0, 0, 0);
        const diffTime = exp.getTime() - today.getTime();
        const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        doc.remainingDays = remainingDays;
        doc.isExpired = remainingDays < 0;
      } else {
        doc.remainingDays = null;
        doc.isExpired = false;
      }
      return doc;
    });

    if (category) {
      const filtered = enriched.filter(b => {
        if (b.remainingDays === null) return false;
        if (category === 'expired') return b.remainingDays < 0;
        if (category === '7days') return b.remainingDays >= 0 && b.remainingDays <= 7;
        if (category === '15days') return b.remainingDays >= 0 && b.remainingDays <= 15;
        if (category === '30days') return b.remainingDays >= 0 && b.remainingDays <= 30;
        return true;
      });
      return res.json(filtered);
    }

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getExpiryAlerts = async (req, res) => {
  try {
    const batches = await Batch.find({ expiryDate: { $ne: null } })
      .populate('product', 'name category unit price hsnCode')
      .populate('vendor', 'name contact')
      .populate('branch', 'name')
      .sort({ expiryDate: 1 });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expired = [];
    const within7Days = [];
    const within15Days = [];
    const within30Days = [];

    batches.forEach(b => {
      const doc = b.toObject();
      const exp = new Date(b.expiryDate);
      exp.setHours(0, 0, 0, 0);
      const diffTime = exp.getTime() - today.getTime();
      const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      doc.remainingDays = remainingDays;

      if (remainingDays < 0) {
        expired.push(doc);
      } else if (remainingDays <= 7) {
        within7Days.push(doc);
      } else if (remainingDays <= 15) {
        within15Days.push(doc);
      } else if (remainingDays <= 30) {
        within30Days.push(doc);
      }
    });

    res.json({
      expired,
      within7Days,
      within15Days,
      within30Days,
      totalCount: expired.length + within7Days.length + within15Days.length + within30Days.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== BRANCH MANAGEMENT ====================

exports.createBranch = async (req, res) => {
  try {
    const { name, address, contact } = req.body;
    if (!name || !address || !contact) {
      return res.status(400).json({ error: 'Name, address and contact details are required' });
    }
    const branch = new Branch({ name, address, contact });
    await branch.save();
    
    // Log audit trail
    await auditService.logAction(
      req.ctx ? req.ctx.userId : req.user ? req.user.id : null,
      'create',
      'Branch',
      branch._id,
      { name }
    );

    res.status(201).json(branch);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getBranches = async (req, res) => {
  try {
    const branches = await Branch.find({}).sort({ name: 1 });
    res.json(branches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== EMPLOYEE MODULE ====================

exports.createEmployee = async (req, res) => {
  try {
    const { name, mobile, role, joiningDate, branchId, email, password } = req.body;
    if (!name || !mobile || !role || !branchId) {
      return res.status(400).json({ error: 'Name, mobile, role, and branchId are required' });
    }

    let linkedUser = null;
    if (email && password) {
      if (!isStrongPassword(password)) {
        return res.status(400).json({ error: 'Password must be at least 12 characters and include upper-case, lower-case, and numeric characters' });
      }
      // Check if user exists
      const exists = await User.findOne({ email });
      if (exists) return res.status(400).json({ error: 'Email already mapped to an active login account' });

      // Map role to login role
      let userRole = 'staff';
      if (role === 'Admin') userRole = 'admin';
      if (role === 'Manager') userRole = 'staff'; // manager role check handled inside permissions middleware

      const user = new User({
        name,
        email,
        password,
        mobile,
        role: userRole,
        status: 'Active'
      });
      await user.save();
      linkedUser = user._id;
    }

    const employee = new Employee({
      name,
      mobile,
      role,
      joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
      user: linkedUser,
      branch: branchId,
      status: 'Active'
    });
    await employee.save();

    await auditService.logAction(
      req.ctx ? req.ctx.userId : req.user ? req.user.id : null,
      'create',
      'Employee',
      employee._id,
      { name, role }
    );

    res.status(201).json(employee);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getEmployees = async (req, res) => {
  try {
    const { branchId } = req.query;
    const filter = {};
    if (branchId) filter.branch = branchId;

    const employees = await Employee.find(filter)
      .populate('branch', 'name')
      .populate('user', 'email role')
      .sort({ name: 1 });
    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateEmployee = async (req, res) => {
  try {
    const updates = pick(req.body, ['name', 'mobile', 'role', 'joiningDate', 'branch', 'status', 'profilePhoto']);
    const updated = await Employee.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
      .populate('branch', 'name');
    if (!updated) return res.status(404).json({ error: 'Employee not found' });

    await auditService.logAction(
      req.ctx ? req.ctx.userId : req.user ? req.user.id : null,
      'update',
      'Employee',
      updated._id,
      { name: updated.name, status: updated.status }
    );

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    if (employee.user) {
      await User.findByIdAndDelete(employee.user);
    }
    await Employee.findByIdAndDelete(req.params.id);

    await auditService.logAction(
      req.ctx ? req.ctx.userId : req.user ? req.user.id : null,
      'delete',
      'Employee',
      employee._id,
      { name: employee.name }
    );

    res.json({ message: 'Employee deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getEmployeePerformance = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.deliveryDate = {};
      if (startDate) dateFilter.deliveryDate.$gte = new Date(startDate);
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        dateFilter.deliveryDate.$lte = eDate;
      }
    }

    const employees = await Employee.find({ role: 'Delivery Staff' });
    const performanceReport = [];

    for (const emp of employees) {
      // Find orders linked to this employee's login user account
      if (!emp.user) continue;

      const orders = await Order.find({
        assignedStaff: emp.user,
        status: 'Delivered',
        ...dateFilter
      });

      let totalDeliveryTime = 0;
      let onTimeCount = 0;
      let delayedCount = 0;

      orders.forEach(order => {
        if (order.deliveredAt && order.createdAt) {
          const diffInMinutes = Math.floor((new Date(order.deliveredAt) - new Date(order.createdAt)) / 60000);
          totalDeliveryTime += diffInMinutes;

          // Delivery is on-time if completed within 24 hours of deliveryDate schedule
          const schedLimit = new Date(order.deliveryDate);
          schedLimit.setHours(23, 59, 59, 999);
          if (new Date(order.deliveredAt) <= schedLimit) {
            onTimeCount++;
          } else {
            delayedCount++;
          }
        }
      });

      const avgTime = orders.length > 0 ? Math.floor(totalDeliveryTime / orders.length) : 0;

      performanceReport.push({
        employeeId: emp._id,
        name: emp.name,
        mobile: emp.mobile,
        branchName: emp.branch ? (await Branch.findById(emp.branch))?.name : 'N/A',
        deliveriesCompleted: orders.length,
        averageDeliveryTimeInMinutes: avgTime,
        onTimeDeliveries: onTimeCount,
        delayedDeliveries: delayedCount
      });
    }

    res.json(performanceReport);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== QUOTATION TO BILL/INVOICE ====================

exports.convertQuotationToInvoice = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id).populate('customer');
    if (!quotation) return res.status(404).json({ error: 'Quotation proposal not found' });
    
    if (quotation.status === 'Converted') {
      return res.status(400).json({ error: 'Quotation already converted to an invoice' });
    }

    // Generate Invoice sequence
    const invoiceCount = await Bill.countDocuments({});
    const invoiceNumber = (invoiceCount + 1).toString().padStart(3, '0');

    // GST calculations based on customer state vs shop setting
    const settings = await Setting.findOne({}) || new Setting();
    const isInterState = quotation.customer.state && settings.state && 
                        quotation.customer.state.toLowerCase().trim() !== settings.state.toLowerCase().trim();

    const subtotal = quotation.totalAmount;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;

    if (isInterState) {
      igstTotal = subtotal * 0.18; // 18% standard IGST
    } else {
      cgstTotal = subtotal * 0.09; // 9% CGST
      sgstTotal = subtotal * 0.09; // 9% SGST
    }

    const grandTotal = subtotal + cgstTotal + sgstTotal + igstTotal;

    // Check stock availability before converting
    const billItems = [];
    const productsToDeduct = [];
    for (const item of quotation.items) {
      const p = await Product.findById(item.product);
      if (!p) {
        return res.status(404).json({ error: `Product not found: ${item.product}` });
      }
      if (p.currentStock < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for product: ${p.name}. Available: ${p.currentStock}, Required: ${item.quantity}` });
      }
      productsToDeduct.push({ product: p, quantity: item.quantity });
      billItems.push({
        product: item.product,
        quantity: item.quantity,
        price: item.price,
        cgst: isInterState ? 0 : 9,
        sgst: isInterState ? 0 : 9,
        igst: isInterState ? 18 : 0
      });
    }

    const bill = new Bill({
      invoiceNumber,
      customer: quotation.customer._id,
      items: billItems,
      subtotal,
      cgstTotal,
      sgstTotal,
      igstTotal,
      totalAmount: grandTotal,
      status: 'Unpaid',
      quotationRef: quotation._id,
      branch: quotation.customer.branch || null
    });
    await bill.save();

    // Deduct stock and log history for each item
    for (const { product, quantity } of productsToDeduct) {
      product.currentStock -= quantity;
      await product.save();

      await StockHistory.create({
        product: product._id,
        type: 'out',
        quantity,
        reason: 'sale'
      });

      // Trigger low stock notification if applicable
      if (product.currentStock <= (product.lowStockThreshold || 10)) {
        await Notification.create({
          type: 'low_stock',
          title: 'Low Stock Alert',
          message: `Low stock alert: ${product.name} has only ${product.currentStock} units remaining`,
          relatedId: product._id
        });
      }
    }

    // Mark quotation status
    quotation.status = 'Converted';
    await quotation.save();

    await auditService.logAction(
      req.ctx ? req.ctx.userId : req.user ? req.user.id : null,
      'create',
      'Bill',
      bill._id,
      { invoiceNumber, fromQuotation: quotation._id }
    );

    res.status(201).json({ message: 'Quotation converted successfully to Tax Invoice Bill!', bill });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== PROCUREMENT & PURCHASE ORDERS ====================

exports.createPurchaseOrder = async (req, res) => {
  try {
    let { supplierId, items, expectedDeliveryDate, branchId } = req.body;
    supplierId = (supplierId && typeof supplierId === 'object' && supplierId._id) ? supplierId._id : supplierId;
    branchId = (branchId && typeof branchId === 'object' && branchId._id) ? branchId._id : branchId;
    if (!branchId) {
      const Branch = require('../models/branch');
      const defaultBranch = await Branch.findOne({});
      branchId = defaultBranch?._id;
    }
    if (!supplierId || !items || !items.length || !expectedDeliveryDate || !branchId) {
      return res.status(400).json({ error: 'Supplier, items list, delivery date, and branchId are required' });
    }

    let totalCost = 0;
    const poItems = [];
    for (const it of items) {
      const productId = (it.product && typeof it.product === 'object' && it.product._id) ? it.product._id : it.product;
      const p = await Product.findById(productId);
      if (!p) return res.status(404).json({ error: `Product not found: ${productId}` });
      totalCost += Number(it.costPrice) * Number(it.quantity);
      poItems.push({
        product: productId,
        quantity: Number(it.quantity),
        costPrice: Number(it.costPrice)
      });
    }

    const po = new PurchaseOrder({
      supplier: supplierId,
      items: poItems,
      totalCost,
      expectedDeliveryDate: new Date(expectedDeliveryDate),
      branch: branchId,
      status: 'Ordered'
    });

    await po.save();

    await auditService.logAction(
      req.ctx ? req.ctx.userId : req.user ? req.user.id : null,
      'create',
      'PurchaseOrder',
      po._id,
      { totalCost }
    );

    // ==================== SEND WHATSAPP TO VENDOR ====================
    try {
      const vendor = await Vendor.findById(supplierId);
      const settings = await Setting.findOne({});
      
      if (vendor && vendor.contact && settings && settings.whatsappToken && settings.whatsappPhoneId) {
        let mobile = vendor.contact.replace(/\D/g, '');
        if (mobile.length === 10) mobile = `91${mobile}`;

        const msg = `Hello ${vendor.name},\n\nA new Purchase Order (Ref: PO-${po._id.toString().substring(18).toUpperCase()}) has been dispatched to you from our company.\n\nTotal Items: ${poItems.length}\nExpected Delivery Date: ${new Date(expectedDeliveryDate).toLocaleDateString()}\n\nPlease check your email/portal for the full PO document.\n\nThank you!`;

        const url = `https://graph.facebook.com/v17.0/${settings.whatsappPhoneId}/messages`;
        fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${settings.whatsappToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: mobile,
            type: 'text',
            text: { body: msg }
          })
        }).catch((err) => logger.write('error', 'vendor_notification_failed', logger.errorDetails(err, req.id)));
      }
    } catch (waErr) {
      logger.write('error', 'vendor_notification_failed', logger.errorDetails(waErr, req.id));
    }
    // =================================================================

    res.status(201).json(po);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getPurchaseOrders = async (req, res) => {
  try {
    const { branchId } = req.query;
    const filter = {};
    if (branchId) filter.branch = branchId;

    const pos = await PurchaseOrder.find(filter)
      .populate('supplier')
      .populate('branch', 'name')
      .populate('items.product')
      .sort({ createdAt: -1 });

    res.json(pos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.sendPurchaseOrderWhatsapp = async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id).populate('supplier');
    if (!po) return res.status(404).json({ error: 'Purchase Order not found' });

    const vendor = po.supplier;
    if (!vendor || !vendor.contact) {
      return res.status(400).json({ error: 'This vendor does not have a contact number saved.' });
    }

    const settings = await Setting.findOne({});
    let mobile = vendor.contact.replace(/\D/g, '');
    if (mobile.length === 10) mobile = `91${mobile}`;

    const msg = `Hello ${vendor.name},\n\nA friendly reminder about Purchase Order (Ref: PO-${po._id.toString().substring(18).toUpperCase()}) dispatched to you.\n\nTotal Items: ${po.items.length}\nExpected Delivery Date: ${new Date(po.expectedDeliveryDate).toLocaleDateString()}\nStatus: ${po.status}\n\nPlease update us on the delivery schedule. Thank you!`;

    if (settings && settings.whatsappProvider === 'local') {
      try {
        await whatsappClient.sendMessage(mobile, msg);
        return res.json({ message: 'WhatsApp notification sent successfully via Local Client!', po });
      } catch (err) {
        return res.status(500).json({ error: 'Local WhatsApp client error: ' + err.message });
      }
    }

    if (!settings || !settings.whatsappToken || !settings.whatsappPhoneId) {
      return res.status(400).json({ error: 'WhatsApp API credentials are not configured. Please go to the WhatsApp page -> API Configuration tab to set them up.' });
    }

    const url = `https://graph.facebook.com/v17.0/${settings.whatsappPhoneId}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.whatsappToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: mobile,
        type: 'text',
        text: { body: msg }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Failed to send WhatsApp message' });
    }

    res.json({ message: 'WhatsApp notification sent successfully!', po });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.receivePurchaseOrder = async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ error: 'Purchase Order not found' });
    if (['Fully Received', 'Received', 'Locked', 'Cancelled'].includes(po.status)) {
      return res.status(400).json({ error: `Cannot receive items for a PO with status "${po.status}"` });
    }

    const { items: receivedItems } = req.body; // array of { productId, receiveQty, location, remarks }
    const receivedBatchItems = [];
    let anyStockAdded = false;

    if (receivedItems && Array.isArray(receivedItems) && receivedItems.length > 0) {
      // Partial / Specific line item receiving
      for (const rItem of receivedItems) {
        const qtyToReceive = Number(rItem.receiveQty) || 0;
        if (qtyToReceive <= 0) continue;

        const poItem = po.items.find(it => it.product.toString() === rItem.productId.toString());
        if (!poItem) continue;

        const alreadyReceived = poItem.receivedQuantity || 0;
        const pendingQty = poItem.quantity - alreadyReceived;

        if (qtyToReceive > pendingQty) {
          return res.status(400).json({ 
            error: `Cannot receive ${qtyToReceive} units. Maximum pending quantity is ${pendingQty}.` 
          });
        }

        poItem.receivedQuantity = alreadyReceived + qtyToReceive;

        // Increase product stock
        const product = await Product.findById(poItem.product);
        if (product) {
          product.currentStock += qtyToReceive;
          await product.save();

          await StockHistory.create({
            product: product._id,
            quantity: qtyToReceive,
            type: 'in',
            reason: 'purchase'
          });
        }

        receivedBatchItems.push({
          product: poItem.product,
          quantity: qtyToReceive,
          location: rItem.location || 'Main Warehouse',
          remarks: rItem.remarks || 'Partial receive'
        });
        anyStockAdded = true;
      }
    } else {
      // Full receive all remaining items fallback
      for (const poItem of po.items) {
        const alreadyReceived = poItem.receivedQuantity || 0;
        const pendingQty = poItem.quantity - alreadyReceived;
        if (pendingQty <= 0) continue;

        poItem.receivedQuantity = poItem.quantity;

        const product = await Product.findById(poItem.product);
        if (product) {
          product.currentStock += pendingQty;
          await product.save();

          await StockHistory.create({
            product: product._id,
            quantity: pendingQty,
            type: 'in',
            reason: 'purchase'
          });
        }

        receivedBatchItems.push({
          product: poItem.product,
          quantity: pendingQty,
          location: 'Main Warehouse',
          remarks: 'Full receive'
        });
        anyStockAdded = true;
      }
    }

    if (!anyStockAdded) {
      return res.status(400).json({ error: 'No quantities entered to receive.' });
    }

    // Evaluate overall PO status
    const allFullyReceived = po.items.every(it => (it.receivedQuantity || 0) >= it.quantity);
    po.status = allFullyReceived ? 'Fully Received' : 'Partially Received';

    // Push to receiving history
    if (!po.receivingHistory) po.receivingHistory = [];
    po.receivingHistory.push({
      receivedBy: req.user ? req.user.name || 'Admin' : 'Admin',
      date: new Date(),
      items: receivedBatchItems
    });

    await po.save();

    const updatedPo = await PurchaseOrder.findById(po._id)
      .populate('supplier')
      .populate('branch', 'name')
      .populate('items.product')
      .populate('receivingHistory.items.product');

    await auditService.logAction(
      req.ctx ? req.ctx.userId : req.user ? req.user.id : null,
      'update',
      'PurchaseOrder',
      po._id,
      { status: po.status, receivedItemsCount: receivedBatchItems.length }
    );

    res.json({ message: `Purchase Order received successfully (${po.status})! 📦`, po: updatedPo });
  } catch (err) {
    logger.write('error', 'purchase_receive_failed', logger.errorDetails(err, req.id));
    res.status(500).json({ error: err.message });
  }
};

exports.updatePurchaseOrder = async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ error: 'Purchase Order not found' });
    
    if (['Fully Received', 'Received', 'Locked', 'Cancelled'].includes(po.status)) {
      return res.status(400).json({ error: `Cannot edit Purchase Order with status "${po.status}"` });
    }

    const { supplierId, items, expectedDeliveryDate, status } = req.body;
    if (supplierId) po.supplier = supplierId;
    if (expectedDeliveryDate) po.expectedDeliveryDate = new Date(expectedDeliveryDate);
    if (status && ['Pending', 'Ordered', 'Locked', 'Cancelled'].includes(status)) {
      po.status = status;
    }

    if (items && Array.isArray(items) && items.length > 0) {
      let totalCost = 0;
      const poItems = [];
      for (const it of items) {
        const p = await Product.findById(it.product);
        if (!p) return res.status(404).json({ error: `Product not found: ${it.product}` });
        const qty = Number(it.quantity);
        const cost = Number(it.costPrice);
        totalCost += cost * qty;

        // Preserve existing receivedQuantity if present
        const existingPoItem = po.items.find(oldIt => oldIt.product.toString() === it.product.toString());
        const recQty = existingPoItem ? existingPoItem.receivedQuantity || 0 : 0;

        poItems.push({
          product: it.product,
          quantity: qty,
          costPrice: cost,
          receivedQuantity: recQty
        });
      }
      po.items = poItems;
      po.totalCost = totalCost;
    }

    await po.save();

    const updatedPo = await PurchaseOrder.findById(po._id)
      .populate('supplier')
      .populate('branch', 'name')
      .populate('items.product');

    res.json({ message: 'Purchase Order updated successfully! ✅', po: updatedPo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== MANUAL STOCK ADJUSTMENTS ====================

exports.manualAdjustProductStock = async (req, res) => {
  try {
    const { newQty, reason } = req.body;
    if (newQty === undefined || !reason) {
      return res.status(400).json({ error: 'New quantity level and reason are required' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product catalog entry not found' });

    const oldQty = product.currentStock;
    product.currentStock = Number(newQty);
    await product.save();

    let userId = req.ctx ? req.ctx.userId : req.user ? req.user.id : null;
    if (!userId) {
      const User = require('../models/user');
      const fallbackUser = await User.findOne({ role: 'admin' });
      if (fallbackUser) userId = fallbackUser._id;
    }

    // Log Stock Adjustment audit trail
    const adjustment = new StockAdjustment({
      product: product._id,
      oldQty,
      newQty: Number(newQty),
      adjustedBy: userId,
      reason
    });
    await adjustment.save();

    // Log Stock History
    const qtyDiff = Math.abs(Number(newQty) - oldQty);
    const adjustType = Number(newQty) >= oldQty ? 'in' : 'out';

    await StockHistory.create({
      product: product._id,
      quantity: qtyDiff,
      type: adjustType,
      reason: 'adjustment'
    });

    await auditService.logAction(
      userId,
      'update',
      'ProductStock',
      product._id,
      { oldQty, newQty: Number(newQty), reason }
    );

    res.json({ product, adjustment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getReorderList = async (req, res) => {
  try {
    const { branchId } = req.query;
    const filter = {};
    if (branchId) filter.branch = branchId;

    const products = await Product.find(filter).populate('linkedVendor', 'name');
    const reorderList = products.filter(p => p.currentStock <= p.lowStockThreshold);
    res.json(reorderList);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getProductStockLog = async (req, res) => {
  try {
    const logs = await StockHistory.find({ product: req.params.id })
      .sort({ timestamp: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== EXPENSE MODULE ====================

exports.createExpense = async (req, res) => {
  try {
    const { category, amount, date, notes, receiptImage, branchId } = req.body;
    if (!category || !amount || !branchId) {
      return res.status(400).json({ error: 'Category, amount, and branchId are required' });
    }
    
    const expense = new Expense({
      category,
      amount: Number(amount),
      date: date ? new Date(date) : new Date(),
      notes,
      receiptImage,
      branch: branchId
    });
    await expense.save();

    await auditService.logAction(
      req.ctx ? req.ctx.userId : req.user ? req.user.id : null,
      'create',
      'Expense',
      expense._id,
      { category, amount }
    );

    res.status(201).json(expense);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getExpenses = async (req, res) => {
  try {
    const { branchId } = req.query;
    const filter = {};
    if (branchId) filter.branch = branchId;

    const expenses = await Expense.find(filter)
      .populate('branch', 'name')
      .sort({ date: -1 });
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findByIdAndDelete(req.params.id);
    if (!expense) return res.status(404).json({ error: 'Expense not found' });

    await auditService.logAction(
      req.ctx ? req.ctx.userId : req.user ? req.user.id : null,
      'delete',
      'Expense',
      expense._id,
      { category: expense.category, amount: expense.amount }
    );

    res.json({ message: 'Expense deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== BACKUP, RESTORE & AUDIT LOGS ====================

exports.exportBackupJSON = async (req, res) => {
  try {
    const data = await backupService.generateDatabaseDump();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=shop_backup.json');
    res.send(JSON.stringify(data, null, 2));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.importBackupJSON = async (req, res) => {
  try {
    if (!env.ONLINE_RESTORE_ENABLED) {
      return res.status(403).json({ error: 'Online database restore is disabled; use the audited offline restore procedure' });
    }
    const dump = req.body;
    if (!dump || typeof dump !== 'object') {
      return res.status(400).json({ error: 'Valid JSON backup object is required' });
    }
    await backupService.restoreDatabaseDump(dump);
    
    // Log audit trail
    await auditService.logAction(
      req.ctx ? req.ctx.userId : req.user ? req.user.id : null,
      'update',
      'SystemDatabase',
      req.ctx ? req.ctx.userId : req.user ? req.user.id : null,
      'Full database restore operation executed'
    );

    res.json({ message: 'Database restore operation completed successfully! ✅' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAuditLogs = async (req, res) => {
  try {
    const { user, entity, startDate, endDate } = req.query;
    const filter = {};
    if (user) filter.user = user;
    if (entity) filter.entity = entity;
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        filter.timestamp.$lte = eDate;
      }
    }

    const logs = await AuditLog.find(filter)
      .populate('user', 'name email')
      .sort({ timestamp: -1 })
      .limit(100);

    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


exports.sendQuotationWhatsapp = async (req, res) => {
  try {
    const Quotation = require('../models/quotation'); // Make sure we have it imported
    const quotation = await Quotation.findById(req.params.id).populate('customer').populate('items.product');
    if (!quotation) return res.status(404).json({ error: 'Quotation not found' });

    const customer = quotation.customer;
    if (!customer || !customer.mobile) {
      return res.status(400).json({ error: 'This customer does not have a mobile number saved.' });
    }

    const settings = await Setting.findOne({});

    let mobile = customer.mobile.replace(/\D/g, '');
    if (!mobile.startsWith('91') && mobile.length === 10) {
      mobile = '91' + mobile; // Default to India prefix if exactly 10 digits
    }

    const validDate = new Date(quotation.validUntil).toLocaleDateString();
    
    const totalAmount = quotation.totalAmount;
    // Replace literal \\n with standard \n for local client readability
    let itemsText = quotation.items.map(i => `- ${i.quantity}x ${i.product?.name || 'Item'} (Rs. ${i.price.toFixed(2)})`).join('\n');
    let messageText = `*Quotation/Cost Estimate*\n\nHello ${customer.name},\n\nHere is your requested quotation for the following items:\n\n${itemsText}\n\n*Total Amount:* Rs. ${totalAmount.toFixed(2)}\n*Valid Until:* ${validDate}\n\nThank you for choosing us!\n`;

    if (settings && settings.whatsappProvider === 'local') {
      try {
        await whatsappClient.sendMessage(mobile, messageText);
        return res.json({ message: 'Quotation sent successfully via Local WhatsApp! ✅', data: quotation });
      } catch (err) {
        return res.status(500).json({ error: 'Local WhatsApp client error: ' + err.message });
      }
    }

    if (!settings || !settings.whatsappToken || !settings.whatsappPhoneId) {
      return res.status(400).json({ error: 'WhatsApp API credentials are not configured. Please go to the WhatsApp page -> API Configuration tab to set them up.' });
    }
    
    // For Meta API, we use \\n because it gets JSON stringified in a certain way in some apps, though \n works perfectly fine in JSON.stringify too.
    let metaMessageText = `*Quotation/Cost Estimate*\\n\\nHello ${customer.name},\\n\\nHere is your requested quotation for the following items:\\n\\n${itemsText.replace(/\n/g, '\\n')}\\n\\n*Total Amount:* Rs. ${totalAmount.toFixed(2)}\\n*Valid Until:* ${validDate}\\n\\nThank you for choosing us!\\n`;

    const response = await fetch(`https://graph.facebook.com/v17.0/${settings.whatsappPhoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.whatsappToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: mobile,
        type: 'text',
        text: { body: metaMessageText }
      })
    });

    const data = await response.json();
    
    if (data.error) {
      return res.status(400).json({ error: data.error.message });
    }

    res.json({ message: 'Quotation sent successfully via WhatsApp! ✅', data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Generic bulk operations controller methods
exports.bulkDelete = async (req, res) => {
  try {
    const { model, ids } = req.body;
    if (!model || !ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Model name and array of IDs are required' });
    }

    let ModelClass;
    switch (model.toLowerCase()) {
      case 'customer':
        ModelClass = Customer;
        break;
      case 'vendor':
      case 'supplier':
        ModelClass = Vendor;
        break;
      case 'product':
        ModelClass = Product;
        break;
      case 'order':
        ModelClass = Order;
        break;
      case 'quotation':
      case 'quote':
        ModelClass = Quotation;
        break;
      case 'bill':
        ModelClass = Bill;
        break;
      case 'payment':
        ModelClass = Payment;
        break;
      case 'employee':
      case 'staff':
        ModelClass = Employee;
        break;
      case 'purchaseorder':
      case 'purchase':
        ModelClass = PurchaseOrder;
        break;
      case 'expense':
        ModelClass = Expense;
        break;
      default:
        return res.status(400).json({ error: `Unsupported bulk model: ${model}` });
    }

    // For employee, we also need to delete the user.
    if (model.toLowerCase() === 'employee' || model.toLowerCase() === 'staff') {
      const employees = await Employee.find({ _id: { $in: ids } });
      for (const emp of employees) {
        if (emp.user) {
          await User.findByIdAndDelete(emp.user);
        }
      }
    }

    const result = await ModelClass.deleteMany({ _id: { $in: ids } });

    // Log action
    await auditService.logAction(
      req.ctx ? req.ctx.userId : req.user ? req.user.id : null,
      'bulk_delete',
      model,
      null,
      { count: result.deletedCount, ids }
    );

    res.json({ message: `Successfully deleted ${result.deletedCount} items.`, deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.bulkUpdateStatus = async (req, res) => {
  try {
    const { model, ids, status, updates } = req.body;
    if (!model || !ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Model name and array of IDs are required' });
    }

    let ModelClass;
    switch (model.toLowerCase()) {
      case 'customer':
        ModelClass = Customer;
        break;
      case 'vendor':
      case 'supplier':
        ModelClass = Vendor;
        break;
      case 'product':
        ModelClass = Product;
        break;
      case 'order':
        ModelClass = Order;
        break;
      case 'quotation':
      case 'quote':
        ModelClass = Quotation;
        break;
      case 'bill':
        ModelClass = Bill;
        break;
      case 'payment':
        ModelClass = Payment;
        break;
      case 'employee':
      case 'staff':
        ModelClass = Employee;
        break;
      case 'purchaseorder':
      case 'purchase':
        ModelClass = PurchaseOrder;
        break;
      case 'expense':
        ModelClass = Expense;
        break;
      default:
        return res.status(400).json({ error: `Unsupported bulk model: ${model}` });
    }

    let updateFields = {};
    if (status !== undefined) {
      updateFields.status = status;
    }
    if (updates && typeof updates === 'object') {
      updateFields = { ...updateFields, ...updates };
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const result = await ModelClass.updateMany({ _id: { $in: ids } }, { $set: updateFields });

    // Log action
    await auditService.logAction(
      req.ctx ? req.ctx.userId : req.user ? req.user.id : null,
      'bulk_update',
      model,
      null,
      { count: result.modifiedCount, ids, updates: updateFields }
    );

    res.json({ message: `Successfully updated ${result.modifiedCount} items.`, modifiedCount: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Excel Bulk Import handler for Products, Customers, Suppliers
exports.bulkImportExcel = async (req, res) => {
  try {
    const { entityType, data } = req.body;
    if (!entityType || !Array.isArray(data) || data.length === 0 || data.length > 5000) {
      return res.status(400).json({ error: 'entityType and non-empty data array are required' });
    }

    const type = entityType.toLowerCase();
    const totalRows = data.length;
    let importedCount = 0;
    const failedRecords = [];

    if (type === 'products' || type === 'product') {
      const defaultVendor = await Vendor.findOne({});
      const defaultBranch = await Branch.findOne({});

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNum = i + 2; // Excel header is line 1

        const name = (row['Product Name'] || row.name || '').toString().trim();
        const category = (row['Category'] || row.category || '').toString().trim();
        const hsnCode = (row['HSN'] || row['HSN Code'] || row.hsnCode || '3004').toString().trim();
        const unit = (row['Unit'] || row.unit || '').toString().trim();
        const purchasePrice = Number(row['Purchase Price'] || row.purchasePrice || 0);
        const retailPrice = Number(row['Retail Price'] || row.price || row.retailPrice || 0);
        const initialStock = Number(row['Initial Stock'] || row.currentStock || row.initialStock || 0);
        const reorderLevel = Number(row['Reorder Level'] || row.lowStockThreshold || row.reorderLevel || 10);
        const supplierName = (row['Supplier'] || row.linkedVendor || '').toString().trim();
        const branchName = (row['Branch'] || row.branch || '').toString().trim();

        if (!name) {
          failedRecords.push({ row: rowNum, record: row, reason: 'Product Name is required' });
          continue;
        }
        if (!category) {
          failedRecords.push({ row: rowNum, record: row, reason: 'Category is required' });
          continue;
        }
        if (!unit) {
          failedRecords.push({ row: rowNum, record: row, reason: 'Unit is required' });
          continue;
        }
        if (isNaN(retailPrice) || retailPrice < 0) {
          failedRecords.push({ row: rowNum, record: row, reason: 'Retail Price must be a non-negative number' });
          continue;
        }
        if (isNaN(purchasePrice) || purchasePrice < 0) {
          failedRecords.push({ row: rowNum, record: row, reason: 'Purchase Price must be a non-negative number' });
          continue;
        }
        if (retailPrice < purchasePrice) {
          failedRecords.push({ row: rowNum, record: row, reason: 'Retail Price cannot be less than Purchase Price' });
          continue;
        }
        if (isNaN(initialStock) || initialStock < 0) {
          failedRecords.push({ row: rowNum, record: row, reason: 'Initial Stock must be 0 or greater' });
          continue;
        }

        // Supplier resolution
        let vendorId = defaultVendor ? defaultVendor._id : null;
        if (supplierName) {
          let foundVendor = await Vendor.findOne({ name: new RegExp(`^${escapeRegex(supplierName)}$`, 'i') });
          if (!foundVendor) {
            foundVendor = new Vendor({ name: supplierName, contact: '9999999999', address: 'Imported Vendor' });
            await foundVendor.save();
          }
          vendorId = foundVendor._id;
        }

        if (!vendorId) {
          failedRecords.push({ row: rowNum, record: row, reason: 'Vendor/Supplier is required' });
          continue;
        }

        // Branch resolution
        let branchId = defaultBranch ? defaultBranch._id : null;
        if (branchName) {
          const foundBranch = await Branch.findOne({ name: new RegExp(`^${escapeRegex(branchName)}$`, 'i') });
          if (foundBranch) branchId = foundBranch._id;
        }

        // Save product
        const product = new Product({
          name,
          category,
          unit,
          price: retailPrice,
          purchasePrice,
          currentStock: initialStock,
          lowStockThreshold: reorderLevel,
          linkedVendor: vendorId,
          hsnCode,
          branch: branchId
        });
        await product.save();
        importedCount++;
      }
    } else if (type === 'customers' || type === 'customer') {
      const defaultBranch = await Branch.findOne({});
      const seenMobiles = new Set();
      const seenGSTs = new Set();

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNum = i + 2;

        const name = (row['Customer Name'] || row.name || '').toString().trim();
        const mobile = (row['Mobile'] || row.mobile || '').toString().trim();
        const gstNumber = (row['GST'] || row.gstNumber || '').toString().trim().toUpperCase();
        const address = (row['Address'] || row.address || '').toString().trim();
        const creditLimit = Number(row['Credit Limit'] || row.creditLimit || 0);
        const notes = (row['Notes'] || row.notes || '').toString().trim();

        if (!name) {
          failedRecords.push({ row: rowNum, record: row, reason: 'Customer Name is required' });
          continue;
        }
        if (!mobile || !/^\d{10}$/.test(mobile)) {
          failedRecords.push({ row: rowNum, record: row, reason: 'Mobile must be exactly 10 numeric digits' });
          continue;
        }
        if (!address) {
          failedRecords.push({ row: rowNum, record: row, reason: 'Address is required' });
          continue;
        }

        // Duplicate check in current file
        if (seenMobiles.has(mobile)) {
          failedRecords.push({ row: rowNum, record: row, reason: `Duplicate Mobile number '${mobile}' in import file` });
          continue;
        }
        if (gstNumber && seenGSTs.has(gstNumber)) {
          failedRecords.push({ row: rowNum, record: row, reason: `Duplicate GST number '${gstNumber}' in import file` });
          continue;
        }

        // Duplicate check in DB
        const existingMobile = await Customer.findOne({ mobile });
        if (existingMobile) {
          failedRecords.push({ row: rowNum, record: row, reason: `Customer with mobile '${mobile}' already exists in database` });
          continue;
        }
        if (gstNumber) {
          const existingGst = await Customer.findOne({ gstNumber });
          if (existingGst) {
            failedRecords.push({ row: rowNum, record: row, reason: `Customer with GST '${gstNumber}' already exists in database` });
            continue;
          }
        }

        seenMobiles.add(mobile);
        if (gstNumber) seenGSTs.add(gstNumber);

        const customer = new Customer({
          name,
          mobile,
          gstNumber,
          address,
          creditLimit: isNaN(creditLimit) ? 0 : creditLimit,
          notes,
          branch: defaultBranch ? defaultBranch._id : null
        });
        await customer.save();
        importedCount++;
      }
    } else if (type === 'suppliers' || type === 'supplier' || type === 'vendors' || type === 'vendor') {
      const seenContacts = new Set();

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNum = i + 2;

        const name = (row['Supplier Name'] || row['Vendor Name'] || row.name || '').toString().trim();
        const contact = (row['Mobile'] || row.contact || row.mobile || '').toString().trim();
        const gstNumber = (row['GST'] || row.gstNumber || '').toString().trim().toUpperCase();
        const address = (row['Address'] || row.address || '').toString().trim();
        const contactPerson = (row['Contact Person'] || row.contactPerson || '').toString().trim();

        if (!name) {
          failedRecords.push({ row: rowNum, record: row, reason: 'Supplier Name is required' });
          continue;
        }
        if (!contact || !/^\d{10}$/.test(contact)) {
          failedRecords.push({ row: rowNum, record: row, reason: 'Mobile/Contact must be exactly 10 numeric digits' });
          continue;
        }
        if (!address) {
          failedRecords.push({ row: rowNum, record: row, reason: 'Address is required' });
          continue;
        }

        if (seenContacts.has(contact)) {
          failedRecords.push({ row: rowNum, record: row, reason: `Duplicate Mobile '${contact}' in import file` });
          continue;
        }

        const existingVendor = await Vendor.findOne({ $or: [{ name: new RegExp(`^${escapeRegex(name)}$`, 'i') }, { contact }] });
        if (existingVendor) {
          failedRecords.push({ row: rowNum, record: row, reason: `Supplier with name '${name}' or mobile '${contact}' already exists` });
          continue;
        }

        seenContacts.add(contact);

        const vendor = new Vendor({
          name,
          contact,
          address,
          itemCategories: contactPerson ? [contactPerson] : []
        });
        await vendor.save();
        importedCount++;
      }
    } else {
      return res.status(400).json({ error: `Unsupported entityType '${entityType}' for bulk import` });
    }

    res.json({
      totalRows,
      importedCount,
      failedCount: failedRecords.length,
      failedRecords
    });
  } catch (err) {
    logger.write('error', 'bulk_import_failed', logger.errorDetails(err, req.id));
    res.status(500).json({ error: err.message });
  }
};



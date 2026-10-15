const Customer = require('../models/customer');
const Vendor = require('../models/vendor');
const Product = require('../models/product');
const StockHistory = require('../models/stockHistory');
const Order = require('../models/order');
const Quotation = require('../models/quotation');
const Bill = require('../models/bill');
const Payment = require('../models/payment');
const Notification = require('../models/notification');
const Setting = require('../models/setting');
const User = require('../models/user');
const Employee = require('../models/employee');
const pdfService = require('../services/pdfService');
const notificationService = require('../services/notificationService');
const whatsappClient = require('../services/whatsappClient');
const logger = require('../services/logger');
const recurringOrderService = require('../services/recurringOrderService');

const pick = (source, fields) => Object.fromEntries(
  fields.filter((field) => Object.prototype.hasOwnProperty.call(source, field)).map((field) => [field, source[field]])
);
const isStrongPassword = (password) => typeof password === 'string' && password.length >= 12 &&
  /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password);
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ==================== DASHBOARD & NOTIFICATIONS ====================

exports.getDashboardStats = async (req, res) => {
  try {
    const totalCustomers = await Customer.countDocuments();
    const totalProducts = await Product.countDocuments();
    
    // Low stock count
    const products = await Product.find({});
    const lowStockAlerts = products.filter(p => p.currentStock <= p.lowStockThreshold);

    // Sales totals
    const bills = await Bill.find({});
    const totalSales = bills.reduce((sum, b) => sum + b.totalAmount, 0);

    // Filter today's vs monthly sales
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfThisMonth = new Date();
    startOfThisMonth.setDate(1);
    startOfThisMonth.setHours(0, 0, 0, 0);

    const todaySales = bills
      .filter(b => new Date(b.createdAt) >= startOfToday)
      .reduce((sum, b) => sum + b.totalAmount, 0);

    const monthSales = bills
      .filter(b => new Date(b.createdAt) >= startOfThisMonth)
      .reduce((sum, b) => sum + b.totalAmount, 0);

    // Payments and Outstanding dues
    const payments = await Payment.find({});
    const totalPaymentsReceived = payments.reduce((sum, p) => sum + p.amountPaid, 0);
    const totalOutstanding = Math.max(0, totalSales - totalPaymentsReceived);

    // Deliveries counts
    const todayEnd = new Date(startOfToday);
    todayEnd.setHours(23, 59, 59, 999);

    const tomorrowStart = new Date(startOfToday);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setHours(23, 59, 59, 999);

    const todayDeliveries = await Order.countDocuments({
      deliveryDate: { $gte: startOfToday, $lte: todayEnd },
      status: { $ne: 'Cancelled' }
    });

    const tomorrowDeliveries = await Order.countDocuments({
      deliveryDate: { $gte: tomorrowStart, $lte: tomorrowEnd },
      status: { $ne: 'Cancelled' }
    });

    const pendingDeliveries = await Order.countDocuments({
      status: { $in: ['Pending', 'Assigned', 'Packed', 'Out for Delivery'] }
    });

    // Recent transactions
    const recentPayments = await Payment.find({})
      .populate('customer')
      .sort({ date: -1 })
      .limit(5);

    // Customer dues list
    const customerList = await Customer.find({});
    const customerDues = [];
    for (const customer of customerList) {
      const custBills = await Bill.find({ customer: customer._id });
      const custPayments = await Payment.find({ customer: customer._id });
      const bSum = custBills.reduce((s, b) => s + b.totalAmount, 0);
      const pSum = custPayments.reduce((s, p) => s + p.amountPaid, 0);
      const outstanding = Math.max(0, bSum - pSum);
      if (outstanding > 0) {
        customerDues.push({
          customerId: customer._id,
          name: customer.name,
          mobile: customer.mobile,
          outstanding
        });
      }
    }
    customerDues.sort((a, b) => b.outstanding - a.outstanding);

    // Recurring order loops info
    const recurringOrders = await Order.find({ isRecurring: true })
      .populate('customer', 'name mobile')
      .populate('items.product', 'name price lowStockThreshold unit linkedVendor')
      .populate('assignedStaff', 'name email mobile')
      .sort({ createdAt: -1 });

    const activeLoopsMap = {};
    for (const ord of recurringOrders) {
      if (ord.customer && !activeLoopsMap[ord.customer._id.toString()]) {
        const baseDate = ord.deliveredAt || ord.deliveryDate || ord.createdAt;
        const lastDate = new Date(baseDate);
        const nextRun = new Date(lastDate);
        nextRun.setDate(nextRun.getDate() + (ord.recurringIntervalDays || 30));

        activeLoopsMap[ord.customer._id.toString()] = {
          orderId: ord._id,
          customerName: ord.customer.name,
          customerMobile: ord.customer.mobile,
          assignedStaff: ord.assignedStaff,
          items: ord.items,
          itemsCount: ord.items.length,
          totalAmount: ord.totalAmount,
          lastRun: baseDate,
          nextRun: nextRun,
          recurringIntervalDays: ord.recurringIntervalDays || 30,
          status: ord.status,
          recurringProcessed: ord.recurringProcessed
        };
      }
    }
    const activeLoops = Object.values(activeLoopsMap);
    const recurringOrderJob = await recurringOrderService.getRecurringJobStatus();

    // Orders Analysis
    const orderStatusAgg = await Order.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const orderStatusCounts = {
      Pending: 0, Assigned: 0, Packed: 0, 'Out for Delivery': 0, Delivered: 0, Cancelled: 0
    };
    orderStatusAgg.forEach(s => {
      if (orderStatusCounts[s._id] !== undefined) {
        orderStatusCounts[s._id] = s.count;
      }
    });

    const recentOrders = await Order.find({})
      .populate('customer', 'name mobile')
      .sort({ createdAt: -1 })
      .limit(8);

    res.json({
      totalCustomers,
      totalProducts,
      lowStockCount: lowStockAlerts.length,
      lowStockAlerts: lowStockAlerts.map(p => ({ _id: p._id, name: p.name, currentStock: p.currentStock, threshold: p.lowStockThreshold })),
      todayDeliveries,
      tomorrowDeliveries,
      pendingDeliveries,
      totalOutstanding,
      totalSales,
      todaySales,
      thisMonthSales: monthSales,
      recentTransactions: recentPayments.map(p => ({
        _id: p._id,
        customerName: p.customer?.name || 'Walk-in Customer',
        amount: p.amountPaid || 0,
        mode: p.paymentMode || 'Cash',
        date: p.date,
        ref: p.referenceNumber || ''
      })),
      customerDues,
      activeLoops,
      recurringOrderJob: recurringOrderJob || {
        status: 'never_run',
        trigger: 'owner',
        lastSuccessfulRunAt: null,
        lastResult: { scanned: 0, due: 0, created: 0, skipped: 0 }
      },
      orderStatusCounts,
      recentOrders: recentOrders.map(o => ({
        _id: o._id,
        ref: `ORD-${o._id.toString().substring(18).toUpperCase()}`,
        customerName: o.customer?.name || 'Unknown',
        totalAmount: o.totalAmount,
        status: o.status,
        date: o.createdAt
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({}).sort({ createdAt: -1 }).limit(30);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    const updated = await Notification.findByIdAndUpdate(req.params.id, { read: true }, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== CUSTOMERS ====================

exports.createCustomer = async (req, res) => {
  try {
    const { name, mobile, address, gstNumber, notes, state, defaultRecurringDays, creditLimit } = req.body;
    if (!name || !mobile || !address) {
      return res.status(400).json({ error: 'Name, mobile and address are required' });
    }
    const cleanMobile = mobile.toString().trim();
    if (!/^\d{10}$/.test(cleanMobile)) {
      return res.status(400).json({ error: 'Mobile number must contain exactly 10 numeric digits' });
    }
    const cleanName = name.toString().trim();
    if (cleanName.length < 2 || cleanName.length > 100 || !/^[a-zA-Z\s.'&-]+$/.test(cleanName)) {
      return res.status(400).json({ error: 'Customer Name must contain between 2 and 100 valid characters' });
    }
    const existing = await Customer.findOne({ mobile: cleanMobile });
    if (existing) {
      return res.status(400).json({ error: 'Customer with this mobile number already exists' });
    }
    const customer = new Customer({ 
      name: cleanName, 
      mobile: cleanMobile, 
      address: address.toString().trim(), 
      gstNumber: gstNumber ? gstNumber.toString().trim().toUpperCase() : '', 
      notes: notes ? notes.toString().trim() : '', 
      state: state ? state.toString().trim() : 'Maharashtra',
      defaultRecurringDays: defaultRecurringDays || 0,
      creditLimit: creditLimit || 0
    });
    
    await customer.save();
    res.status(201).json(customer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getCustomers = async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};
    if (search) {
      if (typeof search !== 'string' || search.length > 100) {
        return res.status(400).json({ error: 'Search term is invalid' });
      }
      const safeSearch = escapeRegex(search);
      query = {
        $or: [
          { name: { $regex: safeSearch, $options: 'i' } },
          { mobile: { $regex: safeSearch, $options: 'i' } }
        ]
      };
    }
    const customers = await Customer.find(query).sort({ name: 1 });
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getCustomerProfile = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const orders = await Order.find({ customer: customer._id })
      .populate('assignedStaff', 'name mobile')
      .sort({ createdAt: -1 });

    const bills = await Bill.find({ customer: customer._id }).sort({ createdAt: -1 });
    const payments = await Payment.find({ customer: customer._id }).sort({ date: -1 });

    // Calculate outstanding
    const bSum = bills.reduce((s, b) => s + b.totalAmount, 0);
    const pSum = payments.reduce((s, p) => s + p.amountPaid, 0);
    const outstanding = Math.max(0, bSum - pSum);

    // Combine history for a timeline
    const history = [];
    orders.forEach(o => {
      history.push({
        type: 'Order',
        id: o._id,
        ref: `ORD-${o._id.toString().substring(18).toUpperCase()}`,
        date: o.createdAt,
        status: o.status,
        amount: o.totalAmount
      });
    });
    bills.forEach(b => {
      history.push({
        type: 'Invoice',
        id: b._id,
        ref: b.invoiceNumber,
        date: b.createdAt,
        status: b.status,
        amount: b.totalAmount
      });
    });
    payments.forEach(p => {
      history.push({
        type: 'Payment Received',
        id: p._id,
        ref: p.referenceNumber || 'Cash/UPI',
        date: p.date,
        status: 'Cleared',
        amount: p.amountPaid
      });
    });

    history.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({
      customer,
      outstanding,
      orderHistory: orders,
      billHistory: bills,
      paymentHistory: payments,
      timeline: history
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    const updateData = pick(req.body, [
      'name', 'mobile', 'address', 'gstNumber', 'notes', 'state', 'branch', 'defaultRecurringDays', 'creditLimit'
    ]);
    
    // Assign fields
    Object.assign(customer, updateData);
    
    const updated = await customer.save();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteCustomer = async (req, res) => {
  try {
    await Customer.findByIdAndDelete(req.params.id);
    res.json({ message: 'Customer deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== VENDORS ====================

exports.createVendor = async (req, res) => {
  try {
    const { name, contact, address, itemCategories } = req.body;
    if (!name || !contact || !address) {
      return res.status(400).json({ error: 'Name, contact, and address are required' });
    }
    const cleanContact = contact.toString().trim();
    if (!/^\d{10}$/.test(cleanContact)) {
      return res.status(400).json({ error: 'Contact Mobile number must contain exactly 10 numeric digits' });
    }
    const cleanName = name.toString().trim();
    if (cleanName.length < 2 || cleanName.length > 100 || !/^[a-zA-Z\s.'&-]+$/.test(cleanName)) {
      return res.status(400).json({ error: 'Supplier Vendor Name must contain between 2 and 100 valid characters' });
    }
    const vendor = new Vendor({ name: cleanName, contact: cleanContact, address: address.toString().trim(), itemCategories });
    await vendor.save();
    res.status(201).json(vendor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getVendors = async (req, res) => {
  try {
    const vendors = await Vendor.find({}).sort({ name: 1 });
    res.json(vendors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateVendor = async (req, res) => {
  try {
    const updates = pick(req.body, ['name', 'contact', 'address', 'itemCategories', 'performanceScore', 'qualityRating']);
    const updated = await Vendor.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteVendor = async (req, res) => {
  try {
    await Vendor.findByIdAndDelete(req.params.id);
    res.json({ message: 'Vendor deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== PRODUCTS & STOCK ====================

exports.createProduct = async (req, res) => {
  try {
    const { name, category, unit, price, purchasePrice, currentStock, lowStockThreshold, linkedVendor, hsnCode, branchId, hasExpiryTracking } = req.body;
    if (!name || !category || !unit || price === undefined || !linkedVendor) {
      return res.status(400).json({ error: 'All required product fields must be provided' });
    }
    const cleanName = name.toString().trim();
    if (cleanName.length < 2 || cleanName.length > 100 || !/^[a-zA-Z0-9\s()/.\-+%]+$/.test(cleanName)) {
      return res.status(400).json({ error: 'Product Name contains invalid special characters' });
    }
    if (/^\d+$/.test(unit.toString().trim())) {
      return res.status(400).json({ error: 'Unit cannot be numeric-only' });
    }
    if (hsnCode && !/^(?:\d{4}|\d{6}|\d{8})$/.test(hsnCode.toString().trim())) {
      return res.status(400).json({ error: 'HSN Code must be 4, 6, or 8 numeric digits' });
    }
    if (Number(price) < 0) {
      return res.status(400).json({ error: 'Retail Price cannot be negative' });
    }
    if (purchasePrice !== undefined && Number(purchasePrice) > Number(price)) {
      return res.status(400).json({ error: 'Retail Price cannot be less than Purchase Price' });
    }
    let targetBranchId = branchId;
    if (!targetBranchId) {
      const defaultBranch = await Branch.findOne({ isDefault: true }) || await Branch.findOne({ status: 'Active' }) || await Branch.findOne();
      if (defaultBranch) targetBranchId = defaultBranch._id;
    }
    const product = new Product({ 
      name: cleanName, 
      category: category.toString().trim(), 
      unit: unit.toString().trim(), 
      price: Number(price), 
      purchasePrice: purchasePrice ? Number(purchasePrice) : 0, 
      currentStock: currentStock ? Number(currentStock) : 0, 
      lowStockThreshold: lowStockThreshold ? Number(lowStockThreshold) : 10, 
      linkedVendor,
      hsnCode: hsnCode || '3004',
      branchId: targetBranchId,
      hasExpiryTracking: hasExpiryTracking !== undefined ? hasExpiryTracking : true
    });
    await product.save();

    // Log initial stock
    if (currentStock > 0) {
      await StockHistory.create({
        product: product._id,
        quantity: currentStock,
        type: 'in',
        reason: 'purchase'
      });
    }

    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find({}).populate('linkedVendor', 'name');
    if (req.user?.role === 'Customer') {
      return res.json(products.map((product) => ({
        _id: product._id,
        name: product.name,
        category: product.category,
        unit: product.unit,
        price: product.price,
        available: product.currentStock > 0,
      })));
    }
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const updates = pick(req.body, [
      'name', 'category', 'unit', 'price', 'lowStockThreshold', 'linkedVendor', 'hsnCode', 'branch', 'purchasePrice', 'hasExpiryTracking'
    ]);
    const updated = await Product.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).populate('linkedVendor', 'name');
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.adjustStock = async (req, res) => {
  try {
    const { quantity, type, reason } = req.body; // type: 'in' | 'out', reason: 'purchase' | 'adjustment' | etc
    if (!quantity || !type || !reason) {
      return res.status(400).json({ error: 'Quantity, type, and reason are required' });
    }
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    let diff = Number(quantity);
    if (type === 'out') {
      if (product.currentStock < diff) {
        return res.status(400).json({ error: 'Insufficient stock available' });
      }
      product.currentStock -= diff;
    } else {
      product.currentStock += diff;
    }

    await product.save();

    // Save history
    const log = await StockHistory.create({
      product: product._id,
      quantity: diff,
      type,
      reason
    });

    // Check low stock threshold and alert
    if (product.currentStock <= product.lowStockThreshold) {
      // Create notification
      const exists = await Notification.findOne({ type: 'low_stock', relatedId: product._id, read: false });
      if (!exists) {
        await Notification.create({
          title: 'Low Stock Alert',
          message: `Product "${product.name}" has reached low stock: ${product.currentStock} ${product.unit} remaining.`,
          type: 'low_stock',
          relatedId: product._id
        });
      }
    }

    res.json({ product, log });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.bulkQuickStockIn = async (req, res) => {
  try {
    const { items, reason } = req.body; // items: [{ productId, quantityToAdd }]
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Please provide at least one product line item to add stock.' });
    }

    const updatedProducts = [];
    for (const item of items) {
      if (!item.productId || !item.quantityToAdd || Number(item.quantityToAdd) <= 0) continue;
      
      const product = await Product.findById(item.productId);
      if (product) {
        const qty = Number(item.quantityToAdd);
        product.currentStock += qty;
        await product.save();

        await StockHistory.create({
          product: product._id,
          quantity: qty,
          type: 'in',
          reason: reason || 'purchase'
        });

        updatedProducts.push(product);
      }
    }

    res.json({ message: `Successfully added stock for ${updatedProducts.length} item(s)!`, updatedCount: updatedProducts.length });
  } catch (err) {
    logger.write('error', 'bulk_stock_in_failed', logger.errorDetails(err, req.id));
    res.status(500).json({ error: err.message });
  }
};

exports.quickExpressIssue = async (req, res) => {
  try {
    const { customerName, customerMobile, items, isGstApplicable } = req.body;
    // items: [{ productId, quantity, price }]
    
    if (customerName && customerName.toString().trim()) {
      const cleanN = customerName.toString().trim();
      if (!/^[a-zA-Z\s.'&-]+$/.test(cleanN) || /\s{2,}/.test(customerName)) {
        return res.status(400).json({ error: 'Customer name can contain only letters, spaces, &, -, and .' });
      }
    }
    if (customerMobile && customerMobile.toString().trim()) {
      const cleanM = customerMobile.toString().trim();
      if (!/^\d{10}$/.test(cleanM)) {
        return res.status(400).json({ error: 'Enter a valid 10-digit mobile number.' });
      }
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Please select at least one item to issue.' });
    }

    // 1. Resolve or create Walk-in Customer
    let customerDoc = null;
    if (customerMobile && customerMobile.trim()) {
      customerDoc = await Customer.findOne({ mobile: customerMobile.trim() });
    }
    if (!customerDoc) {
      const nameToUse = (customerName && customerName.trim()) ? customerName.trim() : 'Walk-in Customer';
      const mobileToUse = (customerMobile && customerMobile.trim()) ? customerMobile.trim() : '9999999999';
      customerDoc = new Customer({
        name: nameToUse,
        mobile: mobileToUse,
        address: 'Over the Counter Sale',
        city: 'Local',
        state: 'Maharashtra'
      });
      await customerDoc.save();
    }

    // 2. Validate stock & deduct stock immediately
    let subtotal = 0;
    const billItems = [];

    for (const line of items) {
      if (!line.productId || !line.quantity || Number(line.quantity) <= 0) continue;
      const product = await Product.findById(line.productId);
      if (!product) return res.status(404).json({ error: `Product not found: ${line.productId}` });

      const qty = Number(line.quantity);
      if (product.currentStock < qty) {
        return res.status(400).json({ error: `Insufficient stock for ${product.name}. Available: ${product.currentStock} ${product.unit || 'pcs'}` });
      }

      // Deduct stock
      product.currentStock -= qty;
      await product.save();

      // Log StockHistory Out
      await StockHistory.create({
        product: product._id,
        quantity: qty,
        type: 'out',
        reason: 'sale'
      });

      const unitPrice = line.price !== undefined ? Number(line.price) : product.price;
      const lineTotal = unitPrice * qty;
      subtotal += lineTotal;

      billItems.push({
        product: product._id,
        quantity: qty,
        price: unitPrice,
        cgst: isGstApplicable ? 9 : 0,
        sgst: isGstApplicable ? 9 : 0
      });
    }

    if (billItems.length === 0) {
      return res.status(400).json({ error: 'No valid items processed.' });
    }

    // 3. Tax calculation
    const isGst = Boolean(isGstApplicable);
    const cgstTotal = isGst ? subtotal * 0.09 : 0;
    const sgstTotal = isGst ? subtotal * 0.09 : 0;
    const totalAmount = isGst ? (subtotal + cgstTotal + sgstTotal) : subtotal;

    // 4. Generate Auto Sequential Invoice Number
    const invoiceCount = await Bill.countDocuments({});
    const invoiceNumber = (invoiceCount + 1).toString().padStart(3, '0');

    // 5. Create Bill Document
    const bill = new Bill({
      invoiceNumber,
      customer: customerDoc._id,
      items: billItems,
      subtotal,
      cgstTotal,
      sgstTotal,
      totalAmount,
      isGstApplicable: isGst,
      status: 'Paid',
      paymentStatus: 'Paid'
    });
    await bill.save();

    // 6. Create a matching Payment record so this counter sale appears in all calculations
    await Payment.create({
      bill: bill._id,
      customer: customerDoc._id,
      amountPaid: totalAmount,
      paymentMode: 'Cash',
      category: 'Counter Sale',
      date: new Date(),
      notes: `Quick counter sale - Invoice #${invoiceNumber}`
    });

    // Populate customer and product details for frontend receipt modal
    const populatedBill = await Bill.findById(bill._id)
      .populate('customer')
      .populate('items.product');

    res.json({
      message: `Quick sale completed! Invoice ${invoiceNumber} issued successfully.`,
      bill: populatedBill
    });

  } catch (err) {
    logger.write('error', 'quick_issue_failed', logger.errorDetails(err, req.id));
    res.status(500).json({ error: err.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== ORDERS & WORKFLOW ====================

exports.createOrder = async (req, res) => {
  try {
    let { customer, items, deliveryDate, isRecurring, recurringIntervalDays, isGstApplicable } = req.body;
    
    // If user is a Customer, force customer ID and status
    let initialStatus = 'Pending';
    if (req.user && req.user.role === 'Customer') {
      customer = req.user.id;
      initialStatus = 'Requested';
    }

    if (!customer || !Array.isArray(items) || !items.length || items.length > 100 || !deliveryDate) {
      return res.status(400).json({ error: 'Customer, items list, and delivery date are required' });
    }

    const requestedDeliveryDate = new Date(deliveryDate);
    const latestAllowedDate = new Date();
    latestAllowedDate.setFullYear(latestAllowedDate.getFullYear() + 1);
    if (Number.isNaN(requestedDeliveryDate.getTime()) || requestedDeliveryDate > latestAllowedDate) {
      return res.status(400).json({ error: 'Delivery date is invalid or too far in the future' });
    }

    let totalAmount = 0;
    const formattedItems = [];

    // Credit limit check
    const custDoc = await Customer.findById(customer);
    if (!custDoc) return res.status(404).json({ error: 'Customer not found' });

    // Verify stock and fetch prices
    for (const item of items) {
      const quantity = Number(item.quantity);
      if (typeof item.product !== 'string' || !Number.isInteger(quantity) || quantity < 1 || quantity > 10000) {
        return res.status(400).json({ error: 'Each order item requires a valid product and positive integer quantity' });
      }
      const p = await Product.findById(item.product);
      if (!p) return res.status(404).json({ error: `Product not found: ${item.product}` });
      if (p.currentStock < quantity) {
        return res.status(400).json({ error: `Insufficient stock for product: ${p.name}` });
      }
      
      const lineTotal = p.price * quantity;
      totalAmount += lineTotal;

      formattedItems.push({
        product: p._id,
        quantity,
        price: p.price,
        vendor: p.linkedVendor
      });
    }

    if (custDoc.creditLimit && custDoc.creditLimit > 0) {
      // Dynamically calculate outstanding: sum of all bills minus sum of all payments
      const custIdStr = custDoc._id.toString();
      const [billsAgg, paymentsAgg] = await Promise.all([
        Bill.aggregate([{ $match: { customer: custDoc._id } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
        Payment.aggregate([{ $match: { customer: custDoc._id } }, { $group: { _id: null, total: { $sum: '$amountPaid' } } }])
      ]);
      const totalBilled = billsAgg.length ? billsAgg[0].total : 0;
      const totalPaid = paymentsAgg.length ? paymentsAgg[0].total : 0;
      const currentOutstanding = Math.max(0, totalBilled - totalPaid);

      if (currentOutstanding + totalAmount > custDoc.creditLimit) {
        return res.status(400).json({ error: `Order exceeds customer credit limit. Limit: Rs.${custDoc.creditLimit}, Outstanding: Rs.${currentOutstanding}, Order: Rs.${totalAmount}` });
      }
    }

    const order = new Order({
      customer,
      items: formattedItems,
      totalAmount,
      deliveryDate: requestedDeliveryDate,
      status: initialStatus,
      isRecurring: isRecurring || false,
      recurringIntervalDays: Math.min(Math.max(Number(recurringIntervalDays) || 30, 1), 365),
      isGstApplicable: isGstApplicable !== undefined ? Boolean(isGstApplicable) : false,
      statusHistory: [{ status: initialStatus, updatedBy: req.ctx ? req.ctx.userId : req.user ? req.user.id : null }]
    });

    await order.save();

    // Trigger WhatsApp notification for order creation
    if (custDoc && custDoc.mobile) {
      const orderRef = `ORD-${order._id.toString().substring(18).toUpperCase()}`;
      notificationService.sendOrderCreated(custDoc.mobile, orderRef, totalAmount)
        .catch((err) => logger.write('error', 'order_notification_failed', logger.errorDetails(err, req.id)));
    }

    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getOrders = async (req, res) => {
  try {
    const { status, staffId } = req.query;
    const filter = {};
    if (req.user?.role === 'Customer') {
      filter.customer = req.user.id;
    } else if (staffId) {
      filter.$or = [
        { assignedStaff: staffId },
        { assignedTo: staffId }
      ];
    }
    if (status) filter.status = status;

    let orderQuery = Order.find(filter);
    if (req.user?.role === 'Customer') {
      orderQuery = orderQuery
        .populate('customer', 'name mobile')
        .populate('assignedStaff', 'name mobile role')
        .populate('assignedTo', 'name mobile role designation')
        .populate('statusHistory.assignedStaff', 'name role')
        .populate('statusHistory.assignedTo', 'name role designation')
        .populate('statusHistory.updatedBy', 'name role')
        .populate('items.product', 'name category unit price');
    } else {
      orderQuery = orderQuery
        .populate('customer')
        .populate('assignedStaff', 'name email mobile role')
        .populate('assignedTo', 'name email mobile role designation department')
        .populate('statusHistory.assignedStaff', 'name email mobile role')
        .populate('statusHistory.assignedTo', 'name email mobile role designation department')
        .populate('statusHistory.updatedBy', 'name email role')
        .populate('items.product');
    }
    const orders = await orderQuery.sort({ createdAt: -1 });

    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.assignOrderStaff = async (req, res) => {
  try {
    const { staffId } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (!staffId) {
      order.assignedStaff = null;
      order.assignedTo = null;
      order.status = 'Pending';
      order.statusHistory.push({
        status: 'Pending',
        timestamp: new Date(),
        assignedStaff: null,
        assignedTo: null,
        updatedBy: req.ctx ? req.ctx.userId : req.user ? req.user.id : null
      });
      await order.save();
      return res.json(order);
    }

    // Lookup staff member in User model or Employee model
    let staffUser = await User.findById(staffId);
    let staffEmp = await Employee.findById(staffId).populate('user');

    if (!staffUser && staffEmp && staffEmp.user) {
      staffUser = staffEmp.user;
    }
    if (!staffEmp && staffUser) {
      staffEmp = await Employee.findOne({ user: staffUser._id });
    }

    order.assignedStaff = staffUser ? staffUser._id : null;
    order.assignedTo = staffEmp ? staffEmp._id : (staffUser ? null : staffId);

    // Determine status according to assigned staff role
    const role = (staffEmp?.role || staffEmp?.designation || staffUser?.role || '').toLowerCase();
    let newStatus = 'Assigned';
    if (role.includes('packer') || role.includes('pack')) {
      newStatus = 'Packed';
    } else if (role.includes('delivery') || role.includes('driver')) {
      newStatus = 'Out for Delivery';
    }

    order.status = newStatus;
    order.statusHistory.push({
      status: newStatus,
      timestamp: new Date(),
      assignedStaff: order.assignedStaff,
      assignedTo: order.assignedTo,
      updatedBy: req.ctx ? req.ctx.userId : req.user ? req.user.id : null
    });

    await order.save();
    const updatedOrder = await Order.findById(order._id)
      .populate('customer')
      .populate('items.product')
      .populate('assignedStaff', 'name email mobile role')
      .populate('assignedTo', 'name email mobile role designation department')
      .populate('statusHistory.assignedStaff', 'name email mobile role')
      .populate('statusHistory.assignedTo', 'name email mobile role designation department')
      .populate('statusHistory.updatedBy', 'name email role');

    res.json(updatedOrder);
  } catch (err) {
    logger.write('error', 'assign_staff_failed', logger.errorDetails(err, req.id));
    res.status(500).json({ error: err.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { status, deliveryProofUrl, signatureUrl } = req.body;
    if (!status) return res.status(400).json({ error: 'Status is required' });

    const order = await Order.findById(req.params.id).populate('customer');
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const oldStatus = order.status;
    order.status = status;
    
    if (deliveryProofUrl) order.deliveryProofUrl = deliveryProofUrl;
    if (signatureUrl) order.signatureUrl = signatureUrl;

    const isNowReservedState = ['Packed', 'Out for Delivery'].includes(status);
    const wasReservedState = ['Packed', 'Out for Delivery'].includes(oldStatus);

    // Stock Reservation handling:
    // 1. Transitioning INTO Packed or Out for Delivery: Reserve stock
    if (isNowReservedState && !wasReservedState) {
      for (const item of order.items) {
        const product = await Product.findById(item.product);
        if (product) {
          product.reservedStock = (product.reservedStock || 0) + item.quantity;
          await product.save();
        }
      }
    }

    // 2. Transitioning OUT of Packed/Out for Delivery into Cancelled: Release reserved stock
    if (status === 'Cancelled' && wasReservedState) {
      for (const item of order.items) {
        const product = await Product.findById(item.product);
        if (product) {
          product.reservedStock = Math.max(0, (product.reservedStock || 0) - item.quantity);
          await product.save();
        }
      }
    }

    // 3. Transitioning into Delivered or Completed
    if ((status === 'Delivered' || status === 'Completed') && oldStatus !== 'Delivered' && oldStatus !== 'Completed') {
      order.deliveredAt = new Date();

      // Deduct stock and clear reserved stock
      for (const item of order.items) {
        const product = await Product.findById(item.product);
        if (product) {
          if (wasReservedState) {
            product.reservedStock = Math.max(0, (product.reservedStock || 0) - item.quantity);
          }
          product.currentStock = Math.max(0, product.currentStock - item.quantity);
          await product.save();
          
          await StockHistory.create({
            product: product._id,
            quantity: item.quantity,
            type: 'out',
            reason: 'sale'
          });

          // Check low stock alert
          if (product.currentStock <= product.lowStockThreshold) {
            await Notification.create({
              title: 'Low Stock Alert',
              message: `Product "${product.name}" has reached low stock: ${product.currentStock} remaining.`,
              type: 'low_stock',
              relatedId: product._id
            });
          }
        }
      }

      // Automatically convert Order to a Bill if not already generated
      const existingBill = await Bill.findOne({ order: order._id });
      if (!existingBill) {
        const invoiceCount = await Bill.countDocuments({});
        const invoiceNumber = (invoiceCount + 1).toString().padStart(3, '0');
        
        const isGst = order.isGstApplicable === true;
        const subtotal = order.totalAmount;
        const cgstTotal = isGst ? subtotal * 0.09 : 0;
        const sgstTotal = isGst ? subtotal * 0.09 : 0;
        const totalAmount = isGst ? (subtotal + cgstTotal + sgstTotal) : subtotal;

        const billItems = order.items.map(i => ({
          product: i.product,
          quantity: i.quantity,
          price: i.price,
          cgst: isGst ? 9 : 0,
          sgst: isGst ? 9 : 0
        }));

        const bill = new Bill({
          invoiceNumber,
          order: order._id,
          customer: order.customer._id,
          items: billItems,
          subtotal,
          cgstTotal,
          sgstTotal,
          totalAmount,
          isGstApplicable: isGst,
          status: 'Unpaid'
        });
        await bill.save();
      }
    }

    order.statusHistory.push({
      status,
      timestamp: new Date(),
      assignedStaff: order.assignedStaff,
      assignedTo: order.assignedTo,
      updatedBy: req.ctx ? req.ctx.userId : req.user ? req.user.id : null
    });

    await order.save();

    // Trigger WhatsApp notifications based on status change
    if (order.customer && order.customer.mobile) {
      const orderRef = `ORD-${order._id.toString().substring(18).toUpperCase()}`;
      if (status === 'Out for Delivery' && oldStatus !== 'Out for Delivery') {
        notificationService.sendOutForDelivery(order.customer.mobile, orderRef)
          .catch((err) => logger.write('error', 'delivery_notification_failed', logger.errorDetails(err, req.id)));
      } else if (status === 'Delivered' && oldStatus !== 'Delivered') {
        notificationService.sendOrderDelivered(order.customer.mobile, orderRef)
          .catch((err) => logger.write('error', 'delivered_notification_failed', logger.errorDetails(err, req.id)));
      }
    }

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateSalesOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Sales Order not found' });
    if (order.status === 'Delivered' || order.status === 'Completed' || order.status === 'Cancelled') {
      return res.status(400).json({ error: `Cannot edit order with status "${order.status}"` });
    }

    const { customerId, items, deliveryDate, isRecurring, recurringIntervalDays, remarks, isGstApplicable } = req.body;

    if (customerId) order.customer = customerId;
    if (deliveryDate) order.deliveryDate = new Date(deliveryDate);
    if (isRecurring !== undefined) order.isRecurring = isRecurring;
    if (recurringIntervalDays) order.recurringIntervalDays = Number(recurringIntervalDays);
    if (remarks !== undefined) order.remarks = remarks;
    if (isGstApplicable !== undefined) order.isGstApplicable = isGstApplicable;

    if (items && Array.isArray(items) && items.length > 0) {
      let totalAmount = 0;
      const orderItems = [];

      for (const item of items) {
        const product = await Product.findById(item.productId || item.product);
        if (!product) return res.status(404).json({ error: `Product not found: ${item.productId}` });

        const qty = Number(item.quantity);
        const price = Number(item.price || product.price);
        totalAmount += qty * price;

        orderItems.push({
          product: product._id,
          quantity: qty,
          price: price,
          vendor: product.linkedVendor
        });
      }

      order.items = orderItems;
      order.totalAmount = totalAmount;
    }

    await order.save();

    const updatedOrder = await Order.findById(order._id)
      .populate('customer')
      .populate('items.product')
      .populate('assignedTo', 'name mobile designation');

    res.json({ message: 'Sales Order updated successfully! ✅', order: updatedOrder });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.reassignDeliveryPerson = async (req, res) => {
  try {
    const { employeeId } = req.body;
    if (!employeeId) return res.status(400).json({ error: 'Employee / Delivery Person ID is required' });

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const employee = await Employee.findById(employeeId);
    if (!employee) return res.status(404).json({ error: 'Delivery Staff Employee record not found' });

    order.assignedTo = employee._id;
    if (employee.user) {
      order.assignedStaff = employee.user;
    }

    if (order.status === 'Pending' || order.status === 'Requested') {
      order.status = 'Assigned';
    }

    if (!order.assignmentHistory) order.assignmentHistory = [];
    order.assignmentHistory.push({
      assignedTo: employee._id,
      assignedBy: req.user ? req.user.name || 'Admin' : 'Admin',
      date: new Date()
    });

    order.statusHistory.push({
      status: order.status,
      timestamp: new Date(),
      assignedTo: employee._id,
      assignedStaff: order.assignedStaff,
      updatedBy: req.ctx ? req.ctx.userId : req.user ? req.user.id : null
    });

    await order.save();

    const updatedOrder = await Order.findById(order._id)
      .populate('customer')
      .populate('items.product')
      .populate('assignedTo', 'name mobile designation department')
      .populate('assignmentHistory.assignedTo', 'name mobile designation');

    res.json({ message: `Order delivery reassigned to ${employee.name}! 🚚`, order: updatedOrder });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.trackOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer', 'name mobile')
      .populate('items.product', 'name');
    
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (req.user?.role === 'Customer' && order.customer?._id.toString() !== req.user.id) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json({
      id: order._id,
      status: order.status,
      customer: order.customer.name,
      deliveryDate: order.deliveryDate,
      totalAmount: order.totalAmount,
      items: order.items.map(i => ({ name: i.product.name, quantity: i.quantity })),
      statusHistory: order.statusHistory,
      latitude: order.latitude,
      longitude: order.longitude,
      deliveredAt: order.deliveredAt,
      deliveryProofUrl: order.deliveryProofUrl
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateOrderLocation = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    
    order.latitude = latitude;
    order.longitude = longitude;
    await order.save();
    
    res.json({ message: 'Location updated', latitude, longitude });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.submitOrderFeedback = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (req.user?.role === 'Customer' && order.customer.toString() !== req.user.id) {
      return res.status(404).json({ error: 'Order not found' });
    }
    const numericRating = Number(rating);
    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5 ||
        (comment !== undefined && (typeof comment !== 'string' || comment.length > 1000))) {
      return res.status(400).json({ error: 'Rating must be from 1 to 5 and comment must not exceed 1000 characters' });
    }
    
    order.feedbackRating = numericRating;
    order.feedbackComment = comment || '';
    await order.save();
    
    res.json({ message: 'Feedback submitted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== QUOTATION & BILLING ====================

exports.createQuotation = async (req, res) => {
  try {
    const { customer, items, validDays } = req.body;
    if (!customer || !items || !items.length) {
      return res.status(400).json({ error: 'Customer and items are required' });
    }

    let totalAmount = 0;
    const qItems = [];
    for (const item of items) {
      const p = await Product.findById(item.product);
      if (!p) return res.status(404).json({ error: `Product not found: ${item.product}` });
      const finalPrice = item.price !== undefined ? Number(item.price) : p.price;
      totalAmount += finalPrice * item.quantity;
      qItems.push({
        product: p._id,
        quantity: item.quantity,
        price: finalPrice
      });
    }

    const validity = new Date();
    validity.setDate(validity.getDate() + (Number(validDays) || 15));

    const quotation = new Quotation({
      customer,
      items: qItems,
      totalAmount,
      validUntil: validity
    });

    await quotation.save();
    res.status(201).json(quotation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getQuotations = async (req, res) => {
  try {
    const quotations = await Quotation.find({})
      .populate('customer')
      .populate('items.product')
      .sort({ createdAt: -1 });
    res.json(quotations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) return res.status(404).json({ error: 'Quotation not found' });
    if (quotation.status !== 'Draft') {
      return res.status(400).json({ error: 'Only draft quotations can be edited' });
    }

    const { customer, validDays, items } = req.body;
    
    // Recalculate total amount
    let totalAmount = 0;
    const formattedItems = [];
    for (const item of items) {
      const p = await Product.findById(item.product);
      if (!p) return res.status(404).json({ error: `Product not found: ${item.product}` });
      const finalPrice = item.price !== undefined ? Number(item.price) : p.price;
      totalAmount += finalPrice * item.quantity;
      formattedItems.push({
        product: p._id,
        quantity: item.quantity,
        price: finalPrice
      });
    }

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + (Number(validDays) || 15));

    quotation.customer = customer || quotation.customer;
    quotation.items = formattedItems;
    quotation.totalAmount = totalAmount;
    quotation.validUntil = validUntil;

    await quotation.save();
    res.json({ message: 'Quotation updated successfully', quotation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.convertQuotationToOrder = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) return res.status(404).json({ error: 'Quotation not found' });
    if (quotation.status === 'Converted') {
      return res.status(400).json({ error: 'Quotation already converted' });
    }

    // Check stock first
    for (const item of quotation.items) {
      const p = await Product.findById(item.product);
      if (!p) return res.status(404).json({ error: `Product not found: ${item.product}` });
      if (p.currentStock < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for: ${p.name}` });
      }
    }

    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + 2); // Default 2 days delivery

    const formattedItems = [];
    for (const item of quotation.items) {
      const p = await Product.findById(item.product);
      formattedItems.push({
        product: item.product,
        quantity: item.quantity,
        price: item.price,
        vendor: p.linkedVendor
      });
    }

    const { isRecurring, recurringIntervalDays } = req.body;

    const order = new Order({
      customer: quotation.customer,
      items: formattedItems,
      totalAmount: quotation.totalAmount,
      deliveryDate,
      status: 'Pending',
      isRecurring: isRecurring || false,
      recurringIntervalDays: Number(recurringIntervalDays) || 30,
      statusHistory: [{ status: 'Pending', updatedBy: req.ctx ? req.ctx.userId : req.user ? req.user.id : null }]
    });

    await order.save();
    
    quotation.status = 'Converted';
    await quotation.save();

    res.json({ message: 'Converted to order successfully', order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getBills = async (req, res) => {
  try {
    const bills = await Bill.find({})
      .populate('customer')
      .populate('items.product')
      .sort({ createdAt: -1 });
    res.json(bills);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getBillPDF = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id)
      .populate('customer')
      .populate('items.product');

    if (!bill) return res.status(404).json({ error: 'Bill invoice not found' });
    if (req.user?.role === 'Customer' && bill.customer?._id.toString() !== req.user.id) {
      return res.status(404).json({ error: 'Bill invoice not found' });
    }

    const setting = await Setting.findOne({});
    const billPageSize = setting?.pdfSettings?.billPageSize || 'A4';
    const billTemplate = setting?.pdfSettings?.billTemplate || 'CLASSIC_MEMO_BOOK';

    const isDownload = req.query.download === 'true';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${isDownload ? 'attachment' : 'inline'}; filename=Invoice_${bill.invoiceNumber}.pdf`);
    
    await pdfService.generateBillPDF(bill, res, billPageSize, billTemplate, setting);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getQuotationPDF = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id)
      .populate('customer')
      .populate('items.product');

    if (!quotation) return res.status(404).json({ error: 'Quotation not found' });

    const setting = await Setting.findOne({});
    const quotationPageSize = setting?.pdfSettings?.quotationPageSize || 'A4';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=Quotation_${quotation._id}.pdf`);

    pdfService.generateQuotationPDF(quotation, res, quotationPageSize);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== PAYMENTS ====================

exports.recordPayment = async (req, res) => {
  try {
    const { billId, customerId, amountPaid, paymentMode, referenceNumber, notes, autoAllocate } = req.body;
    
    if (!amountPaid || !paymentMode) {
      return res.status(400).json({ error: 'Amount paid and payment mode are required' });
    }

    if (autoAllocate && customerId) {
      // Auto-reconciliation (FIFO)
      const bills = await Bill.find({ 
        customer: customerId, 
        status: { $in: ['Unpaid', 'Partially Paid'] } 
      }).sort({ createdAt: 1 });

      let remainingAmount = Number(amountPaid);
      const allocatedPayments = [];

      for (let b of bills) {
        if (remainingAmount <= 0) break;
        
        const past = await Payment.find({ bill: b._id });
        const paidSoFar = past.reduce((sum, p) => sum + p.amountPaid, 0);
        const outstanding = b.totalAmount - paidSoFar;
        
        if (outstanding <= 0) continue;
        
        const amountToAllocate = Math.min(outstanding, remainingAmount);
        remainingAmount -= amountToAllocate;
        
        const payment = new Payment({
          bill: b._id,
          order: b.order,
          customer: b.customer,
          amountPaid: amountToAllocate,
          paymentMode,
          referenceNumber,
          notes: (notes || '') + ' (Auto-allocated)'
        });
        await payment.save();
        allocatedPayments.push(payment);
        
        const grandPaid = paidSoFar + amountToAllocate;
        b.status = grandPaid >= b.totalAmount ? 'Paid' : 'Partially Paid';
        await b.save();
      }
      
      return res.status(201).json({ message: 'Auto-allocated successfully', allocatedPayments, unallocatedAmount: remainingAmount });
    }

    // Normal single-bill payment
    if (!billId) {
      return res.status(400).json({ error: 'Bill ID is required for direct payment' });
    }

    const bill = await Bill.findById(billId);
    if (!bill) return res.status(404).json({ error: 'Invoice bill not found' });

    // Calculate current amount paid so far
    const pastPayments = await Payment.find({ bill: bill._id });
    const totalPaidSoFar = pastPayments.reduce((sum, p) => sum + p.amountPaid, 0);

    const payment = new Payment({
      bill: bill._id,
      order: bill.order,
      customer: bill.customer,
      amountPaid: Number(amountPaid),
      paymentMode,
      referenceNumber,
      notes,
      date: new Date()
    });

    await payment.save();

    // Try sending payment receipt via whatsapp
    const cust = await Customer.findById(bill.customer);
    if (cust && cust.mobile) {
      notificationService.sendPaymentReceived(cust.mobile, amountPaid)
        .catch((err) => logger.write('error', 'payment_notification_failed', logger.errorDetails(err, req.id)));
    }

    // Update bill payment status
    const grandPaid = totalPaidSoFar + Number(amountPaid);
    if (grandPaid >= bill.totalAmount) {
      bill.status = 'Paid';
    } else if (grandPaid > 0) {
      bill.status = 'Partially Paid';
    } else {
      bill.status = 'Unpaid';
    }

    await bill.save();
    res.status(201).json(payment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getPayments = async (req, res) => {
  try {
    const payments = await Payment.find({})
      .populate('customer')
      .populate('bill')
      .sort({ date: -1 });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.sendPaymentReminder = async (req, res) => {
  try {
    const { customerId, language, outstandingAmount } = req.body;
    if (!customerId || !language) {
      return res.status(400).json({ error: 'Customer ID and language template selection are required' });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const settings = await Setting.findOne({}) || new Setting();

    let template = settings.smsTemplates[language] || settings.smsTemplates.english;
    
    // Replace variables
    let text = template
      .replace('{customer_name}', customer.name)
      .replace('{amount}', outstandingAmount)
      .replace('{company_name}', settings.companyName);

    const notifyResult = await notificationService.sendMessage(customer.mobile, text);

    res.json({ message: 'Reminder message sent successfully', text, result: notifyResult });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== SETTINGS ====================

exports.getSettings = async (req, res) => {
  try {
    let settings = await Setting.findOne({});
    if (!settings) {
      settings = new Setting({});
      await settings.save();
    }
    const safeSettings = settings.toObject();
    delete safeSettings.whatsappToken;
    res.json(safeSettings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const allowedSettings = pick(req.body, [
      'companyName', 'state', 'logoUrl', 'address', 'email', 'contact',
      'gstNumber', 'bankDetails', 'smsTemplates', 'pdfSettings',
      'whatsappProvider', 'whatsappPhoneId', 'whatsappToken'
    ]);
    let settings = await Setting.findOne({});
    if (!settings) {
      settings = new Setting(allowedSettings);
    } else {
      Object.assign(settings, allowedSettings);
    }
    await settings.save();
    const safeSettings = settings.toObject();
    delete safeSettings.whatsappToken;
    res.json(safeSettings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.sendWhatsappMessage = async (req, res) => {
  try {
    const { to, message } = req.body;
    if (!to || !message) {
      return res.status(400).json({ error: 'Missing to or message parameters' });
    }

    const settings = await Setting.findOne({}).select('+whatsappToken');
    
    if (settings && settings.whatsappProvider === 'local') {
      try {
        await whatsappClient.sendMessage(to, message);
        return res.json({ success: true, provider: 'local' });
      } catch (err) {
        return res.status(500).json({ error: 'Local WhatsApp client error: ' + err.message });
      }
    }

    if (!settings || !settings.whatsappToken || !settings.whatsappPhoneId) {
      return res.status(400).json({ error: 'WhatsApp API is not configured. Please set the Phone ID and Token in settings.' });
    }

    // Default to Meta Cloud API format
    const url = `https://graph.facebook.com/v17.0/${settings.whatsappPhoneId}/messages`;
    
    // Using native fetch to avoid adding axios dependency if it doesn't exist
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.whatsappToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: message }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      logger.write('error', 'whatsapp_provider_rejected', { requestId: req.id });
      return res.status(response.status).json({ error: data.error?.message || 'Failed to send WhatsApp message' });
    }

    res.json({ success: true, data });
  } catch (err) {
    logger.write('error', 'whatsapp_request_failed', logger.errorDetails(err, req.id));
    res.status(500).json({ error: err.message });
  }
};

exports.getWhatsappStatus = (req, res) => {
  const status = whatsappClient.getStatus();
  res.json(status);
};

exports.logoutWhatsapp = async (req, res) => {
  const success = await whatsappClient.logout();
  res.json({ success });
};

// ==================== REPORTS ====================

exports.getSalesReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = {};
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = eDate;
      }
    }
    const bills = await Bill.find(filter).populate('customer').sort({ createdAt: -1 });
    res.json(bills);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getStockReport = async (req, res) => {
  try {
    const products = await Product.find({}).populate('linkedVendor', 'name');
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getDeliveryReport = async (req, res) => {
  try {
    const { startDate, endDate, staffId } = req.query;
    const filter = {};
    if (startDate || endDate) {
      filter.deliveryDate = {};
      if (startDate) filter.deliveryDate.$gte = new Date(startDate);
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        filter.deliveryDate.$lte = eDate;
      }
    }
    if (staffId) filter.assignedStaff = staffId;

    const orders = await Order.find(filter)
      .populate('customer')
      .populate('assignedStaff', 'name mobile')
      .sort({ deliveryDate: -1 });

    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getOutstandingReport = async (req, res) => {
  try {
    const customers = await Customer.find({});
    const outstandingList = [];

    for (const customer of customers) {
      const bills = await Bill.find({ customer: customer._id });
      const payments = await Payment.find({ customer: customer._id });

      const totalSales = bills.reduce((sum, b) => sum + b.totalAmount, 0);
      const totalPaid = payments.reduce((sum, p) => sum + p.amountPaid, 0);
      const dues = Math.max(0, totalSales - totalPaid);

      if (dues > 0) {
        outstandingList.push({
          customer: {
            _id: customer._id,
            name: customer.name,
            mobile: customer.mobile,
            address: customer.address
          },
          totalSales,
          totalPaid,
          outstandingAmount: dues
        });
      }
    }
    res.json(outstandingList);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getCustomerLedgerReport = async (req, res) => {
  try {
    const { customerId, pdf } = req.query;
    if (!customerId) return res.status(400).json({ error: 'Customer ID is required' });

    const customer = await Customer.findById(customerId);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const bills = await Bill.find({ customer: customer._id }).sort({ createdAt: 1 });
    const payments = await Payment.find({ customer: customer._id }).sort({ date: 1 });

    const ledger = [];
    bills.forEach(b => {
      ledger.push({
        date: b.createdAt,
        type: 'Invoice Bill',
        ref: b.invoiceNumber,
        debit: b.totalAmount,
        credit: 0
      });
    });

    payments.forEach(p => {
      ledger.push({
        date: p.date,
        type: 'Payment Received',
        ref: p.referenceNumber || 'Cash/UPI',
        debit: 0,
        credit: p.amountPaid
      });
    });

    ledger.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate running balance
    let runningBalance = 0;
    const ledgerWithBalance = ledger.map(entry => {
      runningBalance += (entry.debit - entry.credit);
      return {
        ...entry,
        runningBalance
      };
    });

    if (pdf === 'true') {
      const setting = await Setting.findOne({});
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename=statement_${customer.mobile}.pdf`);
      return pdfService.generateCustomerStatementPDF(customer, ledgerWithBalance, res, setting);
    }

    res.json({ customer, ledger: ledgerWithBalance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ==================== STAFF MANAGEMENT ====================

exports.createStaff = async (req, res) => {
  try {
    const { name, email, password, mobile } = req.body;
    if (!name || !email || !password || !mobile) {
      return res.status(400).json({ error: 'Name, email, password, and mobile are required' });
    }
    if (!isStrongPassword(password)) {
      return res.status(400).json({ error: 'Password must be at least 12 characters and include upper-case, lower-case, and numeric characters' });
    }

    const normalizedEmail = email.toString().trim().toLowerCase();
    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) return res.status(400).json({ error: 'Email already registered' });

    const staff = new User({
      name,
      email: normalizedEmail,
      password,
      mobile,
      role: 'staff',
      status: 'Active'
    });

    await staff.save();
    
    res.status(201).json({
      _id: staff._id,
      name: staff.name,
      email: staff.email,
      mobile: staff.mobile,
      role: staff.role,
      status: staff.status
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getStaffList = async (req, res) => {
  try {
    const staff = await User.find({ role: 'staff' }).select('-password');
    res.json(staff);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateStaffStatus = async (req, res) => {
  try {
    const { status } = req.body; // Active | Inactive
    if (!status) return res.status(400).json({ error: 'Status is required' });

    const staff = await User.findByIdAndUpdate(req.params.id, { status }, { new: true }).select('-password');
    res.json(staff);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.processRecurringOrders = async (req, res) => {
  try {
    const { result, createdOrders } = await recurringOrderService.runRecurringOrders({
      triggeredBy: req.ctx?.userId || req.user?.id,
    });
    res.json({
      message: `Recurring-order review complete: ${result.created} created, ${result.skipped} skipped.`,
      result,
      newOrders: createdOrders,
    });
  } catch (err) {
    logger.write('error', 'recurring_order_job_failed', logger.errorDetails(err, req.id));
    res.status(500).json({ error: err.message });
  }
};

exports.processSingleRecurringOrder = async (req, res) => {
  try {
    const { result, createdOrders } = await recurringOrderService.runRecurringOrders({
      orderId: req.params.id,
      force: true,
      triggeredBy: req.ctx?.userId || req.user?.id,
    });
    if (result.created === 0) {
      return res.status(400).json({ error: 'Order is not eligible or was already processed' });
    }
    res.json({ message: 'Recurring order generated successfully.', result, newOrder: createdOrders[0] });
  } catch (err) {
    logger.write('error', 'single_recurring_order_job_failed', logger.errorDetails(err, req.id));
    res.status(500).json({ error: err.message });
  }
};

exports.getCustomerLedgersSummary = async (req, res) => {
  try {
    const customers = await Customer.find({}).sort({ name: 1 });
    const allOrders = await Order.find({})
      .populate('customer')
      .populate('items.product')
      .sort({ createdAt: -1 });
    const payments = await Payment.find({}).sort({ date: -1 });
    const bills = await Bill.find({}).sort({ createdAt: -1 });

    const ledgers = customers.map(cust => {
      const custIdStr = cust._id.toString();
      const custOrders = allOrders.filter(o => o.customer && o.customer._id.toString() === custIdStr);
      const completedOrders = custOrders.filter(o => o.status === 'Delivered');
      
      const custPayments = payments.filter(p => p.customer && p.customer.toString() === custIdStr);
      const custBills = bills.filter(b => b.customer && b.customer.toString() === custIdStr);

      // Use bills as the source of truth for totalBilled (includes Counter Sale + order-linked bills)
      const totalBilled = custBills.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
      const totalPaid = custPayments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
      const pendingBalance = Math.max(0, totalBilled - totalPaid);

      let status = 'Settled';
      if (pendingBalance > 0 && totalPaid > 0) status = 'Partial Paid';
      else if (pendingBalance > 0 && totalPaid === 0) status = 'Pending Payment';

      return {
        customer: cust,
        totalOrdersCount: custOrders.length,
        completedOrdersCount: completedOrders.length,
        totalBilled,
        totalPaid,
        pendingBalance,
        status,
        completedOrders,
        paymentsList: custPayments.map(p => ({
          _id: p._id,
          amountPaid: p.amountPaid,
          paymentMode: p.paymentMode,
          category: p.category || 'Ledger Settlement',
          referenceNumber: p.referenceNumber || '',
          notes: p.notes || '',
          date: p.date
        })),
        billsList: custBills
      };
    // Include customers with delivered orders, bills, or payments
    }).filter(l => l.completedOrdersCount > 0 || l.billsList.length > 0 || l.paymentsList.length > 0)
      .sort((a, b) => (b.pendingBalance || 0) - (a.pendingBalance || 0));

    res.json(ledgers);
  } catch (err) {
    logger.write('error', 'ledger_summary_failed', logger.errorDetails(err, req.id));
    res.status(500).json({ error: err.message });
  }
};

exports.recordLedgerPayment = async (req, res) => {
  try {
    const { customerId, amountPaid, paymentMode, referenceNumber, notes, date, category } = req.body;
    if (!customerId || !amountPaid) return res.status(400).json({ error: 'Customer ID and amount are required' });

    const customer = await Customer.findById(customerId);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const paymentNoteText = notes || 'Manual Ledger Payment';

    const payment = await Payment.create({
      bill: null,                             // Ledger payments have no linked bill
      customer: customer._id,
      amountPaid: Number(amountPaid),
      paymentMode: paymentMode || 'Cash',
      category: category || 'Ledger Settlement',
      referenceNumber: referenceNumber || '',
      notes: paymentNoteText,
      date: date ? new Date(date) : new Date()
    });

    res.status(201).json({ success: true, payment });
  } catch (err) {
    logger.write('error', 'ledger_payment_failed', logger.errorDetails(err, req.id));
    res.status(500).json({ error: err.message });
  }
};


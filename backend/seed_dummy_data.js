require('dotenv').config();
const mongoose = require('mongoose');
const { connectDb, disconnectDb } = require('./src/config/db');

// Load models
const Branch = require('./src/models/branch');
const Vendor = require('./src/models/vendor');
const Product = require('./src/models/product');
const Batch = require('./src/models/batch');
const Customer = require('./src/models/customer');
const Order = require('./src/models/order');
const Bill = require('./src/models/bill');
const Payment = require('./src/models/payment');
const PurchaseOrder = require('./src/models/purchaseOrder');
const Expense = require('./src/models/expense');
const Quotation = require('./src/models/quotation');
const StockHistory = require('./src/models/stockHistory');
const Notification = require('./src/models/notification');

const seedDummyData = async () => {
  try {
    console.log('[SEED] Connecting to MongoDB database...');
    await connectDb();
    console.log('[SEED] Database connected successfully.');

    // Step 1: Remove all previous data
    console.log('[SEED] Purging previous records from database...');
    await Notification.deleteMany({});
    await StockHistory.deleteMany({});
    await Payment.deleteMany({});
    await Bill.deleteMany({});
    await Order.deleteMany({});
    await Quotation.deleteMany({});
    await PurchaseOrder.deleteMany({});
    await Expense.deleteMany({});
    await Batch.deleteMany({});
    await Product.deleteMany({});
    await Customer.deleteMany({});
    await Vendor.deleteMany({});
    await Branch.deleteMany({});

    console.log('[SEED] Previous data purged. Seeding Naresh Enterprises catalog and extended data...');

    // Step 2: Seed Branches
    const branchesData = [
      {
        name: 'Naresh Enterprises - Nanded Branch',
        address: 'Office H. No. 34/B, No.31.L.H. Colony, Beside Govt. ITI, Nanded - 431605',
        contact: '9822311640'
      },
      {
        name: 'Naresh Enterprises - Pune Branch',
        address: 'Nawle Complex, Chakan Road, Talegaon Dabhade, Pune - 410506',
        contact: '7020317605'
      }
    ];
    const branches = await Branch.create(branchesData);
    const primaryBranch = branches[0];
    const secondaryBranch = branches[1];
    console.log(`[SEED] Created ${branches.length} branches.`);

    // Step 3: Seed 15 Suppliers / Vendors
    const vendorsData = [
      {
        name: 'Suresh Sesodiya',
        contact: '9822114401',
        address: 'Abc Chowk, Ram Nagar, Bapu Nagar, Akola - 444001',
        performanceScore: 98,
        qualityRating: 5,
        itemCategories: ['Phenyl', 'Acid', 'Handwash Liqued', 'Glass Liqued', 'Colin']
      },
      {
        name: 'Ram Makoriya',
        contact: '9822114402',
        address: 'Bapu Nagar, Near Mondha, Nanded - 431602',
        performanceScore: 95,
        qualityRating: 5,
        itemCategories: ['Armos Frescos', 'Paper Napkin', 'H. Pick', 'Zadu', 'Mop(W)', 'Mop(D)']
      },
      {
        name: 'Ansh Ahire',
        contact: '9822114403',
        address: 'Near Naresh Enterprises, Beside ITI, Nanded - 431605',
        performanceScore: 92,
        qualityRating: 5,
        itemCategories: ["Nateend'Boul", 'Odonil', 'Yurinte', 'Floor Dister']
      },
      {
        name: 'Balaji Chemical Industries',
        contact: '9822114404',
        address: 'MIDC Chikalthana, Aurangabad - 431006',
        performanceScore: 94,
        qualityRating: 5,
        itemCategories: ['Phenyl', 'Acid', 'Cleaning Chemicals']
      },
      {
        name: 'CleanPro Hygiene Solutions',
        contact: '9822114405',
        address: 'Bhosari Industrial Area, Pune - 411026',
        performanceScore: 90,
        qualityRating: 4,
        itemCategories: ['Handwash Liqued', 'Glass Liqued', 'Disinfectants']
      },
      {
        name: 'Sai Shraddha Enterprises',
        contact: '9822114406',
        address: 'Main Market Yard, Latur - 413512',
        performanceScore: 89,
        qualityRating: 4,
        itemCategories: ['Zadu', 'Mop(W)', 'Mop(D)', 'Cleaning Tools']
      },
      {
        name: 'Maharashtra Floor Care Supplies',
        contact: '9822114407',
        address: 'Bhiwandi Logistics Hub, Thane - 421302',
        performanceScore: 96,
        qualityRating: 5,
        itemCategories: ['Floor Dister', 'Mop(D)', 'Cleaning Cloth']
      },
      {
        name: 'Royal Paper & Disposables',
        contact: '9822114408',
        address: 'MIDC Hotgi Road, Solapur - 413003',
        performanceScore: 91,
        qualityRating: 4,
        itemCategories: ['Paper Napkin', 'Tissue Rolls', 'Disposables']
      },
      {
        name: 'Krishna Cleaning Tools Ltd',
        contact: '9822114409',
        address: 'Hingna Road Industrial Estate, Nagpur - 440016',
        performanceScore: 87,
        qualityRating: 4,
        itemCategories: ['Zadu', 'Mop(W)', 'Brushes']
      },
      {
        name: 'Godavari Sanitary Packs',
        contact: '9822114410',
        address: 'Old Mondha, Nanded - 431604',
        performanceScore: 93,
        qualityRating: 5,
        itemCategories: ["Nateend'Boul", 'Yurinte', 'Sanitary']
      },
      {
        name: 'Supreme Air Fresheners',
        contact: '9822114411',
        address: 'Wagle Estate, Thane - 400604',
        performanceScore: 95,
        qualityRating: 5,
        itemCategories: ['Armos Frescos', 'Odonil', 'Air Care']
      },
      {
        name: 'Om Sai Plastic & Mops',
        contact: '9822114412',
        address: 'Ambad MIDC, Nashik - 422010',
        performanceScore: 88,
        qualityRating: 4,
        itemCategories: ['Mop(W)', 'Mop(D)', 'Buckets']
      },
      {
        name: 'Shree Ganesh Chemical Traders',
        contact: '9822114413',
        address: 'Shiroli MIDC, Kolhapur - 416122',
        performanceScore: 90,
        qualityRating: 4,
        itemCategories: ['Acid', 'Phenyl', 'Industrial Cleansers']
      },
      {
        name: 'Apex Hygiene & Detergents',
        contact: '9822114414',
        address: 'Hadapsar Industrial Estate, Pune - 411028',
        performanceScore: 92,
        qualityRating: 5,
        itemCategories: ['Colin', 'H. Pick', 'Glass Liqued']
      },
      {
        name: 'Sharda Commercial Supplies',
        contact: '9822114415',
        address: 'Badnera Road, Amravati - 444605',
        performanceScore: 86,
        qualityRating: 4,
        itemCategories: ['Paper Napkin', 'Floor Dister', 'Housekeeping']
      }
    ];
    const vendors = await Vendor.create(vendorsData);
    console.log(`[SEED] Created ${vendors.length} vendors/suppliers.`);

    // Step 4: Seed the exact 15 Products requested from the specification
    const productsSpecification = [
      {
        name: 'Phenyl',
        category: 'Housekeeping',
        unit: 'Bottle',
        price: 150,
        purchasePrice: 95,
        currentStock: 180,
        lowStockThreshold: 25,
        linkedVendor: vendors[0]._id,
        hsnCode: '3808',
        hasExpiryTracking: true
      },
      {
        name: 'Acid',
        category: 'Chemicals',
        unit: 'Bottle',
        price: 120,
        purchasePrice: 75,
        currentStock: 120,
        lowStockThreshold: 20,
        linkedVendor: vendors[0]._id,
        hsnCode: '2806',
        hasExpiryTracking: true
      },
      {
        name: 'Handwash Liqued',
        category: 'Housekeeping',
        unit: 'Bottle',
        price: 180,
        purchasePrice: 110,
        currentStock: 90,
        lowStockThreshold: 15,
        linkedVendor: vendors[0]._id,
        hsnCode: '3401',
        hasExpiryTracking: true
      },
      {
        name: 'Glass Liqued',
        category: 'Housekeeping',
        unit: 'Bottle',
        price: 160,
        purchasePrice: 95,
        currentStock: 75,
        lowStockThreshold: 15,
        linkedVendor: vendors[0]._id,
        hsnCode: '3402',
        hasExpiryTracking: true
      },
      {
        name: 'Armos Frescos',
        category: 'Fresheners',
        unit: 'Can',
        price: 220,
        purchasePrice: 140,
        currentStock: 50,
        lowStockThreshold: 10,
        linkedVendor: vendors[1]._id,
        hsnCode: '3307',
        hasExpiryTracking: true
      },
      {
        name: 'Colin',
        category: 'Glass Cleaners',
        unit: 'Bottle',
        price: 110,
        purchasePrice: 70,
        currentStock: 110,
        lowStockThreshold: 20,
        linkedVendor: vendors[0]._id,
        hsnCode: '3402',
        hasExpiryTracking: true
      },
      {
        name: 'Paper Napkin',
        category: 'Disposables',
        unit: 'Packet',
        price: 80,
        purchasePrice: 45,
        currentStock: 140,
        lowStockThreshold: 25,
        linkedVendor: vendors[1]._id,
        hsnCode: '4818',
        hasExpiryTracking: false
      },
      {
        name: 'H. Pick',
        category: 'Toilet Cleaners',
        unit: 'Bottle',
        price: 130,
        purchasePrice: 80,
        currentStock: 85,
        lowStockThreshold: 15,
        linkedVendor: vendors[1]._id,
        hsnCode: '3402',
        hasExpiryTracking: true
      },
      {
        name: 'Zadu',
        category: 'Cleaning Tools',
        unit: 'Pcs',
        price: 140,
        purchasePrice: 85,
        currentStock: 60,
        lowStockThreshold: 10,
        linkedVendor: vendors[1]._id,
        hsnCode: '9603',
        hasExpiryTracking: false
      },
      {
        name: 'Mop(W)',
        category: 'Cleaning Tools',
        unit: 'Pcs',
        price: 250,
        purchasePrice: 160,
        currentStock: 45,
        lowStockThreshold: 10,
        linkedVendor: vendors[1]._id,
        hsnCode: '9603',
        hasExpiryTracking: false
      },
      {
        name: 'Mop(D)',
        category: 'Cleaning Tools',
        unit: 'Pcs',
        price: 280,
        purchasePrice: 180,
        currentStock: 35,
        lowStockThreshold: 10,
        linkedVendor: vendors[1]._id,
        hsnCode: '9603',
        hasExpiryTracking: false
      },
      {
        name: "Nateend'Boul",
        category: 'Sanitary',
        unit: 'Packet',
        price: 95,
        purchasePrice: 55,
        currentStock: 70,
        lowStockThreshold: 15,
        linkedVendor: vendors[2]._id,
        hsnCode: '3307',
        hasExpiryTracking: true
      },
      {
        name: 'Odonil',
        category: 'Fresheners',
        unit: 'Pcs',
        price: 65,
        purchasePrice: 40,
        currentStock: 95,
        lowStockThreshold: 20,
        linkedVendor: vendors[2]._id,
        hsnCode: '3307',
        hasExpiryTracking: true
      },
      {
        name: 'Yurinte',
        category: 'Sanitary',
        unit: 'Bottle',
        price: 175,
        purchasePrice: 105,
        currentStock: 8, // Low Stock Alert Trigger (< 20)
        lowStockThreshold: 20,
        linkedVendor: vendors[2]._id,
        hsnCode: '3402',
        hasExpiryTracking: true
      },
      {
        name: 'Floor Dister',
        category: 'Cleaning Cloth',
        unit: 'Pcs',
        price: 50,
        purchasePrice: 28,
        currentStock: 6, // Low Stock Alert Trigger (< 15)
        lowStockThreshold: 15,
        linkedVendor: vendors[2]._id,
        hsnCode: '6307',
        hasExpiryTracking: false
      }
    ];

    const products = [];
    for (const spec of productsSpecification) {
      const prod = await Product.create({
        ...spec,
        branch: primaryBranch._id
      });
      products.push(prod);
    }
    console.log(`[SEED] Created ${products.length} products matching the exact catalog list.`);

    // Step 5: Seed Batches and Stock History
    const batches = [];
    const now = new Date();
    for (let i = 0; i < products.length; i++) {
      const prod = products[i];
      if (prod.hasExpiryTracking) {
        const batch = await Batch.create({
          product: prod._id,
          batchNumber: `BCH-${now.getFullYear()}-${101 + i}`,
          mfgDate: new Date(now.getFullYear(), now.getMonth() - 1, 1),
          expiryDate: new Date(now.getFullYear() + 1, now.getMonth() + 6, 1),
          quantity: prod.currentStock,
          purchasePrice: prod.purchasePrice,
          retailPrice: prod.price,
          vendor: prod.linkedVendor,
          branch: primaryBranch._id
        });
        batches.push(batch);
      }

      await StockHistory.create({
        product: prod._id,
        quantity: prod.currentStock,
        type: 'in',
        reason: 'Initial Opening Stock Entry',
        timestamp: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      });
    }
    console.log(`[SEED] Created ${batches.length} batches and inventory logs.`);

    // Step 6: Seed 32 Customers (Minimum 30)
    const customersData = [
      {
        name: 'Rohit Sharma',
        mobile: '7982834932',
        address: 'Nawle Complex, Chakan Road, Talegaon Dabhade, Pune',
        gstNumber: '27AABCS1234D1Z1',
        notes: 'Regular customer for bulk housekeeping orders',
        state: 'Maharashtra',
        branch: secondaryBranch._id,
        defaultRecurringDays: 7,
        creditLimit: 50000
      },
      {
        name: 'Virat Kolhi',
        mobile: '7982379837',
        address: 'At Post Pawna Nagar, Maval, Dist. Pune',
        gstNumber: '27AABCV5678E1Z4',
        notes: 'Resort maintenance supplies',
        state: 'Maharashtra',
        branch: secondaryBranch._id,
        defaultRecurringDays: 14,
        creditLimit: 40000
      },
      {
        name: 'Aditya Gautel',
        mobile: '7998340234',
        address: 'Bapu Nagar, Akot Fail, Akola',
        gstNumber: '',
        notes: 'Commercial cleaning supplies purchaser',
        state: 'Maharashtra',
        branch: primaryBranch._id,
        defaultRecurringDays: 30,
        creditLimit: 25000
      },
      {
        name: 'Rajesh Patil',
        mobile: '9823456781',
        address: 'Near Shivaji Chowk, Nanded',
        gstNumber: '',
        notes: 'Local retail enterprise customer',
        state: 'Maharashtra',
        branch: primaryBranch._id,
        defaultRecurringDays: 10,
        creditLimit: 20000
      },
      {
        name: 'Nanded Care Facility',
        mobile: '9823456782',
        address: 'Station Road, Beside Govt. ITI, Nanded',
        gstNumber: '27AABCN9988F1Z8',
        notes: 'Institutional client requiring monthly disinfectant deliveries',
        state: 'Maharashtra',
        branch: primaryBranch._id,
        defaultRecurringDays: 15,
        creditLimit: 80000
      },
      {
        name: 'Kulkarni Diagnostic Center',
        mobile: '9890010006',
        address: 'Doctor Lane, Mahavir Chowk, Nanded - 431601',
        gstNumber: '27AABCK2345G1Z3',
        notes: 'Pathology lab regular sanitizer and floor cleaner orders',
        state: 'Maharashtra',
        branch: primaryBranch._id,
        defaultRecurringDays: 7,
        creditLimit: 30000
      },
      {
        name: 'Green Valley International School',
        mobile: '9890010007',
        address: 'Airport Road, Nanded - 431605',
        gstNumber: '27AABCG3456H1Z5',
        notes: 'Campus housekeeping supplies order placed bi-weekly',
        state: 'Maharashtra',
        branch: primaryBranch._id,
        defaultRecurringDays: 14,
        creditLimit: 60000
      },
      {
        name: 'Hotel Surya Grand',
        mobile: '9890010008',
        address: 'Station Road, Near Bus Stand, Nanded - 431601',
        gstNumber: '27AABCH4567I1Z7',
        notes: 'Hotel room cleaning and air freshener supplies',
        state: 'Maharashtra',
        branch: primaryBranch._id,
        defaultRecurringDays: 7,
        creditLimit: 50000
      },
      {
        name: 'Sai Samarth Hospital',
        mobile: '9890010009',
        address: 'VIP Road, Nanded - 431602',
        gstNumber: '27AABCS5678J1Z9',
        notes: 'Hospital ward disinfectant & acid cleaner supply',
        state: 'Maharashtra',
        branch: primaryBranch._id,
        defaultRecurringDays: 10,
        creditLimit: 75000
      },
      {
        name: 'Dabhade Multi-Speciality Clinic',
        mobile: '9890010010',
        address: 'Station Chowk, Talegaon Dabhade, Pune - 410506',
        gstNumber: '',
        notes: 'Clinic floor care & handwash bulk buyer',
        state: 'Maharashtra',
        branch: secondaryBranch._id,
        defaultRecurringDays: 15,
        creditLimit: 35000
      },
      {
        name: 'Shivneri Residency Association',
        mobile: '9890010011',
        address: 'Chakan-Talegaon Link Road, Pune - 410501',
        gstNumber: '',
        notes: 'Housing society monthly common area cleaning items',
        state: 'Maharashtra',
        branch: secondaryBranch._id,
        defaultRecurringDays: 30,
        creditLimit: 25000
      },
      {
        name: 'Sunrise Corporate Park',
        mobile: '9890010012',
        address: 'Phase 1, Hinjawadi Infotech Park, Pune - 411057',
        gstNumber: '27AABCS6789K1Z2',
        notes: 'IT facility management supplies',
        state: 'Maharashtra',
        branch: secondaryBranch._id,
        defaultRecurringDays: 15,
        creditLimit: 120000
      },
      {
        name: 'Anand Maternity Home',
        mobile: '9890010013',
        address: 'Old Mondha Market, Nanded - 431604',
        gstNumber: '',
        notes: 'Maternity hospital hygiene materials',
        state: 'Maharashtra',
        branch: primaryBranch._id,
        defaultRecurringDays: 10,
        creditLimit: 30000
      },
      {
        name: 'Silver Oak Banquets',
        mobile: '9890010014',
        address: 'Paud Road, Kothrud, Pune - 411038',
        gstNumber: '27AABCS7890L1Z4',
        notes: 'Event hall bulk tissue and mop purchaser',
        state: 'Maharashtra',
        branch: secondaryBranch._id,
        defaultRecurringDays: 14,
        creditLimit: 45000
      },
      {
        name: 'Apex Coaching Academy',
        mobile: '9890010015',
        address: 'Shivaji Nagar, Nanded - 431602',
        gstNumber: '',
        notes: 'Classroom housekeeping items',
        state: 'Maharashtra',
        branch: primaryBranch._id,
        defaultRecurringDays: 30,
        creditLimit: 20000
      },
      {
        name: 'Mauli Agro & Commercial Complex',
        mobile: '9890010016',
        address: 'Latur Road, Nanded - 431605',
        gstNumber: '27AABCM8901M1Z6',
        notes: 'Commercial shopping complex maintenance items',
        state: 'Maharashtra',
        branch: primaryBranch._id,
        defaultRecurringDays: 20,
        creditLimit: 40000
      },
      {
        name: 'Royal Orchid Lodge',
        mobile: '9890010017',
        address: 'Railway Station Road, Nanded - 431601',
        gstNumber: '',
        notes: 'Budget hotel supplies and toilet cleaners',
        state: 'Maharashtra',
        branch: primaryBranch._id,
        defaultRecurringDays: 7,
        creditLimit: 25000
      },
      {
        name: 'TechPark Cafeteria Services',
        mobile: '9890010018',
        address: 'Magarpatta City, Hadapsar, Pune - 411028',
        gstNumber: '27AABCT9012N1Z8',
        notes: 'Kitchen and cafeteria paper napkins & handwash',
        state: 'Maharashtra',
        branch: secondaryBranch._id,
        defaultRecurringDays: 7,
        creditLimit: 55000
      },
      {
        name: 'City Dental Clinic',
        mobile: '9890010019',
        address: 'Taroda Naka, Nanded - 431605',
        gstNumber: '',
        notes: 'Dental clinic surface disinfectants',
        state: 'Maharashtra',
        branch: primaryBranch._id,
        defaultRecurringDays: 15,
        creditLimit: 20000
      },
      {
        name: 'Shriram Commercial Complex',
        mobile: '9890010020',
        address: 'MIDC Road, Nanded - 431603',
        gstNumber: '27AABCS0123O1Z1',
        notes: 'Industrial offices housekeeping supplies',
        state: 'Maharashtra',
        branch: primaryBranch._id,
        defaultRecurringDays: 30,
        creditLimit: 35000
      },
      {
        name: 'Balaji Supermarket',
        mobile: '9890010021',
        address: 'Viman Nagar Main Road, Pune - 411014',
        gstNumber: '27AABCB1234P1Z3',
        notes: 'Store sanitation and cleaning mops',
        state: 'Maharashtra',
        branch: secondaryBranch._id,
        defaultRecurringDays: 14,
        creditLimit: 40000
      },
      {
        name: 'Omkar Housing Society',
        mobile: '9890010022',
        address: 'Dange Chowk, Wakad, Pune - 411057',
        gstNumber: '',
        notes: 'Monthly bulk phenyl and zadu supplies',
        state: 'Maharashtra',
        branch: secondaryBranch._id,
        defaultRecurringDays: 30,
        creditLimit: 25000
      },
      {
        name: 'Phoenix Fitness & Gym',
        mobile: '9890010023',
        address: 'Workshop Road, Nanded - 431605',
        gstNumber: '',
        notes: 'Gym floor and equipment disinfectants',
        state: 'Maharashtra',
        branch: primaryBranch._id,
        defaultRecurringDays: 15,
        creditLimit: 15000
      },
      {
        name: 'Trimurti Diagnostic Lab',
        mobile: '9890010024',
        address: 'Bapu Nagar, Akola - 444001',
        gstNumber: '',
        notes: 'Laboratory glass liquids and sanitizers',
        state: 'Maharashtra',
        branch: primaryBranch._id,
        defaultRecurringDays: 20,
        creditLimit: 25000
      },
      {
        name: 'Blossom Kids Pre-School',
        mobile: '9890010025',
        address: 'Baner Road, Pune - 411045',
        gstNumber: '',
        notes: 'Child-safe hygiene products and liquid soap',
        state: 'Maharashtra',
        branch: secondaryBranch._id,
        defaultRecurringDays: 30,
        creditLimit: 20000
      },
      {
        name: 'Siddhivinayak Traders',
        mobile: '9890010026',
        address: 'Old Mondha, Nanded - 431604',
        gstNumber: '27AABCS2345Q1Z5',
        notes: 'Wholesale reseller partner',
        state: 'Maharashtra',
        branch: primaryBranch._id,
        defaultRecurringDays: 7,
        creditLimit: 60000
      },
      {
        name: 'Gurukrupa Eye Hospital',
        mobile: '9890010027',
        address: 'Mahavir Chowk, Nanded - 431601',
        gstNumber: '27AABCG3456R1Z7',
        notes: 'Operation theater and ward cleaners',
        state: 'Maharashtra',
        branch: primaryBranch._id,
        defaultRecurringDays: 10,
        creditLimit: 50000
      },
      {
        name: 'Prime Care Nursing Home',
        mobile: '9890010028',
        address: 'Gadital, Hadapsar, Pune - 411028',
        gstNumber: '27AABCP4567S1Z9',
        notes: 'Nursing home housekeeping and bathroom cleaners',
        state: 'Maharashtra',
        branch: secondaryBranch._id,
        defaultRecurringDays: 14,
        creditLimit: 45000
      },
      {
        name: 'Metro Logistics Hub',
        mobile: '9890010029',
        address: 'Chakan MIDC Phase 2, Pune - 410501',
        gstNumber: '27AABCM5678T1Z1',
        notes: 'Warehouse floor sweepers and industrial mops',
        state: 'Maharashtra',
        branch: secondaryBranch._id,
        defaultRecurringDays: 30,
        creditLimit: 70000
      },
      {
        name: 'Golden Leaf Restaurant & Bar',
        mobile: '9890010030',
        address: 'Station Road, Nanded - 431601',
        gstNumber: '27AABCG6789U1Z3',
        notes: 'Restaurant kitchen degreasers and floor cleaners',
        state: 'Maharashtra',
        branch: primaryBranch._id,
        defaultRecurringDays: 7,
        creditLimit: 35000
      },
      {
        name: 'Pragati Mahila Bachat Gat',
        mobile: '9890010031',
        address: 'ITI Colony, Nanded - 431605',
        gstNumber: '',
        notes: 'Community self-help group supplies',
        state: 'Maharashtra',
        branch: primaryBranch._id,
        defaultRecurringDays: 30,
        creditLimit: 15000
      },
      {
        name: 'Vikas Educational Society',
        mobile: '9890010032',
        address: 'Degloor Road, Nanded - 431604',
        gstNumber: '27AABCV7890V1Z5',
        notes: 'College campus bulk sanitation order',
        state: 'Maharashtra',
        branch: primaryBranch._id,
        defaultRecurringDays: 15,
        creditLimit: 65000
      }
    ];
    const customers = await Customer.create(customersData);
    console.log(`[SEED] Created ${customers.length} customers.`);

    // Step 7: Seed Orders, Bills, and Payments
    const orders = [];
    const bills = [];
    const payments = [];

    const dateToday = new Date();
    const dateYesterday = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    const date3DaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const date5DaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const dateTomorrow = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);

    const orderBlueprints = [
      {
        customer: customers[0], // Rohit Sharma
        date: date5DaysAgo,
        deliveryDate: date5DaysAgo,
        status: 'Delivered',
        paymentStatus: 'Paid',
        items: [
          { prod: products[0], qty: 10 }, // Phenyl
          { prod: products[1], qty: 5 },  // Acid
          { prod: products[2], qty: 8 },  // Handwash Liqued
          { prod: products[5], qty: 12 }  // Colin
        ],
        invNumber: 'INV-2026-0001',
        paymentMode: 'UPI'
      },
      {
        customer: customers[1], // Virat Kolhi
        date: date3DaysAgo,
        deliveryDate: dateYesterday,
        status: 'Delivered',
        paymentStatus: 'Paid',
        items: [
          { prod: products[4], qty: 6 },  // Armos Frescos
          { prod: products[6], qty: 15 }, // Paper Napkin
          { prod: products[7], qty: 8 },  // H. Pick
          { prod: products[9], qty: 4 }   // Mop(W)
        ],
        invNumber: 'INV-2026-0002',
        paymentMode: 'Bank Transfer'
      },
      {
        customer: customers[2], // Aditya Gautel
        date: dateYesterday,
        deliveryDate: dateToday,
        status: 'Out for Delivery',
        paymentStatus: 'Pending',
        items: [
          { prod: products[8], qty: 10 }, // Zadu
          { prod: products[10], qty: 5 }, // Mop(D)
          { prod: products[11], qty: 8 }  // Nateend'Boul
        ],
        invNumber: 'INV-2026-0003',
        paymentMode: null
      },
      {
        customer: customers[4], // Nanded Care Facility
        date: dateToday,
        deliveryDate: dateTomorrow,
        status: 'Packed',
        paymentStatus: 'Pending',
        items: [
          { prod: products[0], qty: 15 }, // Phenyl
          { prod: products[2], qty: 10 }, // Handwash Liqued
          { prod: products[12], qty: 12 } // Odonil
        ],
        invNumber: 'INV-2026-0004',
        paymentMode: null
      },
      {
        customer: customers[3], // Rajesh Patil
        date: dateToday,
        deliveryDate: dateTomorrow,
        status: 'Pending',
        paymentStatus: 'Pending',
        items: [
          { prod: products[1], qty: 4 },  // Acid
          { prod: products[3], qty: 6 },  // Glass Liqued
          { prod: products[14], qty: 10 } // Floor Dister
        ],
        invNumber: 'INV-2026-0005',
        paymentMode: null
      },
      {
        customer: customers[5], // Kulkarni Diagnostic Center
        date: dateYesterday,
        deliveryDate: dateToday,
        status: 'Delivered',
        paymentStatus: 'Paid',
        items: [
          { prod: products[0], qty: 12 }, // Phenyl
          { prod: products[2], qty: 6 },  // Handwash Liqued
          { prod: products[7], qty: 5 }   // H. Pick
        ],
        invNumber: 'INV-2026-0006',
        paymentMode: 'Cash'
      },
      {
        customer: customers[6], // Green Valley International School
        date: dateToday,
        deliveryDate: dateTomorrow,
        status: 'Pending',
        paymentStatus: 'Pending',
        items: [
          { prod: products[0], qty: 20 }, // Phenyl
          { prod: products[8], qty: 15 }, // Zadu
          { prod: products[9], qty: 8 },  // Mop(W)
          { prod: products[14], qty: 12 } // Floor Dister
        ],
        invNumber: 'INV-2026-0007',
        paymentMode: null
      }
    ];

    for (const bp of orderBlueprints) {
      const orderItems = bp.items.map((it) => ({
        product: it.prod._id,
        quantity: it.qty,
        price: it.prod.price,
        vendor: it.prod.linkedVendor
      }));

      const totalAmount = orderItems.reduce((acc, it) => acc + it.quantity * it.price, 0);

      const order = await Order.create({
        customer: bp.customer._id,
        items: orderItems,
        totalAmount,
        deliveryDate: bp.deliveryDate,
        status: bp.status,
        branch: bp.customer.branch || primaryBranch._id,
        paymentStatus: bp.paymentStatus,
        feedbackRating: bp.status === 'Delivered' ? 5 : undefined,
        feedbackComment: bp.status === 'Delivered' ? 'Timely delivery of housekeeping supplies.' : undefined,
        createdAt: bp.date
      });
      orders.push(order);

      const billItems = bp.items.map((it) => {
        const itemTotal = it.qty * it.prod.price;
        const cgst = Math.round(itemTotal * 0.09 * 100) / 100;
        const sgst = Math.round(itemTotal * 0.09 * 100) / 100;
        return {
          product: it.prod._id,
          quantity: it.qty,
          price: it.prod.price,
          cgst,
          sgst,
          igst: 0
        };
      });

      const bill = await Bill.create({
        invoiceNumber: bp.invNumber,
        order: order._id,
        customer: bp.customer._id,
        items: billItems,
        subtotal: totalAmount,
        cgstTotal: Math.round(totalAmount * 0.09 * 100) / 100,
        sgstTotal: Math.round(totalAmount * 0.09 * 100) / 100,
        igstTotal: 0,
        totalAmount: Math.round(totalAmount * 1.18 * 100) / 100,
        isGstApplicable: true,
        status: bp.paymentStatus === 'Paid' ? 'Paid' : 'Unpaid',
        branch: bp.customer.branch || primaryBranch._id,
        createdAt: bp.date
      });
      bills.push(bill);

      if (bp.paymentStatus === 'Paid' && bp.paymentMode) {
        const payment = await Payment.create({
          bill: bill._id,
          order: order._id,
          customer: bp.customer._id,
          amountPaid: bill.totalAmount,
          paymentMode: bp.paymentMode,
          category: 'Invoice Settlement',
          date: bp.date,
          referenceNumber: `TXN-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`,
          notes: `Settled via ${bp.paymentMode}`
        });
        payments.push(payment);
      }
    }
    console.log(`[SEED] Created ${orders.length} orders, ${bills.length} bills, and ${payments.length} payments.`);

    // Step 8: Seed Purchase Orders to Vendors
    const purchaseOrdersData = [
      {
        supplier: vendors[0]._id, // Suresh Sesodiya
        items: [
          { product: products[0]._id, quantity: 200, costPrice: 95, receivedQuantity: 200 },
          { product: products[1]._id, quantity: 150, costPrice: 75, receivedQuantity: 150 }
        ],
        totalCost: 200 * 95 + 150 * 75,
        expectedDeliveryDate: dateYesterday,
        status: 'Fully Received',
        branch: primaryBranch._id,
        createdAt: date5DaysAgo
      },
      {
        supplier: vendors[1]._id, // Ram Makoriya
        items: [
          { product: products[4]._id, quantity: 50, costPrice: 140, receivedQuantity: 0 },
          { product: products[8]._id, quantity: 80, costPrice: 85, receivedQuantity: 0 }
        ],
        totalCost: 50 * 140 + 80 * 85,
        expectedDeliveryDate: dateTomorrow,
        status: 'Ordered',
        branch: primaryBranch._id,
        createdAt: dateToday
      },
      {
        supplier: vendors[3]._id, // Balaji Chemical Industries
        items: [
          { product: products[0]._id, quantity: 100, costPrice: 95, receivedQuantity: 100 },
          { product: products[1]._id, quantity: 100, costPrice: 75, receivedQuantity: 100 }
        ],
        totalCost: 100 * 95 + 100 * 75,
        expectedDeliveryDate: date3DaysAgo,
        status: 'Fully Received',
        branch: primaryBranch._id,
        createdAt: date5DaysAgo
      }
    ];
    const purchaseOrders = await PurchaseOrder.create(purchaseOrdersData);
    console.log(`[SEED] Created ${purchaseOrders.length} purchase orders.`);

    // Step 9: Seed Quotations
    const quotationsData = [
      {
        customer: customers[4]._id, // Nanded Care Facility
        items: [
          { product: products[0]._id, quantity: 30, price: products[0].price },
          { product: products[2]._id, quantity: 20, price: products[2].price },
          { product: products[7]._id, quantity: 15, price: products[7].price }
        ],
        totalAmount: 30 * 150 + 20 * 180 + 15 * 130,
        validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        status: 'Sent',
        createdAt: dateYesterday
      },
      {
        customer: customers[7]._id, // Hotel Surya Grand
        items: [
          { product: products[4]._id, quantity: 20, price: products[4].price },
          { product: products[5]._id, quantity: 25, price: products[5].price },
          { product: products[6]._id, quantity: 50, price: products[6].price }
        ],
        totalAmount: 20 * 220 + 25 * 110 + 50 * 80,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'Draft',
        createdAt: dateToday
      }
    ];
    const quotations = await Quotation.create(quotationsData);
    console.log(`[SEED] Created ${quotations.length} quotations.`);

    // Step 10: Seed Operating Expenses
    const expensesData = [
      {
        category: 'rent',
        amount: 18000,
        date: new Date(now.getFullYear(), now.getMonth(), 1),
        notes: 'Warehouse & office rent - Naresh Enterprises',
        branch: primaryBranch._id
      },
      {
        category: 'fuel',
        amount: 2500,
        date: date3DaysAgo,
        notes: 'Delivery tempo diesel expense',
        branch: primaryBranch._id
      },
      {
        category: 'salary',
        amount: 28000,
        date: new Date(now.getFullYear(), now.getMonth(), 5),
        notes: 'Staff salaries for storekeeper and delivery boy',
        branch: primaryBranch._id
      }
    ];
    const expenses = await Expense.create(expensesData);
    console.log(`[SEED] Created ${expenses.length} expenses.`);

    // Step 11: Seed Notifications
    const notificationsData = [
      {
        title: 'Low Stock Alert',
        message: 'Yurinte is running low (8 remaining). Reorder recommended.',
        type: 'low_stock',
        relatedId: products[13]._id,
        read: false,
        createdAt: dateToday
      },
      {
        title: 'Low Stock Alert',
        message: 'Floor Dister is below threshold (6 remaining).',
        type: 'low_stock',
        relatedId: products[14]._id,
        read: false,
        createdAt: dateToday
      },
      {
        title: 'Delivery Schedule',
        message: 'Delivery out for Aditya Gautel today.',
        type: 'delivery',
        relatedId: orders[2]._id,
        read: false,
        createdAt: dateToday
      }
    ];
    const notifications = await Notification.create(notificationsData);
    console.log(`[SEED] Created ${notifications.length} notifications.`);

    // Step 12: Ensure admin user for Shital Kalekar
    const User = require('./src/models/user');
    const targetEmail = 'shitalkalekar05@gmail.com';
    const existingUser = await User.findOne({ email: targetEmail });
    if (!existingUser) {
      await User.create({
        email: targetEmail,
        password: 'Shital@#032003Kalekar',
        role: 'admin',
        name: 'Shital Kalekar',
        mobile: '9876543210',
        status: 'Active'
      });
      console.log(`[SEED] Created admin user: ${targetEmail}`);
    }

    console.log('\n======================================================');
    console.log('✅ NARESH ENTERPRISES DATA SEEDED SUCCESSFULLY!');
    console.log('======================================================');
    console.log(`• Total Customers: ${customers.length} (Target: >= 30) ✅`);
    console.log(`• Total Suppliers: ${vendors.length} (Target: >= 15) ✅`);
    console.log(`• Total Products:  ${products.length} (Exact 15 items from screenshot) ✅`);
    console.log(`• Total Batches:   ${batches.length}`);
    console.log(`• Total Orders:    ${orders.length}`);
    console.log(`• Total Bills:     ${bills.length}`);
    console.log(`• Total Payments:  ${payments.length}`);
    console.log(`• Purchase Orders: ${purchaseOrders.length}`);
    console.log(`• Quotations:      ${quotations.length}`);
    console.log(`• Expenses:        ${expenses.length}`);
    console.log(`• Notifications:   ${notifications.length}`);
    console.log('======================================================\n');

    await disconnectDb();
    process.exit(0);
  } catch (err) {
    console.error('[SEED] Error during data seeding:', err);
    await disconnectDb().catch(() => {});
    process.exit(1);
  }
};

seedDummyData();

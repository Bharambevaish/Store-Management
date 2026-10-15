# Comprehensive System Documentation: Naresh Enterprises ERP

> **Business Context & Operating Reality**  
> This system is built for **Naresh Enterprises**, a distributor of cleaning, hygiene, and housekeeping products (such as Phenyl, Acid, Handwash Liquid, Glass Cleaner, Mops, Brooms, Air Fresheners, Paper Napkins, etc.) based in Nanded, Maharashtra.  
> It is **NOT** a pharmacy or medical application. However, the codebase was originally adapted from a medical stock/pharmacy template (and prior to that, contains legacy remnants from an educational Student Information System). Consequently, pharmacy-specific terminology, field labels, validation rules, and default values (e.g., HSN 3004, "strips/tablets" hints) remain in several areas. This document audits the current state of the entire system without modification so these discrepancies can be systematically addressed.

---

## 1. Tech Stack Summary

| Layer | Technology / Library | Version / Details | Purpose / Notes |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | React | `^18.3.1` | Single Page Application UI with React functional components and hooks. |
| **Frontend Build Tool** | Vite | `^8.2.1` | Local development server (`port 3009`) and production asset bundler. |
| **Styling** | Vanilla CSS (`index.css`, `Login.css`) | Custom design system | Modern responsive CSS with custom properties (`--primary: #087E8B`, `--accent-teal`, rounded cards, clean data tables, print stylesheets). |
| **Icons** | Lucide React | `^1.27.0` | Vector icon set used across navigation, dashboard widgets, buttons, and status indicators. |
| **Spreadsheet Tooling** | SheetJS (`xlsx`) | `0.20.3` (`cdn.sheetjs.com`) | Client-side parsing and generation of `.xlsx` files for bulk import and sample downloads. |
| **Charts / Analytics** | Recharts | `^3.9.2` | SVG charting library used in Sales Dashboard and analytics reports. |
| **Client HTTP Transport**| Axios | `^1.7.2` | HTTP client configured with bearer token injection, request interception, and auth-expiry event dispatch. |
| **Client PDF Fallback** | jsPDF + jsPDF-AutoTable | `^4.2.1` / `^5.0.8` | Client-side tabular PDF generation fallback. |
| **Backend Runtime** | Node.js | `>= 18` | Asynchronous JavaScript runtime. |
| **Backend Framework** | Express.js | `^4.19.2` | REST API framework listening on port `4009` under prefix `/result-analysis`. |
| **Database** | MongoDB | Local / MongoDB Atlas | NoSQL document database configured via `MONGO_URI` (`result_analysis_db`). |
| **ODM** | Mongoose | `^8.4.0` | Schema definition, model validation, and query construction. |
| **Security & Middleware**| Helmet, CORS, Express-Rate-Limit, BCryptJS | Helmet `^7.1.0`, Bcrypt `^3.0.3` | Request hardening, IP-based rate limiting, password hashing (cost factor 12), and prototype pollution rejection. |
| **PDF Generation (Server)**| PDFKit | `^0.19.1` | Server-side invoice and quotation PDF rendering (`CLASSIC_MEMO_BOOK`, `MODERN_TAX_INVOICE`, `THERMAL_POS`). |
| **QR Code Generation** | QRCode | `^1.5.4` | Server-side dynamic generation of UPI payment QR codes embedded in PDF invoices. |
| **Deployment Target** | Render Web Service | Free Tier / Standard Web Service | Node.js environment configured with ephemeral filesystem policy and sleeping container lifecycle. |

---

## 2. Data Models / Schema

The application models represent wholesale distribution, stock tracking, and financial operations. (Note: Leftover academic models from an older codebase exist on disk but are not imported by the active application routes.)

### Active Business Models

#### 1. `Product` (`backend/src/models/product.js`)
*Represents an inventory item/cleaning chemical or housekeeping good managed and sold by the business.*
- `name` (String, **Required**, minlength: 2, maxlength: 100, trim)
- `category` (String, **Required**, maxlength: 100, trim)
- `unit` (String, **Required**, maxlength: 30, trim) — *e.g., Litre, Can, Bottle, Box, Pcs*
- `price` (Number, **Required**, min: 0, max: 1,000,000,000) — *Retail selling price*
- `currentStock` (Number, **Required**, default: 0, min: 0, max: 10,000,000)
- `reservedStock` (Number, default: 0, min: 0, max: 10,000,000) — *Temporarily held when orders are packed/out for delivery*
- `lowStockThreshold` (Number, **Required**, default: 10, min: 0, max: 10,000,000) — *Reorder alert level*
- `linkedVendor` (ObjectId ref `'Vendor'`, **Required**) — *Primary supplier*
- `hsnCode` (String, default: `'3004'`, matches 4/6/8-digit numeric or legacy HSN prefix) — *Note: default 3004 is pharma-specific*
- `branch` (ObjectId ref `'Branch'`, default: `null`)
- `purchasePrice` (Number, default: 0, min: 0, max: 1,000,000,000)
- `hasExpiryTracking` (Boolean, default: `false`)
- `createdAt` (Date, default: `Date.now`)

#### 2. `Customer` (`backend/src/models/customer.js`)
*Represents wholesale buyers, retail establishments, commercial clients, or institutions purchasing cleaning products.*
- `name` (String, **Required**, minlength: 2, maxlength: 100, trim)
- `mobile` (String, **Required**, **Unique**, match: `/^\d{10}$/`, trim) — *Must be strictly 10 digits*
- `address` (String, **Required**, maxlength: 500, trim)
- `gstNumber` (String, default: `''`, maxlength: 15, trim)
- `notes` (String, default: `''`, maxlength: 1000, trim)
- `state` (String, default: `'Maharashtra'`, maxlength: 100, trim)
- `branch` (ObjectId ref `'Branch'`, default: `null`)
- `defaultRecurringDays` (Number, default: 0, min: 0, max: 365) — *Default cycle in days for recurring deliveries*
- `creditLimit` (Number, default: 0, min: 0, max: 1,000,000,000) — *Maximum credit ceiling permitted before orders require review*
- `createdAt` (Date, default: `Date.now`)

#### 3. `Vendor` (`backend/src/models/vendor.js`)
*Represents chemical manufacturers, packaging vendors, or goods suppliers from whom Naresh Enterprises procures inventory.*
- `name` (String, **Required**, minlength: 2, maxlength: 100, trim)
- `contact` (String, **Required**, match: `/^\d{10}$/`, trim) — *10-digit mobile number*
- `address` (String, **Required**, maxlength: 500, trim)
- `performanceScore` (Number, default: 100, min: 0, max: 100)
- `qualityRating` (Number, default: 5, min: 1, max: 5)
- `itemCategories` (Array of Strings, default: `[]`, max 50 items)
- `createdAt` (Date, default: `Date.now`)

#### 4. `Order` (`backend/src/models/order.js`)
*Represents a sales order containing customer details, line items, status progress, delivery routing, and recurring loop schedules.*
- `customer` (ObjectId ref `'Customer'`, **Required**)
- `items` (Array of subdocuments, **Required**, 1 to 100 items):
  - `product` (ObjectId ref `'Product'`, **Required**)
  - `quantity` (Number, **Required**, min: 1, max: 10000)
  - `price` (Number, **Required**, min: 0, max: 1,000,000,000)
  - `vendor` (ObjectId ref `'Vendor'`, **Required**)
- `totalAmount` (Number, **Required**, min: 0, max: 1,000,000,000)
- `deliveryDate` (Date, **Required**)
- `status` (String, enum: `['Requested', 'Pending', 'Assigned', 'Packed', 'Out for Delivery', 'Delivered', 'Cancelled']`, default: `'Pending'`)
- `assignedStaff` (ObjectId ref `'User'`, default: `null`)
- `assignedTo` (ObjectId ref `'Employee'`, default: `null`)
- `branch` (ObjectId ref `'Branch'`, default: `null`)
- `latitude` (Number, default: 0)
- `longitude` (Number, default: 0)
- `deliveryProofUrl` (String, default: `''`)
- `signatureUrl` (String, default: `''`)
- `deliveredAt` (Date, default: `null`)
- `statusHistory` (Array of subdocuments: `status`, `timestamp`, `assignedStaff`, `assignedTo`, `updatedBy`)
- `feedbackRating` (Number, min: 1, max: 5)
- `feedbackComment` (String, maxlength: 1000, trim)
- `remarks` (String, default: `''`, maxlength: 1000, trim)
- `assignmentHistory` (Array of subdocuments: `assignedTo`, `assignedBy`, `date`)
- `isRecurring` (Boolean, default: `false`) — *Enables recurring loop generation*
- `isGstApplicable` (Boolean, default: `false`)
- `recurringIntervalDays` (Number, default: 30, min: 1, max: 365) — *Interval days between delivery iterations*
- `recurringSourceOrder` (ObjectId ref `'Order'`, default: `null`) — *Points back to origin order if generated by a loop*
- `recurringProcessed` (Boolean, default: `false`) — *Prevents re-processing of the same cycle*
- `recurringProcessingAt` (Date, default: `null`, hidden by default) — *Atomic lock timestamp*
- `paymentOrderId` (String, default: `null`)
- `paymentStatus` (String, enum: `['Pending', 'Paid', 'Failed']`, default: `'Pending'`)
- `createdAt` (Date, default: `Date.now`)

#### 5. `Quotation` (`backend/src/models/quotation.js`)
*Represents formal price quotations or estimates provided to clients prior to order confirmation or invoicing.*
- `customer` (ObjectId ref `'Customer'`, **Required**)
- `items` (Array of subdocuments, **Required**, 1 to 100 items):
  - `product` (ObjectId ref `'Product'`, **Required**)
  - `quantity` (Number, **Required**, min: 1, max: 10000)
  - `price` (Number, **Required**, min: 0, max: 1,000,000,000)
- `totalAmount` (Number, **Required**, min: 0, max: 1,000,000,000)
- `validUntil` (Date, **Required**)
- `status` (String, enum: `['Draft', 'Sent', 'Converted', 'Expired']`, default: `'Draft'`)
- `createdAt` (Date, default: `Date.now`)

#### 6. `Bill` (`backend/src/models/bill.js`)
*Represents a persisted sales invoice with auto-sequential numbering, GST tax splits, line items, and payment status.*
- `invoiceNumber` (String, **Required**, **Unique**, maxlength: 100, trim) — *e.g., '001', '002'*
- `order` (ObjectId ref `'Order'`, default: `null`) — *Linked when generated from order fulfillment*
- `customer` (ObjectId ref `'Customer'`, **Required**)
- `items` (Array of subdocuments, **Required**, 1 to 100 items):
  - `product` (ObjectId ref `'Product'`, **Required**)
  - `quantity` (Number, **Required**, min: 1, max: 10000)
  - `price` (Number, **Required**, min: 0, max: 1,000,000,000)
  - `cgst` (Number, default: 0)
  - `sgst` (Number, default: 0)
  - `igst` (Number, default: 0)
- `subtotal` (Number, **Required**, min: 0, max: 1,000,000,000)
- `cgstTotal` (Number, default: 0)
- `sgstTotal` (Number, default: 0)
- `igstTotal` (Number, default: 0)
- `totalAmount` (Number, **Required**, min: 0, max: 1,000,000,000)
- `isGstApplicable` (Boolean, default: `false`)
- `status` (String, enum: `['Unpaid', 'Partially Paid', 'Paid']`, default: `'Unpaid'`)
- `quotationRef` (ObjectId ref `'Quotation'`, default: `null`)
- `branch` (ObjectId ref `'Branch'`, default: `null`)
- `paymentOrderId` (String, default: `null`, maxlength: 200)
- `paymentStatus` (String, enum: `['Pending', 'Paid', 'Failed']`, default: `'Pending'`)
- `createdAt` (Date, default: `Date.now`)

#### 7. `Payment` (`backend/src/models/payment.js`)
*Represents a cash, UPI, bank, or cheque payment transaction recorded from a customer.*
- `bill` (ObjectId ref `'Bill'`, default: `null`) — *Optional; null for general ledger settlements*
- `order` (ObjectId ref `'Order'`, default: `null`)
- `customer` (ObjectId ref `'Customer'`, **Required**)
- `amountPaid` (Number, **Required**, min: 0.01, max: 1,000,000,000)
- `paymentMode` (String, **Required**, enum: `['cash', 'Cash', 'UPI', 'UPI / QR', 'bank transfer', 'Bank Transfer', 'Bank Transfer / NEFT', 'cheque', 'Cheque', 'Credit Card', 'Credit / Debit Card', 'Other']`)
- `category` (String, default: `'Ledger Settlement'`, maxlength: 100, trim)
- `date` (Date, default: `Date.now`)
- `referenceNumber` (String, default: `''`, maxlength: 100, trim) — *UTR, cheque number, transaction ID*
- `notes` (String, default: `''`, maxlength: 1000, trim)
- `createdAt`, `updatedAt` (Timestamps auto-generated)

#### 8. `Employee` (`backend/src/models/employee.js`)
*Represents delivery staff, warehouse packers, or operations personnel.*
- `name` (String, **Required**, trim)
- `mobile` (String, **Required**, trim)
- `role` (String, **Required**, enum: `['Delivery Staff', 'Packer', 'Admin', 'Manager']`)
- `joiningDate` (Date, default: `Date.now`)
- `status` (String, enum: `['Active', 'Inactive']`, default: `'Active'`)
- `profilePhoto` (String, default: `''`)
- `user` (ObjectId ref `'User'`, default: `null`)
- `branch` (ObjectId ref `'Branch'`, **Required**)
- `createdAt` (Date, default: `Date.now`)

#### 9. `Branch` (`backend/src/models/branch.js`)
*Represents a warehouse location, depot, or sales distribution outlet.*
- `name` (String, **Required**, minlength: 2, maxlength: 100, trim)
- `address` (String, **Required**, maxlength: 500, trim)
- `contact` (String, **Required**, maxlength: 30, trim)
- `createdAt` (Date, default: `Date.now`)

#### 10. `Setting` (`backend/src/models/setting.js`)
*Stores singleton enterprise profile configuration, print layout templates, bank details, and messaging parameters.*
- `companyName` (String, default: `'NARESH ENTERPRISES'`, maxlength: 150, trim)
- `state` (String, default: `'Maharashtra'`, maxlength: 100, trim)
- `logoUrl` (String, default: `''`, maxlength: 2000)
- `address` (String, default: `'Office H. No.34/B, No.31L.H. Colony, Beside Govt. ITI, NANDED'`, maxlength: 500, trim)
- `email` (String, default: `'contact@nareshenterprises.com'`, maxlength: 254, lowercase, trim)
- `contact` (String, default: `'9822311640, 7020317605'`, maxlength: 100, trim)
- `gstNumber` (String, default: `'27AAAAA0000A1Z5'`, maxlength: 15, trim)
- `bankDetails` (Object: `bankName`, `accountNo`, `ifscCode`, `branch`)
- `smsTemplates` (Object: `marathi`, `english`)
- `pdfSettings` (Object: `billPageSize` [A4/A5/LETTER/THERMAL_80MM], `quotationPageSize` [A4/A5/LETTER], `billTemplate` [CLASSIC_MEMO_BOOK/MODERN_TAX_INVOICE/ELEGANT_MINIMAL/THERMAL_POS])
- `whatsappProvider` (String, default: `'meta'`)
- `whatsappPhoneId` (String, default: `''`, maxlength: 100)
- `whatsappToken` (String, default: `''`, hidden by select: false)

#### 11. `User` (`backend/src/models/user.js`)
*Represents authenticated owner/administrator accounts.*
- `email` (String, **Required**, **Unique**, lowercase, trim, maxlength: 254)
- `password` (String, **Required**, minlength: 16, maxlength: 128, hashed via bcrypt, hidden by default)
- `role` (String, **Required**, enum: `['admin']`) — *Restricted in pilot to 'admin'*
- `name` (String, **Required**, trim, maxlength: 100)
- `mobile` (String, **Required**, match: `/^\d{10}$/`, trim)
- `status` (String, enum: `['Active', 'Inactive']`, default: `'Active'`)
- `passwordChangedAt` (Date, default: `Date.now`, hidden)
- `createdAt` (Date, default: `Date.now`)

#### 12. Supporting Operational Models
- **`Batch`** (`backend/src/models/batch.js`): Product batch lots (`product`, `batchNumber`, `expiryDate`, `mfgDate`, `quantity`, `purchasePrice`, `retailPrice`, `vendor`, `branch`).
- **`PurchaseOrder`** (`backend/src/models/purchaseOrder.js`): Inward procurement orders (`supplier`, `items`, `totalCost`, `expectedDeliveryDate`, `status`, `receivingHistory`, `branch`).
- **`Expense`** (`backend/src/models/expense.js`): Operating expenses (`category`: rent/salary/fuel/misc, `amount`, `date`, `notes`, `receiptImage`, `branch`).
- **`StockAdjustment`** (`backend/src/models/stockAdjustment.js`): Formal manual stock correction log (`product`, `oldQty`, `newQty`, `adjustedBy`, `reason`, `timestamp`).
- **`StockHistory`** (`backend/src/models/stockHistory.js`): Granular audit ledger of physical inventory movements (`product`, `quantity`, `type`: in/out, `reason`, `timestamp`).
- **`Notification`** (`backend/src/models/notification.js`): In-app system alerts (`title`, `message`, `type`: delivery/low_stock/delivery_reminder, `relatedId`, `read`).
- **`AuditLog`** (`backend/src/models/auditLog.js`): Administrative audit trails (`user`, `action`, `entity`, `entityId`, `diff`, `timestamp`).
- **`JobRun`** (`backend/src/models/jobRun.js`): Execution audit and locks for recurring batch jobs (`jobKey`: 'recurring_orders', `status`, `trigger`, `lastStartedAt`, `lastCompletedAt`, `lastResult`).

#### 13. Leftover Legacy Models (37 Inactive Schemas)
Files such as `student.js`, `admission.js`, `course.js`, `faculty.js`, `hallTicket.js`, `certificate.js`, and `settings.js` (plural) are remnants from an educational ERP. They are **not referenced** in `routes/index.js` or `app.js`.

---

## 3. API Endpoints

All application routes are served under the Express base prefix `/result-analysis`. All endpoints except `/auth/login` require an authenticated Bearer token and owner/admin authorization.

### Authentication
- `POST /result-analysis/auth/login` — Authenticates the owner via email & password; returns a scoped JWT.
- `GET /result-analysis/auth/me` — Fetches current authenticated administrator identity profile.
- `POST /result-analysis/auth/change-password` — Updates the owner's password and invalidates all prior sessions.

### Dashboard & Alerts
- `GET /result-analysis/dashboard/stats` — Returns aggregate metrics: total sales, today's sales, month's sales, payments received, total outstanding dues, customer/product counts, and recurring job run stats.
- `GET /result-analysis/notifications` — Lists system notifications (low stock alerts, delivery notices).
- `PUT /result-analysis/notifications/:id/read` — Marks a specific notification as read.

### Products & Inventory
- `GET /result-analysis/products` — Lists products with query filters (search, category, stock status, branch).
- `POST /result-analysis/products` — Registers a new product into inventory.
- `PUT /result-analysis/products/:id` — Updates existing product details, prices, or reorder levels.
- `DELETE /result-analysis/products/:id` — Deletes a product record (restricted to admin).
- `PUT /result-analysis/products/:id/adjust` — Quick stock quantity update with an audit reason.
- `PUT /result-analysis/products/:id/adjust-manual` — Advanced manual stock adjustment logging to `StockAdjustment`.
- `POST /result-analysis/products/quick-stock-in` — Inward quick adjustment adding quantities to existing products.
- `POST /result-analysis/products/quick-issue` — Quick Express Sale: deducts stock immediately, creates a paid `Bill`, and records a matching cash `Payment`.
- `GET /result-analysis/products/reorder-list` — Returns items whose `currentStock <= lowStockThreshold`.
- `GET /result-analysis/products/:id/stock-logs` — Retrieves inflow/outflow audit records (`StockHistory`) for a product.
- `GET /result-analysis/products/expiry-alerts` — Retrieves product batches nearing expiration (within 30/60/90 days).

### Batches
- `POST /result-analysis/batches` — Creates a new lot/batch for a product with quantity, expiry, and manufacturing dates.
- `GET /result-analysis/batches` — Lists all batches across products.

### Customers
- `POST /result-analysis/customers` — Registers a new customer profile.
- `GET /result-analysis/customers` — Returns customer list with contact information, addresses, and balance metrics.
- `GET /result-analysis/customers/:id` — Retrieves complete customer profile including historical orders, bills, and ledger payments.
- `PUT /result-analysis/customers/:id` — Updates customer profile details.
- `DELETE /result-analysis/customers/:id` — Deletes a customer profile (admin only).

### Customer Ledgers & Statements
- `GET /result-analysis/customer-ledgers/summary` — Computes customer ledger summaries across all delivered orders and payments (total billed, total paid, pending balance, and payment status).
- `POST /result-analysis/customer-ledgers/record-payment` — Records an unallocated ledger settlement payment from a customer without requiring a specific bill ID.

### Suppliers / Vendors
- `POST /result-analysis/vendors` — Registers a new supplier/vendor.
- `GET /result-analysis/vendors` — Lists all suppliers with rating and category details.
- `PUT /result-analysis/vendors/:id` — Updates vendor contact and category information.
- `DELETE /result-analysis/vendors/:id` — Deletes a vendor record.

### Sales Orders & Recurring Loops
- `POST /result-analysis/orders` — Creates a sales order with line items, delivery date, and recurring interval. Validates stock availability.
- `GET /result-analysis/orders` — Lists sales orders with status and staff filtering.
- `PUT /result-analysis/orders/:id` — Edits order line items, scheduled delivery date, or remarks.
- `PUT /result-analysis/orders/:id/status` — Transitions order status. Reserving stock on `Packed`/`Out for Delivery`; deducting stock, generating a `Bill`, and logging `StockHistory` when marked `Delivered`.
- `POST /result-analysis/orders/process-recurring` — Manually triggered batch execution scanning delivered recurring orders and generating successor orders.
- `POST /result-analysis/orders/:id/process-loop-now` — Force-generates the next recurring order cycle for a single specific order immediately.

### Quotations
- `POST /result-analysis/quotations` — Generates a formal sales quotation with line items and validity date.
- `GET /result-analysis/quotations` — Lists quotations with status filters (`Draft`, `Sent`, `Converted`, `Expired`).
- `PUT /result-analysis/quotations/:id` — Updates an existing quotation.
- `POST /result-analysis/quotations/:id/convert` — Converts quotation into a pending `Order` (checks stock).
- `POST /result-analysis/quotations/:id/convert-invoice` — Converts quotation directly into a `Bill` invoice with GST calculations (does not check or deduct stock).
- `GET /result-analysis/quotations/:id/pdf` — Streams a rendered PDF quotation document.

### Bills & Invoicing
- `GET /result-analysis/bills` — Lists all generated invoices with tax breakdown, payment status, and customer details.
- `GET /result-analysis/bills/:id/pdf` — Streams a server-generated invoice PDF (`CLASSIC_MEMO_BOOK`, `MODERN_TAX_INVOICE`, or `THERMAL_POS`) with embedded UPI QR code.

### Payments
- `POST /result-analysis/payments` — Records a payment linked to a specific bill, or performs automatic FIFO allocation across unpaid bills.
- `GET /result-analysis/payments` — Lists recorded payment transactions.

### Purchases & Procurement
- `POST /result-analysis/purchases` — Creates an inward purchase order for inventory replenishment.
- `GET /result-analysis/purchases` — Lists purchase orders.
- `PUT /result-analysis/purchases/:id` — Modifies purchase order items or delivery expectations.
- `PUT /result-analysis/purchases/:id/receive` — Records receipt of goods, increments `Product.currentStock`, and logs `StockHistory`.

### Operating Expenses
- `POST /result-analysis/expenses` — Records an operating expense (rent, salary, fuel, misc) with an optional receipt attachment.
- `GET /result-analysis/expenses` — Lists expenses with category and date filtering.
- `DELETE /result-analysis/expenses/:id` — Deletes an expense entry.

### Multi-Branch
- `POST /result-analysis/branches` — Registers a new branch or depot.
- `GET /result-analysis/branches` — Lists all registered branches.

### Analytics & Reports
- `GET /result-analysis/reports/sales` — Aggregate sales report with revenue summaries, item frequency, and payment mode splits.
- `GET /result-analysis/reports/stock` — Inventory valuation, low-stock alerts, and stock distribution.
- `GET /result-analysis/reports/delivery` — Delivery performance and fulfillment rates.
- `GET /result-analysis/reports/outstanding` — Aging and accounts receivable summary by customer.
- `GET /result-analysis/reports/ledger` — Detailed ledger transaction history for a specific customer.

### Enterprise Settings
- `GET /result-analysis/settings` — Fetches enterprise company profile, address, GSTIN, bank details, and print preferences.
- `PUT /result-analysis/settings` — Updates enterprise settings.

### Data Management, Import & Bulk Operations
- `GET /result-analysis/data/backup` — Streams a full JSON export of all database collections.
- `POST /result-analysis/data/restore` — Restores database collections from a JSON backup dump.
- `POST /result-analysis/data/import-bulk` — Bulk imports products, customers, or suppliers from parsed Excel spreadsheet rows.
- `GET /result-analysis/data/audit-logs` — Lists administrative action audit log entries.
- `POST /result-analysis/bulk/delete` — Deletes multiple records by ID for a given model.
- `POST /result-analysis/bulk/status` — Updates status for multiple records by ID for a given model.

### Health Probes (Root level)
- `GET /health` — Liveness probe (`{"ok": true}`).
- `GET /ready` — Readiness probe checking MongoDB connection readiness (`{"ready": true/false}`).

---

## 4. Frontend Pages & Routes

The frontend is an SPA orchestrated by `frontend/src/App.jsx`. Navigation is controlled via an active state switcher (`activePage`), with an unauthenticated fallback to `Login.jsx`.

### Active Pages Mounted in Navigation

| Component File | Sidebar Label | Section in Nav | Description & Core Purpose |
| :--- | :--- | :--- | :--- |
| `pages/Login.jsx` | *(None — Auth Gate)* | Public | Authenticates the owner using email and password, clearing any legacy session keys. |
| `pages/Dashboard.jsx` | **Dashboard** | Overview | Primary operations hub: KPI stats, Express Counter Sale form, low-stock warnings, and the Order Loops (recurring order) management card. |
| `pages/FinancialDashboard.jsx` | **Sales Dashboard** | Overview | Financial charts (Recharts), monthly sales trends, cash vs UPI breakdowns, and profit margins. |
| `pages/Customers.jsx` | **Customers** | Parties & People | Customer directory with Add Customer modal, Excel bulk import button, search, credit limit display, and customer profile drawer. |
| `pages/CustomerLedgers.jsx` | **Customer Ledgers** | Parties & People | Summary ledger statement per customer: total billed, total paid, pending balance, payment history, and direct "Record Payment" modal. |
| `pages/Vendors.jsx` | **Suppliers** | Parties & People | Supplier directory with Add Supplier modal, rating cards, bulk import modal, and contact details. |
| `pages/Products.jsx` | **Products** | Inventory & Logistics | Product master list: search, filter by stock/category, Register Product form, quick stock adjustment, batch registry, and Excel import. |
| `pages/Purchases.jsx` | **Purchase Orders** | Inventory & Logistics | Management of vendor purchase orders and goods receipt confirmation to add incoming stock. |
| `pages/Expenses.jsx` | **Expenses** | Inventory & Logistics | Operational expense tracking (rent, salary, fuel, misc) with receipt attachment modal. |
| `pages/Orders.jsx` | **Orders** | Sales & Billing | Order creation and workflow tracking (`Pending` → `Packed` → `Out for Delivery` → `Delivered`), driver assignment, and status updates. |
| `pages/Quotations.jsx` | **Quotes** | Sales & Billing | Price estimate builder, quotation status management, PDF preview, and one-click conversion to Order or Invoice. |
| `pages/Bills.jsx` | **Bills** | Sales & Billing | Master invoice ledger: search by invoice number, status filter (Paid/Unpaid), payment recording modal, PDF download/print, and WhatsApp link. |
| `pages/InvoiceGenerator.jsx` | **Checkout Invoice** | Sales & Billing | Standalone interactive invoice generator specifically hardcoded with Naresh Enterprises' cleaning products and print layout. |
| `pages/Payments.jsx` | **Payments** | Sales & Billing | Chronological record of payment receipts with manual payment entry and auto-allocation FIFO options. |
| `pages/Reports.jsx` | **Reports** | Analytics & Comm | Comprehensive tabbed reporting suite: Sales Analysis, Stock Valuation, Delivery Logistics, Outstanding Dues, and Customer Statements. |
| `pages/AuditLogs.jsx` | **Audit Logs** | Analytics & Comm | Security and operational log viewer tracking mutations, deletions, and batch runs. |
| `pages/Settings.jsx` | **Settings** | Analytics & Comm | Company details (Naresh Enterprises), bank accounts, GSTIN, invoice paper sizes, and JSON backup/restore downloads. |

### Unmounted / Disabled / Legacy Pages in Codebase
The following page files exist in `frontend/src/pages/` but are **not mounted** in `App.jsx`:
- **Distribution / Inactive:** `CustomerDashboard.jsx`, `CustomerOrderBook.jsx`, `Employees.jsx`, `PublicFeedback.jsx`, `PublicTracking.jsx`, `StaffDashboard.jsx`, `Whatsapp.jsx`, `DataManagement.jsx`.
- **Legacy SIS / Education Remnants (20 files):** `AcademicCalendar.jsx`, `AcademicRegister.jsx`, `AddFaculty.jsx`, `AddStudent.jsx`, `Admissions.jsx`, `Certificates.jsx`, `DocumentSetup.jsx`, `DocumentVerification.jsx`, `Documents.jsx`, `DocumentsInOut.jsx`, `FacultyProfile.jsx`, `GenerateHallTicket.jsx`, `GenerateRollCall.jsx`, `InstituteProfile.jsx`, `PassingRemark.jsx`, `RailwayConcession.jsx`, `SetupCourses.jsx`, `StudentApplications.jsx`, `StudentProfile.jsx`, `StudentPromotion.jsx`, `StudentReport.jsx`, `SubjectDetails.jsx`, `SubjectWiseStudents.jsx`.

---

## 5. All Bill/Invoice-Producing Flows, Mapped Explicitly

There are five separate paths in the application that generate, convert, or print customer invoices:

| Flow Name | Trigger Component & Action | Fetches Live Products? | Persists `Bill` to MongoDB? | Stock Deduction Behavior | Printing / PDF Mechanism |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Quick Express Sale (Counter Sale)** | `Dashboard.jsx` (`handleSingleQuickIssue` or `handleMultiQuickIssueSubmit` calling `POST /products/quick-issue`) | **Yes** (Loads product catalog and checks `p.currentStock < qty`) | **Yes** (Creates `Bill` with sequential 3-digit `invoiceNumber`, status `'Paid'`, and matching `Payment`) | **Immediate Deduction** (`currentStock -= qty`, logs `StockHistory` `'out'` `'sale'`) | Modal opens in frontend showing invoice; prints via browser `window.print()` or downloads PDF via `/bills/:id/pdf`. |
| **2. Sales Order Fulfillment Flow** | `Orders.jsx` (Order created via `POST /orders`, moved to `'Delivered'` via `PUT /orders/:id/status`) | **Yes** (Validates live products and stock availability during order creation) | **Yes** (When transitioned to `'Delivered'`, auto-creates `Bill` with status `'Unpaid'` if not already generated) | **Deducted on Delivery** (Stock is marked *Reserved* during `Packed`/`Out for Delivery`, then decremented from `currentStock` upon `Delivered`) | Downloaded or printed from `Bills.jsx` using `openAuthenticatedFile('/bills/:id/pdf')` or `downloadAuthenticatedFile()`. |
| **3. Quotation Direct Invoice Conversion** | `Quotations.jsx` ("Convert to Invoice" button calling `POST /quotations/:id/convert-invoice`) | **Yes** (Reads product references from existing quotation) | **Yes** (Creates `Bill` with status `'Unpaid'`, calculating CGST/SGST/IGST based on customer state vs shop state) | **NO DEDUCTION** ⚠️ *(Critical Gap: controller saves Bill and marks quote Converted, but never checks or decrements `product.currentStock`)* | Opened and printed from `Bills.jsx` via the `/bills/:id/pdf` route. |
| **4. Quotation to Order to Delivery Flow** | `Quotations.jsx` ("Convert to Order" button calling `POST /quotations/:id/convert`) | **Yes** (Verifies `p.currentStock >= qty` for all items before converting) | **Yes** (Indirectly: creates pending `Order`; Bill is created later when that Order is marked `Delivered`) | **Deducted on Delivery** (Follows standard order lifecycle upon `Delivered` status) | Printed from `Bills.jsx` once the resulting order is completed. |
| **5. Standalone Checkout Invoice** | `InvoiceGenerator.jsx` (Sidebar route: **Checkout Invoice**) | **NO** ⚠️ *(Hardcodes 15 cleaning items: Phenyl, Acid, Colin, etc. in memory)* | **NO** ⚠️ *(Completely client-side; does not make any backend API calls or persist records)* | **NO DEDUCTION** *(Zero interaction with database inventory)* | Direct browser printing via `window.print()` formatted with specialized CSS print styles matching a custom memo bill layout. |

---

## 6. Recurring Orders / Reminders Feature ("Order Loops")

The **Order Loops** feature is designed for repeat commercial customers who require periodic replenishments of housekeeping chemicals and supplies.

### 1. Per-Customer & Per-Order Recurring Cycles
- **Customer Default:** The `Customer` model has a `defaultRecurringDays` field (Number, range 0–365, default `0`).
- **Order-Level Cycle:** The `Order` model contains `isRecurring` (Boolean, default `false`) and `recurringIntervalDays` (Number, default `30`, range 1–365).
- When creating an order, any custom interval can be chosen (e.g., every 6 days, 15 days, 30 days, or 45 days).
- **Trigger Date Calculation:** `recurringOrderService.js` calculates the due date from:
  $$\text{Trigger Date} = \text{deliveredAt (or deliveryDate)} + (\text{recurringIntervalDays} \times 24\text{h})$$

### 2. Connection to Real Data
- It is **strictly linked** to real database records.
- The service queries candidate orders directly from MongoDB:
  `Order.find({ isRecurring: true, status: 'Delivered', recurringProcessed: false })`
- When processed, it creates a new successor `Order` in the `Order` collection with:
  - Identical customer and line items
  - New delivery date set to the run date
  - Status reset to `'Pending'`
  - `recurringSourceOrder` pointing to the prior order ID
  - `isRecurring: true` and identical `recurringIntervalDays` (ensuring the cycle continues indefinitely)
- The source order is updated with `recurringProcessed: true` to prevent duplicate orders.

### 3. Due Date & Execution Mechanism
- **Manual Trigger Only (No Automated Cron):** Per `PRODUCTION_JOB_POLICY.md`, the Render web service runs no background scheduler or `node-cron` because sleeping container instances can cause cron timers to fail.
- **Execution:** The administrator reviews the **Order Loops** card on `Dashboard.jsx` and clicks the **"Process Due Loops"** button. This calls `POST /result-analysis/orders/process-recurring`.
- **Individual Loop Trigger:** A specific order loop can also be triggered manually on demand via `POST /result-analysis/orders/:id/process-loop-now`.
- **Concurrency & Claim Safety:** `recurringOrderService.js` uses an atomic claim mechanism with a 10-minute timeout (`CLAIM_TIMEOUT_MS = 10 * 60 * 1000`) and logs every execution in the `JobRun` collection.

### 4. Notification Scope
- **Business Notification:** The service automatically generates an internal in-app `Notification` document:
  - `type: 'delivery_reminder'`
  - `title: 'Recurring Order Created'`
  - `message: 'A recurring order was created by the owner for [Customer Name].'`
- **Customer Notification:** **None.** Automated customer SMS/WhatsApp dispatch is disabled during the pilot phase to prevent unattended customer messaging.

---

## 7. Payment & Customer Ledger Tracking

The application tracks accounts receivable, outstanding customer dues, and payment collections through two primary models and three interrelated views.

### Models Involved
1. **`Bill`**: Tracks the invoiced total (`totalAmount`), tax breakdowns, and status (`'Unpaid'`, `'Partially Paid'`, `'Paid'`).
2. **`Payment`**: Tracks actual monetary transactions (`amountPaid`, `paymentMode`, `date`, `referenceNumber`, `category`).
3. **`Customer`**: Holds `creditLimit`. *(Note: running balance is not stored statically on Customer; it is calculated dynamically).*

### Tracking Pages & Mechanisms

#### 1. Customer Ledgers (`CustomerLedgers.jsx`)
- Backed by `GET /result-analysis/customer-ledgers/summary` (`getCustomerLedgersSummary` in `shopController.js`).
- Aggregates all customers, delivered orders, bills, and payments in memory:
  $$\text{Total Billed} = \sum (\text{Order.totalAmount for all Orders where status} == \text{'Delivered'})$$
  $$\text{Total Paid} = \sum (\text{Payment.amountPaid for Customer})$$
  $$\text{Pending Balance} = \max(0, \text{Total Billed} - \text{Total Paid})$$
- Status is classified dynamically:
  - **`Settled`**: `pendingBalance === 0`
  - **`Partial Paid`**: `pendingBalance > 0` and `totalPaid > 0`
  - **`Pending Payment`**: `pendingBalance > 0` and `totalPaid === 0`
- Clicking a customer expands their transaction history showing delivered orders, bills, and payments.
- Allows recording an unallocated payment directly via the "Record Payment" button (`POST /customer-ledgers/record-payment`).

#### 2. Master Bills View (`Bills.jsx`)
- Backed by `GET /result-analysis/bills`.
- Shows individual invoice status (`Unpaid`, `Partially Paid`, `Paid`).
- Clicking "Record Payment" against an invoice opens a payment modal:
  - Submits `POST /result-analysis/payments` with `{ billId, amountPaid, paymentMode }`.
  - When the cumulative payments for that bill equal or exceed `bill.totalAmount`, `bill.status` updates to `'Paid'`.

#### 3. General Payments View (`Payments.jsx`)
- Backed by `GET /result-analysis/payments`.
- Displays every transaction receipt with payment method (Cash, UPI, Cheque, Bank Transfer).
- Supports **Auto-Allocation (FIFO)**: If enabled, an incoming payment is automatically distributed across the customer's oldest unpaid bills in sequence until exhausted.

#### 4. Outstanding Amount Metric (`Dashboard.jsx` & `Reports.jsx`)
- The KPI card on the dashboard computes:
  $$\text{Total Outstanding} = \max(0, \text{Total Bill Sales} - \text{Total Payments Received})$$

---

## 8. Product Add/Edit Form — Full Audit

The form resides in `frontend/src/pages/Products.jsx` (lines 1026–1215) and is validated via `frontend/src/utils/formValidation.js`.

| Field Name | Label Text in Form | Placeholder / Hint Text | Exact Validation Rule | Classification & Business Relevance |
| :--- | :--- | :--- | :--- | :--- |
| **Product Name** | `Product Name*` | None | `validateProductName`: Required, 2–100 chars, regex `/^[a-zA-Z0-9\s()/.\-+%]+$/`, no consecutive spaces. | **Generic** — Fine for cleaning chemicals and supplies. |
| **Category** | `Category*` | None | `validateCategory`: Required, regex `/^[a-zA-Z0-9\s&/-]+$/`. | **Generic** — Works for categories like "Floor Cleaners", "Disinfectants", "Brushes". |
| **HSN Code** | `HSN Code*` | Initial form state defaults to `'3004'` | `validateHSN`: Must be exactly 4, 6, or 8 digits. Backend model defaults to `'3004'`. | ⚠️ **Pharma-Oriented Default** — HSN 3004 is specifically for pharmaceutical medicaments. Cleaning chemicals use HSN 3402 (organic surface-active cleaning preparations), HSN 2806 (hydrochloric acid), HSN 9603 (brooms/mops), or HSN 4818 (paper napkins). Defaulting to 3004 is incorrect for Naresh Enterprises. |
| **Unit** | `Unit (e.g. strips)*` | Explicit label hint: `(e.g. strips)`. Error hint: `(use e.g. strip, tablet, bottle, ml, etc.)` | `validateUnit`: Required, string, cannot be numeric-only. | ⚠️ **Pharma-Oriented Label & Hint** — Mentions "strips" and "tablets". Needs relabeling for cleaning goods: "Unit (e.g. Litre, Can, Bottle, Box, Pcs, Kg)". |
| **Retail Price** | `Retail Price (Rs.)*` | None | `validatePositiveNumber`: Required, number > 0. Must be $\ge$ Purchase Price. | **Generic** — Standard wholesale/retail selling price. |
| **Purchase Price**| `Purchase Price (Rs.)` | None | `validatePositiveNumber`: Optional, number $\ge$ 0. | **Generic** — Inward procurement cost. |
| **Initial Stock** | `Initial Stock*` | Default: `'0'` | `validatePositiveNumber`: Required, integer $\ge$ 0. | **Generic** — Starting inventory count. |
| **Reorder Level** | `Reorder Level*` | Default: `'10'` | `validatePositiveNumber`: Required, integer $\ge$ 0. | **Generic** — Threshold for low-stock warnings. |
| **Supplier** | `Supplier Vendor*` | Dropdown of loaded vendors | Required; cannot be empty. | **Generic** — Primary manufacturer or distributor. |
| **Branch** | `Branch (Optional)` | `"Default Branch (Auto-assigned)"` | Optional dropdown. | **Generic** — Warehouse location. |
| **Expiry Tracking**| `Enable Expiry Tracking for this Product` | `💡 Expiry Managed Through Batch` | Checkbox boolean (`hasExpiryTracking`). | ⚠️ **Pharma-Oriented Feature** — While chemical batches (like concentrated phenyl or acid) may have shelf lives, items like brooms, mops, wipers, buckets, and dusters never expire. The batch modal strictly enforces `Expiry Date*` as mandatory. |

---

## 9. Known Gaps & Inconsistencies

During code audit of the entire repository, the following functional gaps, bugs, and leftover pharmacy/SIS artifacts were identified:

### 1. Leftover Pharmacy / Medical Terminology & Defaults
- **Seeded Company Name:** `server.js` (line 29) hardcodes `companyName: 'Apex Medical Shop'` during `autoSeed()`. This is why the live database `settings` collection currently stores "Apex Medical Shop" instead of "Naresh Enterprises".
- **Default HSN Code:** Both `backend/src/models/product.js` and `frontend/src/pages/Products.jsx` default HSN to `'3004'` (Medicaments).
- **Unit Validator & Form Hint:** `formValidation.js` and `Products.jsx` prompt users with "strips", "tablets", and "dosage".
- **WhatsApp Invoice Text:** `Bills.jsx` (line 274) hardcodes: *"Please contact the pharmacy for a copy of the tax invoice."*
- **Bulk Import Samples:** `BulkImportModal.jsx` provides sample spreadsheets containing "Amoxicillin 500mg", "Apex Pharma", "Ramesh Chemist", and "Apollo Clinic".
- **OTC Terminology:** `shopController.js` (line 641) automatically creates walk-in customers with address `"Over the Counter Sale"`.
- **PDF Service Fallback:** `pdfService.js` (line 23) defaults the company name to `'TAMMEWAR PHARMACY DISTRIBUTIONS'` and email to `'admin@school.com'`.

### 2. Business Logic & Inventory Inconsistencies
- **Stock Not Deducted on Direct Quotation Invoicing:** When converting a quotation directly to an invoice (`POST /quotations/:id/convert-invoice` in `advancedShopController.js`), a `Bill` is saved, but `product.currentStock` is **never decremented**. In contrast, orders and counter sales properly deduct stock.
- **Duplicate Controller Method:** `advancedShopController.js` defines `exports.bulkImportExcel` twice (line 1035 and line 1330). The second definition silently overrides the first.
- **Missing API Endpoint in Bills Page:** `Bills.jsx` (line 241) calls `POST /payments/reminder`, but this route **does not exist** in `routes/index.js`, resulting in a 404 error when clicking the reminder action.
- **Unpersisted Customer Outstanding Field:** `shopController.js` reads and writes `customer.outstanding` (lines 807, 2028), but `outstanding` is **not defined** in the Mongoose `Customer` schema, meaning Mongoose strips it out and never persists it to the database document.
- **Ledger Inconsistency for Counter Sales:** `getCustomerLedgersSummary` computes `totalBilled` using only orders with `status === 'Delivered'`. Counter Sales (`quickExpressIssue`) and direct quotation invoices create `Bill` documents without an `Order`, meaning those sales are excluded from `totalBilled`, causing skewed balances if ledger payments are cross-referenced.
- **Standalone Invoice Generator Disconnected from DB:** The "Checkout Invoice" page (`InvoiceGenerator.jsx`) is completely isolated. It maintains hardcoded product items in React state, does not query products, does not persist invoices to the `Bill` collection, and does not deduct stock.
- **Root File Clutter:** An unmaintained copy of `InvoiceGenerator.jsx` exists in the workspace root outside `frontend/src/pages/`.

### 3. Leftover Educational ERP Artifacts (SIS)
- **Database Name:** `.env` configures `MONGO_DB_NAME=result_analysis_db` and base route `/result-analysis`.
- **Duplicate Settings Model:** `backend/src/models/settings.js` (plural) defines engineering departments ("Computer Engineering", "B.Tech IT"), whereas `setting.js` (singular) defines the actual enterprise settings.
- **Dead Models & Controllers:** 37 model files and 14 controller files in `backend/src/` belong to a student college management system and are completely unused.
- **Dead Frontend Pages:** Over 20 page files in `frontend/src/pages/` belong to student admissions, hall tickets, and roll calls.

---

## 10. Real Data State (Live Database Audit)

Direct inspection of the active MongoDB database (`mongodb://127.0.0.1:27017/result_analysis_db`) performed via database tools yielded the following counts:

| Collection | Current Count | Status / Notes |
| :--- | :---: | :--- |
| **`customers`** | **0** | **Zero Customer records exist in the database right now.** The client's estimated ~250 recurring customers exist only on paper or external spreadsheets and have not been imported or created. |
| **`bills`** | **0** | No sales invoices have been created. |
| **`orders`** | **0** | No sales orders or order loops exist. |
| **`products`** | **0** | The product catalog has not been entered or imported. |
| **`payments`** | **0** | No payment transactions exist. |
| **`quotations`** | **0** | No quotation estimates exist. |
| **`vendors`** | **0** | No supplier records exist. |
| **`branches`** | **0** | No branches configured. |
| **`batches`** | **0** | No batch inventory lots exist. |
| **`purchaseorders`** | **0** | No purchase orders exist. |
| **`expenses`** | **0** | No expense records exist. |
| **`auditlogs`** | **0** | No audit logs exist. |
| **`jobruns`** | **0** | No recurring job runs have executed. |
| **`users`** | **1** | The single named owner account (`nikhilraghuwanshi2707@gmail.com`, role: `admin`, name: `Nikhil Raghuwanshi`). |
| **`settings`** | **1** | Seeded singleton record holding company details (currently holding the auto-seeded default `"Apex Medical Shop"`). |

---

## 11. Bulk Import Capability

Bulk data onboarding is handled by `frontend/src/components/BulkImportModal.jsx` and backed by `POST /result-analysis/data/import-bulk` (`advancedShopController.bulkImportExcel`).

### 1. Supported Entity Types
The modal supports three entity types:
1. **`products`**: Mounted on `Products.jsx`.
2. **`customers`**: Mounted on `Customers.jsx`.
3. **`suppliers`** / **`vendors`**: Mounted on `Vendors.jsx`.

*(Note: `DataManagement.jsx` also contains a CSV import interface, but that page is not mounted in `App.jsx` and is inactive).*

### 2. Expected File Format
- File extensions: **Excel spreadsheets (`.xlsx`, `.xls`)**.
- The file is read client-side using SheetJS (`XLSX.read(bstr, { type: 'binary' })`) and converted to JSON row objects (`XLSX.utils.sheet_to_json(ws, { defval: '' })`), which are posted in payload `{ entityType, data }`.

### 3. Customer Import Specifications (Crucial for Client's 250 Customers)

#### Expected Columns for Customers:
- `'Customer Name'` (or `name`)
- `'Mobile'` (or `mobile`)
- `'GST'` (or `gstNumber`)
- `'Address'` (or `address`)
- `'Credit Limit'` (or `creditLimit`)
- `'Notes'` (or `notes`)

#### Validation & Normalization Applied During Import:
1. **Name:** Mandatory (`!name` causes row failure).
2. **Mobile:** **Strict validation**: must be **exactly 10 numeric digits** (`/^\d{10}$/`).
   - If a mobile number has spaces, hyphens, a `+91` prefix, a leading `0`, or is a landline, **the row is rejected**.
3. **Address:** Mandatory (`!address` causes row failure).
4. **Duplicate Prevention:**
   - **In-file deduplication:** The controller checks duplicate mobile numbers and GST numbers within the uploaded Excel sheet.
   - **Database deduplication:** Queries `Customer.findOne({ mobile })` and `Customer.findOne({ gstNumber })`. Existing records are rejected.
5. **GST Normalization:** Trimmed and converted to uppercase (`toString().trim().toUpperCase()`).
6. **Credit Limit:** Converted to Number; defaults to `0` if empty or invalid.
7. **Branch Assignment:** Auto-associates with default branch if branches exist in database.

### 4. Product Import Specifications

#### Expected Columns for Products:
- `'Product Name'`, `'Category'`, `'HSN'`, `'Unit'`, `'Purchase Price'`, `'Retail Price'`, `'Initial Stock'`, `'Reorder Level'`, `'Supplier'`, `'Branch'`

#### Validation Applied During Import:
1. **Mandatory Fields:** `Product Name`, `Category`, and `Unit` are strictly required.
2. **Prices & Stock:** `Retail Price` $\ge$ `Purchase Price` $\ge 0$. `Initial Stock` $\ge 0$.
3. **Supplier Resolution:** Looks up `Vendor` by name. If the supplier does not exist in the database, the importer **automatically creates a new Vendor record** with contact `'9999999999'` and address `'Imported Vendor'`.
4. **HSN Code:** Defaults to `'3004'` if omitted from the Excel file.

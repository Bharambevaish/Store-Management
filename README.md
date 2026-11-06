# Naresh Enterprises — Stock & Billing System

Stock, billing and customer-ledger system for **Naresh Enterprises (Zoom Phenol), Nanded**, a distributor of housekeeping and cleaning supplies (phenyl, acid, handwash, mops, brooms, air fresheners, paper napkins…).

- `backend/` — Node.js + Express + MongoDB API (port 4009, routes under `/result-analysis`)
- `frontend/` — React + Vite app (dev port 3009)

> The repository name and some internal identifiers (`result-analysis`, `result_analysis_db`, `tammewar-pharmacy` JWT issuer) are kept unchanged on purpose, because the deployed services and their environment variables depend on them.

## Billing rules

All sale paths (counter sale, delivered order, quotation → bill) use `backend/src/services/billingService.js`:

- **Invoice numbers** come from an atomic counter, so they never repeat. Set *Settings → Next Bill Starts From No.* to continue from the paper bill book.
- **GST** uses each product's own GST % (0/5/12/18/28). Out-of-state customers get IGST; others get CGST + SGST. All amounts are rounded to paise.
- **Stock** is deducted all-or-nothing and can never go below zero.
- **Bills are never deleted.** *Cancel* puts the stock back, removes the bill from totals, and keeps any money already received as an advance on the customer's account.
- Product name, unit, HSN and GST % are copied onto each bill line, so editing or hiding a product never changes old bills. Products used on past bills are hidden instead of deleted.

## Owner account

There is no self-registration. Create or rotate the owner account with:

```bash
cd backend && npm run owner:create
```

## Development

```bash
cd backend && npm install && npm run dev
cd frontend && npm install && npm run dev
cd backend && npm test
```

Hosting, backup and credential runbooks are in the `*_RUNBOOK.md` and `PRODUCTION_*.md` files.

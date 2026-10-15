# Agent Handoff: Tammewar Pharmacy Production Deployment

Last updated: 2026-08-13

## Objective

Prepare and deploy this MERN pharmacy inventory application as a secure,
zero-cost, single-owner production pilot.

The production database starts empty. Confirmed with the user on 2026-08-22:
the pharmacy's records were never digitised and the system has not been handed
over. Earlier drafts of this document assumed roughly 250 existing customer
records needed migrating — there are none, and no migration is planned.

Target deployment:

- Frontend: Cloudflare Pages Free
- Backend: Render Free Web Service
- Database: MongoDB Atlas M0 Free
- Application users: one pharmacy owner/administrator
- Media storage: none required
- Backups: encrypted logical MongoDB dumps stored off-platform

The execution checklist is in
[`PRODUCTION_DEPLOYMENT_TASKLIST.md`](./PRODUCTION_DEPLOYMENT_TASKLIST.md).
The earlier security gate remains in [`PRODUCTION_SECURITY.md`](./PRODUCTION_SECURITY.md).

## Important architectural facts

- The backend is JavaScript/CommonJS, not TypeScript.
- Backend root: `backend`; entry point: `backend/server.js`.
- Frontend root: `frontend`; React 18 + Vite.
- Local ports were 4009 (API), 3009 (Vite), and 27017 (MongoDB).
- The API prefix is `/result-analysis`.
- Frontend production API configuration is not finished. It currently defaults
  to `/api`, which only works locally because the Vite development proxy rewrites
  that path.
- The repository contains many legacy SIS models, but the mounted routes are the
  pharmacy/result-analysis routes in `backend/src/routes/index.js`.
- The backend contains long-running/process-specific features: node-cron jobs,
  PDF generation, SQLite backup scripts, and optional Chromium WhatsApp
  automation. It should remain a normal Node service rather than being moved to
  Supabase Edge Functions.
- Render Free sleeps after 15 minutes and has an ephemeral filesystem. Cron jobs
  and local SQLite backups cannot be treated as reliable there.
- Atlas M0 is large enough for the expected workload but has no normal managed
  backup. A tested encrypted external backup process is a launch blocker.

## Architecture decision history

The user considered Vercel, Render, MongoDB Atlas, and Supabase. The chosen path
is Cloudflare Pages + Render + Atlas because it preserves the existing Express
and Mongoose architecture with minimal migration risk. Supabase would require a
MongoDB-to-Postgres schema/data migration and extensive controller/auth/RLS
rewrites; it is not part of the initial deployment.

## Security findings already addressed in the working tree

The repository had serious vulnerabilities. Changes were implemented locally to
address the following:

- Removed a critical authentication bypass that trusted `X-Tenant-Id`.
- Removed query-string token authentication.
- Added strict JWT algorithm/issuer/audience/expiry checks and active-account
  database lookup.
- Added customer/staff/admin role boundaries and customer ownership checks.
- Protected public registration, backups, restore, settings, staff, destructive,
  audit, and bulk routes.
- Corrected Razorpay verification to use the stored server order, HMAC-SHA256,
  and timing-safe comparison; client-controlled sandbox verification was removed.
- Added CORS allowlisting, Helmet, request limits, rate limits, dangerous MongoDB
  key rejection, ObjectId validation, generic production errors, and stronger
  password requirements.
- Added an authenticated password-change endpoint.
- Removed password hashes from API backup output and hid WhatsApp tokens.
- Disabled auto-seeding, online restore, mock payments, internal gateway auth,
  and local WhatsApp automation by default for production.
- Removed unsafe Chromium sandbox-disabling arguments.
- Raised bcrypt work factors.
- Removed frontend persistent-token fallback and untrusted gateway headers.
- Updated backend/frontend dependencies until `npm audit` reported zero known
  vulnerabilities at the time of testing.
- Untracked database and WhatsApp-session directories from the current Git index
  and added root ignore rules. Local files were preserved.

## Critical unresolved security/operations work

Do not declare the project production-ready until these are resolved:

1. `backend/.wwebjs_auth` and `data/db` still exist in at least one historical
   Git commit. Current index removal does not sanitize history.
2. All credentials/session material that may have existed in Git or the database
   must be revoked/rotated after history cleanup.
3. The legacy local administrator/staff accounts used weak development passwords.
   Never deploy those credentials.
4. Resolved on 2026-08-22. There is no authoritative database: the records were
   never digitised. The two databases on the `medical_stock_system` Atlas
   cluster were audited and confirmed to be development data (6 customers at
   most), and are not migrated. Production starts empty.
5. Atlas M0 backup automation and a verified restore have not been implemented.
6. Render cron behavior has not been redesigned for a sleeping service.
7. Frontend Cloudflare Pages API configuration has not been implemented.
8. No Cloudflare Pages, Render, Atlas, GitHub, Razorpay, or Meta deployment/account
   changes have been made by the agent.
9. There is no meaningful automated test suite; `backend` still has a placeholder
   `npm test` script.
10. Compliance/privacy requirements must be confirmed for the deployment's
    jurisdiction. Do not imply legal or regulatory compliance from code testing.

## Git/worktree cautions

- The worktree contains user/uncommitted changes. Preserve unrelated work.
- Hundreds of staged deletions represent `git rm --cached` removal of tracked
  WhatsApp session and MongoDB data files. The local files were intentionally
  preserved.
- Do not reset, restore, or discard these changes.
- Do not rewrite Git history, force-push, rotate live credentials, deploy, or
  create/modify cloud resources without explicit user authorization for that
  external/destructive step.
- Before editing, run:

```powershell
git status --short
git diff --check
git diff --stat
git diff --cached --stat
```

- Review exact staged/unstaged scope before committing. Do not blindly use
  `git add -A`.

## Key files changed during hardening

- `.gitignore`
- `backend/.env.example`
- `backend/server.js`
- `backend/src/app.js`
- `backend/src/config/db.js`
- `backend/src/config/env.js`
- `backend/src/middleware/auth.js`
- `backend/src/routes/index.js`
- `backend/src/controllers/authController.js`
- `backend/src/controllers/shopController.js`
- `backend/src/controllers/advancedShopController.js`
- `backend/src/controllers/paymentGatewayController.js`
- `backend/src/models/user.js`
- `backend/src/models/customer.js`
- `backend/src/models/setting.js`
- `backend/src/services/backupService.js`
- `backend/src/services/whatsappClient.js`
- `frontend/src/services/api.js`
- `frontend/vite.config.js`
- both package lockfiles and frontend package metadata

Inspect current diffs rather than assuming this list is exhaustive.

## Previously completed verification

These checks passed after the security changes, but must be rerun after every
subsequent edit and against the deployed environment:

- Backend modified JavaScript syntax checks.
- Frontend Vite production build.
- Backend production dependency audit: zero known vulnerabilities at that time.
- Frontend dependency audit: zero known vulnerabilities at that time.
- Forged tenant-header backup request: `401`.
- Public admin registration: `401`.
- Query-string token backup request: `401`.
- Staff backup request: `403`.
- Customer requests for customer list, staff list, and backup: `403`.
- Admin backup contained no `password` field.
- Malformed ObjectId and NoSQL-shaped request: `400`.
- Eleventh failed login in the tested rate window: `429`.
- Password-change test: old password rejected; new password accepted.
- Settings response did not expose `whatsappToken`.
- Temporary role/password test accounts were deleted after testing.

Do not treat these historical results as evidence that the current working tree
or deployed build still passes.

## Recommended next implementation sequence

1. Inspect Git status/diffs and reread both production documents.
2. Ask the user to confirm that customers will not log in. If confirmed, remove
   the customer authentication/portal attack surface and update the UI/routes.
3. Implement `VITE_API_BASE_URL` in the Axios client while preserving the local
   development proxy.
4. Add Render cold-start UX and authentication error differentiation.
5. Add graceful backend shutdown and a database-aware readiness endpoint.
6. Remove/disable filesystem SQLite backup scheduling in the hosted web process.
7. Decide which other cron jobs become manual owner actions for the free pilot.
8. Add deployment configuration/documentation for Cloudflare Pages and Render.
9. Add at least a focused automated security regression suite.
10. Re-run syntax, audits, build, and dynamic authorization tests.
11. With user authorization, sanitize Git history and coordinate the remote
    rewrite; then rotate all credentials.
12. With user authorization, create Atlas, identify/export the authoritative
    local database, import it, and reconcile counts/totals.
13. Implement encrypted off-platform backups and prove restore recovery.
14. With user authorization, configure and deploy Render, then Cloudflare Pages.
15. Run the complete security and business workflow checklists against staging.
16. Complete the final go/no-go gate with the user before exposing real data.

## Expected Cloudflare Pages configuration

```text
Root directory: frontend
Build command: npm run build
Output directory: dist
```

Public build variable:

```env
VITE_API_BASE_URL=https://<render-service>.onrender.com/result-analysis
```

Never put secrets in `VITE_*`; Vite embeds those values in browser assets.

## Expected Render configuration

```text
Service: Web Service / Free
Root directory: backend
Runtime: Node.js
Region: Singapore where available
Build command: npm ci --omit=dev
Start command: npm start
Health path: /health
```

Minimum production environment:

```env
NODE_ENV=production
HOST=0.0.0.0
MONGO_URI=<atlas-connection-string>
JWT_SECRET=<new-random-secret>
JWT_ISSUER=tammewar-pharmacy
JWT_AUDIENCE=tammewar-pharmacy-api
JWT_EXPIRES_IN=2h
CUSTOMER_JWT_EXPIRES_IN=2h
CORS_ORIGINS=https://<project>.pages.dev
AUTO_SEED=false
PAYMENTS_ALLOW_MOCK=false
ONLINE_RESTORE_ENABLED=false
INTERNAL_AUTH_ENABLED=false
WHATSAPP_ENABLED=false
```

Use platform secret stores. Do not copy the local `.env` into Git or frontend
configuration.

## Verification commands

```powershell
cd backend
npm ci
npm audit --omit=dev --audit-level=high

# Run node --check for every modified backend JavaScript file.

cd ..\frontend
npm ci
npm audit --audit-level=high
npm run build

cd ..
git diff --check
git status --short
```

Dynamic tests must use disposable data and remove it afterward. Never test
destructive or payment flows against production customer data.

## Definition of done

The task is complete only when:

- repository history is sanitized and credentials are rotated;
- the single-owner scope is enforced;
- Atlas data migration is reconciled;
- an encrypted backup has been restored successfully;
- Cloudflare/Render/Atlas are configured with least privilege and exact CORS;
- security and business regression checks pass on staging;
- no secrets appear in Git, frontend assets, API responses, exports, or logs;
- the owner understands cold starts and recovery procedures; and
- the user explicitly approves the production go-live.

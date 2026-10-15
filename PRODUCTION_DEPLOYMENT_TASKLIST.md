# Production Deployment Task List

Last updated: 2026-08-21

## Target architecture

- Cloudflare Pages Free: React/Vite frontend
- Render Free: Node.js/Express API
- MongoDB Atlas M0 Free: application database
- One application user: the pharmacy owner
- The production database starts empty. Confirmed on 2026-08-22: the pharmacy's
  records were never digitised, and the project has not yet been handed over to
  the owner. Earlier drafts of this document assumed roughly 250 existing
  customer records were waiting to be migrated; there are none. Capacity
  planning for a few hundred records over time still holds.
- No application media/object-storage requirement
- Encrypted database backups stored outside Render and Atlas

This is a controlled, zero-cost single-owner deployment. Free-tier capacity is
adequate, but Render cold starts and the absence of Atlas M0 managed backups
must be accepted and mitigated. Do not expose the application publicly until
the final go/no-go gate is complete.

## Companion documents

| Document | Covers |
| --- | --- |
| `MANUAL_PRODUCTION_TASKS.md` | Every deferred owner/console action, M-01 onward |
| `ATLAS_FREE_SETUP_RUNBOOK.md` | Phase 7 — Atlas project, cluster, user, network, alerts |
| `BACKUP_RUNBOOK.md` | Phase 9 — encrypted backup, restore drill, disaster recovery |
| `HOSTING_RUNBOOK.md` | Phases 10-12 — Render, Cloudflare Pages, CORS, Cloudflare Access |
| `OWNER_ACCOUNT_RUNBOOK.md` | Phase 13 — owner creation, rotation, lockout recovery |
| `PRODUCTION_JOB_POLICY.md` | Phase 6 — which jobs run, and why nothing is scheduled in the web process |
| `PRODUCTION_DATA_SCOPE.md` | Phase 1 — the customer fields retained and their deletion rules |
| `PRODUCTION_SECURITY.md` | The standing security gate and its residual risks |

## 1. Finalize application scope

- [x] Confirm that the pharmacy owner is the only application user.
- [x] Keep one named administrator account; do not share it. Existing database
      accounts must be reconciled during Phase 8 before go-live.
- [x] Confirm whether customers need to log in themselves.
- [x] If customers do not log in, remove or disable customer login, customer
      passwords, public tracking, customer feedback, and customer payment
      endpoints.
- [x] Disable staff registration and staff-management features unless employees
      will actually receive individual accounts.
- [x] Confirm whether live Razorpay payments are required. Not required for the
      initial pilot; owner-entered payment records remain available.
- [x] Confirm whether WhatsApp messaging is required. Not required for the
      initial pilot.
- [x] Keep Chromium-based local WhatsApp automation disabled in production.
- [x] Use Meta WhatsApp Cloud API if WhatsApp is required. Not applicable while
      WhatsApp remains disabled.
- [x] List the customer fields the business genuinely needs.
- [x] Remove unnecessary sensitive fields and document retention/deletion rules
      in `PRODUCTION_DATA_SCOPE.md`.

## 2. Sanitize and protect the repository

- [x] Review and commit the existing security changes intentionally.
- [x] Confirm `.env`, `.runtime`, `data`, `.wwebjs_auth`, dumps, backups, logs,
      `node_modules`, and `dist` are ignored.
- [x] Make a protected repository backup before rewriting history.
- [x] Purge `backend/.wwebjs_auth` and `data/db` from the complete Git history.
- [x] Inspect the rewritten history before replacing the remote history.
- [x] Coordinate the force-push and require every old clone to be deleted or
      freshly cloned. Remote `main` was replaced on 2026-08-14; the user
      confirmed on 2026-08-16 that no old clones remain.
- [x] Scan the complete history for secrets after the rewrite. The fresh-clone
      credential-pattern scan found no credential values; legacy development
      seed passwords were removed during Phase 3.
- [x] Return the GitHub repository to private before production. GitHub CLI
      verified `visibility: PRIVATE` on 2026-08-16.
- [x] Enable branch protection for `main`. GitHub's branch API reported
      `protected: true` on 2026-08-16, and PR #1 reported `REVIEW_REQUIRED`
      with merging blocked.
- [x] Enable MFA for both GitHub accounts. MFA for `Nikhil270703` and
      `Developerr86` was confirmed by the user on 2026-08-16.
- [x] Do not allow automatic production deployments from untrusted branches.
      No deployment integrations or GitHub Actions workflows exist yet; the
      Render and Cloudflare setup tasks below restrict production to `main`.

History rewriting and force-pushing are destructive coordination operations.
They require explicit authorization immediately before execution.

Phase 2 rewrite record: the inspected clean root commit was force-pushed to
`main` as `8235e2ab525b0f57eff0a2f6b4496673f2b138e5`. An independent fresh clone
contained one root commit, no forbidden historical paths, and no matches for
the credential-value patterns used in the scan. On 2026-08-14, local GitHub CLI
access was restored for `Developerr86` with Write permission. The repository
was then made temporarily public, which gave the connected GitHub reader
read-only access. GitHub's branch API confirmed protection for `main` on
2026-08-16, and PR #1 confirmed that a review is required before merging. MFA
for both GitHub accounts was user-confirmed because GitHub does not expose
another personal account's MFA state to this collaborator. GitHub CLI then
verified private visibility, and the user confirmed that no old clones remain.
Phase 2 was completed on 2026-08-16.

## 3. Rotate credentials

- [x] Defer production JWT generation until Render can receive it directly;
      tracked as M-01 in `MANUAL_PRODUCTION_TASKS.md`.
- [x] Defer owner-managed MongoDB and retired-provider credential rotation;
      tracked as M-02 and M-07 in `MANUAL_PRODUCTION_TASKS.md`.
- [x] Defer revocation of the committed WhatsApp browser session; tracked as
      M-06 in `MANUAL_PRODUCTION_TASKS.md`. Re-pairing is not required while
      WhatsApp remains disabled.
- [x] Replace all development administrator/staff/customer passwords. Obsolete
      credential-bearing seed/reset scripts were removed, and the tracked code
      scan found no remaining hardcoded password or credential fallback
      literals.
- [x] Defer the owner-chosen production password; the 16-character minimum is
      enforced in code and the manual action is tracked as M-05.
- [x] Defer password-manager and platform-secret entry until infrastructure is
      configured; tracked as M-01, M-02, and M-05.
- [x] GitHub MFA is complete; remaining platform MFA is deferred as M-03 and
      provider MFA applies only if a retired provider is re-enabled.
- [x] Credential separation is documented and deferred for owner confirmation
      as M-08.

Phase 3 repository work was completed on 2026-08-16. Deferred owner and
platform actions are centralized in `MANUAL_PRODUCTION_TASKS.md`.

## 4. Prepare the frontend

- [x] Change Axios to use `import.meta.env.VITE_API_BASE_URL` rather than a
      production-relative `/api` URL. Production builds fail when it is absent.
- [x] Keep the local Vite proxy for local development only.
- [x] Ensure no secret is placed in a `VITE_*` variable; the only public values
      are `VITE_API_BASE_URL` and the local `VITE_DEV_PORT`.
- [x] Remove unused gateway/tenant headers and code for standalone deployment.
      The federation runtime, fake gateway token, and remote build were removed.
- [x] Keep authentication tokens out of persistent local storage. The owner JWT
      now exists only in module memory and is never placed in a URL.
- [x] Clear authentication state after `401` responses and on logout.
- [x] Add a friendly Render cold-start state and retry path.
- [x] Avoid interpreting a cold-start timeout as an incorrect password. Only an
      HTTP `401` is presented as invalid credentials.
- [x] Confirm production source maps are not exposed unintentionally. Vite has
      `sourcemap: false`, and the production output contained zero `.map` files.
- [x] Run `npm ci`, `npm audit --audit-level=high`, and `npm run build`. All
      passed on 2026-08-16 with zero reported vulnerabilities.

Phase 4 was completed on 2026-08-16.

## 5. Prepare the backend

- [x] Listen on `0.0.0.0` and Render's injected `PORT` in production.
- [x] Add graceful `SIGTERM`/`SIGINT` handling for HTTP and MongoDB shutdown.
- [x] Keep `/health` minimal and add a database-aware readiness check.
- [x] Keep Helmet, strict CORS, generic production errors, request limits,
      ObjectId validation, dangerous MongoDB key rejection, and rate limiting.
- [x] Validate every inventory, billing, order, payment, and settings field.
- [x] Add maximum lengths to customer names, addresses, notes, and searches.
- [x] Ensure passwords, hashes, provider secrets, and authorization headers are
      never included in responses, exports, or logs.
- [x] Add request IDs and redact customer-sensitive fields from logs.
- [x] Run syntax checks and `npm audit --omit=dev --audit-level=high`.

Phase 5 was completed on 2026-08-16. Verification included a clean production
dependency install, four passing backend security tests, syntax checks for all
backend JavaScript, production host/port assertions, and an audit with zero
reported vulnerabilities. The disabled browser-session WhatsApp dependency was
removed because its Puppeteer chain accounted for all production advisories.

## 6. Handle scheduled jobs safely

- [x] Remove the SQLite backup cron from the Render web process.
- [x] Never rely on Render Free's filesystem for backups or application data.
- [x] Identify recurring-order and reminder jobs that are truly required.
- [x] Disable nonessential jobs for the initial release.
- [x] Prefer an owner-triggered manual action for low-frequency jobs initially.
- [x] If external scheduling is introduced, make every job idempotent.
- [x] Persist last-run, result, and error state in MongoDB.
- [x] Display the last successful run to the owner.

Render Free sleeps after 15 minutes without inbound traffic. Scheduled code does
not run while the service is asleep, and missed executions are not replayed.

Phase 6 was completed on 2026-08-16. The web process has no cron/timer jobs and
no filesystem backup writer. Delivery reminders and unattended messaging are
disabled for launch. Recurring orders remain an owner-triggered, MongoDB-claimed
idempotent action with persisted run state and dashboard visibility. External
scheduling was not introduced; its optional post-launch review is tracked as
M-09 in `MANUAL_PRODUCTION_TASKS.md`. See `PRODUCTION_JOB_POLICY.md`.
Verification included six passing backend tests, backend syntax checks, clean
backend and frontend dependency audits, and a successful production frontend
build on 2026-08-16.

## 7. Create MongoDB Atlas M0

Repository preparation for Phase 7 was completed on 2026-08-16: production now
requires an explicit database name, verifies the connected database at startup,
and provides `npm run atlas:verify` to test exact-role and cross-database access.
The account-console work in M-10 through M-14 was user-confirmed complete on
2026-08-16 after following `ATLAS_FREE_SETUP_RUNBOOK.md`. Render's
service-specific outbound CIDRs remain a Phase 10 update because the service
does not exist yet.

- [x] Create a dedicated production Atlas project and enable account MFA. The
      project exists; the organization-wide Require MFA control is still off.
- [x] Create one M0 Free cluster near Render, preferably Singapore. Created in
      AWS `AP_SOUTH_1` (Mumbai). Acceptable and arguably better for an Indian
      pharmacy, but Render Free has no Mumbai region, so Phase 10 places Render
      in Singapore and accepts the cross-region hop.
- [x] Use a production-specific database name (`tammewar_pharmacy_prod`).
- [ ] Enable termination protection if available. Not settable on a Free
      cluster: Atlas rejects public-API updates to M0
      (`TENANT_CLUSTER_UPDATE_UNSUPPORTED`). Confirm in the console whether the
      control exists for Free clusters; if not, record as not applicable.
- [x] Create a dedicated application database user with access only to the
      application database. Corrected on 2026-08-21: `tammewar_app` now holds
      exactly `readWrite` on `tammewar_pharmacy_prod`, scoped to the production
      cluster, and the stray `atlasAdmin` user was deleted.
- [x] Generate a long random database password and store it only in Render.
- [ ] Allow only Render's documented outbound ranges where possible. Deferred
      to Phase 10: the ranges cannot be read until the Render service exists.
- [x] Avoid `0.0.0.0/0`. Removed on 2026-08-21; the allowlist now holds only
      the trusted administrator addresses.
- [x] Configure available storage and connection alerts. `LOGICAL_SIZE` at
      440 MB and `CONNECTIONS_PERCENT` at 80 are enabled.
- [ ] Confirm the application cannot access unrelated databases. It currently
      can.

Phase 7 was reported complete on 2026-08-21 and independently verified against
Atlas the same day with the Atlas CLI. Four of the five console items did not
hold; three were corrected the same day and one is a Free-tier platform limit.
The evidence and remediation record is in `MANUAL_PRODUCTION_TASKS.md`.
Whether the cluster held data while `0.0.0.0/0` was in place is not
established: the Atlas monitoring `listDatabases` endpoint reports nothing for
any Free cluster, so its zero is not evidence of an empty database.
**Phase 8 must not migrate customer records until `npm run atlas:verify`
passes and organization-wide Require MFA is on.**

## 8. Start the production database clean

There is no migration. The owner confirmed on 2026-08-22 that the pharmacy's
records have never been digitised and the system has not been handed over, so
the production database starts empty and every figure below begins at zero.

This section was originally written as a data migration, and the audit work
done for it still stands as the record of why no migration is happening. The
two databases on the `medical_stock_system` cluster were audited on 2026-08-22
and confirmed to be development datasets, not the pharmacy's live record:

| | `medical_stock_system` | `medical_stock_system=Cluster0` |
| --- | --- | --- |
| collections / documents | 21 / 76 | 17 / 162 |
| customers | 2 | 6 |
| products | 4 | 5 |
| bills / billed | 2 / 643.10 | 6 / 61,722.26 |
| payments / paid | 1 / 289.10 | 4 / 2,798.00 |
| users | 4 (1 admin, 3 staff) | 6 (2 admin, 4 staff) |

Neither is migrated. `npm run data:audit` remains the tool for inventorying any
database read-only, and is used below to prove the production database is clean
rather than to reconcile a copy.

- [x] Identify the authoritative database. Resolved: there is none. The records
      do not exist yet.
- [x] Do not assume a development database is authoritative. Both candidates
      were audited and rejected on the evidence above.
- [x] Check for plaintext credentials or provider tokens. Clean in both
      candidates: every password is a bcrypt hash and no WhatsApp or Razorpay
      secret appears in any document. Recorded because it establishes that
      nothing sensitive needs shredding if those databases are decommissioned.
- [ ] Confirm the production database is empty before go-live. Run
      `npm run data:audit` against `tammewar_pharmacy_prod` and keep the output;
      it is the zero baseline every later reconciliation compares against.
- [ ] Create the single owner account with `npm run owner:create` and confirm
      the account count is exactly one. Tracked as M-22.
- [ ] Confirm indexes and uniqueness constraints exist once the application has
      connected. The audit lists them per collection; `bills.invoiceNumber`,
      `customers.mobile`, and `users.email` must each be unique.
- [ ] Decide what happens to the retired `medical_stock_system` cluster.
      Tracked as M-25.

Items that only applied to a migration are recorded here as not applicable so
the omission is deliberate rather than forgotten: producing and restoring an
encrypted `mongodump` of a source database, comparing source and destination
counts and financial totals, inspecting ten representative migrated records,
and retaining the old database offline during verification. Backup and restore
are still required — they are Phase 9, against production, and they matter more
now, because with no prior system there is no other copy of the owner's data.

## 9. Establish external encrypted backups

This section is a launch blocker because Atlas M0 has no managed cloud backup.

Tooling and procedure are implemented; execution is owner work on the trusted
device. See `BACKUP_RUNBOOK.md`.

- [ ] Install current MongoDB Database Tools on a trusted administrator device.
      Tracked as M-15.
- [ ] Create a separate least-privilege Atlas backup user (`tammewar_backup`,
      built-in `read` on the application database only). Tracked as M-16.
- [x] Produce a compressed single-file archive with `mongodump`.
      `npm run backup:create` dumps with `--archive --gzip`, passing the URI
      through a private config file rather than argv.
- [x] Encrypt the archive before it leaves the trusted device. AES-256-GCM with
      a scrypt-derived key; the plaintext dump lives only in a private
      temporary directory and is removed on both success and failure.
- [x] Keep the encryption key in a password manager, separate from the archive.
      The passphrase is prompted without echo and never written to disk; the
      runbook requires a password-manager entry distinct from the database
      password.
- [ ] Schedule daily backups when data changes daily; otherwise at least weekly.
      Tracked as M-17.
- [x] Retain multiple generations (suggested: 7 daily, 4 weekly, 3 monthly).
      Enforced automatically and unit-tested; unrecognised files are never
      deleted, and a future-dated archive is never pruned.
- [ ] Keep at least one encrypted copy away from the pharmacy computer.
      Tracked as M-17.
- [x] A cloud-drive folder is acceptable only after local encryption. The
      archive is encrypted before it is written to `BACKUP_DIR`.
- [x] Record and alert on backup failure. The run exits non-zero with a
      credential-redacted reason; the runbook defines the operator response.
- [x] Restore a backup into an isolated temporary database.
      `npm run backup:restore-verify` verifies the manifest digest, decrypts,
      restores with `--nsFrom`/`--nsTo`, excludes `admin.*` so no database users
      or roles are reintroduced, and prints per-collection counts. It refuses to
      target the production database.
- [x] Document recovery and repeat the restore test at least quarterly.
      `BACKUP_RUNBOOK.md` documents the drill and the production-recovery path.
- [ ] Perform the first real backup and restore drill. Tracked as M-18; this is
      the launch blocker.

A backup is not verified until it has been restored successfully.

## 10. Configure Render Free

Repository preparation is complete: `render.yaml` declares the non-secret shape
of the service with every secret marked `sync: false`, and `HOSTING_RUNBOOK.md`
carries the console steps and their verification commands. The console work
itself is tracked as M-19.

- [ ] Connect the private repository and create a Web Service.
- [ ] Set the production branch to `main`; do not enable production deploys
      from feature branches or pull-request previews.
- [x] Root directory: `backend`. Declared in `render.yaml`.
- [x] Runtime: Node.js; region: Singapore where available. Declared in
      `render.yaml`.
- [x] Build command: `npm ci --omit=dev`. Declared in `render.yaml`.
- [x] Start command: `npm start`. Declared in `render.yaml`.
- [x] Health-check path: `/health`. Declared in `render.yaml`; liveness reveals
      no dependency or deployment detail, and `/ready` fails closed at `503`
      until MongoDB is connected.
- [ ] Configure secrets only in Render's environment settings.
- [ ] Set at minimum:

```env
NODE_ENV=production
HOST=0.0.0.0
MONGO_URI=<atlas-connection-string>
MONGO_DB_NAME=tammewar_pharmacy_prod
JWT_SECRET=<new-random-secret>
JWT_ISSUER=tammewar-pharmacy
JWT_AUDIENCE=tammewar-pharmacy-api
JWT_EXPIRES_IN=2h
CUSTOMER_JWT_EXPIRES_IN=2h
TRUST_PROXY=1
CORS_ORIGINS=https://<project>.pages.dev
AUTO_SEED=false
PAYMENTS_ALLOW_MOCK=false
ONLINE_RESTORE_ENABLED=false
INTERNAL_AUTH_ENABLED=false
WHATSAPP_ENABLED=false
```

`MONGO_DB_NAME` and `TRUST_PROXY` were missing from the earlier version of this
block. Both are required: startup refuses to run without an explicit production
database name, and without `TRUST_PROXY=1` behind Render's proxy every request
shares one rate-limit bucket. Do not set `PORT`; Render injects it and the
server refuses to start in production if the platform did not supply one.

- [ ] Add Razorpay/Meta variables only when those live integrations are enabled.
- [ ] Confirm secrets do not appear in build or runtime logs.
- [ ] Test rollback and document the expected cold start of up to about a minute.

## 11. Configure Cloudflare Pages

Repository preparation is complete. `frontend/build/cloudflarePagesAssets.js`
emits `_headers`, `_redirects`, and `robots.txt` into `dist` during the
production build, deriving the Content-Security-Policy `connect-src` from
`VITE_API_BASE_URL` so the policy cannot drift from the API the bundle calls.
The console work is tracked as M-20.

- [ ] Enable Cloudflare account MFA.
- [ ] Create a Pages project from the private repository.
- [ ] Set the production branch to `main` and keep preview deployments
      isolated from production secrets and data.
- [x] Root directory: `frontend`. Documented in `HOSTING_RUNBOOK.md`.
- [x] Build command: `npm run build`.
- [x] Output directory: `dist`.
- [ ] Configure the public frontend value:

```env
VITE_API_BASE_URL=https://<render-service>.onrender.com/result-analysis
```

- [x] Confirm no backend secret is present in Cloudflare variables or built JS.
      `VITE_API_BASE_URL` and the local-only `VITE_DEV_PORT` are the only
      frontend variables, and a credential-pattern scan of a production `dist`
      found nothing on 2026-08-21. Re-run the scan for each release.
- [ ] Deploy the production branch and test the `pages.dev` URL.
- [ ] Add a custom domain if available and enforce HTTPS.
- [x] Prevent search indexing for this private operational application.
      The generated `_headers` sends `X-Robots-Tag: noindex, nofollow,
      noarchive, nosnippet`, `robots.txt` disallows everything, and
      `index.html` carries a matching `robots` meta tag.
- [ ] Review preview deployment access.
- [ ] Never connect preview deployments to production customer data; use a
      separate staging API/database or disable previews.

## 12. Lock down CORS and domains

Enforcement is in code; the remaining items are console values and deployed
verification, tracked as M-21.

- [ ] After obtaining the final Pages URL, configure that exact origin in
      Render's `CORS_ORIGINS`.
- [ ] Add the exact custom-domain origin if one is used.
- [x] Remove localhost origins from production. Startup refuses any
      `localhost`, `127.0.0.1`, `::1`, or `0.0.0.0` origin in production.
- [x] Do not use `*`, wildcard `pages.dev`, or caller-provided permission
      headers. Startup refuses a wildcard, a non-`https` scheme, or an origin
      carrying a path or trailing slash. No request header influences the
      allowlist.
- [x] Verify unapproved browser origins receive no CORS permission. An
      unapproved origin is answered with no `Access-Control-Allow-Origin`
      header at all rather than a 500, and credentialed CORS is never enabled.
      Covered by `backend/test/requestHardening.test.js`.
- [x] Verify direct API requests still require valid authentication. Covered by
      `backend/test/authorization.test.js`; repeat against the deployed API
      using the commands in `HOSTING_RUNBOOK.md`.

## 13. Secure the owner account

See `OWNER_ACCOUNT_RUNBOOK.md`.

- [x] Create the owner through a controlled one-time setup and then leave
      `AUTO_SEED=false`. `npm run owner:create` refuses to run if any user
      document already exists, reads the password with echo disabled so it
      never reaches argv, shell history, or the terminal scrollback, and
      enforces the same strength rule as the API. Running it against production
      is tracked as M-22.
- [x] Require current-password confirmation for password changes. Enforced by
      `POST /result-analysis/auth/change-password`, and now reachable from the
      UI at **Settings > Security**, which previously had no password-change
      screen at all.
- [x] Invalidate or expire old sessions after credential rotation. The account
      records `passwordChangedAt` and the authentication middleware rejects any
      token whose `iat` predates it, so a rotation ends every session that was
      open when it happened. The caller that supplied the correct current
      password receives a replacement token so only the other sessions end.
      Covered by `backend/test/authorization.test.js`.
- [x] Add application TOTP MFA if practical. Decided against for the pilot on
      2026-08-21; Cloudflare Access is the chosen second factor instead.
- [ ] Consider Cloudflare Access as an additional identity gate while retaining
      the application's own authentication. Configuration steps are in
      `HOSTING_RUNBOOK.md`; tracked as M-23. Note its limit: Access gates the
      browser path to the UI, while the API stays reachable directly and is
      protected only by the owner password and the JWT.
- [x] Record successful and failed administrator login attempts without logging
      passwords or full tokens. `owner_login_succeeded`,
      `owner_login_failed`, `owner_password_changed`, and
      `owner_password_change_failed` are written with a request id, source IP,
      and reason code. The logger redacts credential-shaped and
      customer-identifying keys, so no password, token, or email value reaches
      the log stream.
- [x] Establish a password-reset procedure that verifies the owner's identity.
      Documented in `OWNER_ACCOUNT_RUNBOOK.md`. There is deliberately no
      self-service reset endpoint: it would be an unauthenticated,
      internet-facing route able to reset the only account in the system.

## 14. Security regression testing

An automated suite now covers the checks that can be asserted without a
deployed environment: `cd backend && npm test` runs 57 tests across
`authorization`, `requestHardening`, `rateLimit`, `productionConfig`,
`dataExposure`, `archiveCrypto`, `backupRetention`, and the original
`security` suite. Every item marked complete below is asserted on each run.
Items still open require the deployed environment and are tracked as M-24.

- [x] Unauthenticated, forged-tenant, query-token, invalid-JWT, and expired-JWT
      requests return `401`. Also covered: a wrong signing secret, a wrong
      issuer or audience, `alg: none`, a non-owner `authType`, a non-admin
      role, a missing or inactive account, and a token predating the last
      password change.
- [x] Public registration is blocked and failed logins trigger `429`. No
      registration, customer-login, staff, or public tracking/feedback surface
      exists, and throttling engages within ten failed attempts without the
      throttled requests reaching the credential lookup.
- [x] Only the owner can access customers, settings, exports, bulk actions, and
      destructive operations. Every route below the login sits behind
      `verifyToken` and then `requireAdmin`.
- [x] Online restore remains disabled. `ONLINE_RESTORE_ENABLED` is forced off
      in production by the environment reader, and the restore endpoint refuses
      with `403` when it is off.
- [x] Passwords and WhatsApp tokens never appear in responses or backups.
      Asserted against documents that deliberately do carry them, so the test
      proves the export strips them rather than that the source was clean.
      `passwordChangedAt` is withheld too.
- [x] MongoDB operator payloads and malformed IDs return `400`. Covers `$ne`,
      `$gt`, `$where`, `$set` inside an array, dotted keys, and `__proto__` and
      `constructor` sent as raw JSON text, plus malformed identifiers in both
      the body and the query string.
- [x] Oversized bodies, invalid quantities/prices, and excessive strings fail.
      A body past 1 MB returns `413`; an over-long string or an over-long array
      returns `400`. Field-level quantity and price validation was completed in
      Phase 5.
- [ ] Rendered notes and customer values cannot execute HTML/script. React
      escapes interpolated text, and a repository-wide scan for HTML sinks on
      2026-08-21 found one real defect, now fixed: the expense receipt viewer
      interpolated a stored value into `document.write` markup and passed it to
      `window.open`, so a stored `javascript:` URL or markup payload would have
      executed. Receipts are now constrained to base64 image/PDF data URIs by
      the Expense schema and re-checked in the UI before any render, download,
      or new-tab open, with the PDF iframe sandboxed. Covered by
      `backend/test/security.test.js`. The only `dangerouslySetInnerHTML` in the
      tree is in an unrouted legacy SIS page that never enters the bundle.
      Confirm the rendered behaviour once the UI is deployed.
- [x] HTTPS and security headers are present. The API sends HSTS, `nosniff`,
      `X-Frame-Options`, and no `X-Powered-By`; the frontend's generated
      `_headers` adds a strict CSP, HSTS, `Referrer-Policy: no-referrer`, a
      restrictive `Permissions-Policy`, and `X-Robots-Tag`. Confirm both over
      the wire after deployment.
- [x] CORS allows only the production frontend. Lookalike hostnames, a
      wildcard subdomain, an `http` downgrade, `null`, and localhost all
      receive no permission; preflights from unapproved origins are not
      granted; credentialed CORS is never enabled.
- [x] No secret is present in frontend assets, Git history, or logs. A
      credential-pattern scan of a production `dist` was clean on 2026-08-21;
      history was scanned in Phase 2; log redaction is asserted against nested
      and array-shaped credential material, and production error records carry
      only an error type, never an exception message.
- [ ] Atlas rejects invalid credentials and unrelated database access. Run
      `npm run atlas:verify` from an allowlisted device and retain the output.
- [ ] The backend and UI recover cleanly from a Render cold start.

## 15. Business workflow testing

- [ ] Owner login, password change, logout, and session expiry.
- [ ] Create/update customers and vendors.
- [ ] Create/update products; stock in, issue, low-stock, and expiry behavior.
- [ ] Create quotation; convert to order/invoice; generate bill PDF.
- [ ] Record payment and verify outstanding balance/customer ledger.
- [ ] Verify sales, stock, delivery, and outstanding reports.
- [ ] Test backup export and an isolated restore.
- [ ] Test the owner's intended desktop/mobile/tablet device.
- [ ] Test the first request after at least 15 minutes of inactivity.

## 16. Monitoring and operating procedures

- [ ] Enable Render, Cloudflare, and Atlas failure/security notifications.
- [ ] Add a low-frequency external uptime check to `/health`; do not use it to
      defeat Render's intended sleep behavior.
- [ ] Review failed login and application error events.
- [ ] Review Atlas network/users and infrastructure membership monthly.
- [ ] Run dependency audits and production builds before every release.
- [ ] Apply security updates regularly.
- [ ] Test backup recovery quarterly.
- [ ] Document password/JWT/database rotation, backup restoration, deployment
      rollback, emergency shutdown, and customer data export/deletion.

## Final go/no-go gate

- [ ] Git history is sanitized and all potentially exposed credentials rotated.
- [ ] Only the intended named owner account exists.
- [ ] Unused customer/staff authentication surfaces are disabled.
- [ ] Cloudflare Pages uses the correct production Render API.
- [ ] Render permits only the exact Cloudflare production origin.
- [ ] Atlas uses least-privilege credentials and a constrained network allowlist.
- [ ] The production database starts empty and contains exactly one owner
      account. There is no migration; the records were never digitised.
- [ ] Unique indexes exist on invoice number, customer mobile, and owner email.
- [ ] A recent encrypted external backup exists and was restored successfully.
- [ ] Critical authorization/security regression tests pass.
- [ ] Complete business workflows pass on the deployed environment.
- [ ] No secrets appear in frontend assets, the repository, exports, or logs.
- [ ] The owner understands cold starts, backups, password hygiene, and incident
      reporting.

## Release commands

Run all of these before every release. The frontend build requires
`VITE_API_BASE_URL`; it fails rather than silently producing a bundle that
calls the wrong API.

```powershell
cd backend
npm ci
npm audit --omit=dev --audit-level=high
npm test

cd ..\frontend
npm ci
npm audit --audit-level=high
$env:VITE_API_BASE_URL = "https://<render-service>.onrender.com/result-analysis"
npm run build
Select-String -Path dist\assets\*.js -Pattern "mongodb\+srv|JWT_SECRET|rzp_live|-----BEGIN"
```

The last command must find nothing. Last full run: 2026-08-21 — 57 backend
tests passing, zero reported vulnerabilities in either package, clean
production build, and no credential pattern in the built assets.

# Manual Production Tasks

This file contains account-owner and platform-console work intentionally
deferred while the implementation phases continue. None of these items blocks
local development. Complete each item by the stated deadline; never paste a
secret, password, recovery code, or connection string into this repository.

## Before connecting production infrastructure

- [ ] **M-01 — Production JWT secret:** When configuring Render, run
      `cd backend && npm run secret:generate`, then store the result directly
      in the password manager and Render as `JWT_SECRET`.
- [x] **M-02 — MongoDB credentials:** `tammewar_app` exists with least
      privilege, and its password was rotated on 2026-08-22. The original was
      not recoverable — Atlas displays a database password once at creation and
      never again — so it was regenerated. Safe to do at that point because no
      service had ever connected: no Render deployment existed and the database
      was empty. The new value must be moved into the password manager and
      entered into Render as `MONGO_URI`.
- [ ] **M-03 — Infrastructure MFA:** Enable MFA on Cloudflare, Render, and
      Atlas before production secrets or customer data are added.
- [ ] **M-04 — Trusted deployment branches:** In Render and Cloudflare, set
      `main` as the only production branch. Do not expose production secrets or
      customer data to pull-request/preview deployments.

## Before going live

- [ ] **M-15 — Supported MongoDB 8.3 recovery host (Phase 8 blocker):** Make a
      supported Windows 11/Windows Server 2022 or supported Linux administrator
      device available for the one-time source recovery. The repaired local
      store has feature compatibility version 8.3, but this administrator
      device runs Windows 10 build 19044. MongoDB 8.3.4 and 8.3.7 both fail in
      the Windows loader before opening the disposable database copy. Do not
      edit the feature-compatibility document or open the original store in
      place. Transfer any required database material only through encrypted
      removable storage, then produce a logical `mongodump` immediately. Follow
      `WINDOWS_11_PHASE_8_CONTINUATION.md` for the controlled transfer, audit,
      dump, restore, and reconciliation procedure.
- [ ] **M-05 — Owner password:** Give the named pharmacy owner a unique
      password of at least 16 characters and store it in the password manager.
- [ ] **M-06 — Revoke legacy integrations:** Log out/revoke the committed
      WhatsApp browser session. Keep WhatsApp disabled; do not re-pair it for
      the pilot.
- [ ] **M-07 — Retired provider credentials:** Revoke or rotate any historical
      Razorpay, Meta/WhatsApp, SMTP, SMS, or gateway credentials. If an account
      or credential never existed, record the item as not applicable.
- [ ] **M-08 — Credential separation:** Confirm the application owner password,
      GitHub password, infrastructure passwords, database password, and JWT
      secret are all distinct.

## Phase 7 — verified against Atlas on 2026-08-21: NOT complete

Phase 7 was reported complete, but a direct read of the Atlas project with the
Atlas CLI (`nraghuvanshi100@gmail.com`, org `tammewar-pharmacy-production`,
project `tammewar_pharmacy_prod`, cluster `tammewar-pharmacy-prod`) contradicts
that for four of the five items.

Whether the cluster held data at the time is **not established**. The Atlas
monitoring `listDatabases` endpoint returned `totalCount: 0`, but it returns
the same for every Free cluster in this account, including ones known to hold
data — the endpoint does not report on shared tiers. Do not read that zero as
evidence of an empty database. Confirming the contents requires a real
`mongosh` connection.

What is genuinely in place:

- The dedicated org, project, and M0 cluster exist, with no sample data.
- Project membership is a single person.
- Alerts are configured, including `LOGICAL_SIZE` at 440 MB and
  `CONNECTIONS_PERCENT` at 80.

What is not:

| Finding | Evidence | Item |
| --- | --- | --- |
| `tammewar_app` holds `readWriteAnyDatabase` on `admin`, not `readWrite` on the application database. It can read and write every database on the cluster. | `atlas dbusers list` | M-12 |
| A second database user, `nraghuvanshi100_db_user`, holds `atlasAdmin`. | `atlas dbusers list` | M-12 |
| The network allowlist contains `0.0.0.0/0` — the database accepts connections from the entire internet. | `atlas accessLists list` | M-13 |
| Termination protection is disabled, though the control is available. | `terminationProtectionEnabled: false` | M-11 |
| The organization-wide Require MFA control is off. | `multiFactorAuthRequired: false` | M-10 |

`npm run atlas:verify` would have caught the first finding on its own — it
fails any role outside `readWrite` on `MONGO_DB_NAME`. Treat M-14 as not yet
run, and re-run it as the closing check once M-10 through M-13 are corrected.

### Remediation applied on 2026-08-21, with the user's approval

- **Fixed.** `tammewar_app` now holds exactly `readWrite` on
  `tammewar_pharmacy_prod`, scoped to cluster `tammewar-pharmacy-prod`. Its
  password was not changed, so nothing already stored needs updating.
- **Fixed.** `nraghuvanshi100_db_user` (`atlasAdmin`) was deleted.
  `tammewar_app` is now the only database user in the project, and its
  privileges are sufficient for the Phase 8 migration and the Phase 9 restore.
- **Fixed.** `0.0.0.0/0` was removed from the network allowlist. The trusted
  device's current address `103.251.209.136/32` was registered first so the
  removal could not cause a lockout.
- **Blocked, not a defect.** Termination protection cannot be enabled: Atlas
  rejects every public-API update to an M0 cluster
  (`TENANT_CLUSTER_UPDATE_UNSUPPORTED`), and the CLI refuses it below M10. The
  task list qualifies this item with "if available". Check the console once; if
  the control is not offered for Free clusters, record M-11 as not applicable
  and rely on the fact that a deleted cluster is recoverable only from a
  Phase 9 backup — which is another reason that backup must be real.

**Note on the allowlist:** the pre-existing entry was `103.251.209.156/32` but
the same machine now presents `103.251.209.136/32`. The address is dynamic, so
allowlist entries will go stale and produce confusing connection failures. Once
Render's outbound ranges are added in Phase 10, remove both administrator
entries and re-add one only for the duration of a maintenance session.

Also noted, not a defect: the cluster is in AWS `AP_SOUTH_1` (Mumbai) rather
than the Singapore the runbook assumed. Mumbai is the better choice for an
Indian pharmacy, but Render Free has no Mumbai region, so Phase 10 should place
Render in Singapore and accept the cross-region hop. Update the runbook's
region assumption rather than moving the cluster; an Atlas cluster cannot be
renamed or relocated in place.

- [x] **M-10 — Atlas ownership and MFA:** In the production Atlas organization,
      configure two MFA methods for each administrator and enable the
      organization-wide Require MFA control.
- [x] **M-11 — Dedicated Free cluster:** Create project
      `tammewar-pharmacy-production` and Free/M0 cluster
      `tammewar-pharmacy-prod`, preferably AWS Singapore, with no sample data
      and termination protection enabled when available.
- [x] **M-12 — Least-privilege application user:** Create `tammewar_app` with
      only `readWrite` on `tammewar_pharmacy_prod`, restricted to the production
      cluster where available. Store its generated password only in the team
      password manager and later in Render.
- [x] **M-13 — Network and alerts:** Temporarily allowlist only the trusted
      migration device, never `0.0.0.0/0`; configure available Logical Size,
      Connections, and administrative-change notifications. Add Render's full
      service-specific outbound CIDR list during Phase 10.
- [x] **M-14 — Access verification:** Passed for the first time on 2026-08-22:
      `{"atlasConnection":"ok","database":"tammewar_pharmacy_prod","role":"readWrite","unrelatedDatabaseAccess":"denied"}`.
      Re-run after Phase 10 adds Render's outbound ranges, and after any change
      to the application user's roles.

      The first run failed, and the failure was in the verifier rather than in
      the privileges. It recognised an authorization denial only by the
      self-hosted MongoDB shape (`code: 13` / `Unauthorized`), while Atlas wraps
      the same refusal as `code: 8000` / `AtlasError` — so the one script whose
      job is proving least privilege reported a false failure against the only
      platform it targets. Fixed, and its denial detection is now pinned by
      `backend/test/atlasVerify.test.js`, including the case that matters most:
      a connectivity error must never be read as a denial, or an unreachable
      cluster would masquerade as a passing check. That this was never caught is
      further confirmation the original M-14 sign-off never ran the command.

M-02 and M-10 through M-14 were confirmed complete by the user on 2026-08-16.
Render's service-specific outbound CIDRs remain a Phase 10 update because the
Render service does not exist yet.

## Confirmed controls

- [x] GitHub MFA is enabled for `Nikhil270703` and `Developerr86`.
- [x] GitHub `main` is protected and requires review.
- [x] The GitHub repository is private.
- [x] Old pre-rewrite repository clones have been removed.

## Source system exposure, found 2026-08-21

While identifying the Phase 8 migration source, the **existing live** project
`medical_stock_system` (cluster `Cluster0`) was found to have the same two
weaknesses the production project had:

- `0.0.0.0/0` in its network allowlist — it accepts connections from the whole
  internet;
- its only database user, `medical_stock_system_db_user`, holds `atlasAdmin`.

This project holds the real pharmacy records, so unlike the empty production
cluster this is a present exposure, not a hypothetical one. It was left
untouched because it backs a running system and tightening it could interrupt
the pharmacy's current app.

- [x] **M-25 — Secure the development project:** Done on 2026-08-22. The
      project is kept as a development environment. `0.0.0.0/0` was removed
      from `medical_stock_system` after registering the administrator device,
      and `medical_stock_system_db_user` was downgraded from `atlasAdmin` to
      `readWrite` on only the two databases that exist, scoped to `Cluster0`.
      Anything that connected from an unlisted address, or relied on
      administrative privileges, will need attention.

## Phase 8 — resolved, no migration

- [x] **M-26 — Locate the authoritative records.** Resolved on 2026-08-22:
      there are none. The pharmacy's records were never digitised and the
      project has not been handed over yet, so production starts empty. The
      audit of the `medical_stock_system` cluster stands as the evidence that
      the two development databases there are not the pharmacy's live record
      and must not be migrated.
- [ ] **M-27 — Source credential rotated.** The password for
      `medical_stock_system_db_user` was reset on 2026-08-22 at the user's
      instruction so the audit could run. **Any application still
      authenticating as that user is broken until its connection string is
      updated.** The new value was written to a private file on the
      administrator device rather than into this repository or the chat
      transcript; move it into the password manager and delete that file. With
      no migration to perform, this credential is only needed if the
      development project is kept; if M-25 retires the project, the credential
      dies with it.

## Phase 9 — encrypted backups (launch blocker)

Tooling and procedure are implemented in the repository; these are the
device-side and account-side actions. See `BACKUP_RUNBOOK.md`.

- [x] **M-15 — MongoDB Database Tools:** Installed on the administrator Mac on
      2026-08-22: Database Tools 100.16.1, `mongosh` 2.9.2, Atlas CLI 1.58.1.
- [ ] **M-16 — Backup user and passphrase:** Create Atlas user
      `tammewar_backup` with built-in `read` on `tammewar_pharmacy_prod` only —
      not the application user. Generate an archive passphrase of at least 20
      characters and store it in the password manager as an entry separate from
      the database password.
- [ ] **M-17 — Schedule and off-site copy:** Schedule `npm run backup:create`
      daily on the administrator device (Task Scheduler or `cron`), never in
      the Render web process. Keep at least one encrypted copy away from the
      pharmacy computer.
- [ ] **M-18 — Restore drill against real data:** The tooling is proven (see
      above). Once the owner has entered real records, run
      `npm run backup:restore-verify` against an isolated verification
      database, compare counts and business totals, inspect ten representative
      records, then drop the verification database and record the date.
      **A backup that has not been restored is not a verified backup.** With no
      prior system, the production database is the only copy of the owner's
      data from the moment they start typing.

### Full drill completed on 2026-08-22

The whole backup path was exercised against real Atlas on the disposable
`medical_stock_system` development cluster, so production was never touched.
Backup: 17 collections and 162 documents dumped, gzipped, and encrypted to a
1.44 MB AES-256-GCM archive with its SHA-256 recorded. Restore: the manifest
digest verified, the archive decrypted, and `mongorestore` wrote into an
isolated `restore_drill_check` database.

Result — all 17 collections and all 162 documents came back, every business
total matched the source exactly (6 customers, 6 bills totalling 61,722.26,
4 payments totalling 2,798.00, 1,701 stock units, 58,924.26 outstanding), and
the three unique indexes were recreated. The drill database was dropped and
the decrypted plaintext deleted.

**The first attempt failed, and is worth recording.** It reported
`"restore": "ok"` while restoring nothing. Two defects caused it: the target
database was passed both in the connection string and in `--nsTo`, so
mongorestore filtered the archive to a name it never contained and matched no
namespaces; and the script inferred success from mongorestore's exit code
rather than from what actually arrived. Both are fixed — the URI is stripped to
the cluster before mongorestore sees it, the manifest now records the source
document count, and the restore refuses to report success on an empty or
short database. `backend/test/backupRetention.test.js` covers the guard.

This proves the tooling. It does not yet prove a backup of the owner's data,
because there is none. Repeat the drill against production once the owner has
entered real records — that is what M-18 now tracks.

## Phases 10-13 — hosting and owner account

See `HOSTING_RUNBOOK.md` and `OWNER_ACCOUNT_RUNBOOK.md`.

- [ ] **M-19 — Render service:** Create the Web Service from `render.yaml`,
      enter the four secret variables, disable PR previews, confirm no secret
      appears in build or runtime logs, and test a rollback.
- [ ] **M-20 — Cloudflare Pages project:** Create the project, set
      `VITE_API_BASE_URL` to the Render API, disable or isolate previews, and
      confirm the generated CSP, HSTS, and `X-Robots-Tag` headers are served.
- [ ] **M-21 — Final CORS origin:** Set Render's `CORS_ORIGINS` to the exact
      Pages origin (and custom domain, if used), then verify over the wire that
      a lookalike origin receives no CORS permission and that a direct API
      request still requires a token.
- [ ] **M-22 — Create the owner account:** Run `npm run owner:create` against
      production once, store the password in the password manager, and confirm
      exactly one account exists.
- [ ] **M-23 — Cloudflare Access:** Put an Access policy in front of the Pages
      hostname, scoped to the owner's email. This is the chosen second factor;
      in-app TOTP was decided against on 2026-08-21.
- [ ] **M-24 — Deployed security checks:** Against the deployed environment,
      confirm rendered notes cannot execute script, `npm run atlas:verify`
      passes from the allowlisted device, and the backend and UI recover
      cleanly from a cold start.

## After the initial release

- [ ] **M-09 — Scheduling review:** After observing real usage, decide whether
      recurring-order processing needs an external scheduler. Keep the current
      owner-triggered workflow if it is sufficient. Any future scheduler must
      call an authenticated, idempotent job entry point and must not run inside
      the Render web process.

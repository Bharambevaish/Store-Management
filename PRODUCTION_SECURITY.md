# Production security gate

The application must not be exposed to the internet until every item in the
"Required before launch" section is complete. The local development database
and credentials are not production configuration.

## Controls implemented in the application

- Signed JWT authentication with explicit algorithm, issuer, audience, expiry,
  and an active-account lookup on every request.
- Customer, staff, and administrator authorization boundaries, including
  ownership checks on customer orders, bills, tracking, feedback, and payments.
- Administrator-only registration, user administration, backups, restores,
  settings, bulk operations, and destructive endpoints.
- Strict CORS allowlist, Helmet response headers, request-size limits, dangerous
  MongoDB key rejection, ObjectId validation, generic production errors, and
  login/API/payment rate limits.
- Strong new-password validation and a password-change endpoint.
- Server-side Razorpay order matching, HMAC verification with a timing-safe
  comparison, and development-only mock payments.
- Passwords and WhatsApp tokens excluded from normal API/backup responses.
- WhatsApp browser automation and online restore disabled by default.
- Database/session/runtime files and environment secrets ignored by Git.

## Required before launch

1. Purge `backend/.wwebjs_auth` and `data/db` from the complete Git history,
   not only the current index. Coordinate the history rewrite with every clone.
2. Revoke and re-pair the exposed WhatsApp session. Rotate every secret that may
   have existed in the repository or database: JWT, Razorpay, MongoDB, gateway,
   SMTP/SMS/WhatsApp, and all administrator/staff/customer passwords.
3. Replace the local MongoDB process with a private production deployment that
   requires authentication, least-privilege application credentials, TLS,
   encryption at rest, tested encrypted backups, point-in-time recovery, and no
   public network access.
4. Terminate TLS at a hardened reverse proxy/load balancer, allow only the real
   frontend origin in `CORS_ORIGINS`, and set `TRUST_PROXY` only to the exact
   trusted proxy topology.
5. Store secrets in the hosting platform's secret manager. Never copy `.env`
   into an image, deployment artifact, support ticket, or repository.
6. Set `NODE_ENV=production`, keep `AUTO_SEED=false`,
   `PAYMENTS_ALLOW_MOCK=false`, `ALLOW_ONLINE_RESTORE=false`, and
   `INTERNAL_AUTH_ENABLED=false`. The server refuses unsafe combinations.
7. Complete Razorpay live-mode end-to-end testing, implement and verify signed
   webhooks, confirm captured status before fulfilment, and make payment writes
   transactional and idempotent under concurrent callbacks.
8. Replace the in-memory rate-limit store with a shared store when running more
   than one application instance. Add centralized redacted logs, alerting,
   uptime monitoring, audit retention, and an incident-response runbook.
9. Add automated unit/integration tests for every role and business workflow,
   restore testing, dependency/security scanning in CI, and an independent
   penetration test against the deployed staging environment.
10. Obtain a documented privacy, pharmaceutical, tax, retention, and payment
    compliance review for every jurisdiction in which the service will operate.
    Define who may access patient/customer data and enforce that policy through
    named accounts, MFA/SSO, periodic access reviews, and offboarding.

## Release verification

Run dependency checks in both package directories and build the frontend for
every release:

```powershell
npm ci
npm audit --audit-level=high
cd ..\frontend
npm ci
npm audit --audit-level=high
npm run build
```

Backups must be restored into an isolated environment on a schedule. A backup
that has not been restored successfully is not considered a verified backup.

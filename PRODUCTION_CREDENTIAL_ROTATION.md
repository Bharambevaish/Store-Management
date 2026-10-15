# Production Credential Rotation

Never record secret values, passwords, recovery codes, or connection strings in
this repository, pull requests, issue comments, deployment logs, or chat.

## Application credentials

1. Generate the production JWT secret immediately before configuring Render:
   `cd backend && npm run secret:generate`.
2. Store it directly in the password manager and Render as `JWT_SECRET`.
3. Use the production-only Atlas connection string as `MONGO_URI` in Render.
4. Give the named pharmacy owner a unique password of at least 16 characters.
5. Keep `AUTO_SEED=false` after the production owner has been created.
6. Do not reuse local-development JWT, database, or owner credentials.

## Provider credentials

The initial pilot does not use Razorpay, Meta/WhatsApp, SMTP, SMS, or another
payment gateway. Do not configure credentials for disabled providers. The
account owner must revoke or rotate any credential that may previously have
been committed, imported, shared, or used by this project:

- rotate the old MongoDB user password and remove obsolete database users;
- revoke Razorpay test/live keys and webhook secrets;
- revoke Meta/WhatsApp access tokens and remove the old browser session;
- revoke SMTP/SMS/API keys and gateway webhook secrets;
- remove unused deployment secrets after verifying the application no longer
  references them.

Record only the provider, credential class, rotation date, responsible person,
and verification result. Never record the credential value.

## Account controls

- GitHub MFA for `Nikhil270703` and `Developerr86` was confirmed on 2026-08-16.
- Enable MFA separately for Cloudflare, Render, Atlas, Razorpay, and Meta before
  granting those accounts production access.
- Store recovery codes outside the repository in the account owner's password
  manager.

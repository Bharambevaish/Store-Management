# Owner account runbook

Phase 13 of `PRODUCTION_DEPLOYMENT_TASKLIST.md`.

The pharmacy owner holds the only account in the system. There is no staff
login, no customer login, and no self-service registration — every application
route sits behind this one credential. It is therefore the single thing whose
compromise loses everything.

## Creating the owner, once

`AUTO_SEED` stays `false` in production. The supported path is a controlled
one-time setup run from the trusted administrator device against the production
database:

```bash
cd backend
MONGO_URI='<atlas uri>' MONGO_DB_NAME=tammewar_pharmacy_prod npm run owner:create
```

The script:

- refuses to run if **any** user document already exists, so it cannot silently
  create a second administrator;
- prompts for email, name, mobile, and password, reading the password with echo
  disabled so it never reaches the terminal scrollback, the shell history, or
  `argv`;
- enforces the same strength rule the API does — 16 to 128 characters with an
  uppercase letter, a lowercase letter, and a digit;
- hashes with bcrypt at cost 12 before the document is written.

Store the password in the password manager immediately. It cannot be recovered
from the database.

Afterwards, confirm exactly one account exists and that it is the intended one.
Any leftover development or test account must be deleted before go-live — this
is the Phase 8 reconciliation item.

## Rotating the password

In the application: **Settings → Security → Change owner password**.

The endpoint requires the current password, rejects a new password that is
weak or unchanged, and — importantly — **ends every other session**. Tokens are
stateless JWTs, so the account records a `passwordChangedAt` instant and the
authentication middleware rejects any token issued before it. The tab that
performed the change receives a replacement token, so the owner is not signed
out of the session that just proved knowledge of the old password.

Rotate the password when:

- anyone other than the owner has seen or handled it;
- a device that was signed in is lost, sold, or serviced;
- the password appears in a breach-notification service;
- routinely, and always after any suspected incident.

Rotating the **`JWT_SECRET`** in Render has the same session-ending effect for a
different reason: every existing token fails signature verification. Do it if a
token may have leaked, or if the Render environment may have been exposed. It
requires a redeploy and the owner will need to sign in again.

## If the owner is locked out

There is no self-service password reset, deliberately: an email-based reset flow
would add an unauthenticated, internet-facing endpoint that can reset the only
account in the system.

Recovery is an administrator action performed out of band:

1. **Verify the requester is the owner** by a channel independent of the
   application — an in-person request, or a voice call to the mobile number
   already recorded on the account. Never act on an emailed request alone.
2. From the trusted administrator device, with the Atlas IP allowlist entry in
   place, connect to the production database as a temporary write-capable user.
3. Set a new bcrypt hash and clear the session window in one update:

   ```js
   // mongosh, against tammewar_pharmacy_prod
   const bcrypt = require('bcryptjs'); // or generate the hash with the app's own dependency
   db.users.updateOne(
     { email: '<owner email>' },
     { $set: { password: '<bcrypt hash, cost 12>', passwordChangedAt: new Date() } }
   );
   ```

   Setting `passwordChangedAt` is what invalidates any token an attacker may
   already hold. Do not skip it.
4. Remove the temporary database user and the temporary IP allowlist entry.
5. Give the owner the new password through the password manager, not over
   email or chat, and have them change it at the next sign-in.
6. Record the reset — who requested it, how identity was verified, who
   performed it, and when — in the operations log.

## What is recorded

Authentication events are written to the structured log as
`owner_login_succeeded`, `owner_login_failed`, `owner_password_changed`, and
`owner_password_change_failed`, each with a request id, the source IP, and a
reason code. Passwords, tokens, and email addresses are redacted by the logger
before anything is written.

Review these in Render's logs when:

- the owner reports a sign-in they did not make;
- `owner_login_failed` appears repeatedly from an unfamiliar address;
- a `429` throttle is reported by the owner during normal use.

Ten failed attempts in fifteen minutes throttles further attempts from that
address. Successful sign-ins do not consume the budget.

## Second factor

The application has no built-in TOTP. The decision for this pilot is to use
**Cloudflare Access** in front of the frontend instead — see
`HOSTING_RUNBOOK.md`. Note its limit honestly: Access gates the browser path to
the UI, while the API remains reachable directly and is protected only by the
owner's password and the JWT. The password's strength and secrecy therefore
still carry most of the weight.

## What the owner needs to understand

- The first request after 15 minutes of inactivity can take about a minute
  while the free backend wakes up. The app shows a waking-up state; it is not a
  fault and it is not a wrong password.
- Only an explicit "invalid email or password" means the credentials were
  wrong.
- Refreshing the browser signs them out — the token is held in memory only and
  is never written to browser storage.
- The password belongs in the password manager and nowhere else: not on paper
  near the computer, not in a browser note, not shared with staff.
- Backups are only as recent as the last successful run. See
  `BACKUP_RUNBOOK.md`.
- Anything that looks like unauthorised access is reported the same day.

# Encrypted backup and restore runbook

Phase 9 of `PRODUCTION_DEPLOYMENT_TASKLIST.md`. **This is a launch blocker.**

MongoDB Atlas Free has no managed cloud backup. If the cluster is lost,
corrupted, paused past its retention, or its data is deleted by mistake, the
only surviving copy of the pharmacy's records is the one produced here. A
backup that has never been restored is not a backup — it is an untested guess.

Never paste a connection string, database password, or archive passphrase into
this repository, a chat window, a screenshot, or a shell command that lands in
history.

## What the tooling does

| Command | Purpose |
| --- | --- |
| `npm run backup:create` | `mongodump` the production database, encrypt the archive on this device, write a manifest, prune old generations |
| `npm run backup:restore-verify` | Decrypt an archive, verify its digest, restore it into an **isolated** database, and print per-collection counts |

Archives are `AES-256-GCM` with a `scrypt`-derived key. The cipher is
authenticated, so a corrupted or tampered archive fails to decrypt instead of
restoring subtly wrong data. Each archive is paired with a
`*.manifest.json` recording its SHA-256, sizes, and timestamps.

`.gitignore` excludes archives and manifests. They must never be committed.

## One-time setup on the trusted administrator device

1. Install the current **MongoDB Database Tools** (`mongodump` and
   `mongorestore` must be on `PATH`). The tools ship separately from the
   MongoDB server; the versions bundled with old server installs are not
   supported against current Atlas.

   ```bash
   mongodump --version
   mongorestore --version
   ```

2. In Atlas, create a **separate least-privilege backup user** — do not reuse
   the application user `tammewar_app`:

   - name: `tammewar_backup`
   - role: built-in `read` on `tammewar_pharmacy_prod` only
   - no `readWriteAnyDatabase`, no `Atlas admin`, no access to other databases

   A read-only backup credential cannot damage production even if the backup
   device is compromised.

3. Allowlist this device's public IP in Atlas **Network Access**, with an
   expiry where Atlas offers one.

4. Generate an archive passphrase of at least 20 characters (a
   four-or-more-word passphrase is fine) and store it in the password manager
   **as a separate entry from the database password**. Anyone holding both the
   archive and the passphrase holds the pharmacy's customer data.

5. Choose a backup directory outside any synced folder, then decide the
   off-site copy destination. A cloud-drive folder is acceptable **only**
   because the archive is already encrypted before it leaves this device.

## Taking a backup

Set the environment for the session without writing the URI into shell history
(most shells skip history for a line beginning with a space; a password
manager CLI is better):

```bash
export BACKUP_MONGO_URI='<atlas uri for tammewar_backup, ending /tammewar_pharmacy_prod>'
export BACKUP_DIR="$HOME/tammewar-backups"
cd backend && npm run backup:create
```

The script prompts for the archive passphrase without echoing it. On success it
prints a JSON summary:

```json
{
  "backup": "ok",
  "archive": "tammewar-2026-08-21T093015Z.archive.gz.enc",
  "database": "tammewar_pharmacy_prod",
  "sha256": "…",
  "generationsRetained": 8,
  "generationsPruned": 1
}
```

Then copy **both** the `.archive.gz.enc` and its `.manifest.json` to the
off-site location.

### Frequency and retention

- Back up **daily** while the pharmacy enters data daily; weekly is the floor.
- Retention is enforced automatically: **7 daily, 4 weekly, 3 monthly.** Files
  the script does not recognise are never deleted.
- Keep at least one encrypted copy physically away from the pharmacy computer.

### Failure handling

The script exits non-zero and prints a redacted reason on failure. A backup run
that fails is an incident, not a nuisance:

1. Re-run once — the usual causes are a lapsed Atlas IP allowlist entry or a
   sleeping laptop.
2. If it fails again, record the date and reason in the operations log and fix
   it the same day. Two consecutive failures mean the newest usable copy is
   already more than 48 hours old.
3. Note the date of the last **successful** run somewhere the owner sees it.

## Verifying a backup by restoring it

Restore into a throwaway database. The script refuses to target
`tammewar_pharmacy_prod`, so a drill cannot overwrite live data.

```bash
export RESTORE_MONGO_URI='<atlas uri ending /tammewar_restore_check>'
export RESTORE_ARCHIVE="$HOME/tammewar-backups/tammewar-2026-08-21T093015Z.archive.gz.enc"
cd backend && npm run backup:restore-verify
```

It verifies the manifest digest, decrypts, runs `mongorestore` with
`--nsFrom`/`--nsTo` into the verification database, excludes `admin.*` so no
database users or roles are reintroduced, and prints per-collection counts.

Then:

1. Compare the printed counts against production for customers, products,
   orders, bills, and payments.
2. Spot-check at least ten representative records.
3. Drop the verification database.
4. Record the restore date in the operations log.

Note that the verification restore needs a **write-capable** user on the
verification database — the read-only `tammewar_backup` user cannot perform it.
Use a temporary user scoped to `tammewar_restore_check` and remove it
afterwards.

Repeat this drill **at least quarterly**, and after any change to the tooling,
the Atlas cluster, or the MongoDB Database Tools version.

## Recovering production from a backup

This is the disaster path. Do it deliberately, not under time pressure.

1. Stop writes: in Render, suspend the service so the API cannot accept changes
   mid-restore.
2. Restore the chosen archive into a **new** verification database first and
   confirm its counts. Never restore straight over production.
3. Once verified, restore into the production database with `--drop`, using a
   temporary write-capable user, then remove that user.
4. Run `npm run atlas:verify` to confirm the application user still has exactly
   `readWrite` on `tammewar_pharmacy_prod` and nothing else.
5. Resume the Render service and confirm owner login and one read of each major
   screen.
6. Record what was lost: everything written after the archive's timestamp.

## What is deliberately not automated

There is no scheduled backup job inside the Render web service. Render Free
sleeps after 15 minutes of inactivity and has an ephemeral filesystem, so a job
there would run unpredictably and write to storage that disappears. See
`PRODUCTION_JOB_POLICY.md`. Scheduling belongs on the trusted administrator
device (Task Scheduler or `cron`) invoking `npm run backup:create` with
`BACKUP_PASSPHRASE` supplied from the password manager.

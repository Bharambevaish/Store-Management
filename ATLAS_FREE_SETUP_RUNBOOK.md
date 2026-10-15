# MongoDB Atlas Free Production-Pilot Setup

This runbook is for the named-owner, low-traffic pilot. MongoDB describes Free
clusters (formerly M0) as development/proof-of-concept deployments: they have
512 MB of storage, no managed backups, limited metrics/alerts, and automatic
pause after 30 days with no connections. These limitations are accepted only
for the initial pilot; Phase 9 establishes external encrypted backups.

Official references:

- [Deploy a Free Cluster](https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/)
- [Free Cluster Limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/)
- [Atlas MFA](https://www.mongodb.com/docs/atlas/security-multi-factor-authentication/)
- [Database Users](https://www.mongodb.com/docs/atlas/security-add-mongodb-users/)
- [Render to Atlas](https://render.com/docs/connect-to-mongodb-atlas)
- [Render Outbound IPs](https://render.com/docs/outbound-ip-addresses)

Never paste a password, connection string, recovery code, or API key into this
repository, a GitHub issue/PR, chat, screenshot, or shell-history command.

## 1. Account and project

1. Nikhil signs in to Atlas and creates or selects the production organization.
2. Configure two MFA methods on the account (authenticator/security key plus a
   backup method). In **Organization Settings**, enable **Require MFA**.
3. Create a dedicated project named `tammewar-pharmacy-production`. Do not put
   unrelated clusters or users in this project.
4. Give collaborators only the Atlas project role they actually need.

## 2. Free cluster

1. Select **Create**, then the **Free** / `M0` option. Do not load sample data.
2. Prefer AWS Singapore (`ap-southeast-1`) when Atlas offers it. Phase 10 must
   use Render Singapore as well. If unavailable, record the selected region and
   place Render in the matching/nearest available region.
3. Name the cluster `tammewar-pharmacy-prod`; Atlas cluster names cannot later
   be changed.
4. Set the application database name to `tammewar_pharmacy_prod` in both the
   Atlas URI path and Render's `MONGO_DB_NAME` environment variable.
   Keep Atlas's `retryWrites=true&w=majority` URI options.
5. Enable termination protection if the Free-cluster controls expose it.

## 3. Application database user

Create a SCRAM password user named `tammewar_app` with exactly:

- built-in role `readWrite` scoped to database `tammewar_pharmacy_prod`;
- access restricted to cluster `tammewar-pharmacy-prod`, if that control is
  available;
- no `Atlas admin`, `readWriteAnyDatabase`, `dbAdminAnyDatabase`, `clusterAdmin`,
  or access to another database.

Use an Atlas-generated long password. Store it only in the team password
manager and, when Phase 10 creates the service, Render's secret environment.
Do not save the URI in a local `.env` longer than required for an administered
verification session.

## 4. Network access

For Phase 8 migration, temporarily allowlist only the trusted administrator
device's current public IP and give the entry an expiry when Atlas supports it.
Never select **Allow Access from Anywhere** (`0.0.0.0/0`).

Render ranges cannot be added until the Render service exists. In Phase 10,
open that service's **Connect > Outbound** panel, copy every listed CIDR into
Atlas Network Access, verify the deployment, then remove the temporary
administrator IP after migration checks finish. Render says a service can use
any address in its regional outbound ranges; all listed ranges are required.

## 5. Alerts and protection

Free clusters support only limited alert conditions. Configure the available:

- **Logical Size** alert at 400 MB (before the 512 MB limit);
- **Connections** threshold warning;
- notification delivery to the two production administrators;
- Atlas project activity notifications for user, network, and cluster changes
  where the console offers them.

Record termination-protection and alert screenshots in the private operations
vault, not in GitHub.

## 6. Verification

From an allowlisted trusted device, inject `MONGO_URI` and
`MONGO_DB_NAME=tammewar_pharmacy_prod` from the password manager without placing
the URI in shell history, then run:

```powershell
cd backend
npm.cmd run atlas:verify
```

Expected output reports `atlasConnection: ok`, role `readWrite`, and unrelated
database access `denied`. The command is read-only: it lists collections in the
application database and attempts a read against a nonexistent probe database,
which must fail as unauthorized.

Phase 7 is complete only after M-10 through M-14 in
`MANUAL_PRODUCTION_TASKS.md` are checked and the verifier passes. Phase 8 cannot
start safely before this destination exists and MongoDB Database Tools are
installed on the trusted migration device.

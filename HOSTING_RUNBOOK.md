# Deployment runbook: Render, Cloudflare Pages, and go-live

Phases 10 through 13 of `PRODUCTION_DEPLOYMENT_TASKLIST.md`. This is a
self-service walkthrough — every step is one you perform, in order, with the
exact values to enter and the command that proves each step worked.

Also published as a formatted page, for following along away from the terminal:
<https://claude.ai/code/artifact/16dce23c-a22f-40ab-bb39-992cd22f12cd>

**Never paste a secret into this repository, a pull request, a GitHub issue, a
screenshot, or a chat message.** Secrets go from your password manager into the
platform's environment settings and nowhere else.

## What already exists

| | Value |
| --- | --- |
| Atlas org / project | `tammewar-pharmacy-production` / `tammewar_pharmacy_prod` |
| Atlas cluster | `tammewar-pharmacy-prod`, M0, AWS `AP_SOUTH_1` (Mumbai) |
| Database | `tammewar_pharmacy_prod` — currently empty |
| Database user | `tammewar_app`, `readWrite` on that database only |
| Repository | `Nikhil270703/Tammewar_Pharmacy`, private, `main` protected |
| Blueprint | `render.yaml` in the repository root |

**On regions:** the cluster is in Mumbai. Render Free offers Oregon, Ohio,
Virginia, Frankfurt, and Singapore — no Mumbai. Use **Singapore**: it is the
closest, and the cross-region hop costs a few tens of milliseconds per query,
which is irrelevant next to a Free-tier cold start. Do not move the cluster; an
Atlas cluster cannot be renamed or relocated in place.

---

## Step 0 — MFA before anything else (M-03)

Do this first. Once a service holds `JWT_SECRET` and the Atlas connection
string, its account password is equivalent to your production database.

1. **Render** → Account Settings → Two-Factor Authentication → enable.
2. **Cloudflare** → My Profile → Authentication → Two-Factor Authentication →
   enable.
3. **Atlas** → enable organization-wide **Require MFA** (Organization Settings).
   Confirm your own account has two MFA methods enrolled *before* you turn this
   on, or you can lock yourself out of your own organization.

Also check, while you are in the Atlas console: whether **termination
protection** is offered for a Free cluster. The API refuses it
(`TENANT_CLUSTER_UPDATE_UNSUPPORTED`). If the console does not offer it either,
record M-11 as not applicable — and note that the cluster then has no
deletion guard at all, which makes the Phase 9 backup the only recovery path.

---

## Step 1 — Generate the JWT secret

```bash
cd backend && npm run secret:generate
```

Copy the output straight into your password manager as a new entry. You will
paste it into Render in Step 2 and never again. It must be distinct from every
other password you hold (M-08).

---

## Step 2 — Create the Render web service (M-19)

Render needs access to a private repository, so this authorizes Render's GitHub
App on `Nikhil270703/Tammewar_Pharmacy`. That is unavoidable for a private repo
and is a deliberate trust decision: Render gains read access to your source.

### Option A — Blueprint (recommended)

1. Render Dashboard → **New** → **Blueprint**.
2. Connect the GitHub repository. Grant access to **only this repository**, not
   all repositories.
3. Render reads `render.yaml` and proposes the service. It will prompt for the
   four values marked `sync: false` — see Step 3.

### Option B — By hand

Render Dashboard → **New** → **Web Service**, then:

| Setting | Value |
| --- | --- |
| Repository | `Nikhil270703/Tammewar_Pharmacy` |
| Branch | `main` |
| Root directory | `backend` |
| Runtime | Node |
| Region | Singapore |
| Instance type | Free |
| Build command | `npm ci --omit=dev` |
| Start command | `npm start` |
| Health check path | `/health` |
| Auto-deploy | On (commits to `main` only) |
| Pull request previews | **Disabled** |

Disabling PR previews matters: a preview would otherwise inherit production
environment variables and reach the production database.

---

## Step 3 — Environment variables

Enter these in Render → your service → **Environment**. The non-secret ones are
already in `render.yaml` if you used the Blueprint.

```env
NODE_ENV=production
HOST=0.0.0.0
TRUST_PROXY=1
JWT_ISSUER=tammewar-pharmacy
JWT_AUDIENCE=tammewar-pharmacy-api
JWT_EXPIRES_IN=2h
CUSTOMER_JWT_EXPIRES_IN=2h
AUTO_SEED=false
PAYMENTS_ALLOW_MOCK=false
ONLINE_RESTORE_ENABLED=false
INTERNAL_AUTH_ENABLED=false
WHATSAPP_ENABLED=false
MONGO_DB_NAME=tammewar_pharmacy_prod
```

Then the four secrets, from your password manager:

| Key | Value |
| --- | --- |
| `MONGO_URI` | The Atlas SRV string for `tammewar_app`, ending `/tammewar_pharmacy_prod?retryWrites=true&w=majority` |
| `JWT_SECRET` | The output of Step 1 |
| `CORS_ORIGINS` | `https://placeholder.invalid` until Step 7 replaces it — see below |

**`CORS_ORIGINS` cannot be a loose placeholder.** The startup gate requires
every entry to be a bare `https` origin, so `placeholder`, `TBD`, an empty
value, or a trailing slash all abort the deploy. Use
`https://placeholder.invalid` until Step 7: it is a valid origin, `.invalid` is
reserved by RFC 2606 and can never resolve, and no real browser origin will
ever match it — so the service starts while still granting CORS permission to
nobody.

Three more things that will otherwise cost you an afternoon:

- **Do not set `PORT`.** Render injects it, and the server refuses to start in
  production if the platform did not supply one.
- **`TRUST_PROXY=1` is required.** Render terminates TLS one hop in front of the
  service. Without it, every request appears to come from the same address and
  the per-IP login rate limit stops discriminating between callers.
- **`MONGO_DB_NAME` must match the database in `MONGO_URI`.** The cluster and
  the database differ only by hyphens versus underscores, and pasting the
  cluster name into the URI path is the easy mistake:

  | | Value | Where it belongs |
  | --- | --- | --- |
  | Cluster | `tammewar-pharmacy-prod` (hyphens) | The hostname only |
  | Database | `tammewar_pharmacy_prod` (underscores) | The end of the URI path, and `MONGO_DB_NAME` |

  ```text
  mongodb+srv://tammewar_app:PASSWORD@tammewar-pharmacy-prod.zxl08z5.mongodb.net/tammewar_pharmacy_prod?retryWrites=true&w=majority
                                      └─ cluster, hyphens ─┘                     └─ database, underscores ─┘
  ```

  Startup verifies both and names each side if they disagree. Note the database
  does not exist until the first write, so there is nothing to look up in
  Atlas — the name is declared here, not discovered.

The server validates this entire set at boot. A misconfiguration fails the
deploy loudly rather than starting with a weaker security posture, and
`backend/test/productionConfig.test.js` asserts the same rules locally.

---

## Step 4 — Let Render reach Atlas

The first deploy will fail to connect until this is done.

1. Render → your service → **Connect** → **Outbound**. Copy **every** listed
   CIDR.
2. Atlas → Network Access → add each one. A partial list produces intermittent,
   maddening connection failures, because Render may use any address in its
   regional range.
3. Remove the temporary administrator entries
   (`103.251.209.156/32`, `103.251.209.136/32`) once the deploy is verified.
   Note that your address is dynamic — it already drifted once during setup — so
   re-add one only for the duration of a maintenance session.

Verify:

```bash
curl -s https://<render-service>.onrender.com/health
# {"ok":true}

curl -s https://<render-service>.onrender.com/ready
# {"ready":true}   <- 503 means Atlas is not reachable yet
```

`/ready` fails closed. If it returns `{"ready":false}` with a 503, the
allowlist or the connection string is wrong.

---

## Step 5 — Create the owner account (M-22)

The service is running but has no account. Create exactly one, from your
machine, with the Atlas allowlist entry still in place:

```bash
cd backend
MONGO_URI='<atlas uri>' MONGO_DB_NAME=tammewar_pharmacy_prod npm run owner:create
```

It refuses to run if any user already exists, prompts for email, name, mobile,
and password with echo disabled, and enforces 16+ characters with upper, lower,
and a digit. **Store the password in the password manager immediately** — it
cannot be recovered from the database.

Then confirm the database holds exactly what you expect:

```bash
AUDIT_MONGO_URI='<atlas uri>' npm run data:audit
```

Expect one user, and the unique indexes on `users.email`, `customers.mobile`,
and `bills.invoiceNumber`. Keep this output — it is the zero baseline.

---

## Step 6 — Deploy the frontend (M-20)

Decide the deployment model first. **This is fixed at creation time**; changing
it later means deleting and recreating the project.

### Direct upload — no repository access

Cloudflare never touches your repo, and there are no preview deployments to
isolate. Two Phase 11 requirements satisfied by construction. The cost is that a
release is a deliberate command rather than automatic on push.

```bash
wrangler login                      # browser OAuth
wrangler pages project create tammewar-pharmacy --production-branch main

cd frontend
VITE_API_BASE_URL=https://<render-service>.onrender.com/result-analysis npm run build
wrangler pages deploy dist --project-name tammewar-pharmacy
```

Every subsequent release is the last two commands.

### Git-connected — auto-deploys on push

Dashboard only; wrangler cannot create this kind of project. Cloudflare Pages →
Create → Connect to Git, then:

| Setting | Value |
| --- | --- |
| Root directory | `frontend` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Production branch | `main` |
| Preview deployments | **Disable**, or restrict to no branches |

Build environment variable:

```env
VITE_API_BASE_URL=https://<render-service>.onrender.com/result-analysis
```

`VITE_*` values are compiled into the browser bundle. **Never put a secret in
one.** The build fails outright if `VITE_API_BASE_URL` is missing, so a bundle
pointing at the wrong API cannot be produced silently.

### Headers are generated, not configured

`frontend/build/cloudflarePagesAssets.js` emits `_headers`, `_redirects`, and
`robots.txt` into `dist` at build time, deriving the CSP's `connect-src` from
`VITE_API_BASE_URL`. The policy therefore cannot drift from the API the bundle
actually calls, and the build refuses a non-HTTPS API URL. You do not configure
any of this in the dashboard.

Verify after deploying:

```bash
curl -sI https://<project>.pages.dev | grep -iE 'content-security-policy|strict-transport|x-robots-tag'
curl -s  https://<project>.pages.dev/robots.txt
```

---

## Step 7 — Lock down CORS (M-21)

Now that the frontend origin exists, set it in Render → Environment:

```env
CORS_ORIGINS=https://tammewar-pharmacy.pages.dev
```

Add a custom domain as a second comma-separated origin if you use one. The
server refuses at boot any list containing `*`, a wildcard hostname, `http://`,
`localhost`, or a trailing path — so a mistake here fails the deploy rather than
quietly widening the boundary.

Verify against the live API:

```bash
# The production origin is granted.
curl -sI -H 'Origin: https://tammewar-pharmacy.pages.dev' \
  https://<render-service>.onrender.com/health | grep -i access-control-allow-origin

# A lookalike is not. Expect no output.
curl -sI -H 'Origin: https://tammewar-pharmacy.pages.dev.attacker.test' \
  https://<render-service>.onrender.com/health | grep -i access-control-allow-origin

# CORS is not authentication: a direct call still needs a token.
curl -s https://<render-service>.onrender.com/result-analysis/customers
# {"error":"Authentication required"}
```

---

## Step 8 — Cloudflare Access as a second factor (M-23)

The application has no in-app TOTP. Access puts an identity gate in front of the
frontend so a stolen owner password alone does not reach the login screen.

1. Zero Trust → **Access → Applications → Add a self-hosted application**,
   covering the Pages hostname.
2. Policy: **Allow**, matched on the owner's email address only.
3. Identity provider: one-time PIN to that address, or a Google/Microsoft
   account already protected by MFA.
4. Leave the application's own login in place.

**Know its limit.** Access gates the browser path to the UI. The API origin is
not behind it and remains reachable directly, protected only by the owner
password and the JWT. Treat this as defence in depth, not as the owner's MFA.

---

## Step 9 — Before handing over

- [ ] Read the Render build and runtime logs and confirm no secret value appears
      in them.
- [ ] Deploy twice and use **Rollback** once, so you know the path works before
      you need it.
- [ ] Confirm no secret reached the bundle:
      `grep -rEi "mongodb\+srv|JWT_SECRET|rzp_live|-----BEGIN" frontend/dist/`
- [ ] Sign in as the owner, change the password from **Settings → Security**,
      and confirm a second browser session is signed out.
- [ ] Leave the app idle 15 minutes, then load it. The first request should show
      a waking-up state and succeed within about a minute — not an error, and
      not "invalid password".
- [ ] Set up the backup schedule (M-16, M-17) and run one real restore drill
      (M-18) once the owner has entered records. **With no prior system, the
      production database is the only copy of their data from the moment they
      start typing.**
- [ ] Walk the owner through `OWNER_ACCOUNT_RUNBOOK.md`: cold starts, why a
      refresh signs them out, password hygiene, and reporting anything odd the
      same day.

---

## Things that will look like bugs but are not

| Symptom | Cause |
| --- | --- |
| First request after idle takes ~1 minute | Render Free sleeps after 15 minutes. Expected; the UI shows a waking-up state. |
| Refreshing the browser signs the owner out | The token is held in memory only and never written to browser storage. Deliberate. |
| `/ready` returns 503 | Atlas is unreachable — usually a missing Render outbound CIDR in the allowlist. |
| Deploy fails at startup with a config error | The environment gate is working. Read the message; it names the exact variable. |
| Intermittent database connection failures | A partial Render outbound CIDR list. Add every range, not the first few. |

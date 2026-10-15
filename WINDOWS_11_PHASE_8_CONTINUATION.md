# Windows 11 Phase 8 Continuation Guide

Last updated: 2026-08-19

This guide reproduces the trusted local environment on a Windows 11
administrator computer and continues Phase 8 (data validation and migration).
It does not authorize production go-live. Work only on the
`agent/phase-8-data-migration` branch and keep `main` protected.

## Current state and safety boundary

- Atlas Phase 7 is complete.
- `data/db-local` was audited from a disposable copy. It contains no customers,
  products, orders, bills, or payments, so it is not authoritative.
- `data/db-repaired` is the remaining likely source, but it has not yet been
  proven authoritative. It uses MongoDB feature compatibility version 8.3.
- The Windows 10 computer cannot load MongoDB 8.3. Do not edit the feature
  compatibility document to bypass that restriction.
- None of the original `data` database directories was opened or modified
  during Phase 8 investigation.
- The local database directories, `.env`, `.runtime`, archives, logs,
  `node_modules`, and browser-session data are intentionally ignored by Git.

Never paste a password, Atlas URI, recovery code, token, customer record, or
unencrypted database into Git, GitHub, chat, screenshots, or a cloud drive.

## 1. Confirm the published continuation branch

The initial Phase 8 handoff was committed and pushed to
`origin/agent/phase-8-data-migration` on 2026-08-19. Before changing computers,
confirm that the original worktree is clean and the local and remote branch
commits match:

```powershell
cd C:\Users\ashis\Projects\Nikhil_projects\Tammewar_Pharmacy
git fetch origin agent/phase-8-data-migration
git status -sb
git rev-parse HEAD
git rev-parse origin/agent/phase-8-data-migration
```

The two hashes must match and status must show no tracked changes. Draft PR #7
is the handoff PR and must remain draft until Phase 8 is complete. Never add
`data`, `.runtime`, `.env`, logs, archives, or database files to Git.

## 2. Create an encrypted transfer of the local source stores

Perform this on the original computer with MongoDB stopped. Confirm that the
following returns no process:

```powershell
Get-Process mongod -ErrorAction SilentlyContinue
```

The current source folders are approximately:

| Folder | Files | Size | Meaning |
| --- | ---: | ---: | --- |
| `data/db` | 63 | 203 MB | Original damaged store; retain as a recovery fallback |
| `data/db-repaired` | 65 | 303 MB | Repaired FCV 8.3 candidate; audit first |
| `data/db-local` | 61 | 202 MB | Known non-authoritative development store |

Create a file-level checksum manifest without placing it inside a MongoDB
`dbPath`:

```powershell
$dataRoot = (Resolve-Path .\data).Path
$manifest = Get-ChildItem -LiteralPath $dataRoot -Recurse -File |
  Where-Object Name -ne 'TRANSFER_MANIFEST.csv' |
  Sort-Object FullName |
  ForEach-Object {
    [pscustomobject]@{
      RelativePath = $_.FullName.Substring($dataRoot.Length + 1)
      Length = $_.Length
      SHA256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash
    }
  }
$manifest | Export-Csv -NoTypeInformation -Encoding UTF8 `
  .\data\TRANSFER_MANIFEST.csv
```

Install the current [7-Zip](https://www.7-zip.org/) from its official site. In
7-Zip File Manager, select the top-level `data` folder and create a `.7z`
archive with:

- archive format: `7z`;
- encryption method: `AES-256`;
- **Encrypt file names** enabled;
- a new random password stored in the password manager, not on the transfer
  drive.

Do not include `.git`, `backend/.env`, `.wwebjs_auth`, `node_modules`, or old
runtime ZIP downloads. Test the encrypted archive in 7-Zip, then record its
transport checksum:

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath D:\transfer\tammewar-data.7z
```

Copy only the encrypted archive and its non-secret SHA-256 checksum to trusted
removable storage. Keep the password separate. Retain the original computer's
database offline until Atlas verification and the Phase 9 restore test pass.

## 3. Prepare the Windows 11 computer

Fully update Windows 11, enable device encryption/BitLocker, use a named
administrator account with MFA where applicable, and do not expose MongoDB to
the network.

Install these tools from their official sources:

- [Git for Windows](https://git-scm.com/download/win)
- [GitHub CLI](https://cli.github.com/) (optional, needed to open the PR)
- [Node.js](https://nodejs.org/en/download): use Node `26.3.0` with npm
  `11.16.0` to reproduce the original environment
- [MongoDB Community Server archive](https://www.mongodb.com/try/download/community-edition/releases):
  Windows x64 ZIP, version `8.3.7`
- [MongoDB Database Tools archive](https://www.mongodb.com/try/download/database-tools/releases/archive):
  Windows x64 ZIP, version `100.17.0`
- [7-Zip](https://www.7-zip.org/)

Use portable MongoDB ZIPs; do not install MongoDB as a Windows service. Extract
them under the repository's ignored `.runtime` directory with these expected
paths:

```text
.runtime/mongodb-win32-x86_64-windows-8.3.7/bin/mongod.exe
.runtime/mongodb-database-tools-windows-x86_64-100.17.0/bin/mongodump.exe
.runtime/mongodb-database-tools-windows-x86_64-100.17.0/bin/mongorestore.exe
```

Verify the environment:

```powershell
node --version
npm.cmd --version
git --version
& .\.runtime\mongodb-win32-x86_64-windows-8.3.7\bin\mongod.exe --version
& .\.runtime\mongodb-database-tools-windows-x86_64-100.17.0\bin\mongodump.exe --version
& .\.runtime\mongodb-database-tools-windows-x86_64-100.17.0\bin\mongorestore.exe --version
```

Expected key versions are Node `v26.3.0`, npm `11.16.0`, MongoDB `8.3.7`, and
Database Tools `100.17.0`.

## 4. Clone the private repository and restore dependencies

Authenticate GitHub with the named collaborator account, then clone the
sanitized repository. Do not reuse an old pre-history-rewrite clone.

```powershell
New-Item -ItemType Directory -Force C:\Projects | Out-Null
cd C:\Projects
git clone https://github.com/Nikhil270703/Tammewar_Pharmacy.git
cd Tammewar_Pharmacy
git fetch origin
git switch --track origin/agent/phase-8-data-migration
git status -sb

cd backend
npm.cmd ci
npm.cmd test
npm.cmd audit --omit=dev --audit-level=high

cd ..\frontend
npm.cmd ci
npm.cmd audit --audit-level=high
npm.cmd run build

cd ..
git status -sb
```

The final status should contain no dependency or build artifacts. They are
ignored and must not be committed.

## 5. Receive and verify the encrypted source

Copy the encrypted transfer into `.runtime/incoming`. First compare the archive
SHA-256 with the value recorded on the original computer. Extract it with 7-Zip
to `.runtime/incoming/source`; never extract it over the repository's `data`
folder.

Verify every transferred database file against the included manifest:

```powershell
$sourceRoot = (Resolve-Path .\.runtime\incoming\source\data).Path
$expected = Import-Csv `
  .\.runtime\incoming\source\data\TRANSFER_MANIFEST.csv
$actual = Get-ChildItem -LiteralPath $sourceRoot -Recurse -File |
  Where-Object Name -ne 'TRANSFER_MANIFEST.csv' |
  ForEach-Object {
    [pscustomobject]@{
      RelativePath = $_.FullName.Substring($sourceRoot.Length + 1)
      Length = [string]$_.Length
      SHA256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash
    }
  }

$differences = Compare-Object $expected $actual `
  -Property RelativePath, Length, SHA256
$differences
```

No output means the file-level verification passed. If any difference appears,
stop and repeat the encrypted transfer.

## 6. Audit the repaired candidate from a disposable copy

Never start `mongod` against the extracted source itself. Make a disposable
working copy:

```powershell
New-Item -ItemType Directory -Force .\.runtime\phase8-forensics | Out-Null
Copy-Item -LiteralPath `
  .\.runtime\incoming\source\data\db-repaired `
  -Destination .\.runtime\phase8-forensics\db-repaired `
  -Recurse
```

Start MongoDB bound only to localhost:

```powershell
$mongod = (Resolve-Path `
  .\.runtime\mongodb-win32-x86_64-windows-8.3.7\bin\mongod.exe).Path
$dbPath = (Resolve-Path `
  .\.runtime\phase8-forensics\db-repaired).Path
$logPath = Join-Path (Resolve-Path .\.runtime\phase8-forensics).Path `
  'db-repaired-mongod.log'

$mongoProcess = Start-Process -FilePath $mongod `
  -ArgumentList @(
    '--dbpath', $dbPath,
    '--bind_ip', '127.0.0.1',
    '--port', '27029',
    '--logpath', $logPath,
    '--logappend'
  ) `
  -WindowStyle Hidden `
  -PassThru
$mongoProcess.Id
```

Wait several seconds, then run the aggregate-only audit. It reports counts,
totals, index definitions, duplicate groups, demo indicators, credential-risk
counts, and redacted structural reviews; it does not print customer values or
credential values.

```powershell
cd backend
$env:MIGRATION_SOURCE_URI = `
  'mongodb://127.0.0.1:27029/?directConnection=true'
node .\scripts\auditMigrationDatabase.js |
  Tee-Object ..\.runtime\phase8-forensics\db-repaired-audit.json
Remove-Item Env:MIGRATION_SOURCE_URI
cd ..
```

When finished, stop only the process ID returned above:

```powershell
Stop-Process -Id $mongoProcess.Id
```

The copy may require recovery after that stop; this is acceptable because it is
disposable. Never substitute the extracted source path for `$dbPath`.

## 7. Authoritative-source decision gate

Do not migrate merely because `db-repaired` opens. Review its audit and confirm:

1. It contains the expected real customers (approximately 250) and plausible
   products, vendors, bills, orders, and payments.
2. Inventory, billed, outstanding, payment, order, and expense totals agree
   with the pharmacy owner's records.
3. Date ranges match the period in which the business used the application.
4. The known dummy seeder signatures are not being mistaken for business data.
5. Only the intended owner application account will remain.
6. Password fields contain recognized hashes; provider token and plaintext
   credential counts are zero after cleanup.

If the repaired candidate is empty, implausible, or missing expected records,
stop. Do not upload it. Preserve the audit and arrange recovery of a disposable
copy of `data/db`; that damaged original may require `mongod --repair`, and the
repair must never run against the only copy.

Before deleting anything, make a second disposable copy and obtain the pharmacy
owner's written confirmation of the exact demo records, duplicate winners, and
development accounts to remove. Demo-name matching is evidence for review, not
permission to delete. Re-run the audit after cleanup; that clean audit is the
source baseline used for every comparison below.

## 8. Create and encrypt the logical dump

With the cleaned disposable source running on port 27029, determine the source
database name from the audit report. The historical name is likely
`student_information_system`, but do not assume it.

```powershell
New-Item -ItemType Directory -Force .\.runtime\migration | Out-Null
$sourceDb = 'student_information_system' # replace if the audit reports another name
$dumpTool = (Resolve-Path `
  .\.runtime\mongodb-database-tools-windows-x86_64-100.17.0\bin\mongodump.exe).Path

& $dumpTool `
  --uri='mongodb://127.0.0.1:27029/?directConnection=true' `
  --db=$sourceDb `
  --archive=.\.runtime\migration\source-clean.archive.gz `
  --gzip
if ($LASTEXITCODE -ne 0) { throw 'mongodump failed' }
```

Specifying one application database excludes MongoDB database users and roles.
The `.gz` file is compressed, not encrypted. Immediately encrypt it in 7-Zip
using AES-256, encrypted file names, and a new password stored separately. Test
the encrypted archive before moving or deleting the temporary plaintext dump.
Never upload the plaintext `.gz` file.

## 9. Verify Atlas access without saving its URI

Temporarily allowlist only the Windows 11 computer's public IP in Atlas. Never
use `0.0.0.0/0`. Read the Atlas URI as a secure prompt, convert it only into the
current process environment, verify access, and clear it afterward:

```powershell
cd backend
$secureAtlasUri = Read-Host 'Atlas URI' -AsSecureString
$env:MONGO_URI = [System.Net.NetworkCredential]::new(
  '', $secureAtlasUri
).Password
$env:MONGO_DB_NAME = 'tammewar_pharmacy_prod'
npm.cmd run atlas:verify
Remove-Item Env:MONGO_URI
Remove-Item Env:MONGO_DB_NAME
$secureAtlasUri = $null
cd ..
```

The expected result is `atlasConnection: ok`, exact `readWrite` access to
`tammewar_pharmacy_prod`, and denial for an unrelated database.

## 10. Restore into the empty production database

Confirm in Atlas that `tammewar_pharmacy_prod` is empty before restoring. If it
contains any document, stop and investigate; do not use `--drop` casually.

Decrypt the clean logical dump locally. Then inject the Atlas URI through the
same secure prompt and restore with namespace mapping:

```powershell
$restoreTool = (Resolve-Path `
  .\.runtime\mongodb-database-tools-windows-x86_64-100.17.0\bin\mongorestore.exe).Path
$secureAtlasUri = Read-Host 'Atlas URI' -AsSecureString
$env:MONGO_URI = [System.Net.NetworkCredential]::new(
  '', $secureAtlasUri
).Password
$sourceDb = 'student_information_system' # use the audited source name

& $restoreTool `
  --uri=$env:MONGO_URI `
  --archive=.\.runtime\migration\source-clean.archive.gz `
  --gzip `
  --nsInclude="$sourceDb.*" `
  --nsFrom="$sourceDb.*" `
  --nsTo='tammewar_pharmacy_prod.*' `
  --stopOnError `
  --maintainInsertionOrder
$restoreExit = $LASTEXITCODE

Remove-Item Env:MONGO_URI
$secureAtlasUri = $null
if ($restoreExit -ne 0) { throw "mongorestore failed: $restoreExit" }
```

Do not restore `admin`, `config`, `local`, database users, or database roles.

## 11. Reconcile source and destination

Run the same audit against Atlas, again injecting the URI only into the current
process:

```powershell
cd backend
$secureAtlasUri = Read-Host 'Atlas URI' -AsSecureString
$env:MIGRATION_SOURCE_URI = [System.Net.NetworkCredential]::new(
  '', $secureAtlasUri
).Password
$env:MIGRATION_DB_NAME = 'tammewar_pharmacy_prod'
node .\scripts\auditMigrationDatabase.js |
  Tee-Object ..\.runtime\migration\atlas-audit.json
Remove-Item Env:MIGRATION_SOURCE_URI
Remove-Item Env:MIGRATION_DB_NAME
$secureAtlasUri = $null
cd ..
```

Compare the clean source and Atlas reports. All of these must match exactly:

- collection and document counts;
- inventory units, reserved units, retail value, and purchase value;
- billed total, outstanding balance, recorded payments, order total, and
  expenses;
- status-group counts;
- duplicate summaries and credential-risk counts;
- index keys and unique constraints.

In Atlas Data Explorer, manually inspect at least ten representative records
across customers, products, bills, payments, and orders. Confirm relationships,
dates, amounts, stock, and required fields without copying records into Git or
screenshots. Record only a non-sensitive pass/fail note.

If any comparison differs, stop. Do not configure Render against the database
until the mismatch is explained and corrected.

## 12. Complete Phase 8 and hand off through GitHub

After every Phase 8 checkbox has objective evidence:

1. Mark the completed Phase 8 items in `PRODUCTION_DEPLOYMENT_TASKLIST.md`.
2. Mark M-15 complete in `MANUAL_PRODUCTION_TASKS.md` and summarize the
   supported host used without recording secrets or customer data.
3. Record only aggregate totals and tool versions in repository documentation.
4. Keep the original raw database and clean logical dump encrypted and offline.
5. Remove the temporary Atlas migration IP after Render's Phase 10 ranges are
   configured; until then, keep it narrowly scoped and expiring.
6. Run verification:

```powershell
cd backend
npm.cmd test
npm.cmd audit --omit=dev --audit-level=high

cd ..\frontend
npm.cmd audit --audit-level=high
npm.cmd run build

cd ..
git diff --check
git status --short
```

Commit only source and documentation, push
`agent/phase-8-data-migration`, and open a draft pull request to protected
`main`. Never attach an audit report containing data, a dump, an archive, a log,
or an environment file to the pull request.

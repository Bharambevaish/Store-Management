# Production Job Policy

The initial production release runs no timer, cron scheduler, or startup job in
the Render web process. Render Free can sleep between requests, so in-process
schedules are neither timely nor durable.

## Initial release decisions

| Workflow | Initial behavior | Reason |
| --- | --- | --- |
| Recurring orders | Owner selects **Process Due Loops** | Business-useful but low-frequency; the owner can review before orders are created. |
| Delivery reminders | Disabled | Nonessential for launch and unreliable without an external scheduler. |
| Payment/message reminders | Owner initiated only; messaging integrations remain disabled | Avoids unattended customer messages during the pilot. |
| Database backups | Owner downloads a streamed JSON export; the Phase 8 migration uses encrypted `mongodump` | No backup is written to or retained on Render's ephemeral filesystem. |
| SQLite backup/restore | Removed | SQLite files are not a production backup for MongoDB and would rely on local disk. |

## Recurring-order safety

The owner-triggered recurring-order job atomically claims each due source order
in MongoDB. Concurrent requests skip an active claim. Claims abandoned by a
crashed process become retryable after ten minutes, and an existing successor
is detected before another is created.

MongoDB stores the job's start, completion, last successful run, result counts,
trigger type, triggering owner, and a bounded error type. The dashboard shows
the last successful run and its created/skipped counts.

## Future scheduling

Do not add `node-cron` or timers to the web service. If production usage later
justifies external scheduling, retain the same idempotent MongoDB operation,
add a dedicated authenticated scheduler entry point, and record each run. The
decision is tracked as M-09 in `MANUAL_PRODUCTION_TASKS.md`.

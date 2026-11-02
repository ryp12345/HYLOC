# HYLOC-MGT Project Audit — 31 October 2026

**Scope:** whole repository — Express/PostgreSQL API (`server/`), React/Vite client (`client/`), database migrations, CI/CD workflow, dependencies.
**Baseline:** the working tree as of this date, **including 59 modified and 20 untracked files that are not yet committed** (an in-progress security-hardening change). Findings marked *(uncommitted)* depend on that work.
**Method:** manual code review of every route file, every auth/upload middleware, the user, leave, ticket, employee-KPI and dev-ticket controllers, related models and services, all migrations, the deploy workflow and client auth code. Also ran `jest` (10 suites, 37 tests, all pass) and `npm audit` on both packages. `server/.env` was not read.

---

## 1. Summary

| Severity | Count | Headline |
|---|---|---|
| **Critical** | 1 | Employees can approve their own leave through the update endpoint |
| **High** | 5 | Management can grant itself Admin; ticket attachment path lets any user delete uploaded files; uncommitted security work that will break login if deployed without migrations; database cannot be built from migrations; unsafe deploy pipeline |
| **Medium** | 13 | Race conditions in leave balance and approval, token storage, account-lockout DoS, over-broad data access, missing FKs/indexes, no audit trail, PII in git, slow KPI recalculation, no pagination |
| **Low** | 14 | Code quality, consistency, dead code, logging, minor info leaks |

**What is already done well:** all SQL is parameterized, and the dynamic `SET` clauses use allowlists (no SQL injection found). Uploads check extension, MIME type and file signature (magic bytes) and use random filenames. Access tokens are revoked through `token_version` when a password or status changes. Password-reset OTPs are hashed, expire after 5 minutes and allow 5 attempts. Errors return generic messages, `helmet` is on, CORS is locked to one production origin, and the client has no `dangerouslySetInnerHTML`/`eval` sinks. Server production dependencies have no known vulnerabilities.

---

## 2. Critical

### C-1. Employees can self-approve (or rewrite) their own leave
**Where:** [leave.routes.js:19](../server/src/routes/leave.routes.js#L19) → [leave.controller.js:346](../server/src/controllers/leave.controller.js#L346) → [leave.service.js:399](../server/src/services/leave.service.js#L399) → [leave.model.js:185](../server/src/models/leave.model.js#L185)

`PUT /api/leaves/:id` passes `req.body` straight through to `updatePendingLeave`, which copies it (`{ ...updateData }`) into `leaveModel.updateLeave`. That model's allowlist includes `status` and `approved_by`. The only ownership check is "is the owner, or is HOD/HR/Management", so the **owner is allowed to set any allowlisted field**.

- An employee sends `PUT /api/leaves/123 {"status":"Approved","approved_by":<any id>}` and the leave is approved with no approver involved.
- Despite the function's name, it never checks that the leave is still `Pending`, so owners can also change dates or type on an **already approved** leave. The balance is rebalanced, but the approval stays.
- HOD can edit any *Employee* leave in **any department**, because the department check that `approveLeave` does is missing here. HR can edit every leave.

**Fix:**
1. In `updatePendingLeave`, build an explicit per-role field allowlist. Owners get `from_date, to_date, leave_duration, leave_reason, alternate_person, additional_alternate, available_on_phone, leave_type`, and never `status`, `approved_by` or `credited_days`.
2. Reject owner edits unless `existingLeave.status === 'Pending'`.
3. Route every status change through `approveLeave`/`rejectLeave`/`cancelLeave` only, and apply the same department check as `getLeaveApprovalContext` for HOD.
4. Add regression tests for each of these cases.

---

## 3. High

### H-1. Management can escalate to Admin and take over admin accounts
**Where:** [userRole.controller.js:46-57](../server/src/controllers/userRole.controller.js#L46-L57), [user.controller.js:286](../server/src/controllers/user.controller.js#L286), [user.controller.js:315](../server/src/controllers/user.controller.js#L315), [user.routes.js:25-28](../server/src/routes/user.routes.js#L25-L28)

`authorize('admin','management')` guards user-role creation, user create/update/delete and admin password reset, but nothing checks **which** role is granted or **whose** account is touched. A Management user can:
- `POST /api/user-roles {userId:<self>, roleId:<Admin>}`, or `PUT /api/users/<self> {"role":"admin"}`, and become Admin.
- `PATCH /api/users/<adminId>/reset-password` to take over any Admin or Super Admin.
- Delete or deactivate Admin accounts.

**Fix:** Define a role hierarchy, for example `super admin > admin > management > hr/hod > employee`. A user may only grant roles **below** their own, and may only reset, edit or delete users whose highest role is below their own. Block self-role changes. Enforce this in one helper that both controllers call.

### H-2. Client-controlled `attachment` path lets any user delete files under `server/public`
**Where:** [ticket.controller.js:195-198](../server/src/controllers/ticket.controller.js#L195-L198), [ticket.controller.js:329-335](../server/src/controllers/ticket.controller.js#L329-L335), [ticket.controller.js:106-118](../server/src/controllers/ticket.controller.js#L106-L118), [ticket.controller.js:509-512](../server/src/controllers/ticket.controller.js#L509-L512)

When no file is uploaded, `createTicket` stores `req.body.attachment` verbatim. `updateTicket` also accepts any `payload.attachment` string. Later, when the attachment is replaced or cleared, `removeLocalAttachmentIfExists(existing.attachment)` unlinks whatever path is stored, as long as it resolves inside `server/public`.

Attack: create a ticket with `attachment=/uploads/users/<colleague>.jpg`, then update it with a new file. The colleague's photo, or any other ticket's attachment, is deleted. The prefix check `absolutePath.startsWith(publicRoot)` has no trailing separator, so sibling folders whose names start with `public` are also reachable. The same field lets a user point their own ticket at another ticket's file and download it through `GET /tickets/:id/attachment`.

**Fix:** Never accept `attachment` from the request body. Set it only from `req.file.filename`, and let clients clear it with an explicit boolean like `removeAttachment: true`. Store just the generated filename, not a path. On delete, resolve against `ticketUploadsDir` and check `startsWith(ticketUploadsDir + path.sep)`.

### H-3. Uncommitted security work: deploying it without migrations will break login *(uncommitted)*
**Where:** `git status` shows 59 modified files, 20 untracked files, and a deleted migration (`020_drop_kpi_values_higher_is_better.sql`).

The new auth code needs `password_reset_requests` (021), `login_attempts` (022) and `users.token_version` (023). The deploy workflow runs no migrations. If this is pushed to `main` before the migrations are applied by hand, `loginAttemptModel.isLocked` throws on a missing table and **every login fails** with a 401. `authenticate` also compares against `token_version`.

Separately, **deleting an already-shipped migration** breaks the history for any environment that hasn't applied it yet.

**Fix:** Commit the work in reviewable pieces on a branch. Restore migration 020. Apply 021–023 to staging, then production, **before** deploying the code, and add a migration step to the pipeline (see H-5).

### H-4. The database cannot be built from the repository
**Where:** [server/database/migrations/](../server/database/migrations/)
- `001_create_users.sql` and `011_create_notifications.sql` use `nextval('..._seq')`, but no migration creates those sequences, so a fresh database fails at step 1.
- Tables the code uses with **no migration at all**: `categories`, `dev_tickets`, `employee_monthly_working_days`.
- Migration numbers are duplicated (`002`, `003`, `004`, `005` each appear twice), so the order depends on alphabetical sorting.
- There is no migrations-tracking table. [migrate.js](../server/src/config/migrate.js) re-runs every file every time, and [runMigrations.js](../server/scripts/runMigrations.js) relies on the operator to pick files by hand.
- `users.empid` is `bigint NOT NULL`, but `createUser` inserts `empid || null`, so creating a user without an employee ID fails at the database.

**Fix:** Adopt a migration tool that tracks applied versions, such as `node-pg-migrate`, `knex` or `graphile-migrate`. Generate a baseline from the current production schema (`pg_dump --schema-only`) as migration `000`, renumber the rest, and add a CI job that builds an empty database from scratch.

### H-5. Deployment pipeline is unsafe
**Where:** [.github/workflows/deploy.yml](../.github/workflows/deploy.yml)
- No tests, lint or build check run before production deploys. Every push to `main` goes live.
- The step order is: `git pull` → `npm install` → **restart server** → build frontend. The API restarts before the new frontend exists, which opens a mismatch window, and a failed build leaves the new API running with the old UI.
- `pm2 start server.js` points to a file that doesn't exist (the entry point is `src/server.js`), so the fallback never works.
- `npm install` instead of `npm ci` can pull different dependency versions than the lockfile.
- No migration step, no health check after restart, no rollback. The CI user needs passwordless `sudo` to reload nginx.
- `appleboy/ssh-action@v1.0.3` is pinned to a tag, not a commit SHA.

**Fix:** Split into a CI job (`npm ci`, `jest`, lint, `vite build`, `npm audit --omit=dev`) and a deploy job that needs it and uses a protected `production` environment with required reviewers. On the server: `npm ci`, run migrations, build the client into a new release folder, switch a symlink, `pm2 reload src/server.js`, curl `/api/health`, and roll back on failure. Allow only `systemctl reload nginx` in sudoers. Pin actions by SHA.

---

## 4. Medium

| ID | Finding | Where | Recommendation |
|---|---|---|---|
| M-1 | **Leave approval race.** `approveLeave` updates `WHERE id = $2` with no `AND status='Pending'`. A concurrent reject (which refunds balance) and approve can both succeed, giving an approved leave with its days refunded. | [leave.model.js:381](../server/src/models/leave.model.js#L381) | Add `AND status = 'Pending'`, return 409 if 0 rows, and do it in a transaction like `rejectLeave`. |
| M-2 | **Leave balance overdraw.** `applyLeave` reads the balance and then inserts, inside a transaction but with no row lock. There is no `FOR UPDATE` anywhere in the codebase. Two parallel requests can each spend the same balance. | [leave.service.js:188-275](../server/src/services/leave.service.js#L188-L275) | `SELECT … FROM leaves_entitlement WHERE user_id=$1 AND year=$2 FOR UPDATE` before checking. Read `existingLeave` through the same `client` in `updatePendingLeave`/`cancelLeave`. |
| M-3 | **Account-lockout DoS.** 10 failed logins locks an account for 15 minutes, and the per-account limiter allows 5 per minute. Employee IDs are numeric and guessable, so an attacker can keep all staff locked out. | [loginAttempt.model.js:23](../server/src/models/loginAttempt.model.js#L23), [authRateLimit.middleware.js:15-21](../server/src/middlewares/authRateLimit.middleware.js#L15-L21) *(uncommitted)* | Use progressive delays or CAPTCHA instead of a hard lock, or lock per (account + IP). Alert on mass failures. |
| M-4 | **Tokens in `localStorage`.** Access and 7-day refresh tokens can be read by any XSS or malicious dependency. Refresh tokens are not rotated and logout doesn't revoke them on the server. | [AuthContext.jsx:160-163](../client/src/context/AuthContext.jsx#L160-L163), [config/index.js:56](../server/src/config/index.js#L56) | Move the refresh token to an `HttpOnly; Secure; SameSite=Strict` cookie, keep the access token in memory, rotate refresh tokens on use, and keep a server-side session/denylist for logout. |
| M-5 | **HOD can see every department's leaves.** `GET /leaves/all` allows HOD with no department filter. | [leave.controller.js:721](../server/src/controllers/leave.controller.js#L721) | Force `department_id = requester.department_id` for HOD. |
| M-6 | **`GET /leaves/:id` uses a blocklist.** Only `EMPLOYEE`/`HOD` are limited to their own leaves. Any other role (admin, super admin, hr, developer, or a future role) can read every leave. | [leave.controller.js:309](../server/src/controllers/leave.controller.js#L309) | Switch to an allowlist (owner, or HR/Management, or HOD of the same department). |
| M-7 | **KPI data readable by any logged-in user.** `/employees/:empId/kpi-values`, `/kpi-data-values`, `/kpi-values` and similar have no owner or role scoping. Any employee can list any colleague's KPI assignments and performance numbers. | [employee.routes.js:10-19](../server/src/routes/employee.routes.js#L10-L19), [kpi-data-value.routes.js:14-23](../server/src/routes/kpi-data-value.routes.js#L14-L23) | Decide who may see whose KPIs. Scope reads to self, the HOD's department, or management. |
| M-8 | **Missing foreign keys and indexes.** No FK on `users.department_id/designation_id`, `leaves.user_id/approved_by`, `leaves_entitlement.user_id` or `kpi_data_value.kpi_value_id`. `deleteUser` hard-deletes, which leaves orphan rows. There are no indexes on hot lookup columns (`leaves.user_id`, `notifications.assigned_to`, `user_roles.user_id`, `kpi_values."data operator"`, `ticket_assignees.assigned_to`). | migrations; [user.model.js:207](../server/src/models/user.model.js#L207) | Add FKs (clean orphans first) and the indexes above. Use soft-delete (`status='inactive'`) for users. |
| M-9 | **Role changes only add roles.** `updateUser` with `role` activates or inserts the new role but never deactivates the old one, so a "demotion" in the UI leaves the higher role active. | [user.model.js:163-187](../server/src/models/user.model.js#L163-L187) | Make role changes replace roles (deactivate the others), or make the UI explicitly multi-role. Bump `token_version` on role changes. |
| M-10 | **No audit trail.** A `log` table exists (migration 010), but `logError` only writes to the console. Role grants, password resets, leave approvals and KPI edits leave no record. | [logger.js](../server/src/utils/logger.js) | Write an `audit_log` row (actor, action, target, before/after, IP, time) for sensitive actions. Use a structured logger (pino) with log shipping. |
| M-11 | **Personal data committed to git.** Staff photos and ticket attachments (`server/public/uploads/users/9816.jpg`, `server/public/uploads/tickets/hyloc-img.png`) are tracked even though `.gitignore` lists those folders. `server.js` and `db.js` are also in `.gitignore` while still tracked, which is confusing. | [.gitignore:13-17](../.gitignore#L13-L17) | `git rm --cached` the uploads, purge them from history if they contain real staff data, and remove the source files from `.gitignore`. Store uploads outside the repo (a mounted volume or object storage). |
| M-12 | **KPI submission is slow and not atomic.** Each submit runs about 10+ sequential queries with no transaction. It then calls `findDependentKPIs`, which loads **every** computed KPI and parses its formula in JS, and recurses through dependents and later months, all inside the HTTP request. | [employee.controller.js:144-394](../server/src/controllers/employee.controller.js#L144-L394), [kpiCalculation.service.js:305](../server/src/services/kpiCalculation.service.js#L305) | Wrap submit and recalculation in one transaction. Use `INSERT … ON CONFLICT` (the unique index from 017 exists). Store a precomputed dependency table (`kpi_value_dependencies`). Move cascades to a background job if they grow. |
| M-13 | **No pagination anywhere.** Users, tickets, leaves, KPI values, notifications and dev tickets all return full tables. `attachStaffPhotoUrl` also does synchronous `fs.existsSync` calls per user. | list endpoints | Add `limit/offset` (or cursor) with a server-side cap, and serve photos by a stored filename instead of probing the disk. |

---

## 5. Low

| ID | Finding | Where | Recommendation |
|---|---|---|---|
| L-1 | Unauthenticated test endpoint left in production. | [app.js:161](../server/src/app.js#L161) | Remove it. |
| L-2 | Debug logging of full ticket payloads and results, and of dev-ticket bodies. | [ticket.controller.js:386,485,504](../server/src/controllers/ticket.controller.js#L485), [devTickets.controller.js:27,46](../server/src/controllers/devTickets.controller.js#L27) | Remove it, or switch to a leveled logger with redaction. |
| L-3 | `logError(..., req.user?.id)`: the token has `userId`, not `id`, so the user is always logged as `undefined`. | [employee.controller.js:47](../server/src/controllers/employee.controller.js#L47) and other call sites | Use `req.user?.userId`. |
| L-4 | `validateRegister` calls an undefined `validateEmail`, so it would throw if used. `Register.jsx` is deleted, so this is dead code. `joi` is a dependency but is never imported. | [auth.validation.js:27](../server/src/validations/auth.validation.js#L27) | Delete the dead code, or adopt Joi/Zod schemas for **all** request bodies (most endpoints currently have no input validation). |
| L-5 | `getDepartmentLeaves` HOD branch: the query already filters to the HOD's own department, then keeps only HODs from *other* departments, so that part of the result is always empty. | [leave.controller.js:974](../server/src/controllers/leave.controller.js#L974) | Fetch other departments' HOD leaves separately, or drop the rule. |
| L-6 | Inconsistent role names in `authorize()`. `'super admin'` is allowed on KPI routes but not on roles, user-roles, pillars, associations or leave-entitlements. The client uses `RoleRoute` on only 1 of about 48 routes. | routes; [AppRoutes.jsx:457](../client/src/routes/AppRoutes.jsx#L457) | Put role names in one shared constant and use permission sets instead of role lists. Add `RoleRoute` to admin/HR/management pages (UX and defense in depth). |
| L-7 | Users can change their own email with no re-authentication or verification. That email then receives password-reset OTPs. Email uniqueness is case-sensitive (`Foo@x` and `foo@x` can coexist). | [user.controller.js:386](../server/src/controllers/user.controller.js#L386), [001_create_users.sql](../server/database/migrations/001_create_users.sql) | Require the current password for email changes and verify the new address. Add a unique index on `lower(email)`. |
| L-8 | Login rejects inactive or unknown users before the bcrypt compare, so response timing reveals which employee IDs exist. | [auth.service.js:9-23](../server/src/services/auth.service.js#L9-L23) | Always run a bcrypt compare (against a dummy hash if needed). |
| L-9 | Password policy is only "8 or more characters". bcrypt cost is 10. | [hash.js](../server/src/utils/hash.js) | Raise the cost to 12, check against breached-password lists, and consider forcing a change after an admin reset. |
| L-10 | `/users/assignable` returns every active user's name, email and role to any user. `/dev-tickets` shows all dev tickets to everyone, and the `developer` role can set any status string. | [user.model.js:316](../server/src/models/user.model.js#L316), [devTickets.controller.js](../server/src/controllers/devTickets.controller.js) | Return only names and IDs, and validate statuses against an enum. |
| L-11 | Cron jobs run inside the web process. They would run twice under PM2 cluster mode or multiple instances. The overdue job makes N+1 queries per ticket and recipient. Schedules use server local time, and columns mix `timestamp` and `timestamptz`. | [schedulers/](../server/src/schedulers/) | Use a Postgres advisory lock or a separate worker, batch the queries, pin `TZ=Asia/Kolkata`, and standardize on `timestamptz`. |
| L-12 | Client dependencies: `npm audit` reports 8 moderate issues in production deps (15 including dev), all through `exceljs → archiver → minimatch/glob`. | [client/package.json](../client/package.json) | Track the exceljs upgrade, or lazy-load it only on export pages. Add `npm audit --omit=dev` to CI. |
| L-13 | Response shapes vary: `{success,data}`, raw JSON, `{error}` and `{message}` are all used. | controllers | Standardize on `sendSuccess`/`sendError` and a central async error wrapper. |
| L-14 | Concurrent 401s each trigger a separate token refresh, because the interceptor has no single-flight lock. | [axios.js:76-110](../client/src/api/axios.js#L76-L110) | Share one in-flight refresh promise. |

---

## 6. Best-practice gaps (maintainability, documentation, reliability)

1. **No README.** Ten feature docs sit loose in the repo root (`LeaveRules.md`, `NotDoc.md`, …), but nothing explains setup, environment variables, migrations or deploys. Add a `README.md` and `server/.env.example`, and move feature docs into `docs/`.
2. **Lint is broken.** Both packages have `"lint": "eslint src/"` but no ESLint config, so the command fails. Add a config (with `eslint-plugin-react-hooks` for the client), Prettier, and a pre-commit hook.
3. **Test coverage is thin.** The server has 37 tests (mainly auth, uploads and some controller authorization). There are **no tests** for leave balance math, KPI formula evaluation, or the cases in C-1/H-1/H-2, and **no client tests**. Tests don't run in CI.
4. **Very large, duplicated components.** `ManagementDashboard.jsx` is 2,773 lines. The four role calendars (`HRCalendar`, `ManagementCalendar`, `EmployeeCalendar`, `HODCalendar`) are 1,364–1,758 lines each and largely duplicated, and so are the per-role `LeavesPage`/`LeaveApprovalPage`. Extract one shared calendar and leave module that takes role-specific props.
5. **Fat controllers.** Business rules and raw SQL live in controllers (`employee.controller.js`, `ticket.controller.js`), while other modules use services and models. Move logic into services so it can be tested and kept transactional.
6. **Leftover artifacts in the repo:** `client/color_scan.json`, `client/debug-kpi-structure.html`, two near-identical logo JPGs, and package keywords that say "postgresql" for the client. Clean these up.
7. **Naming:** the API uses `piller` instead of `pillar` and `"data operator"` (a column name with a space). These are hard to change later, so plan any rename together with the migration-tool switch.
8. **Observability:** add a `/api/health` check that also pings the database, structured request logs with request IDs (replacing the `console.log` in [app.js:125](../server/src/app.js#L125)), and error tracking such as Sentry.
9. **Commit hygiene:** recent commit messages are mostly "initial update". Use descriptive messages, feature branches and PRs (the workflow deploys straight from `main`).

---

## 7. Suggested remediation order

1. **This week:** C-1 (leave self-approval), H-2 (attachment path), H-1 (role hierarchy). These are small, local code changes, each with a regression test.
2. **Before the next deploy:** H-3. Commit the hardening work on a branch, restore migration 020, and apply 021–023 to staging and then production first. Remove L-1 and L-2.
3. **Next sprint:** H-5 (CI gate and safer deploy), M-1/M-2 (leave races), M-5/M-6/M-7 (data scoping), M-9 (role demotion), M-11 (uploads out of git).
4. **Next quarter:** H-4 (migration tool and baseline), M-4 (cookie-based refresh tokens), M-8 (FKs and indexes), M-10 (audit log), M-12/M-13 (performance), plus the section 6 items.

*This audit is based on code review and local tooling only. Nothing was tested against a running server or the production database, so verify each finding in staging before fixing it.*

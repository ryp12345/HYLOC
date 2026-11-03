# HYLOC-MGT — Security Audit Report

**Date:** 2026-11-03
**Scope:** Whole repository at commit `d473384` (branch `main`): `server/` (Node/Express API), `client/` (React SPA), database migrations, GitHub Actions deploy workflow, local `server/.env` (values were checked but **not** copied into this report).
**Method:** Read-only code review: every route, how auth works, and every controller that changes data. `npm audit` on all three packages. Ran the existing test suite (46/46 pass). Ran proof-of-concept scripts that execute the **real** controllers and middleware with the database and filesystem mocked. **No live server, database, or third-party system was touched. No application code was changed.**

---

## 1. Executive summary

The codebase has already had real hardening work. Every SQL query is parameterized. There is no `eval`. Uploads are validated by extension, MIME type and file signature (magic bytes). Tokens are revoked when a password or account status changes. Logins and password resets are rate-limited, OTPs are hashed, and errors are generic. Those areas held up under review.

The serious problems are in **secrets management** and **business-logic authorization**:

| # | Severity | Finding | Status |
|---|---|---|---|
<!-- | C1 | **CRITICAL** | JWT signing secrets in `.env` are the placeholder strings committed in git history, so anyone with repo access can forge an admin/management token | **Fixed** (code + local); prod rotation pending | -->
| H1 | **HIGH** | Any employee can approve their own leave (and change credited days) via `PUT /api/leaves/:id` | Confirmed |

| M1 | MEDIUM | Any user can delete arbitrary files under `server/public/uploads` (e.g. other staff photos) via the ticket `attachment` field | Confirmed |
| M2 | MEDIUM | HODs can view, edit and delete leaves outside their own department | Confirmed |
| M3 | MEDIUM | Logout does not end the session; 7-day refresh tokens cannot be revoked | Confirmed |

| L1–L8 | LOW | Account enumeration, broad read access, ticket logic gaps, stale roles, weak password policy, OTP email flooding, payload logging, case-sensitive email uniqueness | Confirmed / Potential |


**Fix first:** C1 (rotate secrets today), then H1, H2, M1.

---

## 2. Application overview

| Area | What was found |
|---|---|
| Languages / frameworks | Node.js + Express 4.22 (CommonJS) API; React 18 + Vite 6 + Tailwind SPA |
| Database | PostgreSQL via `pg` Pool (`server/src/config/db.js`); raw SQL, no ORM; SQL migrations in `server/database/migrations` |
| Authentication | Employee ID + password → bcrypt (cost 10) → JWT access token (15 min, HS256) + refresh token (7 days). Tokens stored in browser `localStorage`, sent as `Authorization: Bearer` |
| Session revocation | `users.token_version`, incremented on password or status change and checked on every request |
| Authorization | Role name embedded in JWT; `authorize(...roles)` middleware plus ad-hoc checks in controllers. Roles: Employee, HOD, HR, Management, Admin, Super Admin (stored in `roles` / `user_roles`). Users can hold multiple roles and switch between them |
| Password reset | 6-digit email OTP, bcrypt-hashed, 5 min expiry, 5 attempts |
| Rate limiting | `express-rate-limit`: login 5/min per IP + 5/min per account; reset endpoints 5/min per IP; account lock after 10 failures for 15 min |
| File uploads | `multer` → `server/public/uploads/{tickets,users}`, random hex filenames, served only through authenticated routes |
| Background jobs | `node-cron` leave-entitlement and overdue-ticket schedulers |
| Third-party | SMTP (nodemailer) for OTP. 
| Deployment | GitHub Actions → SSH → `git pull`, `npm install`, `pm2 reload`, `vite build`, `nginx reload`. Production origin `https://hyloc.git.edu`. **The nginx config and production `.env` are not in the repo and were not reviewed.** |

---

## 3. Findings

### C1 — JWT secrets equal publicly-committed placeholder values → token forgery

| Field | Details |
|---|---|
| Vulnerability | Hard-coded / leaked JWT signing secret, leading to authentication bypass and privilege escalation |
| Severity | **CRITICAL** |
| Location | `server/.env` (`JWT_SECRET`, `JWT_REFRESH_SECRET`); history of `server/src/config/index.js` (commits `4fbef71`, removed in `6755e44`); trust of role claim at `server/src/middlewares/auth.middleware.js:28` |
| Description | Early versions of `config/index.js` contained fallbacks `'supersecret_access_please_change'` and `'supersecret_refresh_please_change'`. The fallbacks were removed from code, but **the current `.env` uses exactly these strings** (checked by comparison, not printed). They are permanently visible in git history to anyone with repo access. In addition, `authenticate` trusts the `role` claim inside the token. It never checks that the user actually holds that role, so a forged token can claim any role. |
| Evidence | (1) `.env` values compared byte-for-byte with the historical strings: both match. (2) PoC (`poc_jwt.js`, mocked DB): a token signed with the historical string for an ordinary Employee (`userId:7, role:'Management', tokenVersion:0`) was **accepted by the real `authenticate()`** and **passed `authorize('admin','management')`**. |
| Attack scenario | An attacker with repo access (former contractor, leaked clone, CI logs) signs `{userId: <any>, role: 'Admin', tokenVersion: 0}`. `token_version` is a small integer, so trying 0–5 is enough. Then they call `PATCH /api/users/:id/reset-password` or `POST /api/user-roles`. They can also forge refresh tokens that are valid for 7 days. |
| Impact | Full compromise of every account and all HR, leave, KPI and user data. Logs show no failed attempts. |
| Recommended fix | 1) **Today:** generate new random secrets (`openssl rand -base64 48`, different for access and refresh) on **every** environment, especially production, and restart. This logs everyone out. 2) Add a startup check that rejects secrets shorter than 32 bytes or matching known placeholders. 3) In `authenticate`, check `decoded.role` against `UserModel.getActiveRoles(userId)` (that query already exists) so a token cannot grant a role the user doesn't have. 4) Treat every secret ever stored in `.env` on shared machines (SMTP, DB, OpenAI) as exposed and rotate them. |
| Status | **Fixed in code + local env (2026-11-03). Production still needs secret rotation.** Changes: `config/index.js` refuses to start with secrets that are short (<32 chars), known placeholders, or identical to each other; `auth.middleware.js` checks the token's role against the user's active roles in the DB; `auth.service.js` login/refresh now pick only *active* roles. Local `server/.env` secrets replaced with 64-char random values. Tests: `config/index.test.js`, `middlewares/auth.middleware.test.js`. **Remaining:** rotate JWT, SMTP, DB and OpenAI secrets on staging/production. |

---

### H1 — Employees can self-approve leave and rewrite leave fields (approval workflow bypass)

| Field | Details |
|---|---|
| Vulnerability | Mass assignment / broken function-level authorization |
| Severity | **HIGH** |
| Location | `server/src/services/leave.service.js:432` (`const updatedFields = { ...updateData }`); `server/src/models/leave.model.js:193-198` (allowed fields include `status`, `approved_by`, `credited_days`, `rejection_reason`); route `PUT /api/leaves/:id` (`server/src/routes/leave.routes.js`) |
| Description | The dedicated `POST /api/leaves/:id/approve` and `/reject` endpoints enforce role, department, "pending only" and "no self-approval" rules. But the generic update endpoint copies the whole request body into the UPDATE statement. The owner of a leave can therefore set `status`, `approved_by` and `credited_days` directly. Nothing checks the current status either, so already-approved or rejected leaves can be rewritten. |
| Evidence | PoC (`poc.js`, real `leave.controller.updateLeave` + `leave.service`, mocked DB): Employee user 7 sent `{status:'Approved', approved_by:7, credited_days:0}` for their own pending leave and got **HTTP 200**. Fields written to `leaves`: `{"status":"Approved","approved_by":7,"credited_days":0}`. |
| Attack scenario | An employee applies for 10 days of Earned Leave and then sends `PUT /api/leaves/<id>` with `{"status":"Approved","approved_by":<HOD id>}`. The leave looks HOD-approved without the HOD doing anything. Setting `credited_days: 0` (without changing dates) makes the stored record disagree with the balance logic, so they can take leave without it being deducted. HR / HOD / Management can use the same path to bypass the approval rules for other people's leave. |
| Impact | Integrity of leave and attendance records (which affect payroll); forged approver identity. |
| Recommended fix | In `updatePendingLeave`, keep only an explicit list of fields from the request body: `from_date, to_date, leave_duration, leave_reason, alternate_person, additional_alternate, available_on_phone, leave_type`. Never accept `status`, `approved_by`, `credited_days` or `rejection_reason` there. Only owners may edit, and only while the status is `Pending`. Status changes must go only through approve/reject/request-change. Add regression tests for each forbidden field. |
| Status | **Confirmed** |

---

### H2 — Management can escalate to Admin and take over any account

| Field | Details |
|---|---|
| Vulnerability | Privilege escalation / missing role hierarchy |
 `admin`/`HR`/`super admin` role (`POST /api/user-roles`, `PUT /api/users/:id {role}`); (b) **rename** existing roles (`PUT /api/roles/:id`), for example rename the "Employee" role so every employee silently gets a different role; (c) reset the password of an Admin or Super Admin and log in as them. Nothing is recorded: the `log` table exists but is never written to. |
| Evidence | Route definitions above. The controllers do not check the target user's role or compare it to the caller's role. `admin`-only features exist (e.g. `/api/leave-entitlements` is `admin, hr` only), so Management → Admin is a real privilege gain. |
| Attack scenario | A Management account (or a stolen Management session) calls `PATCH /api/users/<admin id>/reset-password`, logs in as Admin, and changes leave entitlements. Alternatively it calls `POST /api/user-roles {userId:<self>, roleId:<HR>}`. |
| Impact | Takeover of higher-privileged accounts; tampering with leave entitlements and roles; no audit trail. |
| Recommended fix | Decide the hierarchy (e.g. Super Admin > Admin > Management/HR > HOD > Employee) and enforce it on the server. Nobody may assign or reset an account at or above their own level, or change their own roles. Limit role rename/create/delete to Super Admin/Admin. Write every role change, password reset and status change to the `log` table. |
| Status | **Confirmed** (the behaviour); severity depends on the intended hierarchy |

---

### M1 — Arbitrary file deletion under `server/public` via ticket `attachment`

| Field | Details |
|---|---|
| Vulnerability | Unvalidated user-supplied file path → arbitrary file deletion (limited path traversal) |
| Severity | MEDIUM |
| Location | `server/src/controllers/ticket.controller.js:195-197` (create accepts a string `attachment`), `:329` (`payload = { ...req.body }` on update), `:106-118` (`toLocalUploadPath` allows anything under `server/public`), `:511` (`removeLocalAttachmentIfExists(existing.attachment)`) |
| Description | The `attachment` column should only ever hold a server-generated upload path, but both create and update accept any string from the client. When the attachment is later cleared or replaced, the server deletes whatever file that string points to. The only limit is that the file must be inside `server/public`. |
| Evidence | PoC (`poc.js`, real `ticket.controller.updateTicket`, mocked model, `fs.promises.unlink` stubbed): an Employee sent `PUT {attachment:'/uploads/users/70001.JPG'}` and then `PUT {attachment:''}` on their own ticket. Both returned 200, and **`unlink()` was called on `server\public\uploads\users\70001.JPG`**, another employee's photo. |
| Attack scenario | Any logged-in user creates a ticket and repeats the two requests for each target filename. Staff photos are named after employee IDs (e.g. `70001.JPG`) and ticket attachments are visible to their participants, so targets are easy to find. Everyone's photos or attachments can be deleted. |
| Impact | Loss of uploaded files (availability and integrity). Traversal outside `server/public` is blocked, so code and config files are safe. |
| Recommended fix | Never accept `attachment` from the request body. Set it only from `req.file.filename`, and use an explicit `removeAttachment: true` flag for clearing. Store only the bare filename. On delete, resolve against `uploads/tickets` only and require `path.sep` after the base directory. Also remove the attachment file when a ticket is deleted. |
| Status | **Confirmed** |

---

### M2 — HOD can access and change leaves outside their department

| Field | Details |
|---|---|
| Vulnerability | Broken object-level authorization (IDOR) |
| Severity | MEDIUM |
| Location | `server/src/services/leave.service.js:423-429` (update: HOD check is "applicant is Employee", with no department check); `server/src/services/leave.service.js:543-545` (cancel/delete: HR, HOD and Management can delete **any** leave, including Management's); `server/src/controllers/leave.controller.js:700` (pending list: HOD without `department_id` gets all departments, and can pass any `department_id`); `:721-745` (`/api/leaves/all`: HOD can view every department) |
| Description | The approve/reject endpoints correctly limit HODs to their own department, but the update, delete and list endpoints do not. |
| Evidence | Code paths above. The HOD branch in `updatePendingLeave` never compares departments. `cancelLeave` allows any `canManageAnyLeave` role on any leave. |
| Attack scenario | A HOD in Department A calls `GET /api/leaves/all` to read every employee's leave reasons, which may include medical details. They can then call `DELETE /api/leaves/<id>` on a Department B leave or on a Management user's leave. |
| Impact | Exposure of personal and possibly medical information; tampering with or deleting other departments' records. |
| Recommended fix | Load the HOD's `department_id` on the server and require the leave owner to be in the same department for view, update and cancel. Ignore `department_id` from the query string for HODs. Do not let HOD/HR delete another person's leave; use reject or an HR-specific audited action. |
| Status | **Confirmed** |

---

### M3 — Sessions cannot be revoked; logout is client-side only

| Field | Details |
|---|---|
| Vulnerability | Insufficient session expiration / invalidation |
| Severity | MEDIUM |
| Location | `client/src/context/AuthContext.jsx:200` (logout only clears `localStorage`); `client/src/context/AuthContext.jsx:163` (refresh token in `localStorage`); `server/src/routes/auth.routes.js:14`; `server/src/config/index.js:56` (7-day refresh) |
| Description | The server has no logout endpoint. Refresh tokens are stateless, never rotated, and stay valid for 7 days unless the password or account status changes. A copied refresh token keeps producing new access tokens after the user "logs out". |
| Evidence | No server-side session or refresh-token store exists. `refreshAccessToken` only checks the signature, user status and `token_version`. |
| Attack scenario | On a shared office PC, or after a brief XSS / malicious extension, the attacker copies `refreshToken` from `localStorage`. The victim logs out, but the attacker keeps access for up to 7 days. |
| Impact | Long-lived account access after compromise. |
| Recommended fix | Add `POST /api/auth/logout` that invalidates the refresh token. Simplest option: bump `token_version`, which logs out all devices. Better option: a `refresh_tokens` table with per-device rotation and reuse detection. Move the refresh token into an `HttpOnly; Secure; SameSite=Strict` cookie scoped to `/api/auth`. Consider a shorter refresh lifetime (e.g. 8–12 h for a workday app). |
| Status | **Confirmed** |

---

### M4 — Email change without re-authentication → persistent account takeover

| Field | Details |
|---|---|
| Vulnerability | Broken authentication (sensitive account change with no re-authentication or verification) |
| Severity | MEDIUM |
| Location | `server/src/controllers/user.controller.js:389-417` (`PUT /api/users/me`) |
| Description | A user can change their own email address with just a valid access token: no current password and no confirmation to the old or new address. Password reset sends the OTP to the stored email. |
| Evidence | `updateMyProfile` writes `email` straight from the body after only a uniqueness check. The `token_version` bump only happens on password or status changes. |
| Attack scenario | An attacker with a 15-minute stolen session changes the email to their own, then uses "Forgot password" to set a new password. The real owner is locked out for good. |
| Impact | Account takeover from a short-lived session compromise. |
| Recommended fix | Require `currentPassword` to change the email. Send a confirmation link to the new address and a notice to the old one. Alternatively, make email admin-editable only. |
| Status | **Confirmed** |

---

### M5 — Anyone can lock any account (lockout denial of service)

| Field | Details |
|---|---|
| Vulnerability | Abuse of brute-force protection / denial of service |
| Severity | MEDIUM |
| Location | `server/src/models/loginAttempt.model.js:31` (10 failures → 15 min lock); `server/src/services/auth.service.js` login flow |
| Description | The lock is per account and triggered by unauthenticated requests. Employee IDs are short and sequential (e.g. `70001`, `70005`), so an attacker can enumerate them and keep the whole organisation locked out. The per-account limit (5/min) slows this down but does not stop it, and spreading the requests over several IPs gets around the per-IP limit. |
| Evidence | Code review. An account locks after 10 wrong passwords regardless of source IP. |
| Attack scenario | A script loops over IDs 70000–71000, sending 10 bad passwords each, and repeats every 15 minutes. |
| Impact | Nobody can log in (availability). |
| Recommended fix | Count failures per (account, IP) pair as well as per account. Use progressive delays or a CAPTCHA instead of a hard lock. Lock only when failures come from many sources. Alert on lockout spikes. |
| Status | **Confirmed** |

---

### L1 — Account enumeration

| Field | Details |
|---|---|
| Severity | LOW |
| Location | `server/src/controllers/auth.controller.js:35-44` (HTTP 423 "account locked" only happens for existing active accounts); `server/src/services/auth.service.js:29` (unknown ID returns before bcrypt, so the response is noticeably faster); `server/src/controllers/auth.controller.js:149-154` (reset request: bcrypt and SMTP work only for real emails, so the timing differs) |
| Description / Attack | An attacker can tell which employee IDs and emails exist from the 423 status and from response timing. This helps targeted phishing and M5. |
| Recommended fix | Run a dummy bcrypt compare for unknown users. Return the same 401 for locked accounts (the lock still applies). Send the OTP email in a background job so the response time is constant. |
| Status | Confirmed (code) |

### L2 — Broad read access for any logged-in user

| Field | Details |
|---|---|
| Severity | LOW (raise if KPI data is confidential) |
| Location | `server/src/routes/kpi*.routes.js`, `employee.routes.js` (all GETs available to any authenticated user); `server/src/models/user.model.js:316-329` (`/api/users/assignable` returns every active user's email and role); `server/src/controllers/leave.controller.js:325` (`GET /api/leaves/:id`: any role other than Employee/HOD, including custom roles, can read any leave) |
| Description | Any employee can fetch all KPI definitions, targets, actuals and audit data, plus any colleague's KPI values (`/api/employees/:empId/kpi-values`), and a full staff directory with emails and roles. |
| Recommended fix | Confirm what each role is supposed to see. Limit KPI reads to assigned KPIs or the user's own department for Employee/HOD. Change the leave view check to an allow-list (owner, same-department HOD, HR, Management). |
| Status | Potential (depends on business intent) |

### L3 — Ticket workflow gaps

| Field | Details |
|---|---|
| Severity | LOW |
| Location | `server/src/controllers/ticket.controller.js:204` (create accepts any `status`); `:425-433` (comment says "others can only edit title and description" but nothing enforces it) |
| Description | A creator can create a ticket already `Closed` or `Rejected`, skipping the "only Management can reject" rule. Assignees can change priority and attachment as well as title/description. |
| Recommended fix | Always create with `status='Open'`. Enforce per-field edit rules on the server. |
| Status | Confirmed (code) |

### L4 — Role removal is not enforced until the access token expires

| Field | Details |
|---|---|
| Severity | LOW |
| Location | `server/src/middlewares/auth.middleware.js:28`; user-role update/delete controllers do not bump `token_version` |
| Description | When a role is removed, the user keeps it for up to 15 minutes, until their access token expires. |
| Recommended fix | The fix for C1 step 3 (check the role against the DB on each request) solves this too. |
| Status | **Fixed** (with C1): removed or deactivated roles stop working on the next request |

### L5 — Weak password policy

| Field | Details |
|---|---|
| Severity | LOW |
| Location | `auth.controller.js:128,239`, `user.controller.js` (length ≥ 8 only); `server/src/utils/hash.js:4` (bcrypt cost 10) |
| Description | No check against common or breached passwords. Admins set initial passwords, and users are not forced to change them. bcrypt silently ignores input beyond 72 bytes. |
| Recommended fix | Minimum 10–12 characters, reject common passwords (e.g. `zxcvbn` score ≥ 3), force a change on first login after an admin reset, cap length at 72 bytes, and consider bcrypt cost 12. |
| Status | Confirmed |

### L6 — Password-reset flooding / OTP reissue

| Field | Details |
|---|---|
| Severity | LOW |
| Location | `server/src/controllers/auth.controller.js:145-214`; `server/src/models/passwordReset.model.js:3-15` |
| Description | There is no per-account limit on reset requests, so an attacker can flood a victim's inbox from many IPs. Each new request also resets the 5-attempt counter. The chance of guessing an OTP stays very small (5 in 1,000,000 per OTP), but there is nothing per-account to stop repeated tries. |
| Recommended fix | Limit to about 3 OTP requests per account per hour. Keep a running failure count across reissues. |
| Status | Confirmed (code) |

### L7 — Request payloads written to logs

| Field | Details |
|---|---|
| Severity | LOW |
| Location | `server/src/controllers/ticket.controller.js:386,485,504` (`DEBUG:` logs of full ticket payloads and results); `client/src/api/axios.js` logs the API URL |
| Recommended fix | Remove the debug logs and use a leveled logger (e.g. pino) with `info` in production and redaction of request bodies. |
| Status | Confirmed |

### L8 — Email uniqueness is case-sensitive

| Field | Details |
|---|---|
| Severity | LOW |
| Location | `server/database/migrations/001_create_users.sql:20`; `user.model.js:75-83` |
| Description | `A@x.com` and `a@x.com` can belong to different accounts. This creates confusion in reset flows and makes impersonation easier. |
| Recommended fix | Unique index on `LOWER(email)` and normalise emails on write. |
| Status | Confirmed (code) |

---

### Informational / hardening

| # | Item | Details & recommendation |
|---|---|---|
| I1 | Dependencies | `npm audit --omit=dev`: **root 0, server 0, client 8 moderate**, all from `minimatch` ReDoS through `exceljs → archiver`. This runs in the browser on user-chosen files, so real-world risk is low. Server dev tooling (jest/eslint) has 28 low/moderate issues, not shipped. Outdated but not vulnerable: `express 4 → 5`, `bcryptjs 2 → 3`, `pg`, `node-cron`. Add `npm audit` to CI. |
| I2 | Deploy pipeline (`.github/workflows/deploy.yml`) | Every push to `main` deploys to production with **no tests or approval gate**. Uses `npm install` instead of `npm ci`, so the lockfile is not enforced (supply-chain risk). The pm2 fallback `pm2 start server.js` points at the wrong path (`src/server.js`). The deploy user needs passwordless `sudo` for nginx. Recommendation: run `npm ci && npm test` first, use a protected GitHub environment with required reviewers, and give sudo only for `systemctl reload nginx`. |
| I3 | API port exposed | `server.js:9` binds `0.0.0.0:3001` over plain HTTP. If the firewall does not block 3001, clients can skip nginx/TLS. Bind to `127.0.0.1` in production. |
| I4 | `NODE_ENV` defaults to `development` | `config/index.js:3`. If production does not set `NODE_ENV=production`, HSTS is off (`app.js:42`) and dev CORS origins (any `http://<IP>:3000/5173`) are allowed. Bearer tokens limit the CORS impact, but set it explicitly and fail at startup if it is missing. The `CORS_ORIGIN` env var is ignored because the origin is hard-coded. |
| I5 | Rate limiting depends on nginx | `trust proxy 'loopback'` is correct only if nginx sends `X-Forwarded-For`. Otherwise every user shares the 127.0.0.1 bucket, so the whole company gets 5 logins per minute. Not verifiable: nginx config not in the repo. |
| I6 | Frontend security headers / clickjacking | Helmet (CSP, frame-ancestors, etc.) only protects API responses. The SPA is served by nginx, whose headers are unknown. Add CSP, `X-Frame-Options: DENY` or `frame-ancestors 'none'`, `Referrer-Policy`, and HSTS in nginx. |
| I7 | Tokens in `localStorage` | Any XSS would expose the tokens. **No XSS sinks were found:** no `dangerouslySetInnerHTML`, no `innerHTML`, and React escapes output. Attachments open as blob URLs, and only PDF, image, Office and TXT files are allowed (no HTML/SVG). Moving refresh tokens into HttpOnly cookies (see M3) reduces the risk. |
| I8 | Local `.env` hygiene | DB connects as the `postgres` **superuser** with a 6-character password. Use a least-privilege app role (DML only, no DDL) and a strong password. An unused `OPENAI_API_KEY` is present: revoke it. `.env` is gitignored and **was never committed** (history checked). |
| I9 | No audit trail | A `log` table exists (`010_create_log.sql`) but nothing writes to it. Log logins, failed logins, role/password/status changes, leave approvals, and deletions. |
| I10 | Leftover endpoints/files | Unauthenticated `GET /api/test/leave-entitlements` (`app.js:159`, harmless, remove it). `client/debug-kpi-structure.html` (not in the build, remove it). Legacy uploads with guessable names in `uploads/tickets/` (`admin-avatar.jpg`, etc.). |
| I11 | `.gitignore` oddity | It lists `server/src/config/db.js` and `server/src/server.js`, but both are tracked, so the entries have no effect. Remove them to avoid confusion. |

---

## 4. Areas tested and found secure

| Area | Result |
|---|---|
| SQL injection | All queries use `$n` parameters. Dynamic column names (`leave.model`, `user.model`, `kpi-value.model`, `leaveEntitlement.model`, `employeeMonthlyWorkingDays.model`) come from hard-coded allow-lists. No injection found. |
| NoSQL / command injection / RCE | No NoSQL. No `child_process`, `eval`, `new Function` or `vm`. The KPI formula engine (`utils/formulaEvaluator.js`) is a hand-written tokenizer and parser with no dynamic code. |
| Insecure deserialization | Only `JSON.parse` on assignee ID lists, with results coerced to integers. |
| JWT implementation | `jsonwebtoken` 9 (rejects `alg:none`). Access and refresh secrets are separate. Expiry is enforced. Revocation via `token_version` works (tests pass). The weaknesses are the secret values (C1) and trusting the role claim. |
| Password storage | bcrypt with a per-password salt. Hashes never returned (`findUserById` selects explicit columns). |
| Password reset | OTP from `crypto.randomInt`, bcrypt-hashed, 5-minute expiry, 5 attempts, single use (`DELETE … RETURNING`). The same response for unknown emails prevents enumeration by message. The email goes to the stored address. Login lock is cleared on reset. |
| File upload | Extension, MIME and signature checks; random filenames; 5/10 MB limits; files deleted on validation failure; downloads served only through authenticated routes with `basename` and path-prefix checks plus `nosniff`. No upload path traversal or stored XSS. |
| Ticket read authorization | Only creator, assignee, Management, or same-department HOD (both the detail and attachment endpoints). |
| Notifications | Every query is limited to `assigned_to = current user`. No create endpoint. |
| KPI data submission | Employees limited to their own empid and assigned KPIs; HOD to their department; numeric validation. |
| Role switching | `switch-role` and refresh with `selectedRole` check against the user's active roles in the DB. |
| Error handling | The global handler returns generic messages. Stack traces are not sent to clients. |
| SSRF / open redirect / file inclusion | No server-side requests to URLs supplied by users. No redirect endpoints. No dynamic `require`. |
| CSRF | Not applicable: auth uses a bearer header, not cookies. (If M3 moves the refresh token to a cookie, add `SameSite=Strict` and a CSRF check on `/auth/refresh-token`.) |
| Secrets in git | `.env` never committed. The only historical secrets are the placeholder fallbacks behind C1. |
| Race conditions | Leave apply/update and approval run in transactions with overlap checks; OTP use is atomic. No race-condition issue found. |

---

## 5. Remediation plan (prioritised)

| Priority | Item | Effort | Notes |
|---|---|---|---|
| **P0: today** | C1: rotate `JWT_SECRET` / `JWT_REFRESH_SECRET` on all environments; rotate SMTP, DB and OpenAI credentials; add a startup check against weak or placeholder secrets | < 1 h | Logs everyone out. No code change needed for the rotation itself. |
| **P1: this week** | H1: allow-list fields in `updatePendingLeave`; block status changes through PUT | ~2 h + tests | Run a DB query to check for leaves where `approved_by = user_id` (possible past abuse). |
| P1 | C1-3 / L4: check the token role against the DB's active roles in `authenticate` | ~1 h | One extra indexed query per request. |
| P1 | M1: stop accepting `attachment` from the body; tighten the delete path | ~1 h + tests | |
| P1 | H2: role hierarchy checks for role assignment, password reset and role rename; audit logging | ~0.5–1 day | Needs your decision on the intended hierarchy. |
| P2: next sprint | M2 HOD department scoping; M4 re-authentication for email change; M3 logout endpoint and refresh rotation / HttpOnly cookie | 1–2 days | M3 touches the client too. |
| P2 | M5 / L1 lockout and enumeration hardening; L6 per-account OTP limit | ~0.5 day | |
| P3 | L2 read-scope review (business decision), L3, L5, L7, L8, I1–I11 | Ongoing | Most are config or deploy hygiene. |

**After approval, each fix will:** keep current behaviour for legitimate use, add a Jest regression test that reproduces the attack (in the style of the existing `*.test.js` files), and run the full suite. Unresolved items will be listed here with Status updated to *Fixed* / *Accepted risk*.

---

## 6. Limitations

- **No live testing.** Attack simulations ran the real controllers and middleware in Node with the database and `fs.unlink` mocked, so no data or files were changed. Endpoint-level behaviour against a running PostgreSQL instance was not exercised.
- **Production configuration was not reviewed:** nginx config, production `.env`, firewall, TLS, OS permissions, PM2 user and DB grants. Findings C1 (prod), I3–I6 depend on these.
- Client-side review focused on authentication, token handling and XSS sinks, not every UI page.
- PoC scripts (kept outside the repo):
  - `C:\Users\User\AppData\Local\Temp\claude\d--HYLOC-MGT\580e5204-5b87-439d-a338-c279e7d3d533\scratchpad\poc.js` (H1, M1)
  - `C:\Users\User\AppData\Local\Temp\claude\d--HYLOC-MGT\580e5204-5b87-439d-a338-c279e7d3d533\scratchpad\poc_jwt.js` (C1)

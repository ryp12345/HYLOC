# HYLOC-MGT — Security Audit Report

**Audit date:** 2026-11-03 · **Last updated:** 2026-11-03
**Scope:** Whole repository at commit `d473384` (branch `main`): `server/` (Node/Express API), `client/` (React SPA), database migrations, GitHub Actions deploy workflow, local `server/.env` (values were checked but **not** copied into this report).
**What counts as a finding:** security vulnerabilities only. Role permissions and workflow rules (who may see, approve or manage what) are business requirements and are out of scope.
**Method:** Read-only code review of every route, the authentication flow, and every controller that changes data. `npm audit` on all packages. Proof-of-concept scripts ran the **real** controllers and middleware with the database and filesystem mocked. No live server, database or third-party system was touched.

---

## 1. Summary

The codebase already had good basic protections. Every SQL query is parameterized. There is no `eval`. Uploads are checked by extension, MIME type and file signature. Tokens are revoked when a password or account status changes. Logins and password resets are rate-limited. OTPs are hashed. Error messages are generic. See section 4.

### Open findings

| # | Severity | Finding | Status |
|---|---|---|---|
| C1 | **CRITICAL** | JWT signing secrets equal placeholder strings visible in git history, so login tokens can be forged | Local secrets rotated; production rotation and code fix **pending** |
| M3 | MEDIUM | Logout does not end the session on the server; refresh tokens stay valid for 7 days | Open |
| M5 | MEDIUM | Anyone can lock any account (employee IDs are guessable) | Open |
| L1 | LOW | The login page reveals which employee IDs and emails exist | Open |
| L4 | LOW | A removed role keeps working for up to 15 minutes | Open (fixed together with C1) |
| L6 | LOW | No per-account limit on password-reset code requests | Open |
| L8 | LOW | Email uniqueness is case-sensitive | Open |
| I1–I10 | INFO | Hardening: deployment, server configuration, dependencies | Open |

### Fixed findings

| # | Severity | Finding | Fixed in |
|---|---|---|---|
| H1 | **HIGH** | Employees could approve their own leave via `PUT /api/leaves/:id` | `server/src/services/leave.service.js` |
| M1 | MEDIUM | Any user could delete other users' uploaded files via the ticket `attachment` field | `server/src/controllers/ticket.controller.js` |
| M4 | MEDIUM | Email could be changed without the current password, so a stolen session could take over the account | `server/src/controllers/user.controller.js`, `client/src/pages/auth/ProfilePage.jsx` |
| L5 | LOW | Weak password policy: common passwords accepted, input over bcrypt's 72-byte limit silently cut off | `server/src/utils/passwordPolicy.js`, `auth.controller.js`, `user.controller.js` |
| L7 | LOW | Debug logs printed full ticket contents | `server/src/controllers/ticket.controller.js` |

**Next priority:** C1. Rotate the secrets on production and staging, then re-apply the code fix.

---

## 2. Application overview

| Area | What was found |
|---|---|
| Languages / frameworks | Node.js + Express 4.22 (CommonJS) API; React 18 + Vite 6 + Tailwind SPA |
| Database | PostgreSQL via `pg` Pool (`server/src/config/db.js`); raw SQL, no ORM; SQL migrations in `server/database/migrations` |
| Authentication | Employee ID + password → bcrypt (cost 10) → JWT access token (15 min, HS256) + refresh token (7 days). Tokens stored in browser `localStorage`, sent as `Authorization: Bearer` |
| Session revocation | `users.token_version`, incremented on password or status change and checked on every request |
| Authorization | Role name in the JWT; `authorize(...roles)` middleware plus checks in controllers. Roles: Employee, HOD, HR, Management, Admin, Super Admin |
| Password reset | 6-digit email OTP, bcrypt-hashed, 5 min expiry, 5 attempts |
| Rate limiting | `express-rate-limit`: login 5/min per IP + 5/min per account; reset endpoints 5/min per IP; account lock after 10 failures for 15 min |
| File uploads | `multer` → `server/public/uploads/{tickets,users}`, random hex filenames, served only through authenticated routes |
| Third-party | SMTP (nodemailer) for OTP emails |
| Deployment | GitHub Actions → SSH → `git pull`, `npm install`, `pm2 reload`, `vite build`, `nginx reload`. Production origin `https://hyloc.git.edu`. The nginx config and production `.env` are not in the repo and were not reviewed. |

---

## 3. Findings

### C1 — JWT secrets equal publicly-committed placeholder values → token forgery

| Field | Details |
|---|---|
| Vulnerability | Hard-coded / leaked JWT signing secret, leading to authentication bypass and privilege escalation |
| Severity | **CRITICAL** |
| Location | `server/.env` (`JWT_SECRET`, `JWT_REFRESH_SECRET`); history of `server/src/config/index.js` (commit `4fbef71`, removed in `6755e44`); role claim trusted at `server/src/middlewares/auth.middleware.js:28` |
| Description | Early versions of `config/index.js` had fallback secrets `'supersecret_access_please_change'` and `'supersecret_refresh_please_change'`. They are permanently visible in git history. The local `.env` used exactly these strings. Separately, `authenticate` trusts the `role` written inside the token and never checks that the user actually holds that role. |
| Evidence | (1) `.env` values compared with the historical strings: both matched (not printed). (2) PoC: a token signed with the historical string, claiming Management for an ordinary Employee, was **accepted by the real `authenticate()`** and **passed `authorize('admin','management')`**. |
| Attack scenario | Anyone who has seen the repo (former contractor, leaked clone) signs `{userId: <any>, role: 'Admin', tokenVersion: 0}` and gets full access. They can also forge refresh tokens that are valid for 7 days. |
| Impact | Full compromise of every account and all HR, leave, KPI and user data. |
| Recommended fix | 1) Generate new random secrets (`openssl rand -base64 48`, a different value for each key) on **every** environment and restart. 2) Add a startup check that rejects short, placeholder or identical secrets. 3) In `authenticate`, check the token's role against the user's active roles in the database (`UserModel.getActiveRoles`). 4) Rotate the SMTP and DB passwords as well. |
| Status | **Partly fixed.** Local `server/.env` JWT secrets were replaced with 64-character random values. The code changes for steps 2 and 3 were written and tested, then reverted so that production would not refuse to start before its `.env` is updated. **Pending:** rotate production/staging secrets, then re-apply the code changes. |

---

### H1 — Employees could self-approve leave and rewrite leave fields

| Field | Details |
|---|---|
| Vulnerability | Mass assignment / broken function-level authorization |
| Severity | **HIGH** |
| Location | `server/src/services/leave.service.js` (`updatePendingLeave`); route `PUT /api/leaves/:id` |
| Description | The approve/reject endpoints enforced the approval rules, but the generic update endpoint copied the whole request body into the database. A leave owner could set `status`, `approved_by` and `credited_days` directly. |
| Evidence | PoC: Employee 7 sent `{status:'Approved', approved_by:7, credited_days:0}` for their own leave and got HTTP 200; all three fields were saved. |
| Impact | Forged approvals and incorrect leave balances (payroll impact). |
| Status | **Fixed (2026-11-03).** Only an allow-list of detail fields (`EDITABLE_LEAVE_FIELDS`) is saved. `credited_days`, `approved_by` and `rejection_reason` are always set by the server. Status changes use the same rules as the approve/reject endpoints, via `assertCanDecideLeave`. Details can be edited only while the leave is Pending. Tests: `server/src/services/leave.service.test.js` (12 cases). PoC re-run: HTTP 403, nothing written. **Follow-up:** check for past abuse with `SELECT id, user_id, status FROM leaves WHERE approved_by = user_id;` |

---

### M1 — Arbitrary file deletion via ticket `attachment`

| Field | Details |
|---|---|
| Vulnerability | User-supplied file path → arbitrary file deletion |
| Severity | MEDIUM |
| Location | `server/src/controllers/ticket.controller.js` (`createTicket`, `updateTicket`, `toLocalUploadPath`) |
| Description | Ticket create and update accepted any text as the `attachment` path. When the attachment was later cleared, the server deleted whatever file that path pointed to, anywhere under `server/public`. |
| Evidence | PoC: an Employee set `attachment` to `/uploads/users/70001.JPG` and then cleared it; `unlink()` was called on another employee's staff photo. |
| Impact | Any logged-in user could delete everyone's photos and attachments. |
| Status | **Fixed (2026-11-03).** The attachment is set only from a real upload; any other text from the client is ignored. File deletion uses only the file name, inside `uploads/tickets`, so it can't reach other folders or use `../`. No frontend change was needed. Tests: 6 cases in `server/src/controllers/ticket.controller.test.js`. PoC re-run: nothing deleted. **Follow-up:** check for planted values with `SELECT id, attachment FROM tickets WHERE attachment IS NOT NULL AND attachment NOT LIKE '/api/uploads/tickets/%';` |

---

### M3 — Sessions cannot be revoked; logout is client-side only

| Field | Details |
|---|---|
| Vulnerability | Insufficient session invalidation |
| Severity | MEDIUM |
| Location | `client/src/context/AuthContext.jsx` (`logout` only clears `localStorage`); `server/src/routes/auth.routes.js` (no logout endpoint); `server/src/config/index.js` (7-day refresh) |
| Description | The server has no logout. Refresh tokens are never stored, rotated or revoked, and stay valid for 7 days unless the password or account status changes. |
| Attack scenario | On a shared office PC, or through a malicious browser extension, an attacker copies `refreshToken` from `localStorage`. The victim logs out, but the attacker keeps access for up to 7 days. |
| Impact | Long-lived account access after a compromise. |
| Recommended fix | Add `POST /api/auth/logout`. Two options: (a) **this device only**: record the logged-out token IDs in a new `revoked_tokens` table (needs a DB migration before deploying); (b) **all devices**: increment `token_version` (no DB change, but logs the user out everywhere). Optionally move the refresh token to an `HttpOnly; Secure; SameSite=Strict` cookie. |
| Status | **Open.** Waiting for the decision between (a) and (b). |

---

### M4 — Email change without re-authentication → account takeover

| Field | Details |
|---|---|
| Vulnerability | Sensitive account change without re-authentication |
| Severity | MEDIUM |
| Location | `server/src/controllers/user.controller.js` (`updateMyProfile`, `PUT /api/users/me`) |
| Description | A user could change their own email (where reset codes are sent) with only a valid session. A briefly stolen session could change the email, then use "Forgot password" to take the account permanently. |
| Status | **Fixed (2026-11-03).** Changing the email now requires `currentPassword`, checked with bcrypt; otherwise the request is refused and nothing is saved. Other profile edits need no password. `ProfilePage.jsx` shows a "Current password" field only while the email is edited. Tests: 4 cases in `server/src/controllers/user.controller.test.js`. **Not covered:** confirmation email to the old/new address; no rate limit on the password check (the existing `change-password` endpoint has the same gap). |

---

### M5 — Anyone can lock any account (lockout denial of service)

| Field | Details |
|---|---|
| Vulnerability | Abuse of brute-force protection / denial of service |
| Severity | MEDIUM |
| Location | `server/src/models/loginAttempt.model.js` (10 failures → 15 min lock); login flow in `server/src/services/auth.service.js` |
| Description | The lock is per account and triggered by unauthenticated requests. Employee IDs are short and sequential (e.g. `70001`), so an attacker can lock out the whole organisation and repeat every 15 minutes. Spreading requests over several IPs gets around the per-IP limit. |
| Attack scenario | A script loops over IDs 70000–71000, sending 10 bad passwords each. |
| Impact | Nobody can log in. |
| Recommended fix | Count failures per (account, IP) pair as well as per account. Use progressive delays instead of a hard lock. Alert on lockout spikes. |
| Status | **Open** |

---

### L1 — Account enumeration

| Field | Details |
|---|---|
| Severity | LOW |
| Location | `server/src/controllers/auth.controller.js` (HTTP 423 "account locked" only for real accounts); `server/src/services/auth.service.js` (unknown IDs return before the bcrypt check, so the response is faster); password-reset request timing |
| Description | An attacker can tell which employee IDs and emails exist from the 423 status and from response timing. This helps phishing and M5. |
| Recommended fix | Run a dummy bcrypt compare for unknown users. Return the same 401 for locked accounts (the lock still applies). Send the OTP email in the background so the response time is constant. |
| Status | **Open** |

### L4 — A removed role keeps working until the access token expires

| Field | Details |
|---|---|
| Severity | LOW |
| Location | `server/src/middlewares/auth.middleware.js` |
| Description | When a role is removed from a user, their current token keeps that role for up to 15 minutes. |
| Recommended fix | The same as C1 step 3: check the token's role against the database on each request. |
| Status | **Open.** Fixed together with C1's code change. |

### L5 — Weak password policy

| Field | Details |
|---|---|
| Severity | LOW |
| Location | `server/src/controllers/auth.controller.js`, `server/src/controllers/user.controller.js` (length ≥ 8 only); `server/src/utils/hash.js` (bcrypt cost 10) |
| Description | No check against common or breached passwords, and no forced change after an admin sets a password. bcrypt ignores input beyond 72 bytes. |
| Recommended fix | Minimum 10–12 characters, reject common passwords, force a change on first login after an admin reset, cap length at 72 bytes, consider bcrypt cost 12. |
| Status | **Fixed.** One shared check (`server/src/utils/passwordPolicy.js`) now runs everywhere a password is set: admin create/update/reset, change password, forgot-password reset. It keeps the 8-character minimum and rejects common passwords, a single repeated character, input over 72 bytes, and non-string values. Tests: `passwordPolicy.test.js`. Not done because they change current rules: a longer minimum, forced change after an admin reset, and bcrypt cost 12. |

### L6 — No per-account limit on password-reset codes

| Field | Details |
|---|---|
| Severity | LOW |
| Location | `server/src/controllers/auth.controller.js` (`requestPasswordReset`); `server/src/models/passwordReset.model.js` |
| Description | There is no per-account limit, so an attacker using many IPs can flood a victim's inbox. Each new code also resets the 5-attempt counter. Guessing a code stays very unlikely, but nothing limits retries per account. |
| Recommended fix | About 3 code requests per account per hour; keep the failure count across new codes. |
| Status | **Open** |

### L7 — Ticket data written to server logs

| Field | Details |
|---|---|
| Severity | LOW |
| Location | `server/src/controllers/ticket.controller.js` |
| Description | Three debug lines printed full ticket contents (title, description, attachment, assignees) to the server log on every edit. |
| Status | **Fixed (2026-11-03).** The debug lines were removed. Error logging is unchanged. |

### L8 — Email uniqueness is case-sensitive

| Field | Details |
|---|---|
| Severity | LOW |
| Location | `server/database/migrations/001_create_users.sql` (`UNIQUE (email)`); `server/src/models/user.model.js` (`findUserByEmail`) |
| Description | `A@x.com` and `a@x.com` can belong to different accounts. This causes confusion in reset flows and makes impersonation easier. |
| Recommended fix | Unique index on `LOWER(email)`; normalise emails when saving. |
| Status | **Open** |

---

### Informational / hardening

| # | Item | Details & recommendation |
|---|---|---|
| I1 | Dependencies | `npm audit --omit=dev`: root 0, server 0, client 8 moderate, all from `minimatch` through `exceljs → archiver`. That code runs in the browser on files the user chooses, so the risk is low. Add `npm audit` to CI. |
| I2 | Deploy pipeline | Every push to `main` deploys to production with no tests or approval step. `npm install` is used instead of `npm ci`, so the lockfile isn't enforced. The deploy user needs passwordless `sudo`. Recommendation: run `npm ci && npm test` first, require approval for production, and limit sudo to `systemctl reload nginx`. Keep `set -e` in the deploy script. |
| I3 | API port exposed | `server/src/server.js` listens on `0.0.0.0:3001` over plain HTTP. If the firewall doesn't block port 3001, clients can bypass nginx and TLS. Listen on `127.0.0.1` in production. |
| I4 | `NODE_ENV` defaults to `development` | If production doesn't set `NODE_ENV=production`, HSTS is off and development CORS origins are allowed. Set it explicitly. |
| I5 | Rate limiting depends on nginx | `trust proxy 'loopback'` only works if nginx sends `X-Forwarded-For`. Otherwise all users share one rate-limit bucket. Not verifiable from the repo. |
| I6 | Frontend security headers | Helmet only protects API responses. Add CSP, `X-Frame-Options: DENY`, `Referrer-Policy` and HSTS in nginx for the website itself. |
| I7 | Tokens in `localStorage` | Any XSS would expose the tokens. **No XSS sinks were found** (no `dangerouslySetInnerHTML` or `innerHTML`; React escapes output). |
| I8 | Database account | The app connects as the `postgres` superuser with a 6-character password. Use a separate app user with limited rights and a strong password. `.env` is gitignored and was never committed. |
| I9 | No audit trail | A `log` table exists but nothing writes to it. Log logins, failed logins, role/password/status changes, and leave approvals. |
| I10 | Leftover endpoints/files | Unauthenticated `GET /api/test/leave-entitlements` (`server/src/app.js`; harmless, remove it). `client/debug-kpi-structure.html` (not in the build, remove it). |

---

## 4. Areas tested and found secure

| Area | Result |
|---|---|
| SQL injection | All queries use `$n` parameters. Dynamic column names come from hard-coded allow-lists. |
| Command injection / RCE | No `child_process`, `eval`, `new Function` or `vm`. The KPI formula engine is a hand-written parser that runs no dynamic code. |
| Insecure deserialization | Only `JSON.parse` on assignee ID lists, converted to integers. |
| JWT implementation | `jsonwebtoken` 9 (rejects `alg:none`), separate access and refresh secrets, expiry enforced, revocation via `token_version`. The weaknesses are the secret values and trusting the role claim (C1). |
| Password storage | bcrypt with a per-password salt. Hashes are never returned by the API. |
| Password reset | Random OTP, bcrypt-hashed, 5-minute expiry, 5 attempts, single use; same response for unknown emails. |
| File upload | Extension, MIME and signature checks; random filenames; size limits; downloads only through authenticated routes with path checks and `nosniff`. |
| Ticket access | Tickets and attachments are visible only to the creator, assignees, Management, or the same-department HOD. |
| Notifications | Every query is limited to the logged-in user. |
| KPI data submission | Employees limited to their own assigned KPIs; HODs to their department. |
| Role switching | `switch-role` and token refresh check the requested role against the user's active roles. |
| Error handling | Generic messages; stack traces are not sent to clients. |
| SSRF / open redirect / file inclusion | No server-side requests to user-supplied URLs; no redirect endpoints; no dynamic `require`. |
| CSRF | Not applicable: authentication uses a bearer header, not cookies. |
| Secrets in git | `.env` was never committed. The only secrets in history are the placeholders behind C1. |
| Race conditions | Leave operations run in transactions with overlap checks; OTP use is atomic. |

---

## 5. Remediation plan (open items only)

| Priority | Item | Notes |
|---|---|---|
| **P0** | C1: rotate `JWT_SECRET` / `JWT_REFRESH_SECRET` on production and staging (and the SMTP/DB passwords), then re-apply the startup check and the role check (also fixes L4) | Update the server `.env` **before** deploying the code change, otherwise the server won't start. Everyone has to log in again once. |
| P1 | M3: server-side logout | Decide between "this device only" (needs a DB table) and "all devices" (no DB change). |
| P1 | M5 + L1: lockout abuse and account enumeration | No visible change for normal users. |
| P2 | L6: per-account limit on reset codes | |
| P2 | I2, I3, I4, I6, I8: deployment and server configuration | Server and nginx changes, no app code. |
| P3 | L8, I1, I5, I7, I9, I10 | Hardening. |

Each fix keeps current behaviour for legitimate use, adds Jest regression tests, and runs the full test suite.

---

## 6. Limitations

- **No live testing.** Attack simulations ran the real controllers and middleware with the database and file deletion mocked. Nothing ran against a live PostgreSQL instance.
- **Production configuration was not reviewed:** nginx config, production `.env`, firewall, TLS, OS permissions and DB grants. C1 (production), I3–I6 and I8 depend on these.
- The client-side review covered authentication, token handling and XSS sinks, not every UI page.

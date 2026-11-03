# HYLOC-MGT — Security Audit Report

**Date:** 2026-11-03
**Commit audited:** `382b501` (branch `main`), plus the working tree at that time
**Type:** Static white-box review (source code, configuration, git history, dependency audit). No live system was attacked.

---

## 1. Executive Summary

HYLOC-MGT is an internal HR / KPI / ticketing system (React + Express + PostgreSQL). The basics are solid: every SQL query uses parameters, uploads are checked and given random names, file paths are confined to their folders, error messages are generic, passwords use bcrypt, and password-reset codes are hashed, short-lived and single-use. Earlier fixes (leave self-approval, ticket attachment file deletion, email change without password, password policy, ticket debug logs) are still in place.

The main remaining risks are in **who gets which role** and **leave records**:

1. **Deactivated roles still work.** If an admin sets a user's role to "Inactive", that user still receives the role at their next login or token refresh, because login picks the user's oldest role row without checking its status (**H1**).
2. **Shared default password.** The admin screen creates and resets every account with the same password, `Password@123`, and users are never forced to change it. Anyone who knows this password and an employee ID (IDs are short and sequential, e.g. `70001`) can log in as any account that kept it (**H2**). Note: since the password-policy fix, the server rejects `Password@123`, so **creating users and resetting passwords from the admin screen currently fails**.
3. **Approved leave can be erased through the API.** The UI hides "Cancel" for approved leave, but the API lets an employee delete their own approved leave (getting the days back), and lets any HOD delete anyone's leave in any department (**H3**).
4. **JWT signing secrets** used placeholder values that are in git history. Local secrets were rotated; production rotation has not been confirmed and there is still no startup check (**C1**, potential).

**Overall risk rating: HIGH** (would be CRITICAL if production still uses the placeholder JWT secrets).

---

## 2. Scope

| Area | Covered |
|---|---|
| Backend | `server/src/**` — all 20 route files, all controllers, services, models, middleware, utils, schedulers |
| Frontend | `client/src/**` — API client, auth context, token storage, XSS sinks, role-gated pages relevant to findings |
| Database | `server/database/migrations/*.sql` |
| Config / CI | `server/src/config/*`, `.gitignore`, `.github/workflows/deploy.yml`, `vite.config.js` |
| Git history | 159 commits searched for secrets and credentials |
| Dependencies | `npm audit` in `/`, `/server`, `/client` |

**Not in scope / not available:** production server, nginx configuration, `server/.env` contents (not read), the live database, runtime testing against a running instance.

**Stack:** Node.js / Express 4, `pg` (PostgreSQL), `jsonwebtoken` 9, `bcryptjs`, `multer` 2, `helmet` 8, `express-rate-limit` 8, `nodemailer`; React 18 + Vite 6 + axios; deployed via GitHub Actions → SSH → PM2 + nginx.

---

## 3. Findings Overview (most severe first)

| ID | Severity | Finding | Status |
|---|---|---|---|
| C1 | CRITICAL | JWT signing secrets were placeholders committed to git; no guard against weak secrets | POTENTIAL |
| H1 | HIGH | Deactivated ("Inactive") role is still granted at login and token refresh | **FIXED** (2026-11-03) |
| H2 | HIGH | Every new / reset account gets the shared password `Password@123`; no forced change | CONFIRMED |
| H3 | HIGH | `DELETE /api/leaves/:id`: employee can erase own approved leave; any HOD can delete any leave | **FIXED** (2026-11-03) |
| M1 | MEDIUM | HODs receive every leave in the company (incl. reasons); department filter is client-side only | CONFIRMED |
| M2 | MEDIUM | HOD can edit pending leave of Employees in other departments | **FIXED** (2026-11-03) |
| M3 | MEDIUM | No server-side logout; 7-day refresh tokens in `localStorage` cannot be revoked per session | CONFIRMED |
| M4 | MEDIUM | Anyone can keep any account locked (lockout denial of service) | CONFIRMED |
| M5 | MEDIUM | Management role can grant Admin / Super admin and reset Admin passwords | POTENTIAL (may be intended) |
| L1 | LOW | Account enumeration via lockout response and response timing | CONFIRMED |
| L2 | LOW | Role removal takes effect only when the 15-minute access token expires | CONFIRMED |
| L3 | LOW | Requesting a new reset code resets the OTP attempt counter | CONFIRMED |
| L4 | LOW | `GET /api/leaves/:id` readable by any role other than Employee/HOD | CONFIRMED |
| L5 | LOW | Self-service email change has no format check / ownership verification; email match is case-sensitive | CONFIRMED |
| I1–I7 | INFO | Hardening items (see §6) | — |

---

## 4. Critical & High Findings

### C1 — JWT signing secrets were placeholders in git history

| Field | Detail |
|---|---|
| **Vulnerability** | Hard-coded / leaked JWT signing secret → token forgery |
| **Severity** | CRITICAL |
| **Location** | `server/src/config/index.js:42-46` (current); git history, removed in commit `6755e44` |
| **Description** | Earlier versions shipped fallback secrets `supersecret_access_please_change` and `supersecret_refresh_please_change`. Anyone with repo access knows them. If any environment's `.env` still uses these (or other weak) values, anyone can sign their own tokens. The current code only checks that the variables are *set*, not that they are strong or different from the old placeholders. |
| **Evidence** | `git log -S JWT_SECRET` → commit `6755e44`: `- secret: process.env.JWT_SECRET \|\| 'supersecret_access_please_change'`. Current `config/index.js:77-85` `validateEnvironment()` only tests presence. `auth.middleware.js:29` trusts `decoded.role` from the token. |
| **Attack Scenario** | 1. Attacker reads the placeholder from git history. 2. Signs `{userId: <admin id>, role: "Admin", tokenVersion: 0}` with it. 3. Sends it as `Authorization: Bearer …` → full admin access (the middleware only checks that the user exists, is active and the token version matches, which is 0 for most users). |
| **Impact** | Complete takeover of every account and all data. |
| **Likelihood** | Unknown → depends on production `.env`. Local `.env` was rotated on 2026-11-03; production/staging have not been confirmed. |
| **Recommended Fix** | 1. Rotate `JWT_SECRET` and `JWT_REFRESH_SECRET` on production and staging to 64+ random characters (`node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`). This logs everyone out once. 2. Then add to `validateEnvironment()`: refuse to start if either secret is shorter than 32 chars, equals a known placeholder, or the two are equal. (This was written before and reverted so production wouldn't refuse to start before its `.env` is updated — re-apply after step 1.) |
| **Status** | POTENTIAL (code path confirmed; production secret values not verified) |

---

### H1 — Deactivated role is still granted at login and token refresh

| Field | Detail |
|---|---|
| **Vulnerability** | Broken access control — revoked privilege still issued |
| **Severity** | HIGH |
| **Location** | `server/src/services/auth.service.js:59-70` (login), `:107-116` (refresh fallback); also used by `getLeaveApprovalContext` (`leave.controller.js:15-34`) and `assertCanDecideLeave` (`leave.service.js:38-53`) |
| **Description** | Login picks the role for the token with `SELECT r.role_name FROM user_roles ur JOIN roles r … WHERE ur.user_id = $1 ORDER BY ur.id ASC LIMIT 1` — **no `ur.status = 'active'` filter**. Admins revoke a role in *User Roles* by setting its status to "Inactive" (`UserRolePage.jsx:404`, `userRole.model.js:79`). If that role is the user's oldest row (usually the case), login still issues it. Token refresh does the same whenever the client-selected role isn't active. Everywhere else (`getActiveRoles`, `switchRole`) correctly filters on status. |
| **Evidence** | `auth.service.js:59-67` (query above) vs `user.model.js:304-313` `getActiveRoles` which has `AND ur.status = 'active'`. `auth.middleware.js` never re-checks the role. |
| **Attack Scenario** | 1. User X has Admin (user_roles row #1) and Employee (row #2). 2. Admin sets X's Admin row to Inactive to demote them. 3. X logs out and back in → token says `role: "Admin"` → X still has full admin APIs (create users, reset passwords, delete users). Same for a demoted HOD/Management/HR. |
| **Impact** | Demotions don't work; former admins/managers keep their powers indefinitely. |
| **Likelihood** | HIGH — the UI's normal way to remove a role is setting it Inactive. |
| **Recommended Fix** | Add `AND ur.status = 'active'` to both queries in `auth.service.js` (lines 63 and 111). If no active role remains, fall back to `'Employee'` as today. Optionally apply the same filter to the two leave "applicant role" queries. Add a unit test: inactive first role → token gets the next active role. |
| **Status** | **FIXED (2026-11-03).** Both queries in `auth.service.js` (login, line 63; refresh fallback, line 111) now include `AND ur.status = 'active'`, the same rule `getActiveRoles`/`switchRole` already used. If no active role is left, the user gets `Employee`, as before. The leave "applicant role" queries were not changed (no privilege is granted there). Tests: 3 new cases in `server/src/services/auth.service.test.js`. They fail without the fix and pass with it. Full suite: 76/76. **Follow-up:** users already logged in keep their current access token for up to 15 minutes (see L2). |

---

### H2 — Shared default password `Password@123` for every new or reset account

| Field | Detail |
|---|---|
| **Vulnerability** | Default / shared credentials, no forced change |
| **Severity** | HIGH |
| **Location** | `client/src/pages/admin/UsersPage.jsx:43-44, 117-118` (create form default), `:227` (reset always sends `'Password@123'`), `:821` (UI text tells admin the default); server has no "must change password" flag (no such column in `server/database/migrations/`) |
| **Description** | All accounts created or reset from the admin screen get the same, publicly visible password. Nothing forces the user to change it at first login. Employee IDs are short and sequential (e.g. staff photo names `70001.JPG … 70093.jpeg` in `server/public/uploads/users/`), so an insider can try the default against every ID. |
| **Evidence** | `UsersPage.jsx:227`: `await resetUserPassword(resetTarget.id, 'Password@123');` Login (`auth.service.js:26-56`) has no "password expired / must change" check. |
| **Attack Scenario** | 1. Any employee (or anyone who saw the admin screen) knows `Password@123`. 2. Tries empid `70001`, `70002`, … at `/api/auth/login` (5/min per IP is allowed). 3. Logs in as every colleague — including HOD/Management/Admin accounts — who never changed the default. |
| **Impact** | Account takeover of any account still on the default; with an Admin/Management account, full control. |
| **Likelihood** | HIGH — every account starts this way; the number still on the default is unknown (check: cannot be read from hashes directly, but can be tested offline with `bcrypt.compare('Password@123', hash)` per user). |
| **Recommended Fix** | 1. **Now:** run an offline check of all users' hashes against `Password@123` and force-reset those accounts. 2. Add `must_change_password BOOLEAN DEFAULT false` to `users`; set it to true on admin create/reset; make login return a flag and block all routes except `change-password` until it is changed. 3. Let the admin screen generate a random one-time password (or let the admin type one) instead of the fixed value. **Note — current breakage:** since the password policy fix, `getPasswordError('Password@123')` returns "too common" (`passwordPolicy.js:13`), so `POST /api/users` and `PATCH /api/users/:id/reset-password` from the admin UI now return 400. Step 3 fixes both problems. |
| **Status** | CONFIRMED (mechanism); number of affected accounts not verified |

---

### H3 — Approved leave can be deleted through the API; HOD can delete any leave

| Field | Detail |
|---|---|
| **Vulnerability** | Missing server-side business-rule enforcement / broken access control |
| **Severity** | HIGH |
| **Location** | `server/src/services/leave.service.js:617-654` (`cancelLeave`), route `leave.routes.js` `DELETE /:id` |
| **Description** | `cancelLeave` allows the owner to delete a leave **in any status** and refunds its Earned Leave days. It also allows *any* HR, HOD or Management user to delete *any* leave, with no department or applicant-role check. The UI only offers Cancel for Pending leave (`EmployeeCalendar.jsx:928-936, 1188-1196, 1298-1300`), and the HOD UI never offers cancelling others' leave (`HODCalendar.jsx` defines `handleCancelLeave` but never calls it). The function's own header says "Rule 7, 8: Can Only Delete Pending Leaves". |
| **Evidence** | `leave.service.js:631-634`: `const canManageAnyLeave = ['hr','hod','management'].includes(normalizedRole); if (existingLeave.user_id !== userId && !canManageAnyLeave) throw …` — no status check anywhere before `deleteLeave` at line 654; balance is refunded at 643-650. |
| **Attack Scenario** | A) Employee takes 5 days of approved Earned Leave, then sends `DELETE /api/leaves/<id>` → the record disappears (and its notifications are deleted), 5 days return to their balance. B) An HOD of department A sends `DELETE /api/leaves/<id>` for a Management member's or another department's approved leave → it is erased without trace. |
| **Impact** | Leave balances and attendance/payroll records can be falsified; audit trail is deleted. |
| **Likelihood** | MEDIUM-HIGH — requires only a valid login and one HTTP request (browser dev tools). |
| **Recommended Fix** | In `cancelLeave`: (1) for the owner (when not HR/Management), allow only `status === 'Pending'` — approved/rejected leave goes through the existing "request change" flow; (2) restrict HOD to Employee leaves of their own department, mirroring `assertCanDecideLeave`; (3) keep HR/Management as today unless you decide otherwise. **Business-rule check needed:** confirm that HR/Management are meant to delete approved leave (their UI does allow it at `ManagementCalendar.jsx:1305`, `HRCalendar.jsx:1334`). Then check past abuse: compare `leaves_entitlement.leaves_availed` against the sum of existing Earned Leave rows. |
| **Status** | **FIXED (2026-11-03).** `cancelLeave` in `leave.service.js` now works like this: **HR and Management** have the same rights as before (any leave, any status), because the owner hasn't decided otherwise and their screens allow it. **Everyone else** can cancel only *Pending* leave; approved or rejected leave has to go through "request change" first. An **HOD** cancelling someone else's leave must meet the same rule as approve/reject: the leave belongs to an Employee in the HOD's own department. That check was moved into a shared helper, `assertHodOwnsEmployeeLeave`, and approve/reject behave exactly as before. Errors: not allowed → 403, wrong status → 400 ("Leave cannot be cancelled in its current status"). No frontend change was needed, because the Employee screens only offer Cancel for Pending leave and the HOD screens don't offer it at all. Tests: 10 new cases in `server/src/services/leave.service.test.js`; the 5 security cases fail on the old code. Full suite: 86/86. **Follow-up:** check for past abuse with the balance comparison above. **Open decision:** whether HR/Management should keep deleting approved leave. |

---

## 5. Medium & Low Findings

### M1 — HODs receive all leaves company-wide (department filter is client-side only)

| Field | Detail |
|---|---|
| **Vulnerability** | Excessive data exposure / missing server-side scoping |
| **Severity** | MEDIUM |
| **Location** | `server/src/controllers/leave.controller.js:727-762` (`getAllLeaves`), `:686-721` (`getPendingLeaves`, line 706-708); client `client/src/pages/hod/leaves/LeaveApprovalPage.jsx:75-80` |
| **Description** | `GET /api/leaves/all` and `GET /api/leaves/pending` accept an optional `department_id` from the query string. An HOD can omit it (or pass any department) and receive every leave in the company, including `leave_reason` (may contain medical/personal information), names and employee IDs. The HOD approval page itself calls `getAllLeaves({ year })` without a department and filters in the browser. |
| **Evidence** | `leave.controller.js:706-708`: `if (userRole === 'HOD' && req.query.department_id) filters.department_id = parseInt(req.query.department_id);` — never forced to the HOD's own department. `LeaveRules.md`: "The HOD approval page filters visible leaves by department (implemented in the page's load/filter logic)". |
| **Attack Scenario** | HOD opens dev tools → `GET /api/leaves/all` → gets full leave history for all staff and Management. |
| **Impact** | Disclosure of personal leave reasons across departments. |
| **Likelihood** | MEDIUM — any HOD, one request. |
| **Recommended Fix** | For role HOD, set `filters.department_id` from the HOD's own `users.department_id` on the server, ignoring the query value. Check first that the HOD calendar (which intentionally shows other HODs' leave dates) uses `/department-leaves`, not `/all`, so it isn't affected. |
| **Status** | CONFIRMED |

### M2 — HOD can edit pending leave of Employees in other departments

| Field | Detail |
|---|---|
| **Vulnerability** | Broken object-level authorization |
| **Severity** | MEDIUM |
| **Location** | `server/src/services/leave.service.js:466-483` (`updatePendingLeave`) |
| **Description** | For non-owners, an HOD is only checked for "applicant is an Employee"; the department is not compared. Approve/reject *do* require the same department (`assertCanDecideLeave`, `leave.controller.js:824-829`), so this is inconsistent. |
| **Evidence** | Lines 477-483 check `existingLeave.user_role === 'employee'` only. |
| **Attack Scenario** | HOD of dept A sends `PUT /api/leaves/<id>` with new `from_date`/`to_date`/`leave_type` for a pending leave of an Employee in dept B → the request is altered before their own HOD sees it. |
| **Impact** | Tampering with other departments' leave requests. |
| **Likelihood** | MEDIUM |
| **Recommended Fix** | In the HOD branch, also require `applicant.department_id === hod.department_id` (reuse the query in `assertCanDecideLeave`). |
| **Status** | **FIXED (2026-11-03).** In `updatePendingLeave`, an HOD editing someone else's leave now goes through the shared `assertHodOwnsEmployeeLeave`, the same check approve, reject and cancel use. The leave must belong to an Employee in the HOD's own department, and an HOD with no department is refused. Owners, HR and Management are unchanged. A refused request gets 403 and nothing is saved. No frontend change was needed: the HOD screens only show the HOD's own department. Tests: 5 new cases in `server/src/services/leave.service.test.js`; the 3 security cases fail with the old check. Full suite: 91/91. |

### M3 — No server-side logout; refresh tokens can't be revoked per session

| Field | Detail |
|---|---|
| **Vulnerability** | Insufficient session invalidation |
| **Severity** | MEDIUM |
| **Location** | `server/src/routes/auth.routes.js` (no logout route); `client/src/context/AuthContext.jsx:162-165, 200` |
| **Description** | Logout only clears `localStorage`. A stolen refresh token (valid 7 days, stored in `localStorage`, readable by any script on the page) keeps minting access tokens until it expires, or until a password/status change bumps `token_version`. |
| **Evidence** | `AuthContext.jsx:163` `localStorage.setItem('refreshToken', …)`; `auth.service.js:137-158` accepts any unexpired refresh token whose `tokenVersion` matches. |
| **Attack Scenario** | Token copied from a shared/kiosk PC or via a future XSS → attacker keeps access for up to 7 days after the victim "logs out". |
| **Impact** | Prolonged account access after logout. |
| **Likelihood** | LOW-MEDIUM (needs token theft; no XSS was found). |
| **Recommended Fix** | Simplest: add `POST /api/auth/logout` that increments `token_version` (logs out *all* devices). Better: store refresh tokens (hashed, with an id) in a table, revoke on logout, rotate on each refresh. Optionally move the refresh token to an `HttpOnly; Secure; SameSite=Strict` cookie. **Decision needed:** "this device only" vs "all devices". |
| **Status** | CONFIRMED |

### M4 — Lockout denial of service

| Field | Detail |
|---|---|
| **Vulnerability** | Abuse of brute-force protection |
| **Severity** | MEDIUM |
| **Location** | `server/src/models/loginAttempt.model.js:31`; `server/src/services/auth.service.js:42-55`; `middlewares/authRateLimit.middleware.js:18-24` |
| **Description** | 10 wrong passwords lock an account for 15 minutes; the lock is checked before the password, so the real owner can't log in either. The per-account limiter allows 5 tries/minute, so anyone can lock any account in about 2 minutes and keep it locked forever with ~10 requests per 15 minutes. |
| **Evidence** | `failed_attempts + 1 >= 10 THEN NOW() + INTERVAL '15 minutes'`; `getLockSecondsRemaining` runs before `comparePassword`. |
| **Attack Scenario** | Script sends 10 bad logins for each Management empid every 15 minutes → management can't log in (they can still use Forgot Password). |
| **Impact** | Availability of chosen accounts. |
| **Likelihood** | MEDIUM — trivial to script, empids are guessable. |
| **Recommended Fix** | Keep the per-IP and per-account rate limits, but either (a) let a correct password through even while locked when the request comes from an IP with no recent failures, or (b) replace the hard lock with growing delays / CAPTCHA after N failures. |
| **Status** | CONFIRMED |

### M5 — Management can grant Admin / Super admin and reset Admin passwords

| Field | Detail |
|---|---|
| **Vulnerability** | Possible privilege escalation (depends on intended role design) |
| **Severity** | MEDIUM |
| **Location** | `server/src/routes/userRole.routes.js` (all `authorize('admin','management')`), `user.routes.js` (`POST /`, `PUT /:id`, `PATCH /:id/reset-password`), `user.model.js:163-187` |
| **Description** | Management users can assign any role id (including Admin) to anyone, including themselves, and reset any Admin's password. |
| **Evidence** | `createUserRole(userId, roleId, status)` with no check on which role is granted; `resetUserPassword` has no check on the target's role. |
| **Attack Scenario** | A Management account (or a stolen one) grants itself Admin, or resets the Admin's password and logs in as them. |
| **Impact** | Management → Admin escalation; Admin account takeover. |
| **Likelihood** | Depends on whether Management is meant to be equal to Admin. |
| **Recommended Fix** | If Management should *not* manage Admins: only Admin may grant Admin/Super admin roles or reset/edit/delete Admin accounts. **Owner decision needed** — may be intentional. |
| **Status** | POTENTIAL |

### L1 — Account enumeration

| Field | Detail |
|---|---|
| **Severity** | LOW |
| **Location** | `server/src/services/auth.service.js:28-55`; `auth.controller.js:36-46`; `auth.controller.js:147-210` |
| **Description / Evidence** | Unknown empids always return 401 quickly (no bcrypt). Existing active empids return 423 "locked" after 10 failures, and take ~100 ms longer per attempt (bcrypt). Password reset: an existing email triggers bcrypt + SMTP before responding, an unknown one returns at once. |
| **Attack Scenario** | Measure response times or trigger the lock to list valid empids/emails, then target them (see H2). |
| **Impact** | Helps targeted guessing; empids are already semi-public inside the company. |
| **Likelihood** | MEDIUM |
| **Recommended Fix** | Run a dummy `bcrypt.compare` when the user isn't found; send the reset email after responding (fire-and-forget). |
| **Status** | CONFIRMED |

### L2 — Role removal applies only when the access token expires

| Field | Detail |
|---|---|
| **Severity** | LOW |
| **Location** | `server/src/middlewares/auth.middleware.js:21-29`; `userRole.model.js:75-102` |
| **Description / Evidence** | The middleware trusts `decoded.role`. Deactivating/deleting a user_role row does not bump `token_version` (only password/status changes do — `user.model.js:140-142`). |
| **Attack Scenario** | A demoted admin keeps admin access for up to 15 minutes (indefinitely while H1 is open). |
| **Impact** | Short window of retained privilege. |
| **Likelihood** | LOW |
| **Recommended Fix** | Bump `users.token_version` in `updateUserRole`/`deleteUserRole` (and in `updateUser` when `role` changes), or check in the middleware that `decoded.role` is in the user's active roles. |
| **Status** | CONFIRMED |

### L3 — OTP attempt counter resets with each new code

| Field | Detail |
|---|---|
| **Severity** | LOW |
| **Location** | `server/src/models/passwordReset.model.js:3-15`; `auth.routes.js` (`passwordResetLimiter` is per IP only) |
| **Description / Evidence** | `createRequest` sets `attempts = 0` on every new request. There's no per-account cap on codes per hour. |
| **Attack Scenario** | From many IPs: request code → 4 guesses → request again … Each cycle has a ~1-in-250,000 chance; also floods the victim's inbox. |
| **Impact** | Very small chance of reset takeover; email spam. |
| **Likelihood** | LOW |
| **Recommended Fix** | Limit codes per account (e.g. 5 per hour) in `createRequest`, and keep a per-account failed-guess counter that isn't reset by a new code. |
| **Status** | CONFIRMED |

### L4 — Any role other than Employee/HOD can read any leave by id

| Field | Detail |
|---|---|
| **Severity** | LOW |
| **Location** | `server/src/controllers/leave.controller.js:309-340`; route `leave.routes.js` `GET /:id` (no `authorize`) |
| **Description / Evidence** | Only `EMPLOYEE` and `HOD` are restricted to their own leave. Admin, Super admin, and any custom role created via `/api/roles` can read every leave including reasons. |
| **Attack Scenario** | A user with a custom role (e.g. "Accounts") enumerates `/api/leaves/1..N`. |
| **Impact** | Disclosure of leave reasons. |
| **Likelihood** | LOW (depends on custom roles existing) |
| **Recommended Fix** | Allow-list instead: owner, HR, Management, and HOD-of-same-department; deny everyone else. |
| **Status** | CONFIRMED |

### L5 — Self-service email change: no format check, no verification, case-sensitive match

| Field | Detail |
|---|---|
| **Severity** | LOW |
| **Location** | `server/src/controllers/user.controller.js:394-459`; `user.model.js:75-83` |
| **Description / Evidence** | Any string is accepted as an email (current password is required). The new address isn't verified, and `WHERE u.email = $1` is case-sensitive, so `Boss@corp.com` and `boss@corp.com` can belong to two accounts. |
| **Attack Scenario** | A user sets an address they don't own; reset codes/notifications for that account go to a third party; or creates a look-alike of a colleague's email. |
| **Impact** | Confusion / misdirected reset emails. |
| **Likelihood** | LOW |
| **Recommended Fix** | Validate email format; compare with `LOWER(email)` and add a unique index on `LOWER(email)`; optionally send a confirmation code to the new address. |
| **Status** | CONFIRMED |

---

## 6. Informational / Hardening

| ID | Item | Location | Note |
|---|---|---|---|
| I1 | Unauthenticated test endpoint | `server/src/app.js:159-161` | Returns static text only; remove. |
| I2 | API listens on `0.0.0.0:3001` | `server/src/server.js:9` | If the host firewall allows 3001, the API is reachable without nginx (no TLS). Bind to `127.0.0.1` in production or confirm firewall. |
| I3 | Deploy uses `npm install`, restarts before build | `.github/workflows/deploy.yml:39, 46` | Use `npm ci` so production installs exactly the lockfile. |
| I4 | Tokens in `localStorage` | `client/src/context/AuthContext.jsx:162-165` | No XSS sink was found (no `dangerouslySetInnerHTML`/`innerHTML`), but any future XSS would expose tokens. See M3. |
| I5 | Frontend security headers | nginx (not in repo) | Helmet's CSP only applies to API responses. Confirm nginx sets CSP, `X-Frame-Options`/`frame-ancestors`, HSTS for the SPA. |
| I6 | All users can list every active user's email and role | `GET /api/users/assignable` (`user.model.js:316-329`) | Needed for ticket assignment; consider returning names only. |
| I7 | `.gitignore` lists tracked files | `.gitignore` (`server/src/config/db.js`, `server/src/server.js`) | Has no effect on tracked files; harmless but misleading. `client/debug-kpi-structure.html` is outside `public/` and is not served. |

---

## 7. Areas Tested and Found Secure

- **SQL injection:** all queries use `$n` parameters; dynamic `SET` clauses are built only from fixed allow-lists (`user.model.js:132`, `leave.model.js:193-198`, `leaveEntitlement.model.js:141`, `kpi-value.model.js:160-181`, `ticket.model.js:476-490`); month columns come from a fixed map.
- **Code execution:** KPI formulas are parsed by a custom tokenizer/AST (`utils/formulaEvaluator.js`), no `eval`/`Function`/`child_process`.
- **File uploads:** random 32-hex names, extension + MIME allow-list, magic-byte check (`utils/uploadValidation.js`), size limits, `nosniff`; ticket attachments only via authorized `GET /api/tickets/:id/attachment`.
- **Path traversal:** user photos and ticket attachments are reduced to `basename` and confined to their folders (`app.js:46-90`, `ticket.controller.js:105-115`, `user.controller.js:12-41`).
- **Tickets:** view/edit/delete/attachment restricted to creator, assignee, Management, or same-department HOD; attachment path can't be set from request body (earlier fix intact).
- **Notifications:** every query filters on `assigned_to = current user`.
- **Leave approve/reject and status changes via PUT:** self-approval blocked; HOD limited to own-department Employees (earlier fix intact).
- **KPI data entry:** Employees can only submit for themselves; HODs only for their department; KPI assignment checked.
- **JWT handling:** HMAC secret with `jsonwebtoken` 9 (rejects `alg: none`); `token_version` + active-status check on every request; password and status changes invalidate tokens.
- **Password reset:** OTP from `crypto.randomInt`, bcrypt-hashed, 5-minute expiry, 5 guesses, single use, same response for unknown emails.
- **Passwords:** bcrypt (cost 10), shared policy on every set-password path.
- **Errors:** global handler returns generic messages; stack traces only in server logs.
- **CORS:** production allows only `https://hyloc.git.edu`; bearer-token auth means no CSRF exposure.
- **Secrets in git history:** apart from the JWT placeholders (C1), no DB/SMTP/API credentials found; `.env` was never committed.

---

## 8. Dependency Review

| Package set | Command | Result |
|---|---|---|
| Server (production deps) | `npm audit --omit=dev` | **0 vulnerabilities** |
| Server (incl. dev deps) | `npm audit` | 4 low, 24 moderate — all in dev tooling (`eslint`, `jest`, `nodemon` chains, mainly `minimatch` ReDoS). Not shipped to production runtime. |
| Client | `npm audit` | 15 moderate — `minimatch` ReDoS via `eslint` / `eslint-plugin-react` (dev) and `exceljs → archiver → glob` (runs in the browser on trusted, app-generated data). Low real-world risk. |
| Root | `npm audit` | 0 |

Recommendation: update `eslint` to 9.x when convenient; watch for an `exceljs` release that drops the vulnerable `archiver` chain. No urgent action.

---

## 9. Quick Wins (small change, high value)

1. **H1** — add `AND ur.status = 'active'` to two queries in `auth.service.js` (≈2 lines).
2. **C1** — rotate production/staging JWT secrets (config only), then re-apply the startup check.
3. **H3** — add a "Pending only" check for owners and a department check for HODs in `cancelLeave` (≈10 lines).
4. **M1** — force HOD `department_id` from the database in `getAllLeaves`/`getPendingLeaves` (≈6 lines).
5. **H2 (immediate part)** — offline-check all password hashes against `Password@123` and force-reset matches.

---

## 10. Remediation Roadmap

| Order | Items | Effort | Notes |
|---|---|---|---|
| 1 — today | C1 rotation; H2 offline hash check | < 1 h | Rotation logs everyone out once. |
| 2 — this week | H1, H3, M1, M2 | ~half day | Small, local server changes with unit tests. H3 needs a quick yes/no on HR/Management deleting approved leave. |
| 3 — this week | H2 proper fix (must-change-password flag + no fixed default) | ~1 day | Also fixes the currently broken admin create/reset flow. |
| 4 — next sprint | M3 (logout/refresh revocation), M4 (lockout), L2 | 1–2 days | M3 needs the "this device vs all devices" decision. |
| 5 — decision | M5 | — | Confirm whether Management may manage Admins. |
| 6 — backlog | L1, L3, L4, L5, I1–I7, dependency updates | 1 day total | Hardening. |

---

## 11. Limitations

- Static review only; no requests were sent to a running server. Findings marked CONFIRMED are proven from code paths, not live exploitation.
- `server/.env`, production configuration, nginx config and the live database were not inspected, so C1 and the number of accounts affected by H2 are unverified.
- Business rules were inferred from code, comments, UI behaviour and `LeaveRules.md`; findings M5 and parts of H3/M1 note where the intended rule should be confirmed.



# Leave Rules (implemented behavior only)

This document lists the leave-related behaviors that are implemented in the system for the three roles present in code: `Management`, `Manager`, and `Employee`. Items that were assumptions or not found in the codebase have been removed.

1. Management

 - Scope
   - Can view all leaves via the Calendar.

 - Applying for leave
   - Management may apply  using the same Calendar. 
   - Management applications are created with `status = 'Approved'` and `approved_by` set to the applicant (auto-approved behavior).

 - Approval / Rejection
   - Management can approve or reject leaves(of Manager/Employee roles) via the Approve/Reject  (Management authorization allows acting on any applicant role).

- Notifications 
   - Notifications are created for apply/approve/reject actions. 

Notes:
  - Notifications are going to all members of mgmt team.


***********************************************************************************************

2. Manager

- Scope
   - Managers are authorized to approve/reject leave requests for Employees and to view pending leaves scoped to department.

 - Applying for leave
   - Managers may apply using the standard apply endpoint (same validation as other roles).

 - Approval workflow
   - Managers use the approve and reject endpoints to change status. The controller enforces that Managers may only approve/reject leaves where the applicant's role is `Employee`.

 - View pending approvals
   - The pending endpoint returns pending leaves; Managers may filter by department identifier.

 - Update vs delete
   - Managers (and Management) may update status/`approved_by` via the update endpoint for others. Deletion/cancellation of a leave record is allowed only by the leave owner via the cancel endpoint.

- Notes:
  - A Mgrr from another department can approve/reject an Employee's leave.(Update if required)
  - Notifications are going to all mgrs(only to the same deptartment)


***********************************************************************************************

3. Employee

 - Apply for leave
   - The apply endpoint handles validation and creation. Required fields are enforced by controller/service (e.g., `from_date`, `leave_reason`).

- Date validation
   - The service validates date formats and enforces `from_date` ≤ `to_date`.

- Partial-day support
   - `Morning Half` and `Afternoon Half` are supported and credited as `0.5` days in the service logic.

- Paid / Unpaid split
   - When available Paid balance is insufficient, the service splits the request into Paid and Unpaid segments (multiple leave records may be created) and updates entitlements for Paid segments.

 - Alternate person / department colleagues
   - The colleagues endpoint returns department colleagues for alternate-person selection.
   - If `alternate_person` is provided on apply, a notification is created for that user.

 - Leave balance and history
   - The balance endpoint returns entitlement/balance information. The history endpoint returns leave history for a year.

 - Cancel / update
   - Owners may cancel their own leave via the cancel endpoint; when a paid leave is cancelled, entitlements are restored and related alternate-person notifications are removed.
   - Owners may update their own pending (or permitted) leave via the update endpoint (dates, duration, etc.). When an approver permits a change and moves a leave back to pending, the owner receives a notification.

 - Request change for Approved/Rejected
   - A request-change endpoint exists; employees may request approver permission to edit/cancel an approved or rejected leave. Routing implemented: if `credited_days > 2` the request notifies Management recipients; otherwise it notifies department managers.

 - Department leaves (calendar)
   - The department leaves endpoint returns leaves for the department with role-based filtering implemented (Employees see department Employees; Managers see additional Manager leaves per controller logic).

4. Common system behaviors (implemented)

- Notifications
   - Notification records are created for application submission, approvals, rejections, alternate-person assignment, and request-change flows. Notifications are stored via the notifications model.

- Audit-related persistence
   - Leave records persist `created_at`/`approved_by` and other fields useful for auditing; notification records include timestamps and actor information.

***********************************************************************

1.Inspect the monthly row for the user/year
SELECT *
FROM employee_monthly_working_days
WHERE user_id = 9817 AND year = 2026;

2.If no row, list any rows for that user (other years)
SELECT *
FROM employee_monthly_working_days
WHERE user_id = 9817
ORDER BY year DESC;

3.If still nothing, find by empid (replace EMP123 with the employee's EmpID)
SELECT u.id AS user_id, u.empid, em.*
FROM users u
LEFT JOIN employee_monthly_working_days em ON em.user_id = u.id
WHERE u.empid = 'EMP123';


4.Check leaves_entitlement entries
SELECT *
FROM leaves_entitlement
WHERE user_id = 9817
ORDER BY year DESC;

5.Compute total_days and expected entitlement from months (single query)

WITH totals AS (
  SELECT user_id,
    (COALESCE(jan_duration,0)+COALESCE(feb_duration,0)+COALESCE(mar_duration,0)+
     COALESCE(apr_duration,0)+COALESCE(may_duration,0)+COALESCE(jun_duration,0)+
     COALESCE(jul_duration,0)+COALESCE(aug_duration,0)+COALESCE(sep_duration,0)+
     COALESCE(oct_duration,0)+COALESCE(nov_duration,0)+COALESCE(dec_duration,0)
    ) AS total_days
  FROM employee_monthly_working_days
  WHERE user_id = 9817 AND year = 2026
)
SELECT user_id, total_days,
       CEIL(total_days/20.0) AS expected_entitlement
FROM totals;

6.Common causes and quick fixes
Row exists but all month columns = 0 → CSV import probably used wrong column mapping or wrong year. Re-import the CSV for year 2026 or manually UPDATE the row:
UPDATE employee_monthly_working_days
SET jan_duration=18.5, feb_duration=20, mar_duration=20, apr_duration=20,
    may_duration=20, jun_duration=20, jul_duration=20, aug_duration=20,
    sep_duration=20, oct_duration=20, nov_duration=20, dec_duration=20
WHERE user_id = 9817 AND year = 2026;

-No row for year 2026 but a row for another year (e.g., 2027) → import used wrong year; move data or re-import.
-Row present for different user_id → mapping used empid incorrectly; find correct user_id via users table.
-After correcting monthly values, run the generator for 2027:


-----------------------------------------------------------------------
1.Confirm table columns (shows which reference column exists: user_id or empid):
SELECT column_name
FROM information_schema.columns
WHERE table_schema='public' AND table_name='employee_monthly_working_days'
ORDER BY ordinal_position;

2.Find any rows for this user across years (matches any reference column):
SELECT *
FROM employee_monthly_working_days
WHERE (user_id = 9817 OR empid::text = (SELECT empid::text FROM users WHERE id = 9817))
ORDER BY year DESC, updated_at DESC
LIMIT 50;

3.Show any rows in 2026 that have non-zero months (find where your upload wrote data):
SELECT *
FROM employee_monthly_working_days
WHERE year = 2026
  AND (COALESCE(jan_duration,0)+COALESCE(feb_duration,0)+COALESCE(mar_duration,0)+
       COALESCE(apr_duration,0)+COALESCE(may_duration,0)+COALESCE(jun_duration,0)+
       COALESCE(jul_duration,0)+COALESCE(aug_duration,0)+COALESCE(sep_duration,0)+
       COALESCE(oct_duration,0)+COALESCE(nov_duration,0)+COALESCE(dec_duration,0)) > 0
ORDER BY updated_at DESC
LIMIT 50;


4.Show the user record and joining year (to rule out join-year rule causing 0):
SELECT id, empid, created_at, EXTRACT(YEAR FROM created_at)::int AS joining_year
FROM users
WHERE id = 9817;

5.Check the leaves_entitlement row written for 2027:
SELECT *
FROM leaves_entitlement
WHERE user_id = 9817 AND year = 2027;

SELECT id, empid, created_at, EXTRACT(YEAR FROM created_at)::int AS joining_year
FROM users
WHERE id = 9817;

SELECT id, empid, email, created_at
FROM users
WHERE id = 9817 OR empid::text = '9817';
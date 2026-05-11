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

# Ticket Workflow (Implemented Behavior Only)

This document describes what is currently implemented in the ticket module as of now.

1. Who is involved in the ticket process
   1. Any logged-in user can access the ticket pages and ticket functions.
   2. Application roles that use tickets in the UI navigation are: Admin, Management, Manager, and Employee.
   3. Operational roles used inside the workflow are:
      - Ticket Creator (the person who created the ticket)
      - Assignee (the person currently assigned to the ticket)
      - Management role users (used in specific permission and notification cases)
      - Manager role users (used in status-change notification query logic)

2. Ticket statuses currently implemented
   1. The backend workflow logic explicitly uses these statuses:
      - Open
      - Assigned
      - In Progress
      - Rejected
      - Resolved
      - Closed
   2. The UI fallback list may also show: Pending and Overdue.
   3. Overdue is treated as a due-date condition (date-based), not as a backend workflow transition in the status transition map.

3. Ticket creation rules
   1. A ticket can be created by any logged-in user.
   2. Required fields for creation are:
      - Title
      - Due Date
      - Creator (taken from logged-in user)
   3. Description is saved (UI also enforces description as required in the form).
   4. If the creator assigns the ticket during creation, the system forces status to Assigned.
   5. If not assigned on creation, default status is Open.

4. Assignment behavior currently implemented
   1. Assignment is supported through the Assign To field.
   2. On create:
      - If assigned by creator, status is forced to Assigned.
   3. On update:
      - If creator sets assigned_to, status is forced to Assigned.
      - Reassignment to a different person sends an assignment notification to the new assignee.
   4. In the edit form, assignment and status are linked in UI behavior:
      - If status is Open and user assigns someone, UI changes status to Assigned.
      - If assignee is cleared while status is Assigned, UI changes status back to Open.

5. Allowed status movement path (backend enforced)
   1. Open -> Assigned or Rejected
   2. Rejected -> Open
   3. Assigned -> In Progress or Rejected
   4. In Progress -> Resolved
   5. Resolved -> Closed
   6. Closed -> no further transition
   7. Any status change outside this map is rejected.

6. Special implemented behavior for Rejected
   1. Rejected is allowed in transition checks.
   2. After a Rejected change is processed, backend logic converts it to:
      - Status = Open
      - assigned_to = null (unassigned)
   3. This makes Rejected a transient step in implementation (it is immediately turned into Open + unassigned).

7. Who can change status to what
   1. In Progress, Rejected, and Resolved:
      - Only the currently assigned user can set these statuses.
   2. Closed:
      - Only the ticket creator can set status to Closed.
      - Also, transition map requires current status to be Resolved before Closed.
   3. Assigned and Open:
      - Governed by transition map plus general field-edit permission rules.

8. Field edit permissions currently implemented
   1. Due Date:
      - Only Management role users or the ticket creator can change due date.
      - Manager role users are not allowed unless they are also the ticket creator.
   2. Users who are not Management, not Creator, and not Assignee:
      - Can only edit title and description.
   3. Assignee and Creator and Management are not limited to title/description by that restriction block.

9. Closing rules
   1. To close a ticket, two implemented conditions must both be true:
      - Current status must be Resolved (because only Resolved -> Closed is allowed)
      - Action must be performed by the ticket creator

10. Can a ticket go back to a previous step
   1. Implemented backward route:
      - Rejected -> Open
   2. In actual runtime logic, setting Rejected results in Open + unassigned.
   3. No other backward transitions are implemented in the transition map.

11. Deletion rules currently implemented
   1. Backend allows deletion only when ticket status is Closed.
   2. Backend delete check does not enforce creator/role ownership; it checks only Closed status.
   3. UI shows delete action to creator, but backend delete rule itself is status-based.

12. Notification behavior currently implemented
   1. On create with assignee:
      - Assignee receives a ticket assignment notification.
   2. On reassignment to a new assignee:
      - New assignee receives a ticket assignment notification.
   3. On status Rejected:
      - Creator receives a rejection-format notification.
   4. On status Resolved:
      - Creator receives a resolved-format notification.
   5. Manager recipients are queried in status-change logic, but manager notification sends for status-change are currently commented out.

13. Overdue handling currently implemented
   1. A ticket is treated as overdue when due date is before today and status is not Closed.
   2. Overdue indicators are used in UI filters/highlighting.
   3. Scheduler logic exists for overdue notifications.
   4. Scheduler currently sends overdue notifications to Management role users.
   5. Scheduler is configured with cron expression: 50 15 19 2 *.

14. Ticket access scope by role in current implementation
   1. Ticket route is behind login (authenticated access), not role-restricted to one role.
   2. Tickets menu appears for Admin, Management, Manager, and Employee in sidebar configuration.
   3. Ticket APIs for list/create/update/delete use authentication; no role-only gate is applied on ticket routes themselves.

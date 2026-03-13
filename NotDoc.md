**Notification Rules (NotDoc)**

This document explains, in plain language, when notifications are sent and when they are received for each role in the system: Employee, Manager, Management, and Admin. It focuses on business rules and expected behaviors — no technical details.

**How to read this document**
- **Sent by:** Actions or events that cause a person in this role to trigger a notification to others.
- **Received by:** Situations where a person in this role will get a notification from others or the system.

---

**Employee**
- Sent by Employee:
  - Submits a leave request: notifies their Manager (and HR/Admin if required).
  - Creates or updates a support/dev ticket: notifies the assigned support/engineering team and their Manager if escalation is needed.
  - Submits a KPI update or self-assessment: notifies their Manager and relevant reviewers.
  - Comments, mentions, or replies in a ticket or workflow: notifies the people mentioned and the ticket owner.
  - Requests a role, access, or profile change: notifies Admin/HR and the approving Manager.

- Received by Employee:
  - Approval or rejection of their leave, request, or change: from Manager or Admin.
  - Updates to tickets they created or are assigned to: from support/dev or Manager.
  - Manager feedback, assignments, or performance notes: from their Manager.
  - Organization-wide announcements or policy updates: from Management or Admin (if relevant to all staff).
  - Reminders for pending tasks, deadlines, or missing information: automated or sent by Manager/Admin.

---

**Manager**
- Sent by Manager:
  - Approves or rejects employee leave, requests, or changes: notifies the Employee (and HR/Admin when needed).
  - Assigns work, tasks, or KPIs to direct reports: notifies the assigned Employee(s).
  - Escalates tickets or issues that need higher attention: notifies Management or Admin and the original requester.
  - Provides feedback or performance notes: notifies the Employee and optionally HR/Management when formal review is required.

- Received by Manager:
  - New leave requests, change requests, or approvals needing their action: from Employees and the system.
  - Updates on tickets and tasks owned by their team: from Employees or support/dev teams.
  - Team summaries, status reports, or exception alerts: from Admin, Management, or automated reports.
  - Requests for additional resources or approvals from their direct reports.

---

**Management** (Senior leadership / Executives)
- Sent by Management:
  - Organization-wide announcements, policy changes, and strategic directives: notifies all roles (Employees, Managers, Admin).
  - Requests for high-level reports, budget approvals, or program decisions: notifies Managers and Admin as appropriate.
  - Escalations that affect multiple teams or require cross-functional action: notifies Managers and Admin.

- Received by Management:
  - Consolidated reports, KPIs, and summaries from Managers and Admin (regularly scheduled or ad-hoc).
  - Critical escalations that need executive input or decisions.
  - Notifications about major policy, compliance, or audit items requiring leadership awareness.

---

**Admin** (HR / System administrators / Operations)
- Sent by Admin:
  - Account, role, and access changes (user created, role assigned, permissions updated): notifies the affected Employee and their Manager.
  - Policy, benefits, or payroll communications: notifies Employees and Managers as appropriate.
  - System-wide maintenance, downtime, or security alerts: notifies Managers, Employees, and Management depending on impact.
  - Reminders or compliance deadlines (e.g., mandatory training): notifies targeted users and their Managers.

- Received by Admin:
  - Requests for account or role changes from Employees or Managers.
  - Reports of incidents, errors, or suspicious activity from the system or other roles.
  - Approval confirmations or follow-ups from Managers and Management.

---

**General business rules (applies to all roles)**
- Priority: Notifications are distinguished between urgent (requires immediate action) and informational (for awareness). Urgent items should clearly state the required action.
- Recipient relevance: Notifications should only go to people who need to act or be aware — avoid broad, unnecessary alerts.
- Escalation: If an action is not acknowledged or completed within a defined business timeframe, the notification can be escalated to the next role (e.g., Manager → Management).
- Acknowledgement: For approvals and critical actions, the sender typically expects a confirmation or visible status update.
- Auditability: Notifications about approvals, role changes, and compliance should be logged for record-keeping and follow-up (business process note).

---



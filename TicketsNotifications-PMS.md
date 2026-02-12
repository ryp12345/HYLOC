# Help Tickets & Notifications Functionality Documentation

This document provides a comprehensive overview of the "Help Tickets" and associated "Notifications" features, including database schema, business rules, workflow, hierarchy, and notification logic. It is intended as a blueprint for implementing these features in any project.

---

## 1. Tickets Table Schema (SQL)

```sql
CREATE TABLE tickets (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Open',
    priority VARCHAR(20) NOT NULL DEFAULT 'Normal',
    created_by INT NOT NULL,
    assigned_to INT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP,
    resolution TEXT,
    attachment_url VARCHAR(255),
    to_complete_date TIMESTAMP, -- Deadline for ticket completion
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (assigned_to) REFERENCES users(id)
);
```

---

## 2. Notification Tables Schema (SQL)

```sql
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL, -- e.g., 'ticket_created', 'ticket_status_changed', 'ticket_overdue'
    message TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_notifications (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    notification_id INT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (notification_id) REFERENCES notifications(id)
);
```

---

## 3. Business Rules

### Ticket Rules

- Any authenticated user can create a ticket.
- Title, description, category are mandatory.
- Tickets can be assigned to staff (manual/automatic).
- Status transitions: Open → In Progress → Resolved/Closed/Rejected.
- Only assigned staff or authorized roles can change status.
- Resolution note required for 'Resolved'.
- 'Closed' can be set by creator after review.
- 'Rejected' requires a reason.
- Tickets have a completion deadline (`to_complete_date`).
- Tickets not closed by deadline are marked overdue and escalated.

### Notification Rules

- Notifications are sent for:
  - Ticket creation: Assigned staff notified.
  - Status change: All involved users notified (creator, assigned staff).
  - Ticket overdue: Assigned staff and management notified.
- Notifications are stored and can be marked as read.
- NotificationBell component displays unread notifications for the logged-in user.
- Notification types are extensible (e.g., comments, reassignment).

---

## 4. Assumptions

- There is a `users` table with at least `id`, `role`, and `email` fields.
- Roles include Employee, HR, Management, Manager, Admin, IT Staff.
- The application supports authentication and role-based access control.
- File attachments are stored and accessible via URLs.
- Notification system supports in-app and optionally email notifications.
- Timestamps are stored in UTC.
- Ticket categories and notification types are configurable.

---

## 5. Sequential Workflow

### Ticket Workflow

1. User selects "Help Tickets" from dashboard.
2. User clicks "Raise Ticket", fills form, submits.
3. Ticket is created with status 'Open', deadline set.
4. Assigned staff receives notification.
5. Staff updates ticket status, adds comments/resolution.
6. Status changes trigger notifications to involved users.
7. If ticket is not closed by `to_complete_date`, system marks as overdue and notifies management.
8. Ticket creator reviews resolution, closes ticket or reopens if unsatisfied.

### Notification Workflow

1. Notification created in response to ticket events (creation, status change, overdue).
2. Notification linked to relevant users in `user_notifications`.
3. NotificationBell component fetches unread notifications for user.
4. User marks notifications as read.

---

## 6. Hierarchy & Roles

- **Employee**: Can create/view their own tickets, comment, close tickets, receive notifications.
- **IT/Support Staff**: Can view/assign tickets, update status, add resolution, receive notifications.
- **HR/Management/Admin**: Can view all tickets, assign/reassign, escalate, override status, receive notifications (especially for overdue/escalated tickets).
- **Manager**: May have visibility over tickets raised by their team, receive notifications for escalated tickets.

---

## 7. Notification Events & Logic

### Ticket Creation

- When a ticket is created, a notification is sent to the assigned staff.
- Example: "A new ticket has been assigned to you: [title]"

### Status Change

- When ticket status changes (e.g., In Progress, Resolved, Closed, Rejected), notifications are sent to:
  - Ticket creator
  - Assigned staff
- Example: "Ticket [title] status changed to [status] by [user]"

### Ticket Overdue

- If ticket is not closed by `to_complete_date`, a notification is sent to:
  - Assigned staff
  - Management/Admin
- Example: "Ticket [title] is overdue. Please take action."

### Additional Events

- Comments, reassignment, escalation can trigger notifications as needed.

---

## 8. Additional Notes

- All actions (creation, assignment, status change, comments, notifications) are logged for audit.
- UI should provide filters for tickets and notifications (by status, category, priority, assigned staff, etc.).
- SLA and escalation rules should be configurable.
- Notification system should be extensible for new event types.
- NotificationBell should poll or use websockets for real-time updates.

---

**End of Document**

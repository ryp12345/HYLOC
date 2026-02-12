# Help Tickets & Notifications Functionality Documentation

This document provides a comprehensive overview of the "Help Tickets" and associated "Notifications" features, including database schema, business rules, workflow, hierarchy, and notification logic. It is intended as a blueprint for implementing these features in any project.

---

## 1. Tickets Table Schema (SQL)

```sql
CREATE TABLE IF NOT EXISTS public.tickets
(
    id integer NOT NULL DEFAULT nextval('tickets_id_seq'::regclass),
    title character varying(255) COLLATE pg_catalog."default" NOT NULL,
    description text COLLATE pg_catalog."default" NOT NULL,
    status enum_tickets_status DEFAULT 'Open'::enum_tickets_status,
    category enum_tickets_category DEFAULT 'Other'::enum_tickets_category,
    priority enum_tickets_priority DEFAULT 'Medium'::enum_tickets_priority,
    created_by integer NOT NULL,
    assigned_to integer,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at timestamp without time zone,
    resolution text COLLATE pg_catalog."default",
    attachment_url character varying(255) COLLATE pg_catalog."default",
    to_complete_date date NOT NULL,
    CONSTRAINT tickets_pkey PRIMARY KEY (id),
    CONSTRAINT fk_assigned_to FOREIGN KEY (assigned_to)
        REFERENCES public.users (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE SET NULL,
    CONSTRAINT fk_created_by FOREIGN KEY (created_by)
        REFERENCES public.users (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
)
```

---

## 2. Notification Tables Schema (SQL)

```sql
CREATE TABLE IF NOT EXISTS public.notifications
(
    id integer NOT NULL DEFAULT nextval('notifications_id_seq'::regclass),
    user_id integer NOT NULL,
    message text COLLATE pg_catalog."default" NOT NULL,
    priority enum_notifications_priority DEFAULT 'Medium'::enum_notifications_priority,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT notifications_pkey PRIMARY KEY (id),
    CONSTRAINT fk_notification_ticket FOREIGN KEY (ticket_id)
        REFERENCES public.tickets (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE,
    CONSTRAINT fk_notification_user FOREIGN KEY (user_id)
        REFERENCES public.users (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
)


CREATE TABLE IF NOT EXISTS public.user_notifications
(
    id integer NOT NULL DEFAULT nextval('user_notifications_id_seq'::regclass),
    user_id integer NOT NULL,
    notification_id integer NOT NULL,
    is_read boolean NOT NULL DEFAULT false,
    read_at timestamp without time zone,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_notifications_pkey PRIMARY KEY (id),
    CONSTRAINT unique_user_notification UNIQUE (user_id, notification_id),
    CONSTRAINT fk_user_notifications_notification FOREIGN KEY (notification_id)
        REFERENCES public.notifications (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE,
    CONSTRAINT fk_user_notifications_user FOREIGN KEY (user_id)
        REFERENCES public.users (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
)
```

---

## 3. Business Rules

### Ticket Rules

- Any authenticated user can create a ticket.
- Title, description, category are mandatory.
- Tickets can be assigned to any user (manual/automatic...depends).
- Status transitions: Open → In Progress → Resolved/Closed/Rejected.
- Only the user who is assigned the ticket can change the status(however the management and manager can override the status).
- Resolution note required for 'Resolved'.
- 'Closed' can be set by creator after review.
- 'Rejected' requires a reason.
- Tickets have a completion deadline (`to_complete_date`).
- Tickets not closed by deadline are marked overdue and escalated(notification sent to the users of role ,management and the the user who created_by ).

### Notification Rules

- Notifications are sent for:
  - Ticket creation: assigned_to user notified.
  - Status change:  users notified (created_by).
  - Ticket overdue: Assigned staff and management notified.
- Notifications are stored and can be marked as read.
- NotificationBell component displays unread notifications for the logged-in user.
- Notification types are extensible (e.g., comments, reassignment).

---

## 4. Assumptions

There is a `users` table schema is as below
- CREATE TABLE IF NOT EXISTS public.users
  (
  id integer NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 ),
  empid bigint,
  department_id integer,
  designation_id integer,
  status character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'active'::character varying,
  phone character varying(25) COLLATE pg_catalog."default",
  address text COLLATE pg_catalog."default",
  firstname character varying(100) COLLATE pg_catalog."default" NOT NULL,
  middlename character varying(100) COLLATE pg_catalog."default",
  lastname character varying(100) COLLATE pg_catalog."default" NOT NULL,
  email character varying(150) COLLATE pg_catalog."default" NOT NULL,
  bloodgroup character varying(10) COLLATE pg_catalog."default",
  password character varying(255) COLLATE pg_catalog."default" NOT NULL,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_email_unique UNIQUE (email),
  CONSTRAINT users_empid_unique UNIQUE (empid)
  ).
- Roles include Employee, Management, Manager, admin(there could other roles added later).
- The application supports authentication and role-based access control.
- File attachments are stored and accessible via URLs.
- Notification system supports in-app and optionally email notifications.
- Timestamps should be stored (as it is done in the other tables).
- Ticket categories and notification types are configurable.

---

## 5. Sequential Workflow

### Ticket Workflow

1. User selects "Help Tickets" from dashboard.
2. User clicks "Create Ticket", fills form, submits.
3. Ticket is created with status 'Open', deadline set.
4. assigned_to user receives notification.
5. assigned_to updates ticket status, adds comments/resolution.
6. Status changes trigger notifications to involved users.
7. If ticket is not closed by `to_complete_date`, system marks as overdue and notifies management and created_by user.
8. created_by Ticket user reviews resolution, closes ticket or reopens if unsatisfied.

### Notification Workflow

1. Notification created in response to ticket events (creation, status change, overdue).
2. Notification linked to relevant users in `user_notifications`.
3. NotificationBell component fetches unread notifications for user.
4. User marks notifications as read.

---

## 6. Hierarchy & Roles

- Users(of all roles): Can create/view their own tickets, comment, close tickets, receive notifications.
- **Management/Manager**: Can view all tickets, assign/reassign, escalate, override status, receive notifications (especially for overdue/escalated tickets).
- **Manager**: May have visibility over tickets raised by their team, receive notifications for escalated tickets.
- if a User is assigned_to a ticket , he can reject it by changing the status to 'Open' in which case there is a notification sent to the created_by user and the Management

---

## 7. Notification Events & Logic

### Ticket Creation

- When a ticket is created, a notification is sent to the assigned_to user.
- Example: "A new ticket has been assigned to you: [title]"

### Status Change

- When ticket status changes (e.g., In Progress, Resolved, Closed, Rejected), notifications are sent to:
  - created_by user
  - assigned_to user
- Example: "Ticket [title] status changed to [status] by [user]"

### Ticket Overdue

- If ticket is not closed by `to_complete_date`, a notification is sent to:
  - assigned_to staff, created_by
  - user of Role Management and Manager
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

## 9. Glossary

Roles
List each role and briefly describe what permissions or responsibilities each has in the system. For example:

Employee: Can create/view their own tickets, comment, close tickets, receive notifications.
Manager: Can view all tickets, assign/reassign, escalate, override status, receive notifications for escalated/overdue tickets.
Management: Has all manager permissions, plus can configure system settings and escalation rules.

List each enum used in your schema, its possible values, and what each value means. For example:

enum_tickets_status:

Open: Ticket is newly created.
In Progress: Work has started.
Resolved: Issue is fixed, pending review.
Closed: Ticket is completed and accepted.
Rejected: Ticket is invalid or not actionable.
Overdue: Ticket missed its deadline.

enum_tickets_category:
Hardware, Software, Network, Other

enum_tickets_priority:
Low, Medium, High, Critical

Note:enum values are subject to change.
**End of Document**

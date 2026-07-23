# Ticket Module Documentation

## 1. Overview

The Ticket module provides a complete issue-tracking and request-management system within the HYLOC-MGT application. It allows users to create, assign, track, and resolve tickets with support for file attachments, multi-assignee workflows, role-based visibility, and calendar integration.

### Key Features
- **Ticket CRUD**: Create, read, update, and delete tickets
- **Multi-Assignee Support**: Assign multiple users to a single ticket via `ticket_assignees` join table
- **File Attachments**: Upload attachments stored under `public/uploads/tickets/`
- **Status Workflows**: `Open` → `Rejected` or `Closed` with role-based transition rules
- **Priority Levels**: Enum-based priorities (`Low`, `Medium`, `High`)
- **Due Dates**: Date-only tracking with permission controls
- **Role-Based Visibility**: Management sees all tickets; Employees/HODs see only their own or assigned tickets
- **Notifications**: In-app notifications on ticket creation, assignment, and rejection
- **Calendar Integration**: Tickets appear on Management, HR, HOD, and Employee calendar pages as clickable day indicators
- **Search & Filter**: Filter by assignee, priority, status, overdue flag, and text search
- **URL-Persisted State**: Filter and sort state is bookmarkable via query params

---

## 2. Database Schema

### 2.1 `tickets` Table

Migration: `server/database/migrations/013_create_tickets.sql`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `integer` | PK, GENERATED ALWAYS AS IDENTITY | Unique ticket identifier |
| `title` | `varchar(255)` | NOT NULL | Ticket title |
| `status` | `enum_tickets_status` | Nullable | Current ticket status |
| `description` | `text` | NOT NULL | Detailed ticket description |
| `priority` | `enum_tickets_priority` | NOT NULL, DEFAULT `'Medium'` | Ticket priority level |
| `user_id` | `integer` | NOT NULL, FK → `users.id` | Ticket creator |
| `attachment` | `varchar(255)` | Nullable | Attachment file path |
| `due_date` | `date` | Nullable | Ticket due date |
| `created_at` | `timestamp` | NOT NULL, DEFAULT `CURRENT_TIMESTAMP` | Creation timestamp |
| `updated_at` | `timestamp` | NOT NULL, DEFAULT `CURRENT_TIMESTAMP` | Last update timestamp |

### 2.2 `ticket_assignees` Table

Migration: `server/database/migrations/016_create_ticket_assignees.sql`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `integer` | PK, GENERATED ALWAYS AS IDENTITY | Unique assignment identifier |
| `ticket_id` | `integer` | NOT NULL, FK → `tickets.id` ON DELETE CASCADE | Linked ticket |
| `assigned_to` | `integer` | NOT NULL, FK → `users.id` ON DELETE CASCADE | Assigned user |
| `assigned_by` | `integer` | Nullable, FK → `users.id` ON DELETE SET NULL | User who made the assignment |
| `created_at` | `timestamp` | NOT NULL, DEFAULT `CURRENT_TIMESTAMP` | Assignment timestamp |
| `updated_at` | `timestamp` | NOT NULL, DEFAULT `CURRENT_TIMESTAMP` | Last update timestamp |

**Unique Constraint**: `UNIQUE (ticket_id, assigned_to)` — a user can only be assigned once per ticket.

### 2.3 Enums

```sql
-- Ticket statuses
CREATE TYPE enum_tickets_status AS ENUM ('Open', 'Assigned', 'Pending', 'In Progress', 'Resolved', 'Rejected', 'Closed', 'Overdue');

-- Ticket priorities
CREATE TYPE enum_tickets_priority AS ENUM ('Low', 'Medium', 'High');
```

---

## 3. Server-Side Architecture

### 3.1 Routes

File: `server/src/routes/ticket.routes.js`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/tickets/priorities` | Required | Fetch all priority enum values |
| `GET` | `/api/tickets/statuses` | Required | Fetch all status enum values |
| `POST` | `/api/tickets` | Required | Create a new ticket (multipart/form-data supported) |
| `GET` | `/api/tickets/my-tickets` | Required | List tickets created by the logged-in user |
| `GET` | `/api/tickets` | Required | List all tickets visible to the user |
| `GET` | `/api/tickets/:id` | Required | Fetch a single ticket by ID |
| `PUT` | `/api/tickets/:id` | Required | Update a ticket (multipart/form-data supported) |
| `DELETE` | `/api/tickets/:id` | Required | Delete a ticket (only if status is `Closed`) |

### 3.2 Controller

File: `server/src/controllers/ticket.controller.js`

#### `getMyTickets(req, res)`
Returns tickets where the logged-in user is the creator. Enriches rejected tickets with a `rejected_date` field derived from `updated_at`.

#### `getAllTickets(req, res)`
Returns tickets based on role-based visibility rules (delegated to `ticketModel.getTicketsForUser`).

#### `getTicketById(req, res)`
Returns a single ticket. Authorization rules:
- **Management**: Full access
- **Creator**: Full access
- **Assignee**: Full access
- **HOD**: Access if the ticket creator is in the same department

#### `createTicket(req, res)`
Creates a ticket with the following rules:
- `title`, `user_id` (creator), `due_date`, and at least one assignee are required
- Non-Management users can assign only 1 assigne
- Non-Management users **cannot** assign tickets to Management users
- Supports file upload via `multipart/form-data`
- Creates notification for all assignees

#### `updateTicket(req, res)`
Updates a ticket with the following rules:
- **Status transitions**: `Open` → `Rejected` or `Closed` only
- **Rejection**: Only Management can reject
- **due_date**: Only Management or the ticket creator can modify
- **Other fields**: Assignees can edit `title` and `description`; Management can edit everything
- **Closed**: Only the ticket creator can set status to `Closed`
- **Role restriction**: Employee/HOD cannot assign to Management users

#### `deleteTicket(req, res)`
Deletes a ticket only if its status is `Closed`.

### 3.3 Model

File: `server/src/models/ticket.model.js`

#### Key Functions

| Function | Description |
|----------|-------------|
| `normalizeIdList(values)` | Normalizes assignee IDs from mixed input (array, string, JSON) into a unique array of positive integers |
| `attachTicketAssignees(tickets, db)` | Joins `ticket_assignees` data and appends `assigned_to_ids` array to each ticket |
| `replaceTicketAssignees(db, ticketId, assigneeIds, assignedBy)` | Deletes all existing assignees for a ticket and inserts new ones |
| `createTicket(data, db)` | Inserts a ticket row |
| `getTicketPriorities()` / `getTicketStatuses()` | Returns enum values |
| `getAllTickets(db)` | Returns all tickets with assignees attached |
| `getTicketsForUser(userId, role, db)` | Role-based ticket fetching (Management = all, HOD = same dept, Employee = own/assigned) |
| `getTicketById(id, db)` | Single ticket lookup with assignees |
| `getTicketsByUserId(userId, db)` | Tickets where user is creator or assignee |
| `updateTicket(id, data, db)` | Dynamic UPDATE query for provided fields |
| `deleteTicket(id)` | Hard delete by ID |

---

## 4. Client-Side Architecture

### 4.1 API Client

File: `client/src/api/ticketApi.js`

```javascript
import axios from './axios';

export const getTicketPriorities = async (token) => { ... };
export const createTicket = async (data) => { ... };          // FormData supported
export const getAllTickets = async () => { ... };
export const getMyTickets = async () => { ... };
export const getTicketStatuses = async () => { ... };
export const getTicketById = async (id) => { ... };
export const updateTicket = async (id, data) => { ... };      // FormData supported
export const deleteTicket = async (id) => { ... };
```

### 4.2 Main Ticket Page

File: `client/src/pages/tickets/TicketsPage.jsx`

#### State Management
- `rows`: Ticket list
- `users`: User list for assignee resolution
- `search`: Text search query
- `filter`: Quick filter (`all`, `my`, `overdue`, `open`)
- `assigneeFilter`, `priorityFilter`, `statusFilter`: Dropdown filters
- `overdueOnly`: Boolean overdue filter
- `sortBy`, `sortDir`: Sort configuration
- `form`: Ticket create/edit form state
- `editingId`: Currently edited ticket ID
- `notification`: Toast notifications
- `deleteId`: Ticket pending deletion

#### Features
- **Create/Edit Modal**: Full ticket form with title, description, priority, status, creator, assignees (multi-select dropdown), due date, and attachment
- **Attachment Handling**: Upload new files, view existing attachments, remove attachments
- **Action Buttons**: Edit and Delete per row
- **Delete Confirmation**: Modal confirmation before deletion
- **URL State**: Filter, search, sort, and overdue state persisted to URL query params for bookmarkable views
- ** Pie/Bar Charts**: Ticket distribution by priority and status via Recharts

### 4.3 Calendar Integration

Tickets are integrated into four calendar pages as day indicators:

| Page | File | Behavior |
|------|------|----------|
| Management Calendar | `client/src/pages/management/leaves/ManagementCalendar.jsx` | Shows all tickets; displays `Closed Date` column |
| HR Calendar | `client/src/pages/HR/leaves/HRCalendar.jsx` | Shows all tickets; displays `Closed Date` column |
| HOD Calendar | `client/src/pages/hod/leaves/HODCalendar.jsx` | Shows tickets created by or assigned to HOD |
| Employee Calendar | `client/src/pages/employee/leaves/EmployeeCalendar.jsx` | Shows tickets created by or assigned to employee |

**Ticket Modal in Calendars**: Clicking a day with tickets opens a modal table showing:
- S.No
- Title
- Description
- Priority
- Assigned To (resolved to user names when available)
- Due Date
- Closed Date (Management/HR only)

---

## 5. API Endpoints Reference

### Base URL
```
/api/tickets
```

### 5.1 `GET /priorities`
Returns all available ticket priorities.

**Response**
```json
{
  "success": true,
  "data": ["Low", "Medium", "High"]
}
```

### 5.2 `GET /statuses`
Returns all available ticket statuses.

**Response**
```json
{
  "success": true,
  "data": ["Open", "Assigned", "Pending", "In Progress", "Resolved", "Rejected", "Closed", "Overdue"]
}
```

### 5.3 `POST /`
Creates a new ticket. Accepts `multipart/form-data` with optional `attachment` file.

**Request Body (JSON or FormData)**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | `string` | Yes | Ticket title |
| `description` | `string` | Yes | Ticket description |
| `priority` | `string` | No | Priority level (`Low`, `Medium`, `High`) |
| `status` | `string` | No | Initial status |
| `user_id` | `integer` | Yes | Creator user ID |
| `due_date` | `string` | Yes | Due date (`YYYY-MM-DD`) |
| `assigned_to_ids` | `array` / `string` | Yes | Array of assignee user IDs |
| `assigned_to` | `integer` / `string` | No | Single assignee (legacy fallback) |
| `attachment` | `file` / `string` | No | Attachment file or path |

**Response**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "Sample Ticket",
    "description": "...",
    "priority": "Medium",
    "status": "Open",
    "user_id": 1,
    "due_date": "2026-07-22",
    "attachment": "/api/uploads/tickets/abc123.pdf",
    "created_at": "2026-07-22T10:00:00Z",
    "updated_at": "2026-07-22T10:00:00Z",
    "assigned_to_ids": [2, 3]
  }
}
```

### 5.4 `GET /my-tickets`
Returns tickets created by the logged-in user.

**Response**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Sample Ticket",
      "status": "Open",
      "user_id": 1,
      "assigned_to_ids": [2, 3],
      "rejected_date": "2026-07-22T10:00:00Z"
    }
  ]
}
```

### 5.5 `GET /`
Returns all tickets visible to the logged-in user based on role.

**Response**
```json
{
  "success": true,
  "data": [ ... ]
}
```

### 5.6 `GET /:id`
Returns a single ticket by ID.

**Response**
```json
{
  "success": true,
  "data": { ... }
}
```

### 5.7 `PUT /:id`
Updates a ticket. Accepts `multipart/form-data` with optional `attachment` file.

**Request Body**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | `string` | No | Updated title |
| `description` | `string` | No | Updated description |
| `priority` | `string` | No | Updated priority |
| `status` | `string` | No | Updated status |
| `due_date` | `string` | No | Updated due date |
| `assigned_to_ids` | `array` / `string` | No | Updated assignees |
| `attachment` | `file` / `string` | No | New attachment or path |

### 5.8 `DELETE /:id`
Deletes a ticket. Only allowed when `status = 'Closed'`.

**Response**
```json
{
  "success": true,
  "data": { "id": 1, ... }
}
```

---

## 6. Key Business Rules

### 6.1 Ticket Creation
- Creator is automatically set to the logged-in user (`req.user.userId`)
- At least one assignee is mandatory
- Non-Management users can assign only **1 person**
- Non-Management users cannot assign tickets to **Management** role users

### 6.2 Ticket Updates
| Field | Who Can Edit |
|-------|-------------|
| `title` | Creator, assignees, Management |
| `description` | Creator, assignees, Management |
| `priority` | Creator, assignees, Management |
| `due_date` | **Only Management or creator** |
| `status` | Creator (to `Closed`); Management (to `Rejected` or `Closed`) |
| `assigned_to_ids` | Management (multiple); others (single, non-Management target) |

### 6.3 Status Transitions
```
Open → Rejected  (Management only)
Open → Closed    (Creator or Management)
```
All other transitions are blocked.

### 6.4 Deletion
Tickets can only be deleted when `status = 'Closed'`.

### 6.5 Notifications
- **On Create**: Notification sent to all assignees
- **On Reject**: Notification sent to ticket creator (Management only)
- **On Reassign**: Notification sent to newly assigned users

### 6.6 Visibility Matrix

| Role | Visible Tickets |
|------|-----------------|
| Management | All tickets |
| HOD | Own tickets + assigned tickets + employees in same department |
| Employee | Own tickets + assigned tickets only |

---

## 7. File Structure

```
server/
├── database/
│   └── migrations/
│       ├── 013_create_tickets.sql
│       └── 016_create_ticket_assignees.sql
├── src/
│   ├── models/
│   │   └── ticket.model.js
│   ├── controllers/
│   │   └── ticket.controller.js
│   └── routes/
│       └── ticket.routes.js

client/
└── src/
    ├── api/
    │   └── ticketApi.js
    └── pages/
        ├── tickets/
        │   └── TicketsPage.jsx
        ├── management/
        │   └── leaves/
        │       └── ManagementCalendar.jsx
        ├── HR/
        │   └── leaves/
        │       └── HRCalendar.jsx
        ├── hod/
        │   └── leaves/
        │       └── HODCalendar.jsx
        └── employee/
            └── leaves/
                └── EmployeeCalendar.jsx
```

---

## 8. Configuration Notes

- **Attachment Storage**: Uploaded files are stored in `server/public/uploads/tickets/` and served via `/api/uploads/tickets/:filename`
- **Authentication**: All endpoints require JWT authentication via `authenticate` middleware
- **File Upload Middleware**: `server/src/middlewares/upload.middleware.js` handles `multipart/form-data` parsing
- **CORS**: Configured in `server/src/config/index.js` with development-mode wildcard origins

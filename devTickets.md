# Developer Ticketing System (devTickets)

This document describes the features, implementation status, and schema for the developer ticketing system used for software issue resolution.

---

## Features & Implementation Status

### 1. Dashboard Page with "Raise Ticket" Link
- **Status:** Not Implemented
- **Details:**
  - The Dashboard includes a "Raise Ticket" hyperlink to the left of the 
  - File: `client/src/components/layout/DashboardLayout.jsx`
  - The link navigates to `/raise-ticket`.

### 2. Navigation to "RaiseTicket.jsx"
- **Status:** Not Implemented
- **Details:**
  - The route `/raise-ticket` is defined in the main router.
  - File: `client/src/App.jsx`
  - Component: `RaiseTicket` (located at `client/src/pages/tickets/RaiseTicket.jsx`)

### 3. "RaiseTicket.jsx" Page with 4 Cards
- **Status:** Not Implemented
- **Details:**
  - The `RaiseTicket.jsx` file exists.
  - **To implement:** The Ticket New, Ticket Pending, Ticket Resolved, Total Ticketshould be of type card with the respective count for each status.

### 4. Modal for Raising Ticket
- **Status:** Not Implemented
- **Details:**
  - A modal should be available for ticket creation.
  - Required fields: Issue Title (textbox), Description (textarea), Priority (dropdown), Attachment Upload (file input), and other ticket details.
  - File: `client/src/pages/tickets/RaiseTicket.jsx`
  - Ensure modal supports file upload for attachments.

### 5. Attachment Upload in Modal
- **Status:** Not Implemented
- **Details:**
  - The modal form must include an attachment upload field (file input) for ticket attachments.
  - **Gap:** File upload for attachments is missing and must be implemented.

### 6. Success Message on Ticket Raised
- **Status:** Not Implemented
- **Details:**
  - After successful ticket creation, display the message "Ticket created successfully!".
  - File: `client/src/pages/tickets/RaiseTicket.jsx`

### 7. Backend Support for Ticketing
- **Status:** Not Implemented
- **Details:**
  - Backend must include:
    - Model: `server/src/models/dev_tickets.model.js`
    - Controller: `server/src/controllers/devTickets.controller.js`
    - API Routes: `server/src/routes/devTickets.routes.js`
    - Endpoints for:
      - Ticket creation (POST)
      - Ticket listing (GET)
      - Ticket status update (PATCH/PUT)
      - Attachment upload (POST/PUT)
    - The dev_tickets table is already created; do not recreate.
---

## Summary of Gaps
- **Attachment Upload:** The ticket creation modal does not currently include a file upload field for attachments. This feature is missing and should be added for full compliance.
- **4 Cards on RaiseTicket.jsx:** The display of 4 cards (Ticket New, Ticket Pending, Ticket Resolved, Total Ticket) on the RaiseTicket.jsx page is not implemented.
- **Backend API:** No API endpoints or routes for ticketing are implemented.
- **Model/Controller:** No model or controller for dev_tickets exists.
- **Frontend Route:** No /raise-ticket route or navigation is implemented.
- **Dashboard Link:** No "Raise Ticket" link on Dashboard.

---

## Database Table Schema (Already Created)

Below is the schema for the dev_tickets table (PostgreSQL):

```sql
CREATE TABLE IF NOT EXISTS public.dev_tickets
(
    id integer NOT NULL DEFAULT nextval('dev_tickets_id_seq'::regclass),
    title character varying(150) COLLATE pg_catalog."default" NOT NULL,
    description text COLLATE pg_catalog."default",
    created_by uuid NOT NULL,
    priority enum_dev_tickets_priority DEFAULT 'Medium'::enum_dev_tickets_priority,
    status enum_dev_tickets_status DEFAULT 'Open'::enum_dev_tickets_status,
    attachment_url character varying(500) COLLATE pg_catalog."default",
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT dev_tickets_pkey PRIMARY KEY (id),
    CONSTRAINT dev_tickets_created_by_fkey FOREIGN KEY (created_by)
        REFERENCES public.users (id) MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE CASCADE
)
```

---

## Implementation Checklist

### Frontend
- Add "Raise Ticket" link to Dashboard (client/src/components/layout/DashboardLayout.jsx)
- Define /raise-ticket route in main router (client/src/App.jsx, client/src/routes/AppRoutes.jsx)
- Create RaiseTicket.jsx page (client/src/pages/tickets/RaiseTicket.jsx) with:
  - 4 cards: Ticket New, Ticket Pending, Ticket Resolved, Total Ticket
  - Modal for ticket creation with required fields and file upload
  - Success message after ticket creation

### Backend
- Implement model: server/src/models/dev_tickets.model.js
- Implement controller: server/src/controllers/devTickets.controller.js
- Implement API routes: server/src/routes/devTickets.routes.js
- Endpoints for:
  - Ticket creation (POST)
  - Ticket listing (GET)
  - Ticket status update (PATCH/PUT)
  - Attachment upload (POST/PUT)
  - The dev_tickets table is already created; do not recreate.

### Additional Notes
- Ensure file upload is handled securely and attachment URLs are stored in the database.
- Use enums for priority and status as per schema.
- Confirm UI/UX for modal and cards with stakeholders before implementation.

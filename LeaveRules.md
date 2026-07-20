# Leave Rules — Implemented Features

This document lists the behaviors and rules that are actually implemented in this codebase (frontend + client API). It includes only items that are present in the repository and visible from the client code and API client (`client/src/api/leaveApi.js`).

Roles
- Management, HOD, and Employee roles exist and are referenced in the UI and API client.

Front-end UI features (implemented)
- Leave approval pages for HOD and Management are present under `client/src/pages/*/leaves`.
- Both approval pages provide status tabs (`Pending`, `Approved`, `Rejected`).
- Both pages include date and field filters: From date, To date, Year, Department, Username, and Search/Reset controls. Department options are loaded from the departments API.
- Table columns implemented: `S.No`, `Name`, `Date Range`, `No. of Days`, `Details`, `Status`, `Actions`.
- `No. of Days` is computed on the client by `computeDays()` and shown in the table and Details modal.
  - `computeDays()` uses, in order of preference, `credited_days`, `leave_duration`, or `duration` fields when present; otherwise it computes the inclusive difference between `from_date` and `to_date`.
- Details modal shows `Name`, `Duration` (using computed days), `Date Range`, `Reason`, and `Status`. The `Duration` label uses the same text color as other labels in the modal.
- Approve/Reject actions in the UI call the corresponding API client functions (`approveLeave`, `rejectLeave`) and confirm with the user before sending.
- Editing status in the Details modal updates via the client `updateLeave` function (`updateLeave`).
- The Management approval page filters visible records client-side so that Management views HOD leaves (any duration) and Employee leaves with duration > 2 days (this logic is implemented in the page's `loadLeaves` function).
- The HOD approval page filters visible leaves by department (hod's department) and shows Employee leaves for that department (implemented in the page's load/filter logic).

Leave type values
- The canonical leave type values in the application are now `Earned Leave` and `Leave without pay`.
- The `leaves.leave_type` column default in the database should be updated to match the new canonical value, and any application-level validation or CHECK constraint should allow the new values.

Notifications and feedback
- The frontend uses a `Notification` component to show success/error messages for actions performed in the UI (approve/reject/update/load errors).

Notes and exclusions
- This document intentionally omits features that are not present in the repository or not visible in the client code. Examples of omitted/uncertain items:
  - Any automatic splitting of a leave into Earned Leave and Leave without pay segments is not documented here unless there is server-side confirmation; client code does not perform splitting logic.
  - Policy-level automatic escalations or SLA timers are not implemented in the frontend code and are therefore not documented here.
  - Any behavior about attachment enforcement, encryption, or retention is not derived from the client code and is omitted.

If you want, I can next inspect server-side code to expand or further verify any backend behaviors before updating this document again.*** End Patch

-------------------------------------------------------------------------------------

Tickets Schema


CREATE TABLE IF NOT EXISTS public.tickets
(
    id integer NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 ),
    title character varying(255) COLLATE pg_catalog."default" NOT NULL,
    status enum_tickets_status,
    description text COLLATE pg_catalog."default" NOT NULL,
    priority enum_tickets_priority NOT NULL DEFAULT 'Medium'::enum_tickets_priority,
    user_id integer NOT NULL,
    assigned_to integer,
    attachment character varying(255) COLLATE pg_catalog."default",
    due_date date,
    rejected_by integer,
    rejected_by_reason character varying(255) COLLATE pg_catalog."default",
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT tickets_pkey PRIMARY KEY (id),
    CONSTRAINT fk_assigned_to FOREIGN KEY (assigned_to)
        REFERENCES public.users (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE SET NULL,
    CONSTRAINT fk_created_by FOREIGN KEY (user_id)
        REFERENCES public.users (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE,
    CONSTRAINT fk_rejected_by FOREIGN KEY (rejected_by)
        REFERENCES public.users (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE SET NULL
)

------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ticket_assignees
(
    id integer GENERATED ALWAYS AS IDENTITY,
    ticket_id integer NOT NULL,
    user_id integer NOT NULL,
    assigned_by integer,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ticket_assignees_pkey PRIMARY KEY (id),

    CONSTRAINT fk_ticket_assignees_ticket
        FOREIGN KEY (ticket_id)
        REFERENCES public.tickets(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_ticket_assignees_user
        FOREIGN KEY (user_id)
        REFERENCES public.users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_ticket_assignees_assigned_by
        FOREIGN KEY (assigned_by)
        REFERENCES public.users(id)
        ON DELETE SET NULL,

    CONSTRAINT uq_ticket_assignees_ticket_user UNIQUE (ticket_id, user_id)
);




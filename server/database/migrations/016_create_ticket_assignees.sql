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

CREATE INDEX IF NOT EXISTS idx_ticket_assignees_ticket_id
    ON public.ticket_assignees(ticket_id);

CREATE INDEX IF NOT EXISTS idx_ticket_assignees_user_id
    ON public.ticket_assignees(user_id);
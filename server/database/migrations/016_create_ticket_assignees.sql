CREATE TABLE IF NOT EXISTS public.ticket_assignees
(
    id integer NOT NULL
        GENERATED ALWAYS AS IDENTITY
        (INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1),

    ticket_id integer NOT NULL,

    assigned_to integer NOT NULL,

    assigned_by integer,

    created_at timestamp without time zone NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at timestamp without time zone NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ticket_assignees_pkey
        PRIMARY KEY (id),

    CONSTRAINT uq_ticket_assignees_ticket_assigned_to
        UNIQUE (ticket_id, assigned_to),

    CONSTRAINT fk_ticket_assignees_ticket
        FOREIGN KEY (ticket_id)
        REFERENCES public.tickets (id)
        ON UPDATE NO ACTION
        ON DELETE CASCADE,

    CONSTRAINT fk_ticket_assignees_assigned_to
        FOREIGN KEY (assigned_to)
        REFERENCES public.users (id)
        ON UPDATE NO ACTION
        ON DELETE CASCADE,

    CONSTRAINT fk_ticket_assignees_assigned_by
        FOREIGN KEY (assigned_by)
        REFERENCES public.users (id)
        ON UPDATE NO ACTION
        ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS public.tickets
(
    id integer NOT NULL
        GENERATED ALWAYS AS IDENTITY
        (INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1),

    title character varying(255) NOT NULL,

    status enum_tickets_status,

    description text NOT NULL,

    priority enum_tickets_priority NOT NULL
        DEFAULT 'Medium'::enum_tickets_priority,

    -- User who created the ticket
    user_id integer NOT NULL,

    attachment character varying(255),

    due_date date,

    created_at timestamp without time zone NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at timestamp without time zone NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT tickets_pkey
        PRIMARY KEY (id),

    CONSTRAINT fk_tickets_created_by
        FOREIGN KEY (user_id)
        REFERENCES public.users (id)
        ON UPDATE NO ACTION
        ON DELETE CASCADE
);
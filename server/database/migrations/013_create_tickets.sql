CREATE TABLE IF NOT EXISTS public.tickets
(
    id integer GENERATED ALWAYS AS IDENTITY,
    title varchar(255) NOT NULL,
    status enum_tickets_status,
    description text NOT NULL,
    category enum_tickets_category DEFAULT 'Other',
    priority enum_tickets_priority DEFAULT 'Medium',
    user_id integer NOT NULL,
    assigned_to integer,
    attachment varchar(255),
    due_date date,
    rejected_by integer,
    rejected_by_reason varchar(255),
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT tickets_pkey PRIMARY KEY (id),

    CONSTRAINT fk_assigned_to
        FOREIGN KEY (assigned_to)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_created_by
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_rejected_by
        FOREIGN KEY (rejected_by)
        REFERENCES users(id)
        ON DELETE SET NULL
);
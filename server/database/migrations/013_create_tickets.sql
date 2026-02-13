-- Create tickets table
CREATE TABLE IF NOT EXISTS public.tickets
(
    id integer NOT NULL DEFAULT nextval('tickets_id_seq'::regclass),
    title character varying(255) COLLATE pg_catalog."default" NOT NULL,
    description text COLLATE pg_catalog."default" NOT NULL,
    category enum_tickets_category DEFAULT 'Other'::enum_tickets_category,
    priority enum_tickets_priority DEFAULT 'Medium'::enum_tickets_priority,
    status enum_tickets_status DEFAULT 'Open'::enum_tickets_status,
    user_id integer NOT NULL,
    assigned_to integer,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at timestamp without time zone,
    attachment character varying(255) COLLATE pg_catalog."default",
    due_date date NOT NULL,
    CONSTRAINT tickets_pkey PRIMARY KEY (id),
    CONSTRAINT fk_assigned_to FOREIGN KEY (assigned_to)
        REFERENCES public.users (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE SET NULL,
    CONSTRAINT fk_created_by FOREIGN KEY (user_id)
        REFERENCES public.users (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
);

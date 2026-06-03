June 3rd


CREATE TABLE IF NOT EXISTS public.tickets
(
    id integer NOT NULL DEFAULT nextval('tickets_id_seq'::regclass),
    title character varying(255) COLLATE pg_catalog."default" NOT NULL,
    status enum_tickets_status,
    description text COLLATE pg_catalog."default" NOT NULL,
    category enum_tickets_category DEFAULT 'Other'::enum_tickets_category,
    priority enum_tickets_priority DEFAULT 'Medium'::enum_tickets_priority,
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
TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.tickets
    OWNER to postgres;
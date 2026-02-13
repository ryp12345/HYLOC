-- Create pillers table
CREATE TABLE IF NOT EXISTS public.pillers
(
    id integer NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 ),
    piller_name character varying COLLATE pg_catalog."default" NOT NULL,
    short_name character varying COLLATE pg_catalog."default" NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT pillers_pkey PRIMARY KEY (id)
);

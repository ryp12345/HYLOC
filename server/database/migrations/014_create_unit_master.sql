-- Create unit_master table
CREATE TABLE IF NOT EXISTS public.unit_master
(
    id integer NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 ),
    unit_name character varying COLLATE pg_catalog."default" NOT NULL,
    symbol character varying COLLATE pg_catalog."default",
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT unit_master_pkey PRIMARY KEY (id)
);

-- Create log table
CREATE TABLE IF NOT EXISTS public.log
(
    id bigint NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1 ),
    user_id integer,
    description text COLLATE pg_catalog."default",
    created_at timestamp without time zone DEFAULT now()
);

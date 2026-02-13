-- Create leaves_entitlement table
CREATE TABLE IF NOT EXISTS public.leaves_entitlement
(
    id integer NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 2147483647 CACHE 1 ),
    user_id integer NOT NULL,
    year integer NOT NULL,
    leave_entitled numeric(4,1) NOT NULL DEFAULT 12,
    leaves_accumulated numeric(4,1) NOT NULL DEFAULT 0,
    leaves_availed numeric(4,1) NOT NULL DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT leaves_entitlement_pkey PRIMARY KEY (id),
    CONSTRAINT leaves_entitlement_user_year_unique UNIQUE (user_id, year)
);

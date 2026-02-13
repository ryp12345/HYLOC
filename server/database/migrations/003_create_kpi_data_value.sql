-- Create kpi_data_value table
CREATE TABLE IF NOT EXISTS public.kpi_data_value
(
    id bigint NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1 ),
    kpi_value_id bigint NOT NULL,
    value double precision NOT NULL,
    value_type character varying COLLATE pg_catalog."default" NOT NULL,
    month smallint NOT NULL,
    year smallint NOT NULL,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT kpi_data_value_pkey PRIMARY KEY (id)
);

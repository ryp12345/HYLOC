-- Create kpi_values table
CREATE TABLE IF NOT EXISTS public.kpi_values
(
    id bigint NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1 ),
    data character varying COLLATE pg_catalog."default" NOT NULL,
    kpi_id bigint NOT NULL,
    created_at timestamp without time zone NOT NULL DEFAULT now(),
    updated_at timestamp without time zone NOT NULL DEFAULT now(),
    "data operator" integer,
    target_required boolean,
    uom integer,
    kpi_type character varying COLLATE pg_catalog."default" NOT NULL DEFAULT 'manual'::character varying,
    piller_id integer,
    formula text COLLATE pg_catalog."default",
    source_kpi_value_ids integer[],
    default_target_value integer,
    target_formula text COLLATE pg_catalog."default",
    target_source_kpi_value_ids integer[],
    computation_type character varying(50) COLLATE pg_catalog."default",
    CONSTRAINT kpi_values_pkey PRIMARY KEY (id),
    CONSTRAINT fk_kpi_value_kpi_id FOREIGN KEY (kpi_id)
        REFERENCES public.kpis (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_kpi_values_data_operator FOREIGN KEY ("data operator")
        REFERENCES public.users (empid) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
        NOT VALID,
    CONSTRAINT fk_kpi_values_piller_id FOREIGN KEY (piller_id)
        REFERENCES public.pillers (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
        NOT VALID,
    CONSTRAINT fk_kpi_values_uom FOREIGN KEY (uom)
        REFERENCES public.unit_master (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
        NOT VALID
);

-- Create kpis table
CREATE TABLE IF NOT EXISTS public.kpis
(
    id bigint NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1 ),
    title character varying(625) COLLATE pg_catalog."default" NOT NULL,
    category_id integer NOT NULL,
    parent_kpi_id bigint,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    fin_year character varying COLLATE pg_catalog."default",
    CONSTRAINT kpis_pkey PRIMARY KEY (id),
    CONSTRAINT fk_kpis_category_id FOREIGN KEY (category_id)
        REFERENCES public.categories (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
        NOT VALID,
    CONSTRAINT fk_kpis_parent_kpi_id FOREIGN KEY (parent_kpi_id)
        REFERENCES public.kpis (id) MATCH SIMPLE
        ON UPDATE CASCADE
        ON DELETE CASCADE
        NOT VALID
);

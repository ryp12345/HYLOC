-- Create kpi_emp table
CREATE TABLE IF NOT EXISTS public.kpi_emp
(
    id bigint NOT NULL GENERATED ALWAYS AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1 ),
    kpi_id bigint NOT NULL,
    emp_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT kpi_emp_pkey PRIMARY KEY (id),
    CONSTRAINT fk_kpi_emp_emp_id FOREIGN KEY (emp_id)
        REFERENCES public.users (empid) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT fk_kpi_emp_kpi_id FOREIGN KEY (kpi_id)
        REFERENCES public.kpis (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
);

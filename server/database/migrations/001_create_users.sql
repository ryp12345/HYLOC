CREATE TABLE IF NOT EXISTS public.users
(
    id integer NOT NULL DEFAULT nextval('users_id_seq'::regclass),
    empid bigint NOT NULL,
    department_id integer,
    phone character varying(25) COLLATE pg_catalog."default",
    address text COLLATE pg_catalog."default",
    firstname character varying(100) COLLATE pg_catalog."default" NOT NULL,
    middlename character varying(100) COLLATE pg_catalog."default",
    lastname character varying(100) COLLATE pg_catalog."default" NOT NULL,
    email character varying(150) COLLATE pg_catalog."default" NOT NULL,
    bloodgroup character varying(10) COLLATE pg_catalog."default",
    password character varying(255) COLLATE pg_catalog."default" NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    designation_id integer,
    status character varying(20) COLLATE pg_catalog."default" DEFAULT 'active'::character varying,
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT unique_empid UNIQUE (empid),
    CONSTRAINT users_email_key UNIQUE (email),
    CONSTRAINT users_empid_key UNIQUE (empid)
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

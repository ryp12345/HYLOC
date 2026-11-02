CREATE TABLE IF NOT EXISTS public.login_attempts (
    user_id integer PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    failed_attempts smallint NOT NULL DEFAULT 0 CHECK (failed_attempts BETWEEN 0 AND 10),
    locked_until timestamp without time zone,
    updated_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

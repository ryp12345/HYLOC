CREATE TABLE IF NOT EXISTS public.password_reset_requests (
    id bigserial PRIMARY KEY,
    user_id integer NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    otp_hash character varying(255) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    attempts smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

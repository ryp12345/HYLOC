ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;

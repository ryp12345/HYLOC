-- Accounts given a temporary password (new account or admin reset) must choose
-- their own password before using the app. Existing accounts are not affected.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

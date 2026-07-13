-- Add staff_photo column to users table for storing uploaded photo URL
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS staff_photo character varying(255) COLLATE pg_catalog."default";

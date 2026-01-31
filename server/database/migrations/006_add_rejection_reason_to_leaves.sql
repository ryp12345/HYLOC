-- Add rejection_reason column to leaves table
ALTER TABLE IF EXISTS leaves
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

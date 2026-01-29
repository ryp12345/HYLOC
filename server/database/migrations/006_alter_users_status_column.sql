-- Alter users table status column from BOOLEAN to VARCHAR

-- First, add a temporary column
ALTER TABLE users ADD COLUMN status_temp VARCHAR(20);

-- Convert existing boolean values to text
UPDATE users SET status_temp = CASE 
  WHEN status = true THEN 'active'
  WHEN status = false THEN 'inactive'
  ELSE 'active'
END;

-- Drop the old boolean column
ALTER TABLE users DROP COLUMN status;

-- Rename the temp column to status
ALTER TABLE users RENAME COLUMN status_temp TO status;

-- Set NOT NULL constraint and default value
ALTER TABLE users ALTER COLUMN status SET NOT NULL;
ALTER TABLE users ALTER COLUMN status SET DEFAULT 'active';

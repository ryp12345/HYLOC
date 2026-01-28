-- Drop old users table if it exists
DROP TABLE IF EXISTS users CASCADE;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  empid VARCHAR(50),
  first_name VARCHAR(100),
  middle_name VARCHAR(100),
  last_name VARCHAR(100),
  department_id INT,
  phone VARCHAR(20),
  address TEXT,
  blood_group VARCHAR(5),
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

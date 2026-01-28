-- Insert admin user
INSERT INTO users (id, email, empid, first_name, middle_name, last_name, department_id, phone, address, blood_group, password)
VALUES (
  1,
  'admin@hyloc.co.in',
  '10000',
  'Admin',
  '',
  'User',
  NULL,
  NULL,
  NULL,
  NULL,
  '$2a$10$Vsx/tVXILBeUqRwIzZI6qO6IokdCH978TtLgUR60EoWwpUnuVOD6G'
) ON CONFLICT (id) DO NOTHING;

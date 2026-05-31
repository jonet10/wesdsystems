-- Migration: Employee Auth & Cashier Tracking
-- Enables username/password auth for employees and tracks cashier per transaction

-- 1. Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Add auth columns to salon_employees
ALTER TABLE salon_employees
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS can_login BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Username must be unique per branch to avoid login conflicts
CREATE UNIQUE INDEX IF NOT EXISTS idx_salon_employees_username_branch 
  ON salon_employees(username, branch_id) 
  WHERE username IS NOT NULL;

-- 3. Add cashier columns to salon_sales
ALTER TABLE salon_sales
  ADD COLUMN IF NOT EXISTS cashier_name TEXT,
  ADD COLUMN IF NOT EXISTS cashier_id UUID REFERENCES salon_employees(id);

-- 4. Create RPC to set password securely
CREATE OR REPLACE FUNCTION set_employee_password(
  p_employee_id UUID,
  p_password TEXT
)
RETURNS VOID AS $$
BEGIN
  -- Hashes the password using bcrypt and a blowfish salt
  UPDATE salon_employees
  SET password_hash = crypt(p_password, gen_salt('bf')),
      can_login = true
  WHERE id = p_employee_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create RPC for employee login check
CREATE OR REPLACE FUNCTION check_employee_login(
  p_username TEXT,
  p_password TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_emp salon_employees%ROWTYPE;
  v_count INT;
BEGIN
  -- Check if username exists globally and is active
  SELECT COUNT(*) INTO v_count FROM salon_employees WHERE username = p_username AND is_active = true;

  IF v_count = 0 THEN
    RETURN '{"success": false, "error": "Identifiants incorrects"}'::jsonb;
  END IF;

  IF v_count > 1 THEN
    RETURN '{"success": false, "error": "Nom d''utilisateur ambigu, utilisez votre email ou contactez l''admin"}'::jsonb;
  END IF;

  SELECT * INTO v_emp
  FROM salon_employees
  WHERE username = p_username 
    AND is_active = true
  LIMIT 1;

  -- If not found or can't login
  IF v_emp.can_login = false THEN
    RETURN '{"success": false, "error": "Ce compte n''a pas accès à la plateforme"}'::jsonb;
  END IF;

  -- Check password
  IF v_emp.password_hash IS NULL OR v_emp.password_hash != crypt(p_password, v_emp.password_hash) THEN
    RETURN '{"success": false, "error": "Identifiants incorrects"}'::jsonb;
  END IF;

  -- Update last login
  UPDATE salon_employees 
  SET last_login_at = now() 
  WHERE id = v_emp.id;

  -- Return success with employee data
  RETURN jsonb_build_object(
    'success', true,
    'employee', jsonb_build_object(
      'id', v_emp.id,
      'full_name', v_emp.first_name || ' ' || COALESCE(v_emp.last_name, ''),
      'role', v_emp.role,
      'branch_id', v_emp.branch_id
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

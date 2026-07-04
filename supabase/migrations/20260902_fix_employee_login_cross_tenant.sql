-- ============================================================================
-- Fix: Prevent cross-tenant employee login
-- ============================================================================
-- The previous check_employee_login allowed an employee to log in as long as 
-- their username matched, regardless of the currently authenticated admin's 
-- business. This led to cross-tenant active branch IDs which broke all RLS 
-- policies for the POS. 
-- Now, we ensure the employee belongs to the current user's business.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_employee_login(
  p_username TEXT,
  p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_emp salon_employees%ROWTYPE;
  v_count INT;
  v_session JSONB;
BEGIN
  -- Validate against the current user's business to prevent cross-tenant login
  SELECT COUNT(*)
    INTO v_count
  FROM public.salon_employees e
  JOIN public.salon_branches b ON b.id = e.branch_id
  WHERE e.username = p_username
    AND e.is_active = true
    AND b.business_id = public.current_user_business_id();

  IF v_count = 0 THEN
    RETURN '{"success": false, "error": "Identifiants incorrects ou employé introuvable pour ce salon"}'::jsonb;
  END IF;

  IF v_count > 1 THEN
    RETURN '{"success": false, "error": "Nom d''utilisateur ambigu, utilisez votre email ou contactez l''admin"}'::jsonb;
  END IF;

  SELECT e.*
    INTO v_emp
  FROM public.salon_employees e
  JOIN public.salon_branches b ON b.id = e.branch_id
  WHERE e.username = p_username
    AND e.is_active = true
    AND b.business_id = public.current_user_business_id()
  LIMIT 1;

  IF v_emp.can_login = false THEN
    RETURN '{"success": false, "error": "Ce compte n''a pas accès à la plateforme"}'::jsonb;
  END IF;

  IF v_emp.password_hash IS NULL OR v_emp.password_hash != crypt(p_password, v_emp.password_hash) THEN
    RETURN '{"success": false, "error": "Identifiants incorrects"}'::jsonb;
  END IF;

  v_session := public.issue_employee_session(v_emp.id, v_emp.branch_id);

  RETURN jsonb_build_object(
    'success', true,
    'employee', jsonb_build_object(
      'id', v_emp.id,
      'name', v_emp.first_name || ' ' || v_emp.last_name,
      'role', v_emp.role,
      'branch_id', v_emp.branch_id,
      'session_token', v_session->>'session_token'
    )
  );
END;
$$;

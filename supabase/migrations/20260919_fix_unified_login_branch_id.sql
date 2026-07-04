-- ════════════════════════════════════════════════════════════════════════════
-- Fix unified staff login branch_id error
-- Date: 2026-09-19
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.check_staff_login(
  p_username TEXT,
  p_pin TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  v_emp public.salon_employees;
  v_auto public.auto_parts_staff;
  v_branch_id UUID;
  v_business_id UUID;
  v_business_type TEXT;
  v_session JSONB;
  v_role TEXT;
BEGIN
  -- 1) Try salon_employees
  SELECT * INTO v_emp FROM public.salon_employees
  WHERE username = p_username AND is_active = true LIMIT 1;

  IF v_emp.id IS NOT NULL AND v_emp.password_hash IS NOT NULL AND v_emp.password_hash = crypt(p_pin, v_emp.password_hash) THEN
    -- FIXED: Changed branch_id to sb.id, added sb.business_id to populate v_business_id
    SELECT sb.id, sb.business_id, b.business_type 
    INTO v_branch_id, v_business_id, v_business_type
    FROM public.salon_branches sb
    JOIN public.businesses b ON b.id = sb.business_id
    WHERE sb.id = v_emp.branch_id;

    v_session := public.issue_employee_session(v_emp.id, v_emp.branch_id);

    RETURN jsonb_build_object(
      'success', true, 'staff_type', 'salon',
      'id', v_emp.id, 'name', v_emp.first_name || ' ' || v_emp.last_name,
      'role', v_emp.role, 'business_id', v_business_id,
      'branch_id', v_emp.branch_id,
      'session_token', (v_session->>'session_token'),
      'session_expires_at', (v_session->>'expires_at')
    );
  END IF;

  -- 2) Try auto_parts_staff
  SELECT * INTO v_auto FROM public.auto_parts_staff
  WHERE username = p_username AND is_active = true LIMIT 1;

  IF v_auto.id IS NOT NULL AND v_auto.pin_code IS NOT NULL AND v_auto.pin_code = p_pin THEN
    v_session := public.issue_auto_parts_staff_session(v_auto.id, v_auto.business_id);

    RETURN jsonb_build_object(
      'success', true, 'staff_type', 'auto_parts',
      'id', v_auto.id, 'name', v_auto.name,
      'role', v_auto.role, 'business_id', v_auto.business_id,
      'session_token', (v_session->>'session_token'),
      'session_expires_at', (v_session->>'expires_at')
    );
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'Identifiants incorrects');
END;
$$;

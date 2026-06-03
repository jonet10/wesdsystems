-- ============================================================================
-- Employee session bridge + secure POS catalog access
-- Date: 2026-06-24
--
-- Goals:
-- - Issue a signed employee session token at login
-- - Allow the POS to fetch branch-scoped catalog data through SECURITY DEFINER
--   RPCs without relying on Supabase Auth for employee mode
-- - Keep access locked to the employee's own branch
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Session storage
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.employee_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.salon_employees(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.salon_branches(id) ON DELETE CASCADE,
  session_token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_employee_sessions_employee_id ON public.employee_sessions(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_sessions_branch_id ON public.employee_sessions(branch_id);
CREATE INDEX IF NOT EXISTS idx_employee_sessions_expires_at ON public.employee_sessions(expires_at);

ALTER TABLE public.employee_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS employee_sessions_no_direct_access ON public.employee_sessions;
CREATE POLICY employee_sessions_no_direct_access ON public.employee_sessions
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- Session helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.issue_employee_session(
  p_employee_id UUID,
  p_branch_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee RECORD;
  v_token TEXT;
  v_hash TEXT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  UPDATE public.employee_sessions
  SET revoked_at = now()
  WHERE employee_id = p_employee_id
    AND revoked_at IS NULL
    AND expires_at > now();

  SELECT
    e.id,
    e.branch_id,
    e.is_active,
    b.business_id
  INTO v_employee
  FROM public.salon_employees e
  JOIN public.salon_branches b ON b.id = e.branch_id
  WHERE e.id = p_employee_id
    AND e.branch_id = p_branch_id
    AND e.is_active = true
  LIMIT 1;

  IF v_employee.id IS NULL THEN
    RAISE EXCEPTION 'Employé ou branche invalide' USING ERRCODE = '28000';
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_hash := encode(digest(v_token, 'sha256'), 'hex');
  v_expires_at := now() + INTERVAL '12 hours';

  INSERT INTO public.employee_sessions (
    employee_id,
    branch_id,
    session_token_hash,
    expires_at
  ) VALUES (
    p_employee_id,
    p_branch_id,
    v_hash,
    v_expires_at
  );

  RETURN jsonb_build_object(
    'session_token', v_token,
    'session_expires_at', v_expires_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_employee_session(
  p_session_token TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash TEXT;
BEGIN
  IF p_session_token IS NULL OR BTRIM(p_session_token) = '' THEN
    RETURN;
  END IF;

  v_hash := encode(digest(p_session_token, 'sha256'), 'hex');

  UPDATE public.employee_sessions
  SET revoked_at = now()
  WHERE session_token_hash = v_hash
    AND revoked_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_employee_session(
  p_session_token TEXT
)
RETURNS TABLE (
  employee_id UUID,
  branch_id UUID,
  business_id UUID,
  employee_role TEXT,
  employee_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash TEXT;
BEGIN
  IF p_session_token IS NULL OR BTRIM(p_session_token) = '' THEN
    RETURN;
  END IF;

  v_hash := encode(digest(p_session_token, 'sha256'), 'hex');

  RETURN QUERY
  SELECT
    e.id,
    e.branch_id,
    b.business_id,
    e.role::text,
    TRIM(CONCAT_WS(' ', e.first_name, e.last_name)) AS employee_name
  FROM public.employee_sessions s
  JOIN public.salon_employees e ON e.id = s.employee_id
  JOIN public.salon_branches b ON b.id = e.branch_id
  WHERE s.session_token_hash = v_hash
    AND s.revoked_at IS NULL
    AND s.expires_at > now()
    AND e.is_active = true
    AND b.is_active = true
  LIMIT 1;

  UPDATE public.employee_sessions
  SET last_seen_at = now()
  WHERE session_token_hash = v_hash
    AND revoked_at IS NULL
    AND expires_at > now();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_employee_pos_bundle(
  p_session_token TEXT,
  p_branch_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_branch RECORD;
  v_business RECORD;
  v_employee JSONB;
  v_products JSONB;
  v_services JSONB;
  v_promotions JSONB;
  v_staff JSONB;
BEGIN
  SELECT *
  INTO v_session
  FROM public.resolve_employee_session(p_session_token);

  IF v_session.employee_id IS NULL THEN
    RAISE EXCEPTION 'Session employé invalide ou expirée' USING ERRCODE = '28000';
  END IF;

  IF p_branch_id IS NOT NULL AND p_branch_id <> v_session.branch_id THEN
    RAISE EXCEPTION 'Accès non autorisé à cette branche' USING ERRCODE = '42501';
  END IF;

  SELECT
    sb.id,
    sb.business_id,
    sb.name AS branch_name,
    sb.phone,
    sb.email,
    sb.address
  INTO v_branch
  FROM public.salon_branches sb
  WHERE sb.id = v_session.branch_id
  LIMIT 1;

  SELECT
    b.id,
    b.name,
    b.logo_url
  INTO v_business
  FROM public.businesses b
  WHERE b.id = v_session.business_id
  LIMIT 1;

  v_employee := jsonb_build_object(
    'id', v_session.employee_id,
    'full_name', v_session.employee_name,
    'role', v_session.employee_role,
    'branch_id', v_session.branch_id
  );

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'unit_price', COALESCE(p.unit_price, 0),
        'category', p.category,
        'quantity_in_stock', COALESCE(p.quantity_in_stock, 0),
        'barcode', p.barcode
      )
      ORDER BY p.name
    ),
    '[]'::jsonb
  )
  INTO v_products
  FROM public.salon_products p
  WHERE p.branch_id = v_session.branch_id
    AND p.is_active = true;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'price_htg', COALESCE(s.price_htg, 0),
        'category_id', s.category_id,
        'metadata', COALESCE(s.metadata, '{}'::jsonb)
      )
      ORDER BY s.name
    ),
    '[]'::jsonb
  )
  INTO v_services
  FROM public.salon_services s
  WHERE s.branch_id = v_session.branch_id
    AND s.is_active = true;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', pr.id,
        'name', pr.name,
        'description', pr.description,
        'promotion_type', pr.promotion_type,
        'discount_value', pr.discount_value,
        'discount_percentage', pr.discount_percentage,
        'items_config', COALESCE(pr.items_config, '{}'::jsonb),
        'minimum_quantity', pr.minimum_quantity
      )
      ORDER BY pr.name
    ),
    '[]'::jsonb
  )
  INTO v_promotions
  FROM public.salon_promotions pr
  WHERE pr.branch_id = v_session.branch_id
    AND pr.is_active = true
    AND pr.valid_from <= current_date
    AND pr.valid_until >= current_date;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'first_name', e.first_name,
        'last_name', e.last_name,
        'role', e.role,
        'commission_percentage', COALESCE(e.commission_percentage, 0),
        'metadata', COALESCE(e.metadata, '{}'::jsonb),
        'is_active', e.is_active
      )
      ORDER BY e.first_name, e.last_name
    ),
    '[]'::jsonb
  )
  INTO v_staff
  FROM public.salon_employees e
  WHERE e.branch_id = v_session.branch_id
    AND e.is_active = true;

  RETURN jsonb_build_object(
    'employee', v_employee,
    'branch', jsonb_build_object(
      'id', v_branch.id,
      'business_id', v_branch.business_id,
      'name', v_branch.branch_name,
      'phone', v_branch.phone,
      'email', v_branch.email,
      'address', v_branch.address
    ),
    'business', jsonb_build_object(
      'id', v_business.id,
      'name', v_business.name,
      'logo_url', v_business.logo_url
    ),
    'products', v_products,
    'services', v_services,
    'promotions', v_promotions,
    'employees', v_staff
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_employee_session(UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_employee_session(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_employee_session(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_pos_bundle(TEXT, UUID) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Login RPC: issue an employee session token
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION check_employee_login(
  p_username TEXT,
  p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp salon_employees%ROWTYPE;
  v_count INT;
  v_session JSONB;
BEGIN
  SELECT COUNT(*)
    INTO v_count
  FROM public.salon_employees
  WHERE username = p_username
    AND is_active = true;

  IF v_count = 0 THEN
    RETURN '{"success": false, "error": "Identifiants incorrects"}'::jsonb;
  END IF;

  IF v_count > 1 THEN
    RETURN '{"success": false, "error": "Nom d''utilisateur ambigu, utilisez votre email ou contactez l''admin"}'::jsonb;
  END IF;

  SELECT *
    INTO v_emp
  FROM public.salon_employees
  WHERE username = p_username
    AND is_active = true
  LIMIT 1;

  IF v_emp.can_login = false THEN
    RETURN '{"success": false, "error": "Ce compte n''a pas accès à la plateforme"}'::jsonb;
  END IF;

  IF v_emp.password_hash IS NULL OR v_emp.password_hash != crypt(p_password, v_emp.password_hash) THEN
    RETURN '{"success": false, "error": "Identifiants incorrects"}'::jsonb;
  END IF;

  UPDATE public.salon_employees
  SET last_login_at = now()
  WHERE id = v_emp.id;

  v_session := public.issue_employee_session(v_emp.id, v_emp.branch_id);

  RETURN jsonb_build_object(
    'success', true,
    'employee', jsonb_build_object(
      'id', v_emp.id,
      'full_name', v_emp.first_name || ' ' || COALESCE(v_emp.last_name, ''),
      'role', v_emp.role,
      'branch_id', v_emp.branch_id,
      'session_token', v_session->>'session_token',
      'session_expires_at', v_session->>'session_expires_at'
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION check_employee_login(TEXT, TEXT) TO anon, authenticated;

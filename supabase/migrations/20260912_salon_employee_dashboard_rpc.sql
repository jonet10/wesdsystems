-- Migration: Fonction RPC pour les données du Dashboard employé (bypass RLS)
-- Cette fonction s'exécute en SECURITY DEFINER pour lire les données salon_sales
-- et les filtrer selon le token de session de l'employé.

CREATE OR REPLACE FUNCTION public.get_employee_dashboard_data(
  p_session_token TEXT,
  p_branch_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_today_start TIMESTAMPTZ;
  v_today_end   TIMESTAMPTZ;
  v_week_start  TIMESTAMPTZ;
  v_sales_today NUMERIC;
  v_sales_count_today INT;
  v_week_sales  JSONB;
BEGIN
  -- 1. Validate the session token
  SELECT *
  INTO v_session
  FROM public.resolve_employee_session(p_session_token);

  IF v_session.employee_id IS NULL THEN
    RAISE EXCEPTION 'Session employé invalide ou expirée' USING ERRCODE = '28000';
  END IF;

  -- 2. Ensure the branch matches
  IF p_branch_id <> v_session.branch_id THEN
    RAISE EXCEPTION 'Accès non autorisé à cette branche' USING ERRCODE = '42501';
  END IF;

  -- 3. Compute time ranges (UTC)
  v_today_start := date_trunc('day', NOW() AT TIME ZONE 'UTC');
  v_today_end   := v_today_start + INTERVAL '1 day' - INTERVAL '1 millisecond';
  v_week_start  := v_today_start - INTERVAL '6 days';

  -- 4. Today's sales (filtered by employee role)
  IF v_session.employee_role IN ('manager', 'salon_admin') THEN
    -- Managers see all branch sales
    SELECT
      COALESCE(SUM(total_amount - COALESCE(return_amount, 0)), 0),
      COUNT(*)
    INTO v_sales_today, v_sales_count_today
    FROM public.salon_sales
    WHERE branch_id = p_branch_id
      AND created_at BETWEEN v_today_start AND v_today_end
      AND payment_status = 'completed';
  ELSE
    -- Regular employees only see their own sales
    SELECT
      COALESCE(SUM(total_amount - COALESCE(return_amount, 0)), 0),
      COUNT(*)
    INTO v_sales_today, v_sales_count_today
    FROM public.salon_sales
    WHERE branch_id = p_branch_id
      AND created_at BETWEEN v_today_start AND v_today_end
      AND payment_status = 'completed'
      AND (cashier_id = v_session.employee_id OR employee_id = v_session.employee_id);
  END IF;

  -- 5. Weekly sales (last 7 days)
  IF v_session.employee_role IN ('manager', 'salon_admin') THEN
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'created_at', s.created_at,
          'total_amount', s.total_amount,
          'return_amount', COALESCE(s.return_amount, 0)
        )
        ORDER BY s.created_at
      ),
      '[]'::jsonb
    )
    INTO v_week_sales
    FROM public.salon_sales s
    WHERE s.branch_id = p_branch_id
      AND s.created_at BETWEEN v_week_start AND v_today_end
      AND s.payment_status = 'completed';
  ELSE
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'created_at', s.created_at,
          'total_amount', s.total_amount,
          'return_amount', COALESCE(s.return_amount, 0)
        )
        ORDER BY s.created_at
      ),
      '[]'::jsonb
    )
    INTO v_week_sales
    FROM public.salon_sales s
    WHERE s.branch_id = p_branch_id
      AND s.created_at BETWEEN v_week_start AND v_today_end
      AND s.payment_status = 'completed'
      AND (s.cashier_id = v_session.employee_id OR s.employee_id = v_session.employee_id);
  END IF;

  RETURN jsonb_build_object(
    'today_revenue', v_sales_today,
    'today_count',   v_sales_count_today,
    'week_sales',    COALESCE(v_week_sales, '[]'::jsonb),
    'employee_id',   v_session.employee_id,
    'employee_role', v_session.employee_role,
    'branch_id',     v_session.branch_id,
    'business_id',   v_session.business_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_employee_dashboard_data(TEXT, UUID) TO anon, authenticated;

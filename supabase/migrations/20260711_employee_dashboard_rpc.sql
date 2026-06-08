-- ════════════════════════════════════════════════════════════════════════════
-- WESD SYSTEMS — Employee Dashboard RPC & user_id link
-- Date: 2026-07-11
--
-- 1. Creates get_employee_dashboard_stats() — a SECURITY DEFINER RPC that
--    bypasses RLS for employee PIN login sessions (anon key).
-- 2. Adds user_id FK to salon_employees for Supabase Auth employee linking.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. Link salon_employees to auth.users ───
ALTER TABLE public.salon_employees
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ─── 2. Employee dashboard stats RPC ───
DROP FUNCTION IF EXISTS public.get_employee_dashboard_stats(TEXT, UUID);

CREATE OR REPLACE FUNCTION public.get_employee_dashboard_stats(
  p_session_token TEXT,
  p_branch_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp_id       UUID;
  v_branch_id    UUID;
  v_emp_name     TEXT;
  v_emp_role     TEXT;
  v_now          TIMESTAMPTZ := now();
  v_today_start  TIMESTAMPTZ;
  v_week_start   TIMESTAMPTZ;
  v_month_start  TIMESTAMPTZ;
  v_tz           TEXT := 'America/Port-au-Prince';
  v_today_sales  JSONB;
  v_day          JSONB;
  v_week         JSONB;
  v_month        JSONB;
BEGIN
  -- Resolve employee session
  SELECT s.employee_id, s.branch_id, s.employee_name, s.employee_role
    INTO v_emp_id, v_branch_id, v_emp_name, v_emp_role
  FROM public.resolve_employee_session(p_session_token) s;

  IF v_emp_id IS NULL THEN
    RAISE EXCEPTION 'Session employé invalide ou expirée' USING ERRCODE = '28000';
  END IF;

  IF p_branch_id IS NOT NULL AND p_branch_id <> v_branch_id THEN
    RAISE EXCEPTION 'Accès non autorisé à cette branche' USING ERRCODE = '42501';
  END IF;

  v_today_start := date_trunc('day',    v_now AT TIME ZONE v_tz) AT TIME ZONE v_tz;
  v_week_start  := date_trunc('week',   v_now AT TIME ZONE v_tz) AT TIME ZONE v_tz;
  v_month_start := date_trunc('month',  v_now AT TIME ZONE v_tz) AT TIME ZONE v_tz;

  -- ── Today's detailed sales (net of returns) ──
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',             s.id,
      'sale_number',    s.sale_number,
      'total_amount',   s.total_amount - COALESCE(s.return_amount, 0),
      'payment_method', s.payment_method,
      'customer_name',  s.customer_name,
      'created_at',     s.created_at
    ) ORDER BY s.created_at DESC
  ), '[]'::jsonb)
  INTO v_today_sales
  FROM public.salon_sales s
  WHERE s.branch_id   = v_branch_id
    AND s.cashier_id  = v_emp_id
    AND s.created_at >= v_today_start
    AND s.created_at <  (v_today_start + INTERVAL '1 day')
    AND s.refund_status IS DISTINCT FROM 'full';

  -- ── Day aggregate (net of returns) ──
  SELECT jsonb_build_object(
    'revenue',  COALESCE(SUM(s.total_amount - COALESCE(s.return_amount, 0)), 0),
    'tickets',  COUNT(*)
  )
  INTO v_day
  FROM public.salon_sales s
  WHERE s.branch_id   = v_branch_id
    AND s.cashier_id  = v_emp_id
    AND s.created_at >= v_today_start
    AND s.created_at <  (v_today_start + INTERVAL '1 day')
    AND s.refund_status IS DISTINCT FROM 'full';

  -- ── Week aggregate (today + last 6, net of returns) ──
  SELECT jsonb_build_object(
    'revenue',  COALESCE(SUM(s.total_amount - COALESCE(s.return_amount, 0)), 0),
    'tickets',  COUNT(*)
  )
  INTO v_week
  FROM public.salon_sales s
  WHERE s.branch_id   = v_branch_id
    AND s.cashier_id  = v_emp_id
    AND s.created_at >= v_week_start
    AND s.created_at <  (v_today_start + INTERVAL '1 day')
    AND s.refund_status IS DISTINCT FROM 'full';

  -- ── Month aggregate (net of returns) ──
  SELECT jsonb_build_object(
    'revenue',  COALESCE(SUM(s.total_amount - COALESCE(s.return_amount, 0)), 0),
    'tickets',  COUNT(*)
  )
  INTO v_month
  FROM public.salon_sales s
  WHERE s.branch_id   = v_branch_id
    AND s.cashier_id  = v_emp_id
    AND s.created_at >= v_month_start
    AND s.created_at <  (v_today_start + INTERVAL '1 day')
    AND s.refund_status IS DISTINCT FROM 'full';

  RETURN jsonb_build_object(
    'employee_id',    v_emp_id,
    'branch_id',      v_branch_id,
    'employee_name',  v_emp_name,
    'employee_role',  v_emp_role,
    'today_sales',    v_today_sales,
    'day',            v_day,
    'week',           v_week,
    'month',          v_month
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_employee_dashboard_stats(TEXT, UUID) TO anon, authenticated;

DO $$ BEGIN RAISE NOTICE 'Migration 20260711 applied: employee dashboard RPC + user_id column'; END $$;

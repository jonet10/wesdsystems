-- ════════════════════════════════════════════════════════════════════════════
-- WESD SYSTEMS — Employee Dashboard RPC (Extended)
-- Date: 2026-07-12
--
-- Etend get_employee_dashboard_stats() pour inclure l'évolution, top produits,
-- ruptures de stock, et distribution par catégorie.
-- Si le rôle est "manager", il verra les statistiques étendues pour toute la succursale.
-- ════════════════════════════════════════════════════════════════════════════

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
  
  -- Extensions
  v_evolution    JSONB := '[]'::jsonb;
  v_top_products JSONB := '[]'::jsonb;
  v_out_of_stock JSONB := '[]'::jsonb;
  v_category_dist JSONB := '[]'::jsonb;
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
    AND s.created_at >= (v_today_start - INTERVAL '6 days')
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
    AND s.created_at >= (v_today_start - INTERVAL '29 days')
    AND s.created_at <  (v_today_start + INTERVAL '1 day')
    AND s.refund_status IS DISTINCT FROM 'full';


  -- ── NEW: Evolution des ventes (7 days) ──
  WITH last_7_days AS (
    SELECT generate_series((v_today_start - INTERVAL '6 days'), v_today_start, '1 day'::interval) AS d
  ),
  daily_sales AS (
    SELECT 
      date_trunc('day', s.created_at AT TIME ZONE v_tz) AT TIME ZONE v_tz AS sale_date,
      SUM(s.total_amount - COALESCE(s.return_amount, 0)) AS revenue
    FROM public.salon_sales s
    WHERE s.branch_id = v_branch_id
      AND (v_emp_role = 'manager' OR s.cashier_id = v_emp_id)
      AND s.created_at >= (v_today_start - INTERVAL '6 days')
      AND s.created_at < (v_today_start + INTERVAL '1 day')
      AND s.refund_status IS DISTINCT FROM 'full'
    GROUP BY 1
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'label', to_char(ld.d, 'Dy'),
      'total', COALESCE(ds.revenue, 0)
    ) ORDER BY ld.d
  ), '[]'::jsonb)
  INTO v_evolution
  FROM last_7_days ld
  LEFT JOIN daily_sales ds ON ld.d = ds.sale_date;

  -- ── NEW: Top Produits (30 days) ──
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'name', COALESCE(sp.name, ss.name, 'Article Inconnu'),
      'quantity', COALESCE(t.total_qty, 0)
    ) ORDER BY t.total_qty DESC
  ), '[]'::jsonb)
  INTO v_top_products
  FROM (
    SELECT 
      si.product_id,
      si.service_id,
      SUM(si.quantity) AS total_qty
    FROM public.salon_sale_items si
    JOIN public.salon_sales s ON si.sale_id = s.id
    WHERE s.branch_id = v_branch_id
      AND (v_emp_role = 'manager' OR s.cashier_id = v_emp_id)
      AND s.created_at >= (v_today_start - INTERVAL '29 days')
      AND s.refund_status IS DISTINCT FROM 'full'
    GROUP BY si.product_id, si.service_id
    ORDER BY total_qty DESC
    LIMIT 4
  ) t
  LEFT JOIN public.salon_products sp ON t.product_id = sp.id
  LEFT JOIN public.salon_services ss ON t.service_id = ss.id;

  -- ── NEW: Ruptures de Stock ──
  IF v_emp_role = 'manager' THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'name', p.name
      )
    ), '[]'::jsonb)
    INTO v_out_of_stock
    FROM public.salon_products p
    WHERE p.branch_id = v_branch_id
      AND p.is_active = true
      AND p.quantity_in_stock <= p.reorder_level
    LIMIT 5;
  END IF;

  -- ── NEW: Distribution par Catégorie (30 days) ──
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'name', t.category,
      'value', t.total_val
    )
  ), '[]'::jsonb)
  INTO v_category_dist
  FROM (
    SELECT 
      CASE 
        WHEN si.product_id IS NOT NULL THEN 'Produits'
        WHEN si.service_id IS NOT NULL THEN 'Services'
        ELSE 'Autres'
      END AS category,
      SUM(si.total_price) AS total_val
    FROM public.salon_sale_items si
    JOIN public.salon_sales s ON si.sale_id = s.id
    WHERE s.branch_id = v_branch_id
      AND (v_emp_role = 'manager' OR s.cashier_id = v_emp_id)
      AND s.created_at >= (v_today_start - INTERVAL '29 days')
      AND s.refund_status IS DISTINCT FROM 'full'
    GROUP BY 1
    HAVING SUM(si.total_price) > 0
  ) t;

  RETURN jsonb_build_object(
    'employee_id',    v_emp_id,
    'branch_id',      v_branch_id,
    'employee_name',  v_emp_name,
    'employee_role',  v_emp_role,
    'today_sales',    v_today_sales,
    'day',            v_day,
    'week',           v_week,
    'month',          v_month,
    'evolution',      v_evolution,
    'top_products',   v_top_products,
    'out_of_stock',   v_out_of_stock,
    'category_dist',  v_category_dist
  );
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- WESD AUTO PARTS — Add revenue (CA) to cashier & admin dashboards
-- Migration: 20260811_dashboard_revenue_stats.sql
-- Extends auto_parts_cashier_dashboard and auto_parts_admin_cashier_stats
-- to include revenue amounts, filtering ACTIVE sales only.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. auto_parts_cashier_dashboard — adds revenueToday/Week/Month ──────────
DROP FUNCTION IF EXISTS public.auto_parts_cashier_dashboard(UUID, UUID, UUID);
CREATE OR REPLACE FUNCTION public.auto_parts_cashier_dashboard(
  p_business_id UUID,
  p_staff_id    UUID,
  p_branch_id   UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_day_start    TIMESTAMPTZ := date_trunc('day',   now());
  v_week_start   TIMESTAMPTZ := date_trunc('week',  now());
  v_month_start  TIMESTAMPTZ := date_trunc('month', now());

  -- Transaction counts
  v_sales_today  INT     := 0;
  v_sales_week   INT     := 0;
  v_sales_month  INT     := 0;

  -- Revenue (CA)
  v_rev_today    NUMERIC := 0;
  v_rev_week     NUMERIC := 0;
  v_rev_month    NUMERIC := 0;

  -- Product quantities sold
  v_items_today  NUMERIC := 0;
  v_items_week   NUMERIC := 0;
  v_items_month  NUMERIC := 0;
BEGIN
  -- ── Transaction counts & revenue ─────────────────────────────────────────
  SELECT
    COUNT(*)                                                      AS cnt_today,
    COALESCE(SUM(total), 0)                                       AS rev_today
  INTO v_sales_today, v_rev_today
  FROM public.auto_parts_sales
  WHERE business_id = p_business_id
    AND staff_id    = p_staff_id
    AND status      = 'ACTIVE'
    AND created_at >= v_day_start
    AND (p_branch_id IS NULL OR branch_id IS NULL OR branch_id = p_branch_id);

  SELECT
    COUNT(*),
    COALESCE(SUM(total), 0)
  INTO v_sales_week, v_rev_week
  FROM public.auto_parts_sales
  WHERE business_id = p_business_id
    AND staff_id    = p_staff_id
    AND status      = 'ACTIVE'
    AND created_at >= v_week_start
    AND (p_branch_id IS NULL OR branch_id IS NULL OR branch_id = p_branch_id);

  SELECT
    COUNT(*),
    COALESCE(SUM(total), 0)
  INTO v_sales_month, v_rev_month
  FROM public.auto_parts_sales
  WHERE business_id = p_business_id
    AND staff_id    = p_staff_id
    AND status      = 'ACTIVE'
    AND created_at >= v_month_start
    AND (p_branch_id IS NULL OR branch_id IS NULL OR branch_id = p_branch_id);

  -- ── Product quantities sold ───────────────────────────────────────────────
  SELECT COALESCE(SUM(si.quantity), 0) INTO v_items_today
  FROM public.auto_parts_sales s
  JOIN public.auto_parts_sale_items si ON si.sale_id = s.id
  WHERE s.business_id = p_business_id AND s.staff_id = p_staff_id
    AND s.status = 'ACTIVE' AND s.created_at >= v_day_start
    AND (p_branch_id IS NULL OR s.branch_id IS NULL OR s.branch_id = p_branch_id);

  SELECT COALESCE(SUM(si.quantity), 0) INTO v_items_week
  FROM public.auto_parts_sales s
  JOIN public.auto_parts_sale_items si ON si.sale_id = s.id
  WHERE s.business_id = p_business_id AND s.staff_id = p_staff_id
    AND s.status = 'ACTIVE' AND s.created_at >= v_week_start
    AND (p_branch_id IS NULL OR s.branch_id IS NULL OR s.branch_id = p_branch_id);

  SELECT COALESCE(SUM(si.quantity), 0) INTO v_items_month
  FROM public.auto_parts_sales s
  JOIN public.auto_parts_sale_items si ON si.sale_id = s.id
  WHERE s.business_id = p_business_id AND s.staff_id = p_staff_id
    AND s.status = 'ACTIVE' AND s.created_at >= v_month_start
    AND (p_branch_id IS NULL OR s.branch_id IS NULL OR s.branch_id = p_branch_id);

  RETURN jsonb_build_object(
    -- Counts
    'salesToday',    v_sales_today,
    'salesWeek',     v_sales_week,
    'salesMonth',    v_sales_month,
    -- Invoice counts (same as sales in this model)
    'invoicesToday', v_sales_today,
    'invoicesWeek',  v_sales_week,
    'invoicesMonth', v_sales_month,
    -- Revenue (CA)
    'revenueToday',  v_rev_today,
    'revenueWeek',   v_rev_week,
    'revenueMonth',  v_rev_month,
    -- Products sold
    'itemsSoldToday',  v_items_today,
    'itemsSoldWeek',   v_items_week,
    'itemsSoldMonth',  v_items_month
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.auto_parts_cashier_dashboard TO anon, authenticated;

-- ─── 2. auto_parts_admin_cashier_stats — adds itemsSold to byCashier ─────────
DROP FUNCTION IF EXISTS public.auto_parts_admin_cashier_stats(UUID, UUID);
CREATE OR REPLACE FUNCTION public.auto_parts_admin_cashier_stats(
  p_business_id UUID,
  p_branch_id   UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_day_start   TIMESTAMPTZ := date_trunc('day',   now());
  v_week_start  TIMESTAMPTZ := date_trunc('week',  now());
  v_month_start TIMESTAMPTZ := date_trunc('month', now());
  v_global      JSONB;
  v_by_cashier  JSONB;
BEGIN
  -- ── Global stats (revenue + invoice counts, ACTIVE only) ─────────────────
  SELECT jsonb_build_object(
    'salesToday',    COALESCE(SUM(CASE WHEN s.created_at >= v_day_start   THEN s.total ELSE 0 END), 0),
    'salesWeek',     COALESCE(SUM(CASE WHEN s.created_at >= v_week_start  THEN s.total ELSE 0 END), 0),
    'salesMonth',    COALESCE(SUM(CASE WHEN s.created_at >= v_month_start THEN s.total ELSE 0 END), 0),
    'invoicesToday', COUNT(CASE WHEN s.created_at >= v_day_start   THEN 1 END),
    'invoicesWeek',  COUNT(CASE WHEN s.created_at >= v_week_start  THEN 1 END),
    'invoicesMonth', COUNT(CASE WHEN s.created_at >= v_month_start THEN 1 END)
  ) INTO v_global
  FROM public.auto_parts_sales s
  WHERE s.business_id = p_business_id
    AND s.status = 'ACTIVE'
    AND (p_branch_id IS NULL OR s.branch_id IS NULL OR s.branch_id = p_branch_id);

  -- ── Per-cashier stats (revenue + counts + products sold, ACTIVE only) ────
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'staffId',        COALESCE(agg.staff_id::TEXT, 'unknown'),
      'staffName',      COALESCE(agg.staff_name, 'Non assigné'),
      -- Revenue
      'salesToday',     agg.rev_today,
      'salesWeek',      agg.rev_week,
      'salesMonth',     agg.rev_month,
      -- Counts
      'invoicesToday',  agg.cnt_today,
      'invoicesWeek',   agg.cnt_week,
      'invoicesTotal',  agg.cnt_month,
      -- Products sold this month
      'itemsSoldMonth', COALESCE(qty.items_month, 0)
    )
    ORDER BY agg.rev_month DESC
  ), '[]'::jsonb) INTO v_by_cashier
  FROM (
    SELECT
      s.staff_id,
      s.staff_name,
      SUM(CASE WHEN s.created_at >= v_day_start   THEN s.total ELSE 0 END) AS rev_today,
      SUM(CASE WHEN s.created_at >= v_week_start  THEN s.total ELSE 0 END) AS rev_week,
      SUM(CASE WHEN s.created_at >= v_month_start THEN s.total ELSE 0 END) AS rev_month,
      COUNT(CASE WHEN s.created_at >= v_day_start   THEN 1 END)            AS cnt_today,
      COUNT(CASE WHEN s.created_at >= v_week_start  THEN 1 END)            AS cnt_week,
      COUNT(CASE WHEN s.created_at >= v_month_start THEN 1 END)            AS cnt_month
    FROM public.auto_parts_sales s
    WHERE s.business_id = p_business_id
      AND s.status = 'ACTIVE'
      AND (p_branch_id IS NULL OR s.branch_id IS NULL OR s.branch_id = p_branch_id)
    GROUP BY s.staff_id, s.staff_name
  ) agg
  LEFT JOIN LATERAL (
    -- Products sold this month per cashier
    SELECT COALESCE(SUM(si.quantity), 0) AS items_month
    FROM public.auto_parts_sales s2
    JOIN public.auto_parts_sale_items si ON si.sale_id = s2.id
    WHERE s2.business_id = p_business_id
      AND s2.staff_id    = agg.staff_id
      AND s2.status      = 'ACTIVE'
      AND s2.created_at >= v_month_start
      AND (p_branch_id IS NULL OR s2.branch_id IS NULL OR s2.branch_id = p_branch_id)
  ) qty ON true;

  RETURN jsonb_build_object('global', v_global, 'byCashier', v_by_cashier);
END;
$$;
GRANT EXECUTE ON FUNCTION public.auto_parts_admin_cashier_stats TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
DO $$ BEGIN RAISE NOTICE 'Migration 20260811 applied: revenue added to cashier & admin dashboards'; END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- WESD AUTO PARTS — Fix NULL staff_id in dashboard
-- Migration: 20260812_fix_dashboard_null_staff.sql
-- ════════════════════════════════════════════════════════════════════════════

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
      AND s2.staff_id IS NOT DISTINCT FROM agg.staff_id
      AND s2.staff_name IS NOT DISTINCT FROM agg.staff_name
      AND s2.status      = 'ACTIVE'
      AND s2.created_at >= v_month_start
      AND (p_branch_id IS NULL OR s2.branch_id IS NULL OR s2.branch_id = p_branch_id)
  ) qty ON true;

  RETURN jsonb_build_object('global', v_global, 'byCashier', v_by_cashier);
END;
$$;
GRANT EXECUTE ON FUNCTION public.auto_parts_admin_cashier_stats TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
DO $$ BEGIN RAISE NOTICE 'Migration 20260812 applied: Fix null staff mapping in admin dashboard stats'; END $$;

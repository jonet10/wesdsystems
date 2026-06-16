-- ════════════════════════════════════════════════════════════════════════════
-- FIX: auto_parts_dashboard_counts — les admins Supabase voient les montants
--
-- Problème : quand un admin se connecte via Supabase Auth (pas via session
-- caissier), le paramètre p_session_token est NULL, donc v_can_see_finance
-- reste false et les montants du stock sont masqués.
--
-- Solution : on ajoute p_is_admin BOOLEAN et on vérifie aussi auth.uid()
-- pour détecter un admin Supabase (rôle super_admin ou salon_admin).
-- ════════════════════════════════════════════════════════════════════════════

-- Drop toutes les signatures existantes
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT oidvectortypes(proargtypes) AS args
    FROM pg_catalog.pg_proc
    WHERE pronamespace = 'public'::regnamespace AND proname = 'auto_parts_dashboard_counts'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS public.auto_parts_dashboard_counts(%s)', r.args);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.auto_parts_dashboard_counts(
  p_business_id   UUID,
  p_session_token TEXT    DEFAULT NULL,
  p_staff_id      UUID    DEFAULT NULL,
  p_branch_id     UUID    DEFAULT NULL,
  p_is_admin      BOOLEAN DEFAULT FALSE
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_total_products        INT;
  v_total_stock_value     NUMERIC;
  v_out_of_stock          INT;
  v_low_stock             INT;
  v_today_sales           NUMERIC;
  v_month_sales           NUMERIC;
  v_month_purchases       NUMERIC;
  v_pending_orders        INT;
  v_month_start           TIMESTAMPTZ;
  v_day_start             TIMESTAMPTZ;
  v_staff_role            TEXT;
  v_can_see_finance       BOOLEAN := false;
  v_total_potential_revenue NUMERIC := 0;
  v_total_potential_profit  NUMERIC := 0;
  v_supabase_role         TEXT;
BEGIN
  v_month_start := date_trunc('month', now());
  v_day_start   := date_trunc('day', now());

  -- 1. Accès via token caissier/manager/admin (session interne)
  IF p_session_token IS NOT NULL THEN
    SELECT s.staff_role INTO v_staff_role
    FROM public.resolve_staff_from_token(p_session_token) s;
    IF v_staff_role IS NOT NULL AND public.staff_has_permission(v_staff_role, 'products.manage') THEN
      v_can_see_finance := true;
    END IF;
    IF NOT v_can_see_finance AND public.auto_parts_has_permission(p_session_token, 'products.manage', p_business_id) THEN
      v_can_see_finance := true;
    END IF;
  END IF;

  -- 2. Accès via Supabase Auth (admin connecté directement)
  IF NOT v_can_see_finance THEN
    IF p_is_admin THEN
      v_can_see_finance := true;
    ELSE
      -- Vérifier si auth.uid() est un admin ou propriétaire de ce business
      SELECT p.role INTO v_supabase_role
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.role IN ('super_admin', 'salon_admin', 'owner') OR p.business_id = p_business_id)
      LIMIT 1;
      IF v_supabase_role IS NOT NULL THEN
        v_can_see_finance := true;
      END IF;
    END IF;
  END IF;

  SELECT COUNT(*) INTO v_total_products
  FROM public.auto_parts_products
  WHERE business_id = p_business_id
    AND (p_branch_id IS NULL OR branch_id IS NULL OR branch_id = p_branch_id);

  IF v_can_see_finance THEN
    SELECT
      COALESCE(SUM(cost_price * stock_quantity), 0),
      COALESCE(SUM(unit_price * stock_quantity), 0)
    INTO v_total_stock_value, v_total_potential_revenue
    FROM public.auto_parts_products
    WHERE business_id = p_business_id
      AND active = true
      AND (p_branch_id IS NULL OR branch_id IS NULL OR branch_id = p_branch_id);

    v_total_potential_profit := v_total_potential_revenue - v_total_stock_value;
  END IF;

  SELECT COUNT(*) INTO v_out_of_stock
  FROM public.auto_parts_products
  WHERE business_id = p_business_id
    AND active = true AND stock_quantity <= 0
    AND (p_branch_id IS NULL OR branch_id IS NULL OR branch_id = p_branch_id);

  SELECT COUNT(*) INTO v_low_stock
  FROM public.auto_parts_products
  WHERE business_id = p_business_id
    AND active = true AND stock_quantity > 0 AND stock_quantity <= min_stock
    AND (p_branch_id IS NULL OR branch_id IS NULL OR branch_id = p_branch_id);

  IF p_staff_id IS NOT NULL THEN
    SELECT COALESCE(SUM(total), 0) INTO v_today_sales
    FROM public.auto_parts_sales
    WHERE business_id = p_business_id
      AND created_at >= v_day_start
      AND refund_status IS DISTINCT FROM 'full'
      AND staff_id = p_staff_id
      AND (p_branch_id IS NULL OR branch_id IS NULL OR branch_id = p_branch_id);

    SELECT COALESCE(SUM(total), 0) INTO v_month_sales
    FROM public.auto_parts_sales
    WHERE business_id = p_business_id
      AND created_at >= v_month_start
      AND refund_status IS DISTINCT FROM 'full'
      AND staff_id = p_staff_id
      AND (p_branch_id IS NULL OR branch_id IS NULL OR branch_id = p_branch_id);
  ELSE
    SELECT COALESCE(SUM(total), 0) INTO v_today_sales
    FROM public.auto_parts_sales
    WHERE business_id = p_business_id
      AND created_at >= v_day_start
      AND refund_status IS DISTINCT FROM 'full'
      AND (p_branch_id IS NULL OR branch_id IS NULL OR branch_id = p_branch_id);

    SELECT COALESCE(SUM(total), 0) INTO v_month_sales
    FROM public.auto_parts_sales
    WHERE business_id = p_business_id
      AND created_at >= v_month_start
      AND refund_status IS DISTINCT FROM 'full'
      AND (p_branch_id IS NULL OR branch_id IS NULL OR branch_id = p_branch_id);
  END IF;

  SELECT COALESCE(SUM(total), 0) INTO v_month_purchases
  FROM public.auto_parts_purchases
  WHERE business_id = p_business_id
    AND created_at >= v_month_start
    AND status = 'delivered'
    AND (p_branch_id IS NULL OR branch_id IS NULL OR branch_id = p_branch_id);

  SELECT COUNT(*) INTO v_pending_orders
  FROM public.auto_parts_purchases
  WHERE business_id = p_business_id AND status IN ('pending', 'confirmed')
    AND (p_branch_id IS NULL OR branch_id IS NULL OR branch_id = p_branch_id);

  RETURN jsonb_build_object(
    'totalProducts',         v_total_products,
    'totalStockValue',       CASE WHEN v_can_see_finance THEN v_total_stock_value        ELSE 0 END,
    'totalPotentialRevenue', CASE WHEN v_can_see_finance THEN v_total_potential_revenue   ELSE 0 END,
    'totalPotentialProfit',  CASE WHEN v_can_see_finance THEN v_total_potential_profit    ELSE 0 END,
    'outOfStock',            v_out_of_stock,
    'lowStock',              v_low_stock,
    'todaySales',            v_today_sales,
    'monthSales',            v_month_sales,
    'monthPurchases',        v_month_purchases,
    'pendingOrders',         v_pending_orders
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_parts_dashboard_counts(UUID, TEXT, UUID, UUID, BOOLEAN) TO anon, authenticated;

DO $$ BEGIN RAISE NOTICE 'Fix applied: auto_parts_dashboard_counts now shows finance data for Supabase admins'; END $$;

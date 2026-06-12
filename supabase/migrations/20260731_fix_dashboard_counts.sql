-- ════════════════════════════════════════════════════════════════════════════
-- Fix auto_parts_dashboard_counts — ensure the function exists and works
-- Fix "Achats mois" to return SUM(total) instead of COUNT(*)
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.auto_parts_dashboard_counts(
  p_business_id UUID,
  p_staff_id UUID DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_total_products INT;
  v_total_stock_value NUMERIC;
  v_out_of_stock INT;
  v_low_stock INT;
  v_today_sales NUMERIC;
  v_month_sales NUMERIC;
  v_month_purchases NUMERIC;
  v_pending_orders INT;
  v_month_start TIMESTAMPTZ;
  v_day_start TIMESTAMPTZ;
BEGIN
  v_month_start := date_trunc('month', now());
  v_day_start := date_trunc('day', now());

  SELECT COUNT(*) INTO v_total_products
  FROM public.auto_parts_products
  WHERE business_id = p_business_id OR business_id IS NULL;

  SELECT COALESCE(SUM(cost_price * stock_quantity), 0) INTO v_total_stock_value
  FROM public.auto_parts_products
  WHERE (business_id = p_business_id OR business_id IS NULL)
    AND active = true;

  SELECT COUNT(*) INTO v_out_of_stock
  FROM public.auto_parts_products
  WHERE (business_id = p_business_id OR business_id IS NULL)
    AND active = true AND stock_quantity <= 0;

  SELECT COUNT(*) INTO v_low_stock
  FROM public.auto_parts_products
  WHERE (business_id = p_business_id OR business_id IS NULL)
    AND active = true AND stock_quantity > 0 AND stock_quantity <= min_stock;

  SELECT COALESCE(SUM(total), 0) INTO v_today_sales
  FROM public.auto_parts_sales
  WHERE business_id = p_business_id
    AND created_at >= v_day_start
    AND refund_status IS DISTINCT FROM 'full'
    AND (p_staff_id IS NULL OR staff_id = p_staff_id);

  SELECT COALESCE(SUM(total), 0) INTO v_month_sales
  FROM public.auto_parts_sales
  WHERE business_id = p_business_id
    AND created_at >= v_month_start
    AND refund_status IS DISTINCT FROM 'full'
    AND (p_staff_id IS NULL OR staff_id = p_staff_id);

  -- Fix: use SUM(total) instead of COUNT(*) pour retourner le montant total des achats
  SELECT COALESCE(SUM(total), 0) INTO v_month_purchases
  FROM public.auto_parts_purchases
  WHERE business_id = p_business_id
    AND created_at >= v_month_start
    AND status = 'delivered';

  SELECT COUNT(*) INTO v_pending_orders
  FROM public.auto_parts_purchases
  WHERE business_id = p_business_id AND status IN ('pending', 'confirmed');

  RETURN jsonb_build_object(
    'totalProducts', v_total_products,
    'totalStockValue', v_total_stock_value,
    'outOfStock', v_out_of_stock,
    'lowStock', v_low_stock,
    'todaySales', v_today_sales,
    'monthSales', v_month_sales,
    'monthPurchases', v_month_purchases,
    'pendingOrders', v_pending_orders
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_parts_dashboard_counts TO anon, authenticated;

DO $$ BEGIN RAISE NOTICE 'Fix dashboard_counts: ensure function exists, monthPurchases → SUM(total)'; END $$;

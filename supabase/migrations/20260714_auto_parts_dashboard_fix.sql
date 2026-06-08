-- ════════════════════════════════════════════════════════════════════════════
-- Fix auto_parts_dashboard_counts: todaySales → SUM, optional staff filter
-- Fix auto_parts_monthly_sales: optional staff filter
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. Dashboard counts with optional staff_id filter ───
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
  v_month_purchases INT;
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

  SELECT COUNT(*) INTO v_month_purchases
  FROM public.auto_parts_purchases
  WHERE business_id = p_business_id AND created_at >= v_month_start AND status = 'delivered';

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

-- ─── 2. Monthly sales for chart with optional staff_id filter ───
CREATE OR REPLACE FUNCTION public.auto_parts_monthly_sales(
  p_business_id UUID,
  p_staff_id UUID DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_year_start TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  v_year_start := date_trunc('year', now());
  SELECT jsonb_agg(v ORDER BY v.month) INTO v_result
  FROM (
    SELECT EXTRACT(MONTH FROM created_at)::INT - 1 AS month, COALESCE(SUM(total), 0) AS total
    FROM public.auto_parts_sales
    WHERE business_id = p_business_id
      AND created_at >= v_year_start
      AND refund_status IS DISTINCT FROM 'full'
      AND (p_staff_id IS NULL OR staff_id = p_staff_id)
    GROUP BY month
    ORDER BY month
  ) v;
  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

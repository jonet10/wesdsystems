-- ════════════════════════════════════════════════════════════════════════════
-- WESD AUTO PARTS — SECURITY DEFINER list RPCs (bypass RLS for staff sessions)
-- These functions run as the table owner, circumventing RLS for staff session
-- users who do NOT have a Supabase Auth session (anon key).
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 0. Add missing staff_name column to auto_parts_sales ───
ALTER TABLE public.auto_parts_sales ADD COLUMN IF NOT EXISTS staff_name TEXT;

-- ─── 1. auto_parts_list_products ───
CREATE OR REPLACE FUNCTION public.auto_parts_list_products(p_business_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(
    to_jsonb(p) || jsonb_build_object('category',
      CASE WHEN p.category_id IS NOT NULL THEN
        (SELECT to_jsonb(c) FROM public.auto_parts_categories c WHERE c.id = p.category_id)
      ELSE NULL END
    )
    ORDER BY p.name
  ), '[]'::jsonb) INTO v_result
  FROM public.auto_parts_products p
  WHERE p.business_id = p_business_id OR p.business_id IS NULL;
  RETURN v_result;
END;
$$;

-- ─── 2. auto_parts_search_products ───
CREATE OR REPLACE FUNCTION public.auto_parts_search_products(p_business_id UUID, p_query TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
    FROM (
      SELECT id, name, sku, unit_price, stock_quantity, active
      FROM public.auto_parts_products
      WHERE (business_id = p_business_id OR business_id IS NULL)
        AND (name ILIKE '%' || p_query || '%' OR sku ILIKE '%' || p_query || '%')
      ORDER BY name
      LIMIT 20
    ) r
  );
END;
$$;

-- ─── 3. auto_parts_get_product ───
CREATE OR REPLACE FUNCTION public.auto_parts_get_product(p_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT to_jsonb(p) || jsonb_build_object('category',
    CASE WHEN p.category_id IS NOT NULL THEN
      (SELECT to_jsonb(c) FROM public.auto_parts_categories c WHERE c.id = p.category_id)
    ELSE NULL END
  ) INTO v_result
  FROM public.auto_parts_products p
  WHERE p.id = p_id;
  RETURN v_result;
END;
$$;

-- ─── 4. auto_parts_list_categories ───
CREATE OR REPLACE FUNCTION public.auto_parts_list_categories(p_business_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.sort_order, c.name), '[]'::jsonb)
    FROM public.auto_parts_categories c
    WHERE c.business_id = p_business_id OR c.business_id IS NULL
  );
END;
$$;

-- ─── 5. auto_parts_list_sales ───
CREATE OR REPLACE FUNCTION public.auto_parts_list_sales(p_business_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(
    to_jsonb(s) || jsonb_build_object('items',
      COALESCE((SELECT jsonb_agg(to_jsonb(si) ORDER BY si.id)
        FROM public.auto_parts_sale_items si WHERE si.sale_id = s.id), '[]'::jsonb)
    )
    ORDER BY s.created_at DESC
  ), '[]'::jsonb) INTO v_result
  FROM public.auto_parts_sales s
  WHERE s.business_id = p_business_id OR s.business_id IS NULL
  LIMIT 100;
  RETURN v_result;
END;
$$;

-- ─── 6. auto_parts_get_sale ───
CREATE OR REPLACE FUNCTION public.auto_parts_get_sale(p_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT to_jsonb(s) || jsonb_build_object('items',
    COALESCE((SELECT jsonb_agg(to_jsonb(si) ORDER BY si.id)
      FROM public.auto_parts_sale_items si WHERE si.sale_id = s.id), '[]'::jsonb)
  ) INTO v_result
  FROM public.auto_parts_sales s
  WHERE s.id = p_id;
  RETURN v_result;
END;
$$;

-- ─── 7. auto_parts_list_stock_movements ───
CREATE OR REPLACE FUNCTION public.auto_parts_list_stock_movements(p_business_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(
      to_jsonb(sm) || jsonb_build_object('product',
        CASE WHEN sm.product_id IS NOT NULL THEN
          (SELECT to_jsonb(pr) FROM (
            SELECT p.id, p.name FROM public.auto_parts_products p WHERE p.id = sm.product_id
          ) pr)
        ELSE NULL END
      )
      ORDER BY sm.created_at DESC
    ), '[]'::jsonb)
    FROM public.auto_parts_stock_movements sm
    WHERE sm.business_id = p_business_id
    LIMIT 200
  );
END;
$$;

-- ─── 8. auto_parts_list_clients ───
CREATE OR REPLACE FUNCTION public.auto_parts_list_clients(p_business_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.name), '[]'::jsonb)
    FROM public.auto_parts_clients c
    WHERE c.business_id = p_business_id OR c.business_id IS NULL
  );
END;
$$;

-- ─── 9. auto_parts_search_clients ───
CREATE OR REPLACE FUNCTION public.auto_parts_search_clients(p_query TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.name), '[]'::jsonb)
    FROM public.auto_parts_clients c
    WHERE c.name ILIKE '%' || p_query || '%'
    LIMIT 20
  );
END;
$$;

-- ─── 10. auto_parts_list_staff ───
CREATE OR REPLACE FUNCTION public.auto_parts_list_staff(p_business_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(to_jsonb(st) ORDER BY st.name), '[]'::jsonb)
    FROM public.auto_parts_staff st
    WHERE st.business_id = p_business_id AND st.is_active = true
  );
END;
$$;

-- ─── 11. auto_parts_list_suppliers ───
CREATE OR REPLACE FUNCTION public.auto_parts_list_suppliers(p_business_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.name), '[]'::jsonb)
    FROM public.auto_parts_suppliers s
    WHERE s.business_id = p_business_id OR s.business_id IS NULL
  );
END;
$$;

-- ─── 12. Dashboard metrics RPC ───
CREATE OR REPLACE FUNCTION public.auto_parts_dashboard_counts(p_business_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_total_products INT;
  v_total_stock_value NUMERIC;
  v_out_of_stock INT;
  v_low_stock INT;
  v_today_sales INT;
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

  SELECT COUNT(*) INTO v_today_sales
  FROM public.auto_parts_sales
  WHERE business_id = p_business_id AND created_at >= v_day_start;

  SELECT COALESCE(SUM(total), 0) INTO v_month_sales
  FROM public.auto_parts_sales
  WHERE business_id = p_business_id AND created_at >= v_month_start;

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

-- ─── 13. Monthly sales for chart ───
CREATE OR REPLACE FUNCTION public.auto_parts_monthly_sales(p_business_id UUID)
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
    WHERE business_id = p_business_id AND created_at >= v_year_start
    GROUP BY month
    ORDER BY month
  ) v;
  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- ─── 14. Product category repartition ───
CREATE OR REPLACE FUNCTION public.auto_parts_category_repartition(p_business_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('name', COALESCE(c.name, 'Sans catégorie'), 'count', v.cnt)), '[]'::jsonb)
    FROM (
      SELECT p.category_id, COUNT(*) AS cnt
      FROM public.auto_parts_products p
      WHERE p.business_id = p_business_id OR p.business_id IS NULL
      GROUP BY p.category_id
    ) v
    LEFT JOIN public.auto_parts_categories c ON c.id = v.category_id
  );
END;
$$;

DO $$ BEGIN RAISE NOTICE 'Auto-parts list RPCs created successfully'; END $$;

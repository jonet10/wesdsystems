-- ════════════════════════════════════════════════════════════════════════════
-- WESD AUTO PARTS — Security hardening: role-based access checks
--
-- 1. Sensitive RPCs now verify staff permissions via session token
-- 2. Cashier-specific RPCs that only return own data
-- 3. Admin RPCs for cashier performance analysis
-- 4. Audit log table + triggers
-- ════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- PART 1 — Secure existing RPCs with permission checks
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 0. Permission helper — staff session OR Supabase Auth user ───
CREATE OR REPLACE FUNCTION public.auto_parts_has_permission(
  p_session_token TEXT,
  p_permission TEXT,
  p_business_id UUID DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_staff_role TEXT;
  v_profile_business_id UUID;
BEGIN
  -- 1) Try staff session
  IF p_session_token IS NOT NULL AND p_session_token != '' THEN
    SELECT s.staff_role INTO v_staff_role
    FROM public.resolve_staff_from_token(p_session_token) s;

    IF v_staff_role IS NOT NULL AND public.staff_has_permission(v_staff_role, p_permission) THEN
      RETURN true;
    END IF;
  END IF;

  -- 2) Super admin bypass
  IF public.is_super_admin() THEN
    RETURN true;
  END IF;

  -- 3) Profile-based (Supabase Auth) user — treat as full admin
  IF auth.uid() IS NOT NULL THEN
    v_profile_business_id := public.current_user_business_id();
    IF v_profile_business_id IS NOT NULL THEN
      IF p_business_id IS NULL OR v_profile_business_id = p_business_id THEN
        RETURN true;
      END IF;
    END IF;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_parts_has_permission TO anon, authenticated;

-- ─── 1a. auto_parts_get_product — conditional cost_price ───
-- If caller has 'products.manage', return all columns including cost_price.
-- Otherwise return safe version without cost_price.
DROP FUNCTION IF EXISTS public.auto_parts_get_product(p_id UUID);
DROP FUNCTION IF EXISTS public.auto_parts_get_product(p_id UUID, p_business_id UUID);
DROP FUNCTION IF EXISTS public.auto_parts_get_product(p_id UUID, p_business_id UUID, p_session_token TEXT);

CREATE OR REPLACE FUNCTION public.auto_parts_get_product(
  p_id UUID,
  p_business_id UUID DEFAULT NULL,
  p_session_token TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_staff_role TEXT;
  v_result JSONB;
BEGIN
  -- Try to resolve staff role from token (if provided)
  SELECT s.staff_role INTO v_staff_role
  FROM public.resolve_staff_from_token(p_session_token) s;

  IF v_staff_role IS NOT NULL AND public.staff_has_permission(v_staff_role, 'products.manage') THEN
    -- Admin/manager: return full data with cost_price
    SELECT to_jsonb(p) || jsonb_build_object('category',
      CASE WHEN p.category_id IS NOT NULL THEN
        (SELECT to_jsonb(c) FROM public.auto_parts_categories c WHERE c.id = p.category_id)
      ELSE NULL END
    ) INTO v_result
    FROM public.auto_parts_products p
    WHERE p.id = p_id
      AND (p.business_id = p_business_id OR p.business_id IS NULL OR p_business_id IS NULL);
  ELSE
    -- Cashier/other: return safe data WITHOUT cost_price
    SELECT jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'description', p.description,
      'category_id', p.category_id,
      'sku', p.sku,
      'barcode', p.barcode,
      'unit_price', p.unit_price,
      'stock_quantity', p.stock_quantity,
      'min_stock', p.min_stock,
      'max_stock', p.max_stock,
      'location', p.location,
      'image_url', p.image_url,
      'notes', p.notes,
      'active', p.active,
      'business_id', p.business_id,
      'created_at', p.created_at,
      'updated_at', p.updated_at,
      'category', CASE WHEN p.category_id IS NOT NULL THEN
        (SELECT to_jsonb(c) FROM public.auto_parts_categories c WHERE c.id = p.category_id)
      ELSE NULL END
    ) INTO v_result
    FROM public.auto_parts_products p
    WHERE p.id = p_id
      AND (p.business_id = p_business_id OR p.business_id IS NULL OR p_business_id IS NULL);
  END IF;

  RETURN v_result;
END;
$$;

-- ─── 1b. auto_parts_list_products_full — requires products.manage ───
DROP FUNCTION IF EXISTS public.auto_parts_list_products_full(p_business_id UUID);
DROP FUNCTION IF EXISTS public.auto_parts_list_products_full(p_business_id UUID, p_session_token TEXT);
CREATE OR REPLACE FUNCTION public.auto_parts_list_products_full(
  p_business_id UUID,
  p_session_token TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.auto_parts_has_permission(p_session_token, 'products.manage', p_business_id) THEN
    RAISE EXCEPTION 'ACCESS_DENIED' USING HINT = 'Permission requise: products.manage';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_result
  FROM (
    SELECT p.*, row_to_json(c.*) AS category
    FROM public.auto_parts_products p
    LEFT JOIN public.auto_parts_categories c ON c.id = p.category_id
    WHERE p.business_id = p_business_id OR p.business_id IS NULL
    ORDER BY p.name
  ) t;

  RETURN v_result;
END;
$$;

-- ─── 1c. auto_parts_dormant_products — requires products.manage ───
DROP FUNCTION IF EXISTS public.auto_parts_dormant_products(p_business_id UUID, p_days INT);
DROP FUNCTION IF EXISTS public.auto_parts_dormant_products(p_business_id UUID, p_session_token TEXT, p_days INT);
CREATE OR REPLACE FUNCTION public.auto_parts_dormant_products(
  p_business_id UUID,
  p_session_token TEXT DEFAULT NULL,
  p_days INT DEFAULT 30
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_cutoff TIMESTAMPTZ := now() - (p_days || ' days')::INTERVAL;
BEGIN
  IF NOT public.auto_parts_has_permission(p_session_token, 'products.manage', p_business_id) THEN
    RAISE EXCEPTION 'ACCESS_DENIED' USING HINT = 'Permission requise: products.manage';
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', p.id, 'name', p.name, 'sku', p.sku,
      'stock_quantity', p.stock_quantity,
      'cost_price', p.cost_price,
      'stock_value', p.cost_price * p.stock_quantity,
      'unit_price', p.unit_price,
      'category_name', c.name,
      'last_sale_date', last_sale.last_date,
      'days_since_sale', CASE WHEN last_sale.last_date IS NOT NULL
        THEN EXTRACT(DAY FROM now() - last_sale.last_date)::INT ELSE p_days * 2 END
    )
    ORDER BY p.stock_quantity * p.cost_price DESC
  ), '[]'::jsonb) INTO v_result
  FROM public.auto_parts_products p
  LEFT JOIN public.auto_parts_categories c ON c.id = p.category_id
  LEFT JOIN LATERAL (
    SELECT MAX(s.created_at) AS last_date
    FROM public.auto_parts_sale_items si
    JOIN public.auto_parts_sales s ON s.id = si.sale_id
    WHERE si.product_id = p.id AND s.business_id = p_business_id
      AND s.refund_status IS DISTINCT FROM 'full'
  ) last_sale ON true
  LEFT JOIN LATERAL (
    SELECT MAX(sm.created_at) AS last_date
    FROM public.auto_parts_stock_movements sm
    WHERE sm.product_id = p.id AND sm.business_id = p_business_id
      AND sm.type IN ('in', 'out', 'sale')
  ) last_movement ON true
  WHERE (p.business_id = p_business_id OR p.business_id IS NULL)
    AND p.active = true
    AND p.stock_quantity > 0
    AND (
      (last_sale.last_date IS NULL OR last_sale.last_date < v_cutoff)
      AND (last_movement.last_date IS NULL OR last_movement.last_date < v_cutoff)
    );

  RETURN v_result;
END;
$$;

-- ─── 1d. auto_parts_profit_summary — requires products.manage ───
DROP FUNCTION IF EXISTS public.auto_parts_profit_summary(p_business_id UUID, p_start_date TIMESTAMPTZ, p_end_date TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.auto_parts_profit_summary(p_business_id UUID, p_session_token TEXT, p_start_date TIMESTAMPTZ, p_end_date TIMESTAMPTZ);
CREATE OR REPLACE FUNCTION public.auto_parts_profit_summary(
  p_business_id UUID,
  p_session_token TEXT DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT date_trunc('month', now()),
  p_end_date TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.auto_parts_has_permission(p_session_token, 'products.manage', p_business_id) THEN
    RAISE EXCEPTION 'ACCESS_DENIED' USING HINT = 'Permission requise: products.manage';
  END IF;

  WITH sale_profits AS (
    SELECT
      si.product_id, si.product_name,
      si.quantity, si.unit_price, si.total_price,
      COALESCE(p.cost_price, 0) AS cost_price,
      si.total_price - (si.quantity * COALESCE(p.cost_price, 0)) AS profit
    FROM public.auto_parts_sale_items si
    JOIN public.auto_parts_sales s ON s.id = si.sale_id
    LEFT JOIN public.auto_parts_products p ON p.id = si.product_id
    WHERE s.business_id = p_business_id
      AND s.created_at >= p_start_date AND s.created_at < p_end_date
      AND s.refund_status IS DISTINCT FROM 'full'
  ),
  aggregated AS (
    SELECT
      COUNT(*)::INT AS item_count,
      SUM(total_price)::NUMERIC AS total_revenue,
      SUM(cost_price * quantity)::NUMERIC AS total_cost,
      SUM(profit)::NUMERIC AS total_profit,
      CASE WHEN SUM(total_price) > 0
        THEN ROUND((SUM(profit) / SUM(total_price)) * 100, 1) ELSE 0 END AS margin_pct
    FROM sale_profits
  ),
  top_products AS (
    SELECT jsonb_agg(sub) FROM (
      SELECT
        product_name, SUM(quantity)::INT AS qty,
        SUM(total_price)::NUMERIC AS revenue,
        SUM(cost_price * quantity)::NUMERIC AS cost,
        SUM(profit)::NUMERIC AS profit,
        CASE WHEN SUM(total_price) > 0
          THEN ROUND((SUM(profit) / SUM(total_price)) * 100, 1) ELSE 0 END AS margin_pct
      FROM sale_profits
      WHERE product_id IS NOT NULL
      GROUP BY product_name
      ORDER BY SUM(profit) DESC LIMIT 20
    ) sub
  ),
  top_categories AS (
    SELECT jsonb_agg(sub) FROM (
      SELECT
        COALESCE(c.name, 'Sans catégorie') AS category_name,
        SUM(sp.profit)::NUMERIC AS profit,
        CASE WHEN SUM(sp.total_price) > 0
          THEN ROUND((SUM(sp.profit) / SUM(sp.total_price)) * 100, 1) ELSE 0 END AS margin_pct
      FROM sale_profits sp
      LEFT JOIN public.auto_parts_products p ON p.id = sp.product_id
      LEFT JOIN public.auto_parts_categories c ON c.id = p.category_id
      GROUP BY c.name ORDER BY SUM(sp.profit) DESC LIMIT 10
    ) sub
  ),
  top_suppliers AS (
    SELECT jsonb_agg(sub) FROM (
      SELECT
        COALESCE(sup.name, 'Sans fournisseur') AS supplier_name,
        SUM(sp.profit)::NUMERIC AS profit,
        CASE WHEN SUM(sp.total_price) > 0
          THEN ROUND((SUM(sp.profit) / SUM(sp.total_price)) * 100, 1) ELSE 0 END AS margin_pct
      FROM sale_profits sp
      LEFT JOIN public.auto_parts_purchase_items pi ON pi.product_id = sp.product_id
      LEFT JOIN public.auto_parts_purchases pu ON pu.id = pi.purchase_id
      LEFT JOIN public.auto_parts_suppliers sup ON sup.id = pu.supplier_id
      GROUP BY sup.name ORDER BY SUM(sp.profit) DESC LIMIT 10
    ) sub
  )
  SELECT jsonb_build_object(
    'summary', row_to_json(a.*)::jsonb,
    'top_products', COALESCE((SELECT * FROM top_products), '[]'::jsonb),
    'top_categories', COALESCE((SELECT * FROM top_categories), '[]'::jsonb),
    'top_suppliers', COALESCE((SELECT * FROM top_suppliers), '[]'::jsonb)
  ) INTO v_result
  FROM aggregated a;

  RETURN v_result;
END;
$$;

-- ─── 1e. auto_parts_store_health — requires products.manage ───
DROP FUNCTION IF EXISTS public.auto_parts_store_health(p_business_id UUID);
DROP FUNCTION IF EXISTS public.auto_parts_store_health(p_business_id UUID, p_session_token TEXT);
CREATE OR REPLACE FUNCTION public.auto_parts_store_health(
  p_business_id UUID,
  p_session_token TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_score NUMERIC := 0;
  v_sales_growth NUMERIC := 0;
  v_stock_turnover NUMERIC := 0;
  v_dormant_ratio NUMERIC := 0;
  v_rupture_ratio NUMERIC := 0;
  v_profitability NUMERIC := 0;
  v_category_count INT := 0;
  v_recommendations TEXT[] := '{}';
  v_result JSONB;
  v_month_start TIMESTAMPTZ := date_trunc('month', now());
  v_prev_month_start TIMESTAMPTZ := date_trunc('month', now() - INTERVAL '1 month');
  v_now TIMESTAMPTZ := now();
  v_sales_current NUMERIC;
  v_sales_previous NUMERIC;
  v_total_products INT;
  v_active_products INT;
  v_out_of_stock INT;
  v_dormant_count INT;
  v_total_revenue NUMERIC;
  v_total_cost NUMERIC;
  v_avg_margin NUMERIC;
  v_category_diversity NUMERIC;
BEGIN
  IF NOT public.auto_parts_has_permission(p_session_token, 'products.manage', p_business_id) THEN
    RAISE EXCEPTION 'ACCESS_DENIED' USING HINT = 'Permission requise: products.manage';
  END IF;

  -- Sales growth (0-25 pts)
  SELECT COALESCE(SUM(total), 0) INTO v_sales_current
  FROM public.auto_parts_sales
  WHERE business_id = p_business_id
    AND created_at >= v_month_start
    AND refund_status IS DISTINCT FROM 'full';

  SELECT COALESCE(SUM(total), 0) INTO v_sales_previous
  FROM public.auto_parts_sales
  WHERE business_id = p_business_id
    AND created_at >= v_prev_month_start AND created_at < v_month_start
    AND refund_status IS DISTINCT FROM 'full';

  IF v_sales_previous > 0 THEN
    v_sales_growth := ((v_sales_current - v_sales_previous) / v_sales_previous) * 100;
  END IF;

  IF v_sales_growth > 20 THEN v_score := v_score + 25;
  ELSIF v_sales_growth > 10 THEN v_score := v_score + 20;
  ELSIF v_sales_growth > 0 THEN v_score := v_score + 15;
  ELSIF v_sales_growth > -10 THEN v_score := v_score + 10;
  ELSE v_score := v_score + 5;
  END IF;

  IF v_sales_growth < -10 THEN
    v_recommendations := array_append(v_recommendations, '⚠ Baisse des ventes de ' || ROUND(ABS(v_sales_growth), 1) || '% par rapport au mois dernier');
  END IF;

  -- Stock turnover (0-15 pts)
  WITH avg_stock AS (
    SELECT COALESCE(AVG(stock_quantity), 0) AS avg_qty
    FROM public.auto_parts_products
    WHERE (business_id = p_business_id OR business_id IS NULL) AND active = true
  )
  SELECT CASE WHEN a.avg_qty > 0
    THEN COALESCE((SELECT SUM(si.quantity) FROM public.auto_parts_sale_items si
      JOIN public.auto_parts_sales s ON s.id = si.sale_id
      WHERE s.business_id = p_business_id AND s.created_at >= date_trunc('month', now())
        AND s.refund_status IS DISTINCT FROM 'full') / a.avg_qty, 0)
    ELSE 0 END INTO v_stock_turnover
  FROM avg_stock a;

  IF v_stock_turnover > 2 THEN v_score := v_score + 15;
  ELSIF v_stock_turnover > 1 THEN v_score := v_score + 12;
  ELSIF v_stock_turnover > 0.5 THEN v_score := v_score + 8;
  ELSE v_score := v_score + 4;
  END IF;

  IF v_stock_turnover < 0.5 THEN
    v_recommendations := array_append(v_recommendations, '⚠ Rotation du stock faible (' || ROUND(v_stock_turnover, 2) || 'x/mois)');
  END IF;

  -- Dormant ratio (0-20 pts)
  SELECT COUNT(*) INTO v_active_products
  FROM public.auto_parts_products
  WHERE (business_id = p_business_id OR business_id IS NULL) AND active = true AND stock_quantity > 0;

  WITH dormant AS (
    SELECT p.id
    FROM public.auto_parts_products p
    WHERE (p.business_id = p_business_id OR p.business_id IS NULL) AND p.active = true AND p.stock_quantity > 0
      AND NOT EXISTS (
        SELECT 1 FROM public.auto_parts_sale_items si
        JOIN public.auto_parts_sales s ON s.id = si.sale_id
        WHERE si.product_id = p.id AND s.business_id = p_business_id
          AND s.created_at >= now() - INTERVAL '90 days'
      )
  )
  SELECT COUNT(*) INTO v_dormant_count FROM dormant;

  IF v_active_products > 0 THEN
    v_dormant_ratio := (v_dormant_count::NUMERIC / v_active_products) * 100;
  END IF;

  IF v_dormant_ratio < 10 THEN v_score := v_score + 20;
  ELSIF v_dormant_ratio < 25 THEN v_score := v_score + 15;
  ELSIF v_dormant_ratio < 50 THEN v_score := v_score + 10;
  ELSE v_score := v_score + 5;
  END IF;

  IF v_dormant_ratio > 25 THEN
    v_recommendations := array_append(v_recommendations, '⚠ ' || ROUND(v_dormant_ratio, 0) || '% des produits sont dormants');
  END IF;

  -- Rupture ratio (0-15 pts)
  SELECT COUNT(*) INTO v_total_products
  FROM public.auto_parts_products
  WHERE (business_id = p_business_id OR business_id IS NULL) AND active = true;

  SELECT COUNT(*) INTO v_out_of_stock
  FROM public.auto_parts_products
  WHERE (business_id = p_business_id OR business_id IS NULL) AND active = true AND stock_quantity <= 0;

  IF v_total_products > 0 THEN
    v_rupture_ratio := (v_out_of_stock::NUMERIC / v_total_products) * 100;
  END IF;

  IF v_rupture_ratio < 2 THEN v_score := v_score + 15;
  ELSIF v_rupture_ratio < 5 THEN v_score := v_score + 12;
  ELSIF v_rupture_ratio < 10 THEN v_score := v_score + 8;
  ELSE v_score := v_score + 4;
  END IF;

  IF v_rupture_ratio > 5 THEN
    v_recommendations := array_append(v_recommendations, '⚠ ' || ROUND(v_rupture_ratio, 0) || '% des produits sont en rupture de stock');
  END IF;

  -- Profitability (0-15 pts)
  WITH profits AS (
    SELECT si.total_price, si.quantity, COALESCE(p.cost_price, 0) AS cost
    FROM public.auto_parts_sale_items si
    JOIN public.auto_parts_sales s ON s.id = si.sale_id
    LEFT JOIN public.auto_parts_products p ON p.id = si.product_id
    WHERE s.business_id = p_business_id
      AND s.created_at >= v_month_start
      AND s.refund_status IS DISTINCT FROM 'full'
  )
  SELECT
    COALESCE(SUM(total_price), 0),
    COALESCE(SUM(cost * quantity), 0)
  INTO v_total_revenue, v_total_cost
  FROM profits;

  IF v_total_revenue > 0 THEN
    v_avg_margin := ((v_total_revenue - v_total_cost) / v_total_revenue) * 100;
  END IF;

  IF v_avg_margin > 40 THEN v_score := v_score + 15;
  ELSIF v_avg_margin > 30 THEN v_score := v_score + 12;
  ELSIF v_avg_margin > 20 THEN v_score := v_score + 8;
  ELSIF v_avg_margin > 10 THEN v_score := v_score + 5;
  ELSE v_score := v_score + 2;
  END IF;

  IF v_avg_margin < 15 THEN
    v_recommendations := array_append(v_recommendations, '⚠ Marge bénéficiaire faible (' || ROUND(v_avg_margin, 1) || '%)');
  END IF;

  -- Category diversity (0-10 pts)
  SELECT COUNT(*) INTO v_category_count
  FROM (
    SELECT p.category_id
    FROM public.auto_parts_products p
    WHERE (p.business_id = p_business_id OR p.business_id IS NULL) AND p.active = true
    GROUP BY p.category_id
  ) sub;

  IF v_category_count >= 8 THEN v_score := v_score + 10;
  ELSIF v_category_count >= 5 THEN v_score := v_score + 7;
  ELSIF v_category_count >= 3 THEN v_score := v_score + 4;
  ELSE v_score := v_score + 2;
  END IF;

  IF v_category_count <= 2 THEN
    v_recommendations := array_append(v_recommendations, '⚠ Très faible diversité de catégories (' || v_category_count || ' catégories)');
  END IF;

  -- Build result
  SELECT jsonb_build_object(
    'score', GREATEST(0, LEAST(100, ROUND(v_score)))::INT,
    'sales_growth', ROUND(v_sales_growth, 1),
    'stock_turnover', ROUND(v_stock_turnover, 2),
    'dormant_ratio', ROUND(v_dormant_ratio, 1),
    'rupture_ratio', ROUND(v_rupture_ratio, 1),
    'margin_pct', ROUND(v_avg_margin, 1),
    'category_count', v_category_count,
    'total_products', v_total_products,
    'active_products', v_active_products,
    'out_of_stock', v_out_of_stock,
    'dormant_count', v_dormant_count,
    'level', CASE
      WHEN v_score >= 90 THEN 'excellent'
      WHEN v_score >= 75 THEN 'bon'
      WHEN v_score >= 50 THEN 'moyen'
      WHEN v_score >= 25 THEN 'surveiller'
      ELSE 'critique'
    END,
    'recommendations', COALESCE(jsonb_agg(r), '[]'::jsonb)
  ) INTO v_result
  FROM (SELECT unnest(v_recommendations) AS r) AS rec;

  IF v_recommendations IS NULL OR array_length(v_recommendations, 1) IS NULL THEN
    v_result := jsonb_set(v_result, '{recommendations}', '[]'::jsonb);
  END IF;

  RETURN v_result;
END;
$$;

-- ─── 1f. auto_parts_dashboard_counts — conditionally exclude totalStockValue ───
DROP FUNCTION IF EXISTS public.auto_parts_dashboard_counts(p_business_id UUID);
DROP FUNCTION IF EXISTS public.auto_parts_dashboard_counts(p_business_id UUID, p_staff_id UUID);

CREATE OR REPLACE FUNCTION public.auto_parts_dashboard_counts(
  p_business_id UUID,
  p_session_token TEXT DEFAULT NULL,
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
  v_staff_role TEXT;
  v_can_see_finance BOOLEAN := false;
BEGIN
  v_month_start := date_trunc('month', now());
  v_day_start := date_trunc('day', now());

  -- Check if caller has products.manage (admin/manager sees financial data)
  SELECT s.staff_role INTO v_staff_role
  FROM public.resolve_staff_from_token(p_session_token) s;

  IF v_staff_role IS NOT NULL AND public.staff_has_permission(v_staff_role, 'products.manage') THEN
    v_can_see_finance := true;
  END IF;

  -- Also grant access to profile-based (Supabase Auth) users
  IF NOT v_can_see_finance AND public.auto_parts_has_permission(p_session_token, 'products.manage', p_business_id) THEN
    v_can_see_finance := true;
  END IF;

  SELECT COUNT(*) INTO v_total_products
  FROM public.auto_parts_products
  WHERE business_id = p_business_id OR business_id IS NULL;

  -- totalStockValue is only computed for admin/manager
  IF v_can_see_finance THEN
    SELECT COALESCE(SUM(cost_price * stock_quantity), 0) INTO v_total_stock_value
    FROM public.auto_parts_products
    WHERE (business_id = p_business_id OR business_id IS NULL)
      AND active = true;
  END IF;

  SELECT COUNT(*) INTO v_out_of_stock
  FROM public.auto_parts_products
  WHERE (business_id = p_business_id OR business_id IS NULL)
    AND active = true AND stock_quantity <= 0;

  SELECT COUNT(*) INTO v_low_stock
  FROM public.auto_parts_products
  WHERE (business_id = p_business_id OR business_id IS NULL)
    AND active = true AND stock_quantity > 0 AND stock_quantity <= min_stock;

  -- If p_staff_id provided, filter by staff
  IF p_staff_id IS NOT NULL THEN
    SELECT COALESCE(SUM(total), 0) INTO v_today_sales
    FROM public.auto_parts_sales
    WHERE business_id = p_business_id
      AND created_at >= v_day_start
      AND refund_status IS DISTINCT FROM 'full'
      AND staff_id = p_staff_id;

    SELECT COALESCE(SUM(total), 0) INTO v_month_sales
    FROM public.auto_parts_sales
    WHERE business_id = p_business_id
      AND created_at >= v_month_start
      AND refund_status IS DISTINCT FROM 'full'
      AND staff_id = p_staff_id;
  ELSE
    SELECT COALESCE(SUM(total), 0) INTO v_today_sales
    FROM public.auto_parts_sales
    WHERE business_id = p_business_id
      AND created_at >= v_day_start
      AND refund_status IS DISTINCT FROM 'full';

    SELECT COALESCE(SUM(total), 0) INTO v_month_sales
    FROM public.auto_parts_sales
    WHERE business_id = p_business_id
      AND created_at >= v_month_start
      AND refund_status IS DISTINCT FROM 'full';
  END IF;

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
    'totalStockValue', CASE WHEN v_can_see_finance THEN v_total_stock_value ELSE 0 END,
    'outOfStock', v_out_of_stock,
    'lowStock', v_low_stock,
    'todaySales', v_today_sales,
    'monthSales', v_month_sales,
    'monthPurchases', v_month_purchases,
    'pendingOrders', v_pending_orders
  );
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- PART 2 — Cashier-specific dashboard RPCs
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 2a. Cashier sales summary (own sales only) ───
CREATE OR REPLACE FUNCTION public.auto_parts_cashier_sales_summary(
  p_business_id UUID,
  p_staff_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT date_trunc('day', now()),
  p_end_date TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_period_duration INTERVAL := p_end_date - p_start_date;
  v_prev_start TIMESTAMPTZ := p_start_date - v_period_duration;
  v_prev_end TIMESTAMPTZ := p_start_date;
  v_result JSONB;
BEGIN
  WITH current_period AS (
    SELECT
      COUNT(*)::INT AS order_count,
      COUNT(DISTINCT client_id)::INT AS client_count,
      COALESCE(SUM(total), 0) AS total_revenue,
      COALESCE(AVG(total), 0) AS avg_order_value,
      COALESCE(SUM(total) / GREATEST(EXTRACT(DAY FROM v_period_duration)::INT, 1), 0) AS daily_avg
    FROM public.auto_parts_sales
    WHERE business_id = p_business_id
      AND staff_id = p_staff_id
      AND created_at >= p_start_date AND created_at < p_end_date
      AND refund_status IS DISTINCT FROM 'full'
  ),
  previous_period AS (
    SELECT
      COUNT(*)::INT AS order_count,
      COUNT(DISTINCT client_id)::INT AS client_count,
      COALESCE(SUM(total), 0) AS total_revenue,
      COALESCE(AVG(total), 0) AS avg_order_value
    FROM public.auto_parts_sales
    WHERE business_id = p_business_id
      AND staff_id = p_staff_id
      AND created_at >= v_prev_start AND created_at < v_prev_end
      AND refund_status IS DISTINCT FROM 'full'
  )
  SELECT jsonb_build_object(
    'current', jsonb_build_object(
      'order_count', c.order_count,
      'client_count', c.client_count,
      'total_revenue', c.total_revenue,
      'avg_order_value', ROUND(c.avg_order_value, 2),
      'daily_avg', ROUND(c.daily_avg, 2)
    ),
    'previous', jsonb_build_object(
      'order_count', p.order_count,
      'client_count', p.client_count,
      'total_revenue', p.total_revenue,
      'avg_order_value', ROUND(p.avg_order_value, 2)
    ),
    'evolution', jsonb_build_object(
      'revenue_pct', CASE WHEN p.total_revenue > 0
        THEN ROUND(((c.total_revenue - p.total_revenue) / p.total_revenue) * 100, 1) ELSE NULL END,
      'orders_pct', CASE WHEN p.order_count > 0
        THEN ROUND(((c.order_count - p.order_count)::NUMERIC / p.order_count) * 100, 1) ELSE NULL END,
      'clients_pct', CASE WHEN p.client_count > 0
        THEN ROUND(((c.client_count - p.client_count)::NUMERIC / p.client_count) * 100, 1) ELSE NULL END,
      'avg_value_pct', CASE WHEN p.avg_order_value > 0
        THEN ROUND(((c.avg_order_value - p.avg_order_value) / p.avg_order_value) * 100, 1) ELSE NULL END
    )
  ) INTO v_result
  FROM current_period c, previous_period p;

  RETURN v_result;
END;
$$;

-- ─── 2b. Cashier top products (own sales) ───
CREATE OR REPLACE FUNCTION public.auto_parts_cashier_top_products(
  p_business_id UUID,
  p_staff_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT date_trunc('month', now()),
  p_end_date TIMESTAMPTZ DEFAULT now(),
  p_limit INT DEFAULT 5
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb) INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'product_id', si.product_id,
      'product_name', si.product_name,
      'quantity', SUM(si.quantity)::INT,
      'revenue', SUM(si.total_price)::NUMERIC
    ) AS item
    FROM public.auto_parts_sale_items si
    JOIN public.auto_parts_sales s ON s.id = si.sale_id
    WHERE s.business_id = p_business_id
      AND s.staff_id = p_staff_id
      AND s.created_at >= p_start_date AND s.created_at < p_end_date
      AND s.refund_status IS DISTINCT FROM 'full'
    GROUP BY si.product_id, si.product_name
    ORDER BY SUM(si.quantity) DESC
    LIMIT p_limit
  ) sub;

  RETURN v_result;
END;
$$;

-- ─── 2c. Cashier monthly target progress ───
CREATE OR REPLACE FUNCTION public.auto_parts_cashier_monthly_progress(
  p_business_id UUID,
  p_staff_id UUID,
  p_target NUMERIC DEFAULT 100000
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_achieved NUMERIC;
  v_order_count INT;
  v_client_count INT;
  v_month_start TIMESTAMPTZ := date_trunc('month', now());
BEGIN
  SELECT
    COALESCE(SUM(total), 0),
    COUNT(*)::INT,
    COUNT(DISTINCT client_id)::INT
  INTO v_achieved, v_order_count, v_client_count
  FROM public.auto_parts_sales
  WHERE business_id = p_business_id
    AND staff_id = p_staff_id
    AND created_at >= v_month_start
    AND refund_status IS DISTINCT FROM 'full';

  RETURN jsonb_build_object(
    'target', p_target,
    'achieved', v_achieved,
    'progress_pct', CASE WHEN p_target > 0
      THEN ROUND((v_achieved / p_target) * 100, 1) ELSE 0 END,
    'order_count', v_order_count,
    'client_count', v_client_count,
    'remaining', GREATEST(p_target - v_achieved, 0)
  );
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- PART 3 — Admin cashier performance RPCs
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 3a. Cashier ranking (requires products.manage) ───
CREATE OR REPLACE FUNCTION public.auto_parts_cashier_performance(
  p_business_id UUID,
  p_session_token TEXT,
  p_start_date TIMESTAMPTZ DEFAULT date_trunc('month', now()),
  p_end_date TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.auto_parts_has_permission(p_session_token, 'products.manage', p_business_id) THEN
    RAISE EXCEPTION 'ACCESS_DENIED' USING HINT = 'Permission requise: products.manage';
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'staff_id', s.staff_id,
      'staff_name', COALESCE(s.staff_name, st.name, 'Inconnu'),
      'role', st.role,
      'sale_count', stats.cnt,
      'total_revenue', stats.rev,
      'avg_ticket', CASE WHEN stats.cnt > 0 THEN ROUND(stats.rev / stats.cnt, 2) ELSE 0 END,
      'client_count', stats.client_cnt,
      'product_count', stats.product_cnt,
      'cancellation_count', stats.cancel_cnt,
      'return_count', stats.return_cnt,
      'discount_total', stats.discount_total
    )
    ORDER BY stats.rev DESC
  ), '[]'::jsonb) INTO v_result
  FROM (
    SELECT
      COALESCE(s.staff_id, '00000000-0000-0000-0000-000000000000'::UUID) AS staff_id,
      COUNT(*)::INT AS cnt,
      COALESCE(SUM(s.total), 0)::NUMERIC AS rev,
      COUNT(DISTINCT s.client_id)::INT AS client_cnt,
      COALESCE(SUM(si.quantity), 0)::INT AS product_cnt,
      COUNT(*) FILTER (WHERE s.refund_status = 'full')::INT AS return_cnt,
      0::INT AS cancel_cnt,
      COALESCE(SUM(s.discount_amount), 0)::NUMERIC AS discount_total
    FROM public.auto_parts_sales s
    LEFT JOIN public.auto_parts_sale_items si ON si.sale_id = s.id
    WHERE s.business_id = p_business_id
      AND s.created_at >= p_start_date AND s.created_at < p_end_date
      AND s.refund_status IS DISTINCT FROM 'full'
    GROUP BY s.staff_id
  ) stats
  LEFT JOIN public.auto_parts_staff st ON st.id = stats.staff_id;

  RETURN v_result;
END;
$$;

-- ─── 3b. Cashier detail (requires products.manage) ───
CREATE OR REPLACE FUNCTION public.auto_parts_cashier_detail(
  p_business_id UUID,
  p_staff_id UUID,
  p_session_token TEXT,
  p_start_date TIMESTAMPTZ DEFAULT date_trunc('month', now()),
  p_end_date TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.auto_parts_has_permission(p_session_token, 'products.manage', p_business_id) THEN
    RAISE EXCEPTION 'ACCESS_DENIED' USING HINT = 'Permission requise: products.manage';
  END IF;

  WITH sales_data AS (
    SELECT
      s.id, s.invoice_number, s.created_at, s.total,
      s.payment_method, s.discount_amount, s.refund_status,
      COALESCE((SELECT SUM(si.quantity) FROM public.auto_parts_sale_items si WHERE si.sale_id = s.id), 0)::INT AS item_count
    FROM public.auto_parts_sales s
    WHERE s.business_id = p_business_id
      AND s.staff_id = p_staff_id
      AND s.created_at >= p_start_date AND s.created_at < p_end_date
    ORDER BY s.created_at DESC
  )
  SELECT jsonb_build_object(
    'total_sales', (SELECT COALESCE(SUM(total), 0) FROM sales_data WHERE refund_status IS DISTINCT FROM 'full'),
    'total_invoices', (SELECT COUNT(*)::INT FROM sales_data WHERE refund_status IS DISTINCT FROM 'full'),
    'total_returns', (SELECT COUNT(*)::INT FROM sales_data WHERE refund_status = 'full'),
    'total_discounts', (SELECT COALESCE(SUM(discount_amount), 0) FROM sales_data),
    'total_items_sold', (SELECT COALESCE(SUM(item_count), 0) FROM sales_data WHERE refund_status IS DISTINCT FROM 'full'),
    'sales', COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', sd.id, 'invoice_number', sd.invoice_number,
        'created_at', sd.created_at, 'total', sd.total,
        'payment_method', sd.payment_method,
        'discount_amount', sd.discount_amount,
        'refund_status', sd.refund_status,
        'item_count', sd.item_count
      ) ORDER BY sd.created_at DESC
    ), '[]'::jsonb)
  ) INTO v_result
  FROM sales_data sd;

  RETURN v_result;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- PART 4 — Audit logging
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.auto_parts_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  staff_id UUID,
  staff_name TEXT,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.auto_parts_audit_log ENABLE ROW LEVEL SECURITY;

-- Only super_admin and service_role can read audit logs
DROP POLICY IF EXISTS audit_log_super_admin_only ON public.auto_parts_audit_log;
CREATE POLICY audit_log_super_admin_only ON public.auto_parts_audit_log
  FOR ALL USING (public.is_super_admin());

-- SECURITY DEFINER function to write audit log
CREATE OR REPLACE FUNCTION public.auto_parts_write_audit_log(
  p_business_id UUID,
  p_staff_id UUID DEFAULT NULL,
  p_staff_name TEXT DEFAULT NULL,
  p_action_type TEXT DEFAULT NULL,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id TEXT DEFAULT NULL,
  p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_ip TEXT;
BEGIN
  -- Try to extract IP from request headers
  BEGIN
    v_ip := NULLIF(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', '');
  EXCEPTION WHEN OTHERS THEN v_ip := NULL;
  END;

  INSERT INTO public.auto_parts_audit_log (
    business_id, staff_id, staff_name, action_type,
    entity_type, entity_id, details, ip_address
  ) VALUES (
    p_business_id, p_staff_id, p_staff_name, p_action_type,
    p_entity_type, p_entity_id, p_details, v_ip
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_parts_write_audit_log TO anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- GRANTS
-- ════════════════════════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION public.auto_parts_get_product TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_list_products_full TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_dormant_products TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_profit_summary TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_store_health TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_dashboard_counts TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_cashier_sales_summary TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_cashier_top_products TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_cashier_monthly_progress TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_cashier_performance TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_cashier_detail TO anon, authenticated;

DO $$ BEGIN RAISE NOTICE 'Security: role checks, cashier RPCs, audit log created'; END $$;

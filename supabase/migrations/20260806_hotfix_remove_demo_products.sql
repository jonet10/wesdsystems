-- ════════════════════════════════════════════════════════════════════════════
-- WESD AUTO PARTS — Supprime les données de démonstration globales
--
-- Objectif :
--   1. Copier les produits globaux (business_id IS NULL) vers les
--      établissements EXISTANTS (backward compatibility).
--   2. Supprimer le filtre OR business_id IS NULL de toutes les RPCs
--      produits. Les NOUVEAUX établissements verront une liste vide.
--   3. Les catégories, marques, fournisseurs, clients globaux restent
--      visibles (données de référence).
-- ════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- PART 1 — Backfill : copier les produits globaux vers les business existants
-- ════════════════════════════════════════════════════════════════════════════

-- Pour chaque business existant, copie les produits globaux (business_id IS NULL)
-- qu'il n'a pas déjà (déduplication par SKU ou nom).
-- Les produits copiés reçoivent le business_id du business et branch_id = NULL
-- (visibles par toutes les branches).
INSERT INTO public.auto_parts_products (
  business_id, name, sku, barcode, description, category_id,
  unit_price, cost_price, stock_quantity, reserved_quantity,
  min_stock, max_stock, location, image_url, notes, active,
  created_at, updated_at
)
SELECT
  b.id AS business_id,
  gp.name, gp.sku, gp.barcode, gp.description, gp.category_id,
  gp.unit_price, gp.cost_price, gp.stock_quantity, gp.reserved_quantity,
  gp.min_stock, gp.max_stock, gp.location, gp.image_url, gp.notes, gp.active,
  NOW(), NOW()
FROM public.auto_parts_products gp
CROSS JOIN public.businesses b
WHERE gp.business_id IS NULL
  AND gp.active = true
  AND EXISTS (
    SELECT 1 FROM public.business_branches bb
    WHERE bb.business_id = b.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.auto_parts_products bp
    WHERE bp.business_id = b.id
      AND (bp.sku = gp.sku OR (bp.sku IS NULL AND gp.sku IS NULL AND bp.name = gp.name))
  );

-- ════════════════════════════════════════════════════════════════════════════
-- PART 2 — Mise à jour des RPCs : supprimer OR business_id IS NULL
--           pour les tables de produits uniquement
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 2a. auto_parts_list_products (non-RBAC) ───
CREATE OR REPLACE FUNCTION public.auto_parts_list_products(p_business_id UUID, p_branch_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(jsonb_agg(
    to_jsonb(p) || jsonb_build_object('category',
      CASE WHEN p.category_id IS NOT NULL THEN
        (SELECT to_jsonb(c) FROM (SELECT id, name FROM public.auto_parts_categories c WHERE c.id = p.category_id) c)
      ELSE NULL END
    )
    ORDER BY p.name
  ), '[]'::jsonb)
  FROM public.auto_parts_products p
  WHERE p.business_id = p_business_id
    AND (p_branch_id IS NULL OR p.branch_id IS NULL OR p.branch_id = p_branch_id);
END;
$$;

-- ─── 2b. auto_parts_list_products_full (RBAC) ───
CREATE OR REPLACE FUNCTION public.auto_parts_list_products_full(
  p_business_id UUID,
  p_session_token TEXT DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_result JSONB;
BEGIN
  IF NOT public.auto_parts_has_permission(p_session_token, 'products.manage', p_business_id) THEN
    RAISE EXCEPTION 'ACCESS_DENIED' USING HINT = 'Permission requise: products.manage';
  END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_result
  FROM (
    SELECT p.*, row_to_json(c.*) AS category
    FROM public.auto_parts_products p
    LEFT JOIN public.auto_parts_categories c ON c.id = p.category_id
    WHERE p.business_id = p_business_id
      AND (p_branch_id IS NULL OR p.branch_id IS NULL OR p.branch_id = p_branch_id)
    ORDER BY p.name
  ) t;
  RETURN v_result;
END;
$$;

-- ─── 2c. auto_parts_search_products ───
CREATE OR REPLACE FUNCTION public.auto_parts_search_products(p_business_id UUID, p_query TEXT, p_branch_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.name), '[]'::jsonb)
  FROM public.auto_parts_products p
  WHERE p.business_id = p_business_id
    AND (p_branch_id IS NULL OR p.branch_id IS NULL OR p.branch_id = p_branch_id)
    AND (p.name ILIKE '%' || p_query || '%' OR p.sku ILIKE '%' || p_query || '%')
  LIMIT 20;
END;
$$;

-- ─── 2d. auto_parts_dashboard_counts ───
CREATE OR REPLACE FUNCTION public.auto_parts_dashboard_counts(
  p_business_id UUID,
  p_session_token TEXT DEFAULT NULL,
  p_staff_id UUID DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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

  SELECT COUNT(*) INTO v_total_products
  FROM public.auto_parts_products
  WHERE business_id = p_business_id
    AND (p_branch_id IS NULL OR branch_id IS NULL OR branch_id = p_branch_id);

  IF v_can_see_finance THEN
    SELECT COALESCE(SUM(cost_price * stock_quantity), 0) INTO v_total_stock_value
    FROM public.auto_parts_products
    WHERE business_id = p_business_id
      AND active = true
      AND (p_branch_id IS NULL OR branch_id IS NULL OR branch_id = p_branch_id);
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
    AND (p_branch_id IS NULL OR branch_id IS NULL OR branch_id = p_branch_id);

  SELECT COUNT(*) INTO v_pending_orders
  FROM public.auto_parts_purchases
  WHERE business_id = p_business_id
    AND status IN ('pending', 'confirmed')
    AND (p_branch_id IS NULL OR branch_id IS NULL OR branch_id = p_branch_id);

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

-- ─── 2e. auto_parts_store_health ───
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
    WHERE business_id = p_business_id AND active = true
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
  WHERE business_id = p_business_id AND active = true AND stock_quantity > 0;

  WITH dormant AS (
    SELECT p.id
    FROM public.auto_parts_products p
    WHERE p.business_id = p_business_id AND p.active = true AND p.stock_quantity > 0
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
  WHERE business_id = p_business_id AND active = true;

  SELECT COUNT(*) INTO v_out_of_stock
  FROM public.auto_parts_products
  WHERE business_id = p_business_id AND active = true AND stock_quantity <= 0;

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
    WHERE p.business_id = p_business_id AND p.active = true
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

  -- High category dependency
  WITH cat_revenue AS (
    SELECT COALESCE(c.name, 'Sans catégorie') AS cat_name,
      SUM(si.total_price) AS rev
    FROM public.auto_parts_sale_items si
    JOIN public.auto_parts_sales s ON s.id = si.sale_id
    LEFT JOIN public.auto_parts_products p ON p.id = si.product_id
    LEFT JOIN public.auto_parts_categories c ON c.id = p.category_id
    WHERE s.business_id = p_business_id
      AND s.created_at >= date_trunc('month', now())
      AND s.refund_status IS DISTINCT FROM 'full'
    GROUP BY c.name
    ORDER BY rev DESC
    LIMIT 1
  )
  SELECT cat_name INTO v_category_diversity
  FROM cat_revenue
  WHERE rev > 0 AND rev >= (SELECT COALESCE(SUM(si2.total_price) * 0.5, 0)
    FROM public.auto_parts_sale_items si2
    JOIN public.auto_parts_sales s2 ON s2.id = si2.sale_id
    WHERE s2.business_id = p_business_id
      AND s2.created_at >= date_trunc('month', now())
      AND s2.refund_status IS DISTINCT FROM 'full');

  IF v_category_diversity IS NOT NULL THEN
    v_recommendations := array_append(v_recommendations, '⚠ Forte dépendance à la catégorie "' || v_category_diversity || '"');
  END IF;

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
      WHEN v_score >= 30 THEN 'surveiller'
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

-- ─── 2f. auto_parts_dormant_products ───
CREATE OR REPLACE FUNCTION public.auto_parts_dormant_products(
  p_business_id UUID,
  p_days INT DEFAULT 30
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_cutoff TIMESTAMPTZ := now() - (p_days || ' days')::INTERVAL;
BEGIN
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
  WHERE p.business_id = p_business_id
    AND p.active = true
    AND p.stock_quantity > 0
    AND (
      (last_sale.last_date IS NULL OR last_sale.last_date < v_cutoff)
      AND (last_movement.last_date IS NULL OR last_movement.last_date < v_cutoff)
    );

  RETURN v_result;
END;
$$;

-- ─── 2g. auto_parts_stock_forecast ───
CREATE OR REPLACE FUNCTION public.auto_parts_stock_forecast(
  p_business_id UUID,
  p_lookback_days INT DEFAULT 90
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_cutoff TIMESTAMPTZ := now() - (p_lookback_days || ' days')::INTERVAL;
BEGIN
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', p.id, 'name', p.name, 'sku', p.sku,
      'stock_quantity', p.stock_quantity,
      'min_stock', p.min_stock,
      'unit_price', p.unit_price,
      'avg_daily_sales', ROUND(COALESCE(ds.qty, 0) / GREATEST(p_lookback_days, 1), 2),
      'days_until_rupture', CASE
        WHEN COALESCE(ds.qty, 0) <= 0 THEN NULL
        ELSE ROUND(p.stock_quantity / (COALESCE(ds.qty, 0) / GREATEST(p_lookback_days, 1)))
      END,
      'risk_level', CASE
        WHEN p.stock_quantity <= 0 THEN 'rupture'
        WHEN COALESCE(ds.qty, 0) <= 0 THEN 'unknown'
        WHEN p.stock_quantity / (COALESCE(ds.qty, 0) / GREATEST(p_lookback_days, 1)) <= 7 THEN 'high'
        WHEN p.stock_quantity / (COALESCE(ds.qty, 0) / GREATEST(p_lookback_days, 1)) <= 30 THEN 'medium'
        WHEN p.stock_quantity / (COALESCE(ds.qty, 0) / GREATEST(p_lookback_days, 1)) <= 90 THEN 'low'
        ELSE 'safe'
      END
    )
    ORDER BY
      CASE
        WHEN p.stock_quantity <= 0 THEN 0
        WHEN COALESCE(ds.qty, 0) <= 0 THEN 2
        WHEN p.stock_quantity / NULLIF(COALESCE(ds.qty, 0) / GREATEST(p_lookback_days, 1), 0) <= 7 THEN 1
        ELSE 3
      END,
      p.stock_quantity ASC
  ), '[]'::jsonb) INTO v_result
  FROM public.auto_parts_products p
  LEFT JOIN LATERAL (
    SELECT SUM(si.quantity)::NUMERIC AS qty
    FROM public.auto_parts_sale_items si
    JOIN public.auto_parts_sales s ON s.id = si.sale_id
    WHERE si.product_id = p.id AND s.business_id = p_business_id
      AND s.created_at >= v_cutoff
      AND s.refund_status IS DISTINCT FROM 'full'
  ) ds ON true
  WHERE p.business_id = p_business_id
    AND p.active = true
    AND (p.stock_quantity <= p.min_stock OR p.stock_quantity <= 0);

  RETURN v_result;
END;
$$;

-- ─── 2h. auto_parts_list_products (RBAC, session token overload) ───
CREATE OR REPLACE FUNCTION public.auto_parts_list_products(
  p_session_token TEXT,
  p_business_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_biz UUID;
  v_result JSONB;
BEGIN
  SELECT business_id INTO v_biz
  FROM public.require_staff_permission(p_session_token, 'products.read');

  IF p_business_id IS NOT NULL THEN
    v_biz := p_business_id;
  END IF;

  SELECT jsonb_agg(to_jsonb(t)) INTO v_result
  FROM (
    SELECT p.*, row_to_json(c.*) AS category
    FROM public.auto_parts_products p
    LEFT JOIN public.auto_parts_categories c ON c.id = p.category_id
    WHERE p.business_id = v_biz
    ORDER BY p.name
  ) t;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_parts_list_products(p_business_id UUID, p_branch_id UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_list_products(p_session_token TEXT, p_business_id UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_list_products_full(p_business_id UUID, p_session_token TEXT, p_branch_id UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_search_products(p_business_id UUID, p_query TEXT, p_branch_id UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_dashboard_counts(p_business_id UUID, p_session_token TEXT, p_staff_id UUID, p_branch_id UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_store_health(p_business_id UUID, p_session_token TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_dormant_products(p_business_id UUID, p_days INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_stock_forecast(p_business_id UUID, p_lookback_days INT) TO anon, authenticated;

DO $$ BEGIN RAISE NOTICE 'Migration hotfix appliquée : produits démo supprimés pour les nouveaux comptes'; END $$;

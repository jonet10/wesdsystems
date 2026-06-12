-- ════════════════════════════════════════════════════════════════════════════
-- WESD AUTO PARTS — Rapports intelligents : RPCs agrégation, KPI, analyses
-- ════════════════════════════════════════════════════════════════════════════

-- ─── INDEXES pour les rapports ───
CREATE INDEX IF NOT EXISTS idx_auto_parts_sales_created
  ON public.auto_parts_sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auto_parts_sales_business_created
  ON public.auto_parts_sales(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auto_parts_sale_items_product
  ON public.auto_parts_sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_auto_parts_stock_movements_type
  ON public.auto_parts_stock_movements(product_id, type, created_at DESC);

-- ════════════════════════════════════════════════════════════════════════════
-- 1. SYNTHÈSE VENTES (KPI Dashboard)
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.auto_parts_sales_summary(
  p_business_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT date_trunc('day', now()),
  p_end_date TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_period_start TIMESTAMPTZ := p_start_date;
  v_period_end TIMESTAMPTZ := p_end_date;
  v_prev_start TIMESTAMPTZ;
  v_prev_end TIMESTAMPTZ;
  v_period_duration INTERVAL;
  v_result JSONB;
BEGIN
  v_period_duration := v_period_end - v_period_start;
  v_prev_start := v_period_start - v_period_duration;
  v_prev_end := v_period_start;

  WITH current_period AS (
    SELECT
      COUNT(*)::INT AS order_count,
      COUNT(DISTINCT client_id)::INT AS client_count,
      COALESCE(SUM(total), 0) AS total_revenue,
      COALESCE(AVG(total), 0) AS avg_order_value,
      COUNT(*) FILTER (WHERE payment_method = 'cash')::INT AS cash_count,
      COUNT(*) FILTER (WHERE payment_method = 'card')::INT AS card_count,
      COUNT(*) FILTER (WHERE payment_method = 'moncash')::INT AS moncash_count,
      COUNT(*) FILTER (WHERE payment_method = 'natcash')::INT AS natcash_count,
      COUNT(*) FILTER (WHERE payment_method = 'transfer')::INT AS transfer_count
    FROM public.auto_parts_sales
    WHERE business_id = p_business_id
      AND created_at >= v_period_start AND created_at < v_period_end
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
      AND created_at >= v_prev_start AND created_at < v_prev_end
      AND refund_status IS DISTINCT FROM 'full'
  ),
  daily_avg AS (
    SELECT COALESCE(SUM(total) / GREATEST(EXTRACT(DAY FROM v_period_duration)::INT, 1), 0) AS daily_avg
    FROM public.auto_parts_sales
    WHERE business_id = p_business_id
      AND created_at >= v_period_start AND created_at < v_period_end
      AND refund_status IS DISTINCT FROM 'full'
  )
  SELECT jsonb_build_object(
    'current', jsonb_build_object(
      'order_count', c.order_count,
      'client_count', c.client_count,
      'total_revenue', c.total_revenue,
      'avg_order_value', ROUND(c.avg_order_value, 2),
      'daily_avg', ROUND(d.daily_avg, 2),
      'payment_breakdown', jsonb_build_object(
        'cash', c.cash_count, 'card', c.card_count,
        'moncash', c.moncash_count, 'natcash', c.natcash_count,
        'transfer', c.transfer_count
      )
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
  FROM current_period c, previous_period p, daily_avg d;

  RETURN v_result;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. TOP PRODUITS VENDUS (avec évolution)
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.auto_parts_top_products(
  p_business_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT date_trunc('month', now()),
  p_end_date TIMESTAMPTZ DEFAULT now(),
  p_limit INT DEFAULT 10,
  p_prev_start_date TIMESTAMPTZ DEFAULT NULL,
  p_prev_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_prev_start TIMESTAMPTZ := COALESCE(p_prev_start_date, p_start_date - (p_end_date - p_start_date));
  v_prev_end TIMESTAMPTZ := COALESCE(p_prev_end_date, p_start_date);
BEGIN
  WITH current_sales AS (
    SELECT
      si.product_id, si.product_name,
      SUM(si.quantity)::NUMERIC AS qty,
      SUM(si.total_price)::NUMERIC AS revenue
    FROM public.auto_parts_sale_items si
    JOIN public.auto_parts_sales s ON s.id = si.sale_id
    WHERE s.business_id = p_business_id
      AND s.created_at >= p_start_date AND s.created_at < p_end_date
      AND s.refund_status IS DISTINCT FROM 'full'
    GROUP BY si.product_id, si.product_name
  ),
  prev_sales AS (
    SELECT
      si.product_id,
      SUM(si.quantity)::NUMERIC AS qty,
      SUM(si.total_price)::NUMERIC AS revenue
    FROM public.auto_parts_sale_items si
    JOIN public.auto_parts_sales s ON s.id = si.sale_id
    WHERE s.business_id = p_business_id
      AND s.created_at >= v_prev_start AND s.created_at < v_prev_end
      AND s.refund_status IS DISTINCT FROM 'full'
    GROUP BY si.product_id
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'product_id', c.product_id,
      'product_name', c.product_name,
      'quantity', c.qty,
      'revenue', c.revenue,
      'prev_quantity', COALESCE(p.qty, 0),
      'prev_revenue', COALESCE(p.revenue, 0),
      'qty_evolution', CASE WHEN COALESCE(p.qty, 0) > 0
        THEN ROUND(((c.qty - COALESCE(p.qty, 0)) / p.qty) * 100, 1) ELSE NULL END,
      'revenue_evolution', CASE WHEN COALESCE(p.revenue, 0) > 0
        THEN ROUND(((c.revenue - COALESCE(p.revenue, 0)) / p.revenue) * 100, 1) ELSE NULL END
    )
    ORDER BY c.revenue DESC
  ), '[]'::jsonb) INTO v_result
  FROM current_sales c
  LEFT JOIN prev_sales p ON p.product_id = c.product_id
  LIMIT p_limit;

  RETURN v_result;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. PRODUITS DORMANTS (aucun mouvement depuis N jours)
-- ════════════════════════════════════════════════════════════════════════════
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

-- ════════════════════════════════════════════════════════════════════════════
-- 4. PRÉVISION RUPTURE STOCK
-- ════════════════════════════════════════════════════════════════════════════
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
  WHERE (p.business_id = p_business_id OR p.business_id IS NULL)
    AND p.active = true
    AND (p.stock_quantity <= p.min_stock OR p.stock_quantity <= 0);

  RETURN v_result;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. ANALYSE PAR MARQUE AUTOMOBILE
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.auto_parts_brand_analysis(
  p_business_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT date_trunc('month', now()),
  p_end_date TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_grand_total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(si.total_price), 0) INTO v_grand_total
  FROM public.auto_parts_sale_items si
  JOIN public.auto_parts_sales s ON s.id = si.sale_id
  WHERE s.business_id = p_business_id
    AND s.created_at >= p_start_date AND s.created_at < p_end_date
    AND s.refund_status IS DISTINCT FROM 'full';

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'brand_id', b.id, 'brand_name', b.name,
      'sale_count', brand_stats.cnt,
      'revenue', brand_stats.rev,
      'percentage', CASE WHEN v_grand_total > 0
        THEN ROUND((brand_stats.rev / v_grand_total) * 100, 1) ELSE 0 END
    )
    ORDER BY brand_stats.rev DESC
  ), '[]'::jsonb) INTO v_result
  FROM (
    SELECT
      COALESCE(vc.brand_id, '00000000-0000-0000-0000-000000000000'::UUID) AS brand_id,
      COUNT(*)::INT AS cnt,
      SUM(si.total_price)::NUMERIC AS rev
    FROM public.auto_parts_sale_items si
    JOIN public.auto_parts_sales s ON s.id = si.sale_id
    LEFT JOIN public.auto_parts_vehicle_compatibilities vc ON vc.product_id = si.product_id
    WHERE s.business_id = p_business_id
      AND s.created_at >= p_start_date AND s.created_at < p_end_date
      AND s.refund_status IS DISTINCT FROM 'full'
    GROUP BY COALESCE(vc.brand_id, '00000000-0000-0000-0000-000000000000'::UUID)
  ) brand_stats
  LEFT JOIN public.auto_parts_brands b ON b.id = brand_stats.brand_id;

  RETURN v_result;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. RAPPORT DE RENTABILITÉ (admin/manager uniquement)
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.auto_parts_profit_summary(
  p_business_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT date_trunc('month', now()),
  p_end_date TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
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
        product_name,
        SUM(quantity)::INT AS qty,
        SUM(total_price)::NUMERIC AS revenue,
        SUM(cost_price * quantity)::NUMERIC AS cost,
        SUM(profit)::NUMERIC AS profit,
        CASE WHEN SUM(total_price) > 0
          THEN ROUND((SUM(profit) / SUM(total_price)) * 100, 1) ELSE 0 END AS margin_pct
      FROM sale_profits
      WHERE product_id IS NOT NULL
      GROUP BY product_name
      ORDER BY profit DESC
      LIMIT 10
    ) sub
  ),
  top_categories AS (
    SELECT jsonb_agg(sub) FROM (
      SELECT
        COALESCE(c.name, 'Sans catégorie') AS category_name,
        SUM(si.quantity)::INT AS qty,
        SUM(si.total_price)::NUMERIC AS revenue,
        SUM(COALESCE(p.cost_price, 0) * si.quantity)::NUMERIC AS cost,
        SUM(si.total_price - (si.quantity * COALESCE(p.cost_price, 0)))::NUMERIC AS profit,
        CASE WHEN SUM(si.total_price) > 0
          THEN ROUND((SUM(si.total_price - (si.quantity * COALESCE(p.cost_price, 0))) / SUM(si.total_price)) * 100, 1) ELSE 0 END AS margin_pct
      FROM public.auto_parts_sale_items si
      JOIN public.auto_parts_sales s ON s.id = si.sale_id
      LEFT JOIN public.auto_parts_products p ON p.id = si.product_id
      LEFT JOIN public.auto_parts_categories c ON c.id = p.category_id
      WHERE s.business_id = p_business_id
        AND s.created_at >= p_start_date AND s.created_at < p_end_date
        AND s.refund_status IS DISTINCT FROM 'full'
      GROUP BY c.name
      ORDER BY profit DESC
      LIMIT 10
    ) sub
  ),
  top_suppliers AS (
    SELECT jsonb_agg(sub) FROM (
      SELECT
        COALESCE(sup.name, 'Sans fournisseur') AS supplier_name,
        SUM(si.quantity)::INT AS qty,
        SUM(si.total_price)::NUMERIC AS revenue,
        SUM(COALESCE(p.cost_price, 0) * si.quantity)::NUMERIC AS cost,
        SUM(si.total_price - (si.quantity * COALESCE(p.cost_price, 0)))::NUMERIC AS profit,
        CASE WHEN SUM(si.total_price) > 0
          THEN ROUND((SUM(si.total_price - (si.quantity * COALESCE(p.cost_price, 0))) / SUM(si.total_price)) * 100, 1) ELSE 0 END AS margin_pct
      FROM public.auto_parts_sale_items si
      JOIN public.auto_parts_sales s ON s.id = si.sale_id
      LEFT JOIN public.auto_parts_products p ON p.id = si.product_id
      LEFT JOIN public.auto_parts_purchases pu ON pu.business_id = s.business_id
      LEFT JOIN public.auto_parts_suppliers sup ON sup.id = pu.supplier_id
      WHERE s.business_id = p_business_id
        AND s.created_at >= p_start_date AND s.created_at < p_end_date
        AND s.refund_status IS DISTINCT FROM 'full'
      GROUP BY sup.name
      ORDER BY profit DESC
      LIMIT 10
    ) sub
  )
  SELECT jsonb_build_object(
    'summary', row_to_json(a),
    'top_products', COALESCE((SELECT * FROM top_products), '[]'::jsonb),
    'top_categories', COALESCE((SELECT * FROM top_categories), '[]'::jsonb),
    'top_suppliers', COALESCE((SELECT * FROM top_suppliers), '[]'::jsonb)
  ) INTO v_result
  FROM aggregated a;

  RETURN v_result;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. PERFORMANCE EMPLOYÉS
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.auto_parts_employee_performance(
  p_business_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT date_trunc('month', now()),
  p_end_date TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'staff_id', stats.staff_id,
      'staff_name', COALESCE(st.name, 'Inconnu'),
      'staff_role', st.role,
      'sale_count', stats.cnt,
      'total_revenue', stats.rev,
      'avg_ticket', CASE WHEN stats.cnt > 0
        THEN ROUND(stats.rev / stats.cnt, 2) ELSE 0 END,
      'client_count', stats.client_cnt
    )
    ORDER BY stats.rev DESC
  ), '[]'::jsonb) INTO v_result
  FROM (
    SELECT
      COALESCE(s.staff_id, '00000000-0000-0000-0000-000000000000'::UUID) AS staff_id,
      COUNT(*)::INT AS cnt,
      COALESCE(SUM(s.total), 0)::NUMERIC AS rev,
      COUNT(DISTINCT s.client_id)::INT AS client_cnt
    FROM public.auto_parts_sales s
    WHERE s.business_id = p_business_id
      AND s.created_at >= p_start_date AND s.created_at < p_end_date
      AND s.refund_status IS DISTINCT FROM 'full'
    GROUP BY s.staff_id
  ) stats
  LEFT JOIN public.auto_parts_staff st ON st.id = stats.staff_id;

  RETURN v_result;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 8. HEURES DE FORTE ACTIVITÉ (Heatmap)
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.auto_parts_hourly_activity(
  p_business_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT date_trunc('month', now()),
  p_end_date TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'hour', hour,
      'day_of_week', day_of_week,
      'sale_count', sale_count,
      'revenue', revenue
    )
    ORDER BY day_of_week, hour
  ), '[]'::jsonb) INTO v_result
  FROM (
    SELECT EXTRACT(HOUR FROM s.created_at)::INT AS hour,
           EXTRACT(DOW FROM s.created_at)::INT AS day_of_week,
           COUNT(*)::INT AS sale_count,
           COALESCE(SUM(s.total), 0)::NUMERIC AS revenue
    FROM public.auto_parts_sales s
    WHERE s.business_id = p_business_id
      AND s.created_at >= p_start_date AND s.created_at < p_end_date
      AND s.refund_status IS DISTINCT FROM 'full'
    GROUP BY EXTRACT(HOUR FROM s.created_at), EXTRACT(DOW FROM s.created_at)
  ) agg;

  RETURN v_result;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 9. SANTÉ DU MAGASIN (Score composite 0-100)
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.auto_parts_store_health(
  p_business_id UUID
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
    v_recommendations := array_append(v_recommendations, '⚠ ' || ROUND(v_dormant_ratio, 0) || '% des produits sont dormants (aucune vente depuis 90 jours)');
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

-- ════════════════════════════════════════════════════════════════════════════
-- 10. TENDANCE HEBDOMADAIRE (pour graphiques d'évolution)
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.auto_parts_weekly_trend(
  p_business_id UUID,
  p_weeks INT DEFAULT 12
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_start TIMESTAMPTZ := date_trunc('week', now()) - ((p_weeks - 1) || ' weeks')::INTERVAL;
BEGIN
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'week_start', to_char(week_start, 'YYYY-MM-DD'),
      'total_sales', total_sales,
      'order_count', order_count
    )
    ORDER BY week_start
  ), '[]'::jsonb) INTO v_result
  FROM (
    SELECT date_trunc('week', s.created_at) AS week_start,
           COALESCE(SUM(s.total), 0) AS total_sales,
           COUNT(s.id)::INT AS order_count
    FROM public.auto_parts_sales s
    WHERE s.business_id = p_business_id
      AND s.created_at >= v_start
      AND s.refund_status IS DISTINCT FROM 'full'
    GROUP BY date_trunc('week', s.created_at)
  ) agg;

  RETURN v_result;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 11. SYNTHÈSE CLIENT (nombre clients, factures)
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.auto_parts_client_summary(
  p_business_id UUID
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_clients', (SELECT COUNT(*)::INT FROM public.auto_parts_clients
      WHERE business_id = p_business_id OR business_id IS NULL),
    'total_invoices', (SELECT COUNT(*)::INT FROM public.auto_parts_sales
      WHERE business_id = p_business_id AND refund_status IS DISTINCT FROM 'full'),
    'invoices_month', (SELECT COUNT(*)::INT FROM public.auto_parts_sales
      WHERE business_id = p_business_id AND created_at >= date_trunc('month', now())
        AND refund_status IS DISTINCT FROM 'full'),
    'invoices_today', (SELECT COUNT(*)::INT FROM public.auto_parts_sales
      WHERE business_id = p_business_id AND created_at >= date_trunc('day', now())
        AND refund_status IS DISTINCT FROM 'full')
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

DO $$ BEGIN RAISE NOTICE 'Rapports RPCs créés : sales_summary, top_products, dormant_products, stock_forecast, brand_analysis, profit_summary, employee_performance, hourly_activity, store_health, weekly_trend, client_summary'; END $$;

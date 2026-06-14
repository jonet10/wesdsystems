-- ════════════════════════════════════════════════════════════════════════════
-- WESD AUTO PARTS — Stock valuation fix + potential revenue/profit
--
-- 1. Add cost_price to auto_parts_stock_movements (for historical tracking)
-- 2. Store cost_price on sale (so sale/return use SAME cost_price)
-- 3. Store cost_price on return (old + new workflow)
-- 4. Extend dashboard_counts with totalPotentialRevenue / totalPotentialProfit
-- 5. Extend dormant_products with potential_revenue / potential_profit
-- ════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- PART 0 — Helper: drop ALL overloads of a function dynamically
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT proname, oidvectortypes(proargtypes) AS args
    FROM pg_catalog.pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname IN ('create_auto_parts_sale', 'process_auto_parts_return', 'approve_auto_parts_return', 'auto_parts_dashboard_counts', 'auto_parts_dormant_products')
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS public.%I(%s)', r.proname, r.args);
  END LOOP;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- PART 1 — Add cost_price to stock movements (nullable for historical data)
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.auto_parts_stock_movements
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12,2);

-- ════════════════════════════════════════════════════════════════════════════
-- PART 2 — Update create_auto_parts_sale: store cost_price in stock movement
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.create_auto_parts_sale(
  p_business_id UUID,
  p_client_id UUID DEFAULT NULL,
  p_client_name TEXT DEFAULT NULL,
  p_subtotal NUMERIC DEFAULT 0,
  p_tax_rate NUMERIC DEFAULT 0,
  p_tax_amount NUMERIC DEFAULT 0,
  p_discount_type TEXT DEFAULT 'none',
  p_discount_value NUMERIC DEFAULT 0,
  p_discount_amount NUMERIC DEFAULT 0,
  p_total NUMERIC DEFAULT 0,
  p_payment_method TEXT DEFAULT 'cash',
  p_payment_status TEXT DEFAULT 'paid',
  p_notes TEXT DEFAULT NULL,
  p_staff_id UUID DEFAULT NULL,
  p_invoice_prefix TEXT DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL,
  p_items JSONB DEFAULT '[]'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sale_id UUID;
  v_invoice TEXT;
  v_item JSONB;
  v_product_id UUID;
  v_product_name TEXT;
  v_quantity NUMERIC;
  v_unit_price NUMERIC;
  v_cost_price NUMERIC;
  v_staff_name TEXT;
  v_prefix TEXT;
BEGIN
  IF p_invoice_prefix IS NOT NULL THEN
    v_prefix := p_invoice_prefix;
  ELSE
    SELECT COALESCE(invoice_prefix, 'INV-') INTO v_prefix
    FROM public.auto_parts_business_settings
    WHERE business_id = p_business_id;
    IF v_prefix IS NULL THEN v_prefix := 'INV-'; END IF;
  END IF;

  v_invoice := generate_auto_parts_invoice_number(p_business_id);
  v_staff_name := (SELECT name FROM public.auto_parts_staff WHERE id = p_staff_id AND business_id = p_business_id);

  INSERT INTO public.auto_parts_sales (
    invoice_number, business_id, branch_id, client_id, client_name,
    subtotal, tax_rate, tax_amount, discount_type, discount_value, discount_amount,
    total, payment_method, payment_status, notes, staff_id, staff_name
  ) VALUES (
    v_invoice, p_business_id, p_branch_id, p_client_id, p_client_name,
    p_subtotal, p_tax_rate, p_tax_amount, p_discount_type, p_discount_value, p_discount_amount,
    p_total, p_payment_method, p_payment_status, p_notes, p_staff_id, v_staff_name
  ) RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_product_name := v_item->>'product_name';
    v_quantity := (v_item->>'quantity')::NUMERIC;
    v_unit_price := (v_item->>'unit_price')::NUMERIC;

    -- Capture current cost_price at time of sale
    SELECT COALESCE(cost_price, 0) INTO v_cost_price
    FROM public.auto_parts_products
    WHERE id = v_product_id AND business_id = p_business_id;

    IF v_product_id IS NOT NULL THEN
      IF (SELECT COALESCE(stock_quantity, 0) FROM public.auto_parts_products WHERE id = v_product_id AND business_id = p_business_id) < v_quantity THEN
        RAISE EXCEPTION 'STOCK_INSUFFICIENT_%', v_product_id USING HINT = format('Stock insuffisant pour %s', v_product_name);
      END IF;
    END IF;

    INSERT INTO public.auto_parts_sale_items (sale_id, product_id, product_name, quantity, unit_price, total_price, business_id, branch_id)
    VALUES (v_sale_id, v_product_id, v_product_name, v_quantity, v_unit_price, v_quantity * v_unit_price, p_business_id, p_branch_id);

    IF v_product_id IS NOT NULL THEN
      INSERT INTO public.auto_parts_stock_movements (product_id, type, quantity, unit_price, cost_price, reference, business_id, branch_id, created_by)
      VALUES (v_product_id, 'sale', -v_quantity, v_unit_price, v_cost_price, v_invoice, p_business_id, p_branch_id, auth.uid());
    END IF;
  END LOOP;

  RETURN (
    SELECT jsonb_build_object('id', s.id, 'invoice_number', s.invoice_number, 'total', s.total)
    FROM public.auto_parts_sales s WHERE s.id = v_sale_id
  );
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- PART 3 — Update process_auto_parts_return: store cost_price in movement
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.process_auto_parts_return(
  p_business_id UUID,
  p_sale_id UUID,
  p_items JSONB,
  p_reason TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sale RECORD;
  v_item JSONB;
  v_product_id UUID;
  v_product_name TEXT;
  v_quantity NUMERIC;
  v_unit_price NUMERIC;
  v_cost_price NUMERIC;
  v_total_return_qty NUMERIC := 0;
  v_total_sold_qty NUMERIC := 0;
  v_staff_id UUID;
BEGIN
  SELECT * INTO v_sale
  FROM public.auto_parts_sales
  WHERE id = p_sale_id AND business_id = p_business_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Vente introuvable');
  END IF;

  v_staff_id := public.current_auto_parts_staff_id();
  IF v_staff_id IS NULL THEN
    v_staff_id := auth.uid();
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_product_name := v_item->>'product_name';
    v_quantity := (v_item->>'quantity')::NUMERIC;
    v_unit_price := (v_item->>'unit_price')::NUMERIC;
    v_total_return_qty := v_total_return_qty + v_quantity;

    -- Capture current cost_price at time of return
    SELECT COALESCE(cost_price, 0) INTO v_cost_price
    FROM public.auto_parts_products
    WHERE id = v_product_id;

    INSERT INTO public.auto_parts_stock_movements
      (product_id, type, quantity, unit_price, cost_price, reference, notes, business_id, created_by)
    VALUES
      (v_product_id, 'return', v_quantity, v_unit_price, v_cost_price, v_sale.invoice_number, p_reason, p_business_id, v_staff_id);
  END LOOP;

  SELECT COALESCE(SUM(quantity), 0) INTO v_total_sold_qty
  FROM public.auto_parts_sale_items
  WHERE sale_id = p_sale_id;

  IF v_total_return_qty >= v_total_sold_qty THEN
    UPDATE public.auto_parts_sales
    SET refund_status = 'full', refunded_at = now()
    WHERE id = p_sale_id;
  ELSE
    UPDATE public.auto_parts_sales
    SET refund_status = 'partial', refunded_at = now()
    WHERE id = p_sale_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'sale_id', p_sale_id,
    'refund_status', CASE WHEN v_total_return_qty >= v_total_sold_qty THEN 'full' ELSE 'partial' END
  );
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- PART 4 — Update approve_auto_parts_return: store cost_price in movement
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.approve_auto_parts_return(
  p_request_id  UUID,
  p_reviewer_id UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_request         RECORD;
  v_item            RECORD;
  v_cost_price      NUMERIC;
  v_total_return_qty NUMERIC := 0;
  v_total_sold_qty   NUMERIC := 0;
  v_reviewer_name   TEXT;
BEGIN
  SELECT * INTO v_request
  FROM public.auto_parts_return_requests
  WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Demande introuvable');
  END IF;

  IF v_request.status != 'EN_ATTENTE' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cette demande a déjà été traitée');
  END IF;

  SELECT name INTO v_reviewer_name FROM public.auto_parts_staff WHERE id = p_reviewer_id;

  FOR v_item IN
    SELECT * FROM public.auto_parts_return_request_items WHERE request_id = p_request_id
  LOOP
    v_total_return_qty := v_total_return_qty + v_item.quantity;

    IF v_item.product_id IS NOT NULL THEN
      -- Capture current cost_price at time of return (BEFORE trigger updates stock)
      SELECT COALESCE(cost_price, 0) INTO v_cost_price
      FROM public.auto_parts_products
      WHERE id = v_item.product_id;

      -- Insert stock movement ONLY — the trigger auto_parts_update_stock_on_movement
      -- handles the stock_quantity update. Do NOT update stock_quantity directly,
      -- otherwise the stock is incremented TWICE (direct UPDATE + trigger).
      INSERT INTO public.auto_parts_stock_movements
        (product_id, type, quantity, unit_price, cost_price, reference, notes, business_id, branch_id)
      VALUES (
        v_item.product_id, 'return', v_item.quantity, v_item.unit_price, v_cost_price,
        v_request.invoice_number,
        COALESCE(v_request.reason, 'Retour approuvé'),
        v_request.business_id, v_request.branch_id
      );
    END IF;
  END LOOP;

  SELECT COALESCE(SUM(quantity), 0) INTO v_total_sold_qty
  FROM public.auto_parts_sale_items WHERE sale_id = v_request.sale_id;

  IF v_total_return_qty >= v_total_sold_qty THEN
    UPDATE public.auto_parts_sales
      SET refund_status = 'full', refunded_at = now(), status = 'RETURNED'
      WHERE id = v_request.sale_id;
  ELSE
    UPDATE public.auto_parts_sales
      SET refund_status = 'partial', refunded_at = now()
      WHERE id = v_request.sale_id;
  END IF;

  UPDATE public.auto_parts_return_requests
    SET status = 'APPROUVE', reviewed_by = p_reviewer_id,
        reviewer_name = v_reviewer_name, reviewed_at = now()
    WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true, 'refund_status',
    CASE WHEN v_total_return_qty >= v_total_sold_qty THEN 'full' ELSE 'partial' END);
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- PART 5 — Extend auto_parts_dashboard_counts with potential revenue/profit
-- ════════════════════════════════════════════════════════════════════════════
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
  v_total_potential_revenue NUMERIC := 0;
  v_total_potential_profit NUMERIC := 0;
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
    'totalProducts', v_total_products,
    'totalStockValue', CASE WHEN v_can_see_finance THEN v_total_stock_value ELSE 0 END,
    'totalPotentialRevenue', CASE WHEN v_can_see_finance THEN v_total_potential_revenue ELSE 0 END,
    'totalPotentialProfit', CASE WHEN v_can_see_finance THEN v_total_potential_profit ELSE 0 END,
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
-- PART 6 — Extend auto_parts_dormant_products with potential revenue/profit
-- ════════════════════════════════════════════════════════════════════════════
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
      'potential_revenue', p.unit_price * p.stock_quantity,
      'potential_profit', (p.unit_price - p.cost_price) * p.stock_quantity,
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

-- ════════════════════════════════════════════════════════════════════════════
-- GRANTS
-- ════════════════════════════════════════════════════════════════════════════
GRANT EXECUTE ON FUNCTION public.create_auto_parts_sale(UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, UUID, TEXT, UUID, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_auto_parts_return(UUID, UUID, JSONB, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_auto_parts_return(UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_dashboard_counts(UUID, TEXT, UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_dormant_products(UUID, TEXT, INT) TO anon, authenticated;

DO $$ BEGIN RAISE NOTICE 'Migration 20260815 applied: stock valuation fix (cost_price tracking, potential revenue/profit)'; END $$;

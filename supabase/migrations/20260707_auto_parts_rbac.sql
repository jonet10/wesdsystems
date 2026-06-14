-- ════════════════════════════════════════════════════════════════════════════
-- WESD AUTO PARTS — Role-Based Access Control (RBAC)
-- Enforces granular permissions per role (cashier, manager, admin)
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. HELPER: Resolve staff from a session token ───
CREATE OR REPLACE FUNCTION public.resolve_staff_from_token(p_session_token TEXT)
RETURNS TABLE(staff_id UUID, staff_name TEXT, staff_role TEXT, business_id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  v_hash TEXT;
BEGIN
  IF p_session_token IS NULL OR p_session_token = '' THEN RETURN; END IF;
  v_hash := encode(sha256(p_session_token::bytea), 'hex');
  RETURN QUERY
  SELECT s.staff_id, st.name, st.role, s.business_id
  FROM public.auto_parts_staff_sessions s
  JOIN public.auto_parts_staff st ON st.id = s.staff_id
  WHERE s.session_token_hash = v_hash
    AND s.revoked_at IS NULL
    AND s.expires_at > now()
    AND st.is_active = true;
END;
$$;

-- ─── 2. HELPER: Check if a staff role has a given permission ───
CREATE OR REPLACE FUNCTION public.staff_has_permission(p_role TEXT, p_permission TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
  RETURN (
    CASE p_role
      WHEN 'admin' THEN
        p_permission IN (
          'pos.view', 'pos.sell', 'dashboard.view', 'sales.today',
          'products.read', 'products.manage',
          'categories.manage', 'brands.manage', 'models.manage',
          'compatibilities.manage',
          'clients.read', 'clients.manage',
          'suppliers.read', 'suppliers.manage',
          'purchases.manage', 'stock.view', 'stock.manage',
          'staff.read', 'staff.manage',
          'reports.view', 'settings.view', 'settings.manage'
        )
      WHEN 'manager' THEN
        p_permission IN (
          'pos.view', 'pos.sell', 'dashboard.view', 'sales.today',
          'products.read', 'products.manage',
          'categories.manage', 'brands.manage', 'models.manage',
          'compatibilities.manage',
          'clients.read', 'clients.manage',
          'suppliers.read', 'suppliers.manage',
          'purchases.manage', 'stock.view', 'stock.manage',
          'staff.read',
          'reports.view', 'settings.view'
        )
      WHEN 'cashier' THEN
        p_permission IN (
          'pos.view', 'pos.sell', 'dashboard.view', 'sales.today',
          'products.read',
          'clients.read', 'stock.view'
        )
      ELSE false
    END
  );
END;
$$;

-- ─── 3. HELPER: Assert staff has permission, raise exception if not ───
CREATE OR REPLACE FUNCTION public.require_staff_permission(p_session_token TEXT, p_permission TEXT)
RETURNS TABLE(staff_id UUID, staff_name TEXT, staff_role TEXT, business_id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  v_staff_id UUID;
  v_staff_name TEXT;
  v_staff_role TEXT;
  v_business_id UUID;
BEGIN
  SELECT s.staff_id, s.staff_name, s.staff_role, s.business_id
  INTO v_staff_id, v_staff_name, v_staff_role, v_business_id
  FROM public.resolve_staff_from_token(p_session_token) s;

  IF v_staff_id IS NULL THEN
    RAISE EXCEPTION 'STAFF_SESSION_INVALID' USING HINT = 'Session invalide ou expirée';
  END IF;

  IF NOT public.staff_has_permission(v_staff_role, p_permission) THEN
    RAISE EXCEPTION 'STAFF_PERMISSION_DENIED' USING HINT = format('Permission requise: %s', p_permission);
  END IF;

  RETURN QUERY SELECT v_staff_id, v_staff_name, v_staff_role, v_business_id;
END;
$$;

-- ─── 4. RPC: List products (checks products.read) ───
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

-- ─── 5. RPC: Create product (checks products.manage) ───
CREATE OR REPLACE FUNCTION public.auto_parts_create_product(
  p_session_token TEXT,
  p_business_id UUID,
  p_name TEXT,
  p_category_id UUID DEFAULT NULL,
  p_sku TEXT DEFAULT NULL,
  p_barcode TEXT DEFAULT NULL,
  p_unit_price NUMERIC DEFAULT 0,
  p_cost_price NUMERIC DEFAULT 0,
  p_stock_quantity NUMERIC DEFAULT 0,
  p_min_stock NUMERIC DEFAULT 0,
  p_max_stock NUMERIC DEFAULT NULL,
  p_location TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_image_url TEXT DEFAULT NULL,
  p_active BOOLEAN DEFAULT true
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_staff_id UUID;
  v_biz UUID;
  v_id UUID;
BEGIN
  SELECT staff_id, business_id INTO v_staff_id, v_biz
  FROM public.require_staff_permission(p_session_token, 'products.manage');

  INSERT INTO public.auto_parts_products (
    business_id, name, category_id, sku, barcode,
    unit_price, cost_price, stock_quantity, min_stock, max_stock,
    location, description, notes, image_url, active
  ) VALUES (
    p_business_id, p_name, p_category_id, p_sku, p_barcode,
    p_unit_price, p_cost_price, p_stock_quantity, p_min_stock, p_max_stock,
    p_location, p_description, p_notes, p_image_url, p_active
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'status', 'created');
END;
$$;

-- ─── 6. RPC: List categories (checks products.read — categories are product metadata) ───
CREATE OR REPLACE FUNCTION public.auto_parts_list_categories(
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
    SELECT * FROM public.auto_parts_categories
    WHERE business_id = v_biz OR business_id IS NULL
    ORDER BY sort_order, name
  ) t;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- ─── 7. RPC: List suppliers (checks suppliers.read) ───
CREATE OR REPLACE FUNCTION public.auto_parts_list_suppliers(
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
  FROM public.require_staff_permission(p_session_token, 'suppliers.manage');

  IF p_business_id IS NOT NULL THEN
    v_biz := p_business_id;
  END IF;

  SELECT jsonb_agg(to_jsonb(t)) INTO v_result
  FROM (
    SELECT * FROM public.auto_parts_suppliers
    WHERE business_id = v_biz OR business_id IS NULL
    ORDER BY name
  ) t;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- ─── 8. RPC: List clients (checks clients.read) ───
CREATE OR REPLACE FUNCTION public.auto_parts_list_clients(
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
  FROM public.require_staff_permission(p_session_token, 'clients.read');

  IF p_business_id IS NOT NULL THEN
    v_biz := p_business_id;
  END IF;

  SELECT jsonb_agg(to_jsonb(t)) INTO v_result
  FROM (
    SELECT * FROM public.auto_parts_clients
    WHERE business_id = v_biz OR business_id IS NULL
    ORDER BY name
  ) t;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- ─── 9. RPC: Get dashboard stats (checks dashboard.view) ───
CREATE OR REPLACE FUNCTION public.auto_parts_dashboard_stats(
  p_session_token TEXT,
  p_business_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_result JSONB;
  v_total_products INT;
  v_out_of_stock INT;
  v_low_stock INT;
  v_today_sales INT;
  v_month_sales NUMERIC;
  v_month_purchases INT;
  v_pending_orders INT;
  v_total_stock_value NUMERIC;
  v_now DATE := CURRENT_DATE;
  v_month_start TIMESTAMPTZ := date_trunc('month', CURRENT_TIMESTAMP);
  v_day_start TIMESTAMPTZ := CURRENT_DATE;
BEGIN
  SELECT staff_role INTO v_role
  FROM public.require_staff_permission(p_session_token, 'dashboard.view');

  SELECT COUNT(*) INTO v_total_products
  FROM public.auto_parts_products
  WHERE (business_id = p_business_id OR business_id IS NULL);

  SELECT COUNT(*) INTO v_out_of_stock
  FROM public.auto_parts_products
  WHERE (business_id = p_business_id OR business_id IS NULL)
    AND active = true AND stock_quantity <= 0;

  SELECT COUNT(*) INTO v_low_stock
  FROM public.auto_parts_products
  WHERE (business_id = p_business_id OR business_id IS NULL)
    AND active = true AND stock_quantity > 0 AND stock_quantity <= min_stock;

  SELECT COALESCE(SUM(cost_price * stock_quantity), 0) INTO v_total_stock_value
  FROM public.auto_parts_products
  WHERE (business_id = p_business_id OR business_id IS NULL);

  SELECT COUNT(*) INTO v_today_sales
  FROM public.auto_parts_sales
  WHERE (business_id = p_business_id OR business_id IS NULL)
    AND created_at >= v_day_start;

  SELECT COALESCE(SUM(total), 0) INTO v_month_sales
  FROM public.auto_parts_sales
  WHERE (business_id = p_business_id OR business_id IS NULL)
    AND created_at >= v_month_start;

  SELECT COUNT(*) INTO v_month_purchases
  FROM public.auto_parts_purchases
  WHERE (business_id = p_business_id OR business_id IS NULL)
    AND created_at >= v_month_start AND status = 'delivered';

  SELECT COUNT(*) INTO v_pending_orders
  FROM public.auto_parts_purchases
  WHERE (business_id = p_business_id OR business_id IS NULL)
    AND status IN ('pending', 'confirmed');

  v_result := jsonb_build_object(
    'totalProducts', v_total_products,
    'totalStockValue', v_total_stock_value,
    'outOfStock', v_out_of_stock,
    'lowStock', v_low_stock,
    'todaySales', v_today_sales,
    'monthSales', v_month_sales,
    'monthPurchases', v_month_purchases,
    'pendingOrders', v_pending_orders
  );

  RETURN v_result;
END;
$$;

-- ─── 10. RPC: Create sale (checks pos.sell) ───
CREATE OR REPLACE FUNCTION public.auto_parts_create_sale(
  p_session_token TEXT,
  p_business_id UUID,
  p_subtotal NUMERIC,
  p_tax_rate NUMERIC,
  p_tax_amount NUMERIC,
  p_discount_type TEXT,
  p_discount_value NUMERIC,
  p_discount_amount NUMERIC,
  p_total NUMERIC,
  p_payment_method TEXT,
  p_payment_status TEXT,
  p_client_id UUID DEFAULT NULL,
  p_client_name TEXT DEFAULT NULL,
  p_staff_id UUID DEFAULT NULL,
  p_items JSONB DEFAULT '[]'::jsonb,
  p_notes TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_staff_id UUID;
  v_staff_name TEXT;
  v_biz UUID;
  v_sale_id UUID;
  v_invoice_number TEXT;
  v_item JSONB;
  v_product_id UUID;
  v_qty NUMERIC;
BEGIN
  SELECT staff_id, staff_name, business_id INTO v_staff_id, v_staff_name, v_biz
  FROM public.require_staff_permission(p_session_token, 'pos.sell');

  v_invoice_number := 'AP-' || to_char(CURRENT_TIMESTAMP, 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6));

  INSERT INTO public.auto_parts_sales (
    business_id, invoice_number, client_id, client_name,
    subtotal, tax_rate, tax_amount,
    discount_type, discount_value, discount_amount,
    total, payment_method, payment_status,
    staff_id, staff_name, notes
  ) VALUES (
    p_business_id, v_invoice_number, p_client_id, p_client_name,
    p_subtotal, p_tax_rate, p_tax_amount,
    p_discount_type, p_discount_value, p_discount_amount,
    p_total, p_payment_method, p_payment_status,
    COALESCE(p_staff_id, v_staff_id), v_staff_name, p_notes
  ) RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty := (v_item->>'quantity')::NUMERIC;

    INSERT INTO public.auto_parts_sale_items (sale_id, product_id, product_name, quantity, unit_price, total_price)
    VALUES (
      v_sale_id,
      v_product_id,
      v_item->>'product_name',
      v_qty,
      (v_item->>'unit_price')::NUMERIC,
      (v_item->>'total_price')::NUMERIC
    );

    UPDATE public.auto_parts_products
    SET stock_quantity = stock_quantity - v_qty,
        reserved_quantity = GREATEST(reserved_quantity - v_qty, 0)
    WHERE id = v_product_id;
  END LOOP;

  RETURN jsonb_build_object(
    'id', v_sale_id,
    'invoice_number', v_invoice_number,
    'status', 'created'
  );
END;
$$;

-- ─── 11. RPC: List staff (checks staff.read) ───
CREATE OR REPLACE FUNCTION public.auto_parts_list_staff(
  p_session_token TEXT,
  p_business_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  PERFORM FROM public.require_staff_permission(p_session_token, 'staff.read');

  SELECT jsonb_agg(to_jsonb(t)) INTO v_result
  FROM (
    SELECT id, name, username, email, phone, role, is_active, created_at
    FROM public.auto_parts_staff
    WHERE business_id = p_business_id
    ORDER BY name
  ) t;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- ─── 12. RPC: List sales (checks pos.view for read-only) ───
CREATE OR REPLACE FUNCTION public.auto_parts_list_sales(
  p_session_token TEXT,
  p_business_id UUID,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  PERFORM FROM public.require_staff_permission(p_session_token, 'pos.view');

  SELECT jsonb_agg(to_jsonb(t)) INTO v_result
  FROM (
    SELECT s.*,
      COALESCE(
        (SELECT jsonb_agg(to_jsonb(si.*)) FROM public.auto_parts_sale_items si WHERE si.sale_id = s.id),
        '[]'::jsonb
      ) AS items
    FROM public.auto_parts_sales s
    WHERE s.business_id = p_business_id
    ORDER BY s.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) t;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- ─── 13. RPC: List stock movements (checks stock.view) ───
CREATE OR REPLACE FUNCTION public.auto_parts_list_stock_movements(
  p_session_token TEXT,
  p_business_id UUID,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  PERFORM FROM public.require_staff_permission(p_session_token, 'stock.view');

  SELECT jsonb_agg(to_jsonb(t)) INTO v_result
  FROM (
    SELECT sm.*, p.name AS product_name
    FROM public.auto_parts_stock_movements sm
    LEFT JOIN public.auto_parts_products p ON p.id = sm.product_id
    WHERE sm.business_id = p_business_id
    ORDER BY sm.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) t;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- ─── GRANT EXECUTION ───
GRANT EXECUTE ON FUNCTION public.resolve_staff_from_token TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_has_permission TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.require_staff_permission TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_list_products(p_session_token TEXT, p_business_id UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_create_product(p_session_token TEXT, p_business_id UUID, p_name TEXT, p_category_id UUID, p_sku TEXT, p_barcode TEXT, p_unit_price NUMERIC, p_cost_price NUMERIC, p_stock_quantity NUMERIC, p_min_stock NUMERIC, p_max_stock NUMERIC, p_location TEXT, p_description TEXT, p_notes TEXT, p_image_url TEXT, p_active BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_list_categories(p_session_token TEXT, p_business_id UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_list_suppliers(p_session_token TEXT, p_business_id UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_list_clients(p_session_token TEXT, p_business_id UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_dashboard_stats(p_session_token TEXT, p_business_id UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_create_sale(p_session_token TEXT, p_business_id UUID, p_subtotal NUMERIC, p_tax_rate NUMERIC, p_tax_amount NUMERIC, p_discount_type TEXT, p_discount_value NUMERIC, p_discount_amount NUMERIC, p_total NUMERIC, p_payment_method TEXT, p_payment_status TEXT, p_client_id UUID, p_client_name TEXT, p_staff_id UUID, p_items JSONB, p_notes TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_list_staff(p_session_token TEXT, p_business_id UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_list_sales(p_session_token TEXT, p_business_id UUID, p_limit INT, p_offset INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_list_stock_movements(p_session_token TEXT, p_business_id UUID, p_limit INT, p_offset INT) TO anon, authenticated;

DO $$ BEGIN RAISE NOTICE 'Migration 20260707 complete: RBAC system deployed'; END $$;

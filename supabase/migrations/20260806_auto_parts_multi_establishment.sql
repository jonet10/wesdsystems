-- ════════════════════════════════════════════════════════════════════════════
-- WESD AUTO PARTS — Multi-establishment (branch_id) architecture
--
-- Adds branch_id to all auto-parts tables + updates critical RPCs
-- for branch-scoped data access.
-- ════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- PART 1 — Add branch_id to all auto-parts tables
-- ════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  -- Products & categories
  ALTER TABLE public.auto_parts_categories ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL;
  ALTER TABLE public.auto_parts_products ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL;

  -- CRM
  ALTER TABLE public.auto_parts_clients ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL;
  ALTER TABLE public.auto_parts_suppliers ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL;

  -- Sales
  ALTER TABLE public.auto_parts_sales ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL;
  ALTER TABLE public.auto_parts_sale_items ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL;

  -- Purchases
  ALTER TABLE public.auto_parts_purchases ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL;
  ALTER TABLE public.auto_parts_purchase_items ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL;

  -- Stock
  ALTER TABLE public.auto_parts_stock_movements ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL;

  -- Staff
  ALTER TABLE public.auto_parts_staff ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL;

  -- Alerts
  ALTER TABLE public.auto_parts_alerts ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL;

  -- Quotes
  ALTER TABLE public.auto_parts_quotes ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL;
  ALTER TABLE public.auto_parts_quote_items ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL;

  -- Delivery notes
  ALTER TABLE public.auto_parts_delivery_notes ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL;
  ALTER TABLE public.auto_parts_delivery_note_items ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- PART 2 — Auto-select active_branch_id on INSERT via trigger
-- ════════════════════════════════════════════════════════════════════════════

-- Generic function: sets branch_id from business active_branch_id if not provided
CREATE OR REPLACE FUNCTION public.auto_parts_set_branch_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.branch_id IS NULL THEN
    SELECT active_branch_id INTO NEW.branch_id
    FROM public.businesses WHERE id = NEW.business_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Apply trigger to all tables that have both business_id and branch_id
DO $$ DECLARE
  v_tables TEXT[] := ARRAY[
    'auto_parts_categories', 'auto_parts_products',
    'auto_parts_clients', 'auto_parts_suppliers',
    'auto_parts_sales', 'auto_parts_sale_items',
    'auto_parts_purchases', 'auto_parts_purchase_items',
    'auto_parts_stock_movements',
    'auto_parts_staff', 'auto_parts_alerts',
    'auto_parts_quotes', 'auto_parts_quote_items',
    'auto_parts_delivery_notes', 'auto_parts_delivery_note_items'
  ];
  v_tbl TEXT;
BEGIN
  FOREACH v_tbl IN ARRAY v_tables
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = v_tbl) THEN
      EXECUTE format(
        'DROP TRIGGER IF EXISTS trg_%s_set_branch_id ON public.%I; CREATE TRIGGER trg_%s_set_branch_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.auto_parts_set_branch_id();',
        v_tbl, v_tbl, v_tbl, v_tbl
      );
    END IF;
  END LOOP;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- PART 3 — Update key RPCs to accept and filter by branch_id
-- ════════════════════════════════════════════════════════════════════════════

-- ─── auto_parts_list_sales: add branch filter ───
DROP FUNCTION IF EXISTS public.auto_parts_list_sales(UUID);
CREATE OR REPLACE FUNCTION public.auto_parts_list_sales(p_business_id UUID, p_branch_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_result JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(
    to_jsonb(s) || jsonb_build_object('items',
      COALESCE((SELECT jsonb_agg(to_jsonb(si) ORDER BY si.id)
        FROM public.auto_parts_sale_items si WHERE si.sale_id = s.id), '[]'::jsonb)
    )
    ORDER BY s.created_at DESC
  ), '[]'::jsonb) INTO v_result
  FROM public.auto_parts_sales s
  WHERE s.business_id = p_business_id
    AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
  LIMIT 100;
  RETURN v_result;
END;
$$;

-- ─── auto_parts_list_products: add branch filter ───
DROP FUNCTION IF EXISTS public.auto_parts_list_products(UUID);
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
    AND (p_branch_id IS NULL OR p.branch_id = p_branch_id);
END;
$$;

-- ─── auto_parts_list_products_full: add branch filter ───
DROP FUNCTION IF EXISTS public.auto_parts_list_products_full(p_business_id UUID);
DROP FUNCTION IF EXISTS public.auto_parts_list_products_full(p_business_id UUID, p_session_token TEXT);
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
    WHERE (p.business_id = p_business_id OR p.business_id IS NULL)
      AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)
    ORDER BY p.name
  ) t;
  RETURN v_result;
END;
$$;

-- ─── auto_parts_list_purchases: add branch filter ───
DROP FUNCTION IF EXISTS public.auto_parts_list_purchases(UUID);
CREATE OR REPLACE FUNCTION public.auto_parts_list_purchases(p_business_id UUID, p_branch_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(jsonb_agg(
    to_jsonb(p) || jsonb_build_object('items',
      COALESCE((SELECT jsonb_agg(to_jsonb(pi) ORDER BY pi.id)
        FROM public.auto_parts_purchase_items pi WHERE pi.purchase_id = p.id), '[]'::jsonb)
    )
    ORDER BY p.created_at DESC
  ), '[]'::jsonb)
  FROM public.auto_parts_purchases p
  WHERE p.business_id = p_business_id
    AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)
  LIMIT 100;
END;
$$;

-- ─── auto_parts_list_categories: add branch filter ───
DROP FUNCTION IF EXISTS public.auto_parts_list_categories(UUID);
CREATE OR REPLACE FUNCTION public.auto_parts_list_categories(p_business_id UUID, p_branch_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.sort_order, c.name), '[]'::jsonb)
  FROM public.auto_parts_categories c
  WHERE c.business_id = p_business_id
    AND (p_branch_id IS NULL OR c.branch_id = p_branch_id);
END;
$$;

-- ─── auto_parts_search_products: add branch filter ───
DROP FUNCTION IF EXISTS public.auto_parts_search_products(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.auto_parts_search_products(p_business_id UUID, p_query TEXT, p_branch_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.name), '[]'::jsonb)
  FROM public.auto_parts_products p
  WHERE p.business_id = p_business_id
    AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)
    AND (p.name ILIKE '%' || p_query || '%' OR p.sku ILIKE '%' || p_query || '%')
  LIMIT 20;
END;
$$;

-- ─── list_auto_parts_stock_movements: add branch filter ───
DROP FUNCTION IF EXISTS public.list_auto_parts_stock_movements(UUID);
CREATE OR REPLACE FUNCTION public.list_auto_parts_stock_movements(p_business_id UUID, p_branch_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(jsonb_agg(
    to_jsonb(sm) || jsonb_build_object('product',
      CASE WHEN sm.product_id IS NOT NULL THEN
        (SELECT to_jsonb(pr) FROM (SELECT id, name FROM public.auto_parts_products pr WHERE pr.id = sm.product_id) pr)
      ELSE NULL END
    )
    ORDER BY sm.created_at DESC
  ), '[]'::jsonb)
  FROM public.auto_parts_stock_movements sm
  WHERE sm.business_id = p_business_id
    AND (p_branch_id IS NULL OR sm.branch_id = p_branch_id)
  LIMIT 200;
END;
$$;

-- ─── list_auto_parts_quotes: add branch filter ───
DROP FUNCTION IF EXISTS public.list_auto_parts_quotes(UUID);
CREATE OR REPLACE FUNCTION public.list_auto_parts_quotes(p_business_id UUID, p_branch_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(jsonb_agg(
    to_jsonb(q) || jsonb_build_object('items',
      COALESCE((SELECT jsonb_agg(to_jsonb(qi) ORDER BY qi.id)
        FROM public.auto_parts_quote_items qi WHERE qi.quote_id = q.id), '[]'::jsonb)
    )
    ORDER BY q.created_at DESC
  ), '[]'::jsonb)
  FROM public.auto_parts_quotes q
  WHERE q.business_id = p_business_id
    AND (p_branch_id IS NULL OR q.branch_id = p_branch_id)
  LIMIT 100;
END;
$$;

-- ─── list_auto_parts_delivery_notes: add branch filter ───
DROP FUNCTION IF EXISTS public.list_auto_parts_delivery_notes(UUID);
CREATE OR REPLACE FUNCTION public.list_auto_parts_delivery_notes(p_business_id UUID, p_branch_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(jsonb_agg(
    to_jsonb(dn) || jsonb_build_object('items',
      COALESCE((SELECT jsonb_agg(to_jsonb(dni) ORDER BY dni.id)
        FROM public.auto_parts_delivery_note_items dni WHERE dni.delivery_note_id = dn.id), '[]'::jsonb)
    )
    ORDER BY dn.created_at DESC
  ), '[]'::jsonb)
  FROM public.auto_parts_delivery_notes dn
  WHERE dn.business_id = p_business_id
    AND (p_branch_id IS NULL OR dn.branch_id = p_branch_id)
  LIMIT 100;
END;
$$;

-- ─── auto_parts_dashboard_counts: add branch filter ───
DROP FUNCTION IF EXISTS public.auto_parts_dashboard_counts(UUID, DATE, DATE);
DROP FUNCTION IF EXISTS public.auto_parts_dashboard_counts(p_business_id UUID, p_session_token TEXT, p_staff_id UUID);
DROP FUNCTION IF EXISTS public.auto_parts_dashboard_counts(p_business_id UUID);
DROP FUNCTION IF EXISTS public.auto_parts_dashboard_counts(p_business_id UUID, p_staff_id UUID);
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
  WHERE (business_id = p_business_id OR business_id IS NULL)
    AND (p_branch_id IS NULL OR branch_id = p_branch_id);

  IF v_can_see_finance THEN
    SELECT COALESCE(SUM(cost_price * stock_quantity), 0) INTO v_total_stock_value
    FROM public.auto_parts_products
    WHERE (business_id = p_business_id OR business_id IS NULL)
      AND active = true
      AND (p_branch_id IS NULL OR branch_id = p_branch_id);
  END IF;

  SELECT COUNT(*) INTO v_out_of_stock
  FROM public.auto_parts_products
  WHERE (business_id = p_business_id OR business_id IS NULL)
    AND active = true AND stock_quantity <= 0
    AND (p_branch_id IS NULL OR branch_id = p_branch_id);

  SELECT COUNT(*) INTO v_low_stock
  FROM public.auto_parts_products
  WHERE (business_id = p_business_id OR business_id IS NULL)
    AND active = true AND stock_quantity > 0 AND stock_quantity <= min_stock
    AND (p_branch_id IS NULL OR branch_id = p_branch_id);

  IF p_staff_id IS NOT NULL THEN
    SELECT COALESCE(SUM(total), 0) INTO v_today_sales
    FROM public.auto_parts_sales
    WHERE business_id = p_business_id
      AND created_at >= v_day_start
      AND refund_status IS DISTINCT FROM 'full'
      AND staff_id = p_staff_id
      AND (p_branch_id IS NULL OR branch_id = p_branch_id);

    SELECT COALESCE(SUM(total), 0) INTO v_month_sales
    FROM public.auto_parts_sales
    WHERE business_id = p_business_id
      AND created_at >= v_month_start
      AND refund_status IS DISTINCT FROM 'full'
      AND staff_id = p_staff_id
      AND (p_branch_id IS NULL OR branch_id = p_branch_id);
  ELSE
    SELECT COALESCE(SUM(total), 0) INTO v_today_sales
    FROM public.auto_parts_sales
    WHERE business_id = p_business_id
      AND created_at >= v_day_start
      AND refund_status IS DISTINCT FROM 'full'
      AND (p_branch_id IS NULL OR branch_id = p_branch_id);

    SELECT COALESCE(SUM(total), 0) INTO v_month_sales
    FROM public.auto_parts_sales
    WHERE business_id = p_business_id
      AND created_at >= v_month_start
      AND refund_status IS DISTINCT FROM 'full'
      AND (p_branch_id IS NULL OR branch_id = p_branch_id);
  END IF;

  SELECT COALESCE(SUM(total), 0) INTO v_month_purchases
  FROM public.auto_parts_purchases
  WHERE business_id = p_business_id
    AND created_at >= v_month_start
    AND status = 'delivered'
    AND (p_branch_id IS NULL OR branch_id = p_branch_id);

  SELECT COUNT(*) INTO v_pending_orders
  FROM public.auto_parts_purchases
  WHERE business_id = p_business_id AND status IN ('pending', 'confirmed')
    AND (p_branch_id IS NULL OR branch_id = p_branch_id);

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

-- ─── create_auto_parts_sale: pass branch_id ───
DROP FUNCTION IF EXISTS public.create_auto_parts_sale(UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, UUID, JSONB);
DROP FUNCTION IF EXISTS public.create_auto_parts_sale(UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, UUID, TEXT, JSONB);
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
  v_staff_name := (SELECT name FROM public.auto_parts_staff WHERE id = p_staff_id);

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

    INSERT INTO public.auto_parts_sale_items (sale_id, product_id, product_name, quantity, unit_price, total_price, business_id, branch_id)
    VALUES (v_sale_id, v_product_id, v_product_name, v_quantity, v_unit_price, v_quantity * v_unit_price, p_business_id, p_branch_id);

    IF v_product_id IS NOT NULL THEN
      INSERT INTO public.auto_parts_stock_movements (product_id, type, quantity, unit_price, reference, business_id, branch_id, created_by)
      VALUES (v_product_id, 'sale', -v_quantity, v_unit_price, v_invoice, p_business_id, p_branch_id, auth.uid());
    END IF;
  END LOOP;

  RETURN (
    SELECT jsonb_build_object('id', s.id, 'invoice_number', s.invoice_number, 'total', s.total)
    FROM public.auto_parts_sales s WHERE s.id = v_sale_id
  );
END;
$$;

-- ─── create_auto_parts_purchase: pass branch_id ───
DROP FUNCTION IF EXISTS public.create_auto_parts_purchase(UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, JSONB);
CREATE OR REPLACE FUNCTION public.create_auto_parts_purchase(
  p_business_id UUID,
  p_supplier_id UUID DEFAULT NULL,
  p_supplier_name TEXT DEFAULT NULL,
  p_reference_number TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'draft',
  p_subtotal NUMERIC DEFAULT 0,
  p_tax_amount NUMERIC DEFAULT 0,
  p_total NUMERIC DEFAULT 0,
  p_notes TEXT DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL,
  p_items JSONB DEFAULT '[]'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_purchase_id UUID;
  v_item JSONB;
BEGIN
  INSERT INTO public.auto_parts_purchases (business_id, branch_id, supplier_id, supplier_name, reference_number, status, subtotal, tax_amount, total, notes, created_by)
  VALUES (p_business_id, p_branch_id, p_supplier_id, p_supplier_name, p_reference_number, p_status, p_subtotal, p_tax_amount, p_total, p_notes, auth.uid())
  RETURNING id INTO v_purchase_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.auto_parts_purchase_items (purchase_id, product_id, product_name, quantity, unit_price, total_price, business_id, branch_id)
    VALUES (v_purchase_id, (v_item->>'product_id')::UUID, v_item->>'product_name', (v_item->>'quantity')::NUMERIC, (v_item->>'unit_price')::NUMERIC, (v_item->>'quantity')::NUMERIC * (v_item->>'unit_price')::NUMERIC, p_business_id, p_branch_id);

    IF p_status = 'delivered' AND (v_item->>'product_id')::UUID IS NOT NULL THEN
      INSERT INTO public.auto_parts_stock_movements (product_id, type, quantity, unit_price, reference, business_id, branch_id, created_by)
      VALUES ((v_item->>'product_id')::UUID, 'in', (v_item->>'quantity')::NUMERIC, (v_item->>'unit_price')::NUMERIC, p_reference_number, p_business_id, p_branch_id, auth.uid());
    END IF;
  END LOOP;

  RETURN jsonb_build_object('id', v_purchase_id, 'status', 'created');
END;
$$;

-- ─── create_auto_parts_quote: pass branch_id ───
DROP FUNCTION IF EXISTS public.create_auto_parts_quote(UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC, NUMERIC, NUMERIC, DATE, TEXT, TEXT, TEXT, JSONB);
CREATE OR REPLACE FUNCTION public.create_auto_parts_quote(
  p_business_id UUID,
  p_client_id UUID DEFAULT NULL,
  p_client_name TEXT DEFAULT NULL,
  p_client_phone TEXT DEFAULT NULL,
  p_client_email TEXT DEFAULT NULL,
  p_subtotal NUMERIC DEFAULT 0,
  p_tax_rate NUMERIC DEFAULT 0,
  p_tax_amount NUMERIC DEFAULT 0,
  p_discount_type TEXT DEFAULT 'none',
  p_discount_value NUMERIC DEFAULT 0,
  p_discount_amount NUMERIC DEFAULT 0,
  p_total NUMERIC DEFAULT 0,
  p_valid_until DATE DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_terms TEXT DEFAULT NULL,
  p_quote_prefix TEXT DEFAULT 'DEV-',
  p_branch_id UUID DEFAULT NULL,
  p_items JSONB DEFAULT '[]'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_quote_id UUID;
  v_number TEXT;
  v_item JSONB;
BEGIN
  v_number := generate_auto_parts_quote_number(p_quote_prefix);

  INSERT INTO public.auto_parts_quotes (
    business_id, branch_id, quote_number, client_id, client_name, client_phone, client_email,
    subtotal, tax_rate, tax_amount, discount_type, discount_value, discount_amount,
    total, valid_until, notes, terms, created_by
  ) VALUES (
    p_business_id, p_branch_id, v_number, p_client_id, p_client_name, p_client_phone, p_client_email,
    p_subtotal, p_tax_rate, p_tax_amount, p_discount_type, p_discount_value, p_discount_amount,
    p_total, p_valid_until, p_notes, p_terms, auth.uid()
  ) RETURNING id INTO v_quote_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.auto_parts_quote_items (quote_id, product_id, product_name, quantity, unit_price, total_price, business_id, branch_id)
    VALUES (v_quote_id, (v_item->>'product_id')::UUID, v_item->>'product_name', (v_item->>'quantity')::NUMERIC, (v_item->>'unit_price')::NUMERIC, (v_item->>'quantity')::NUMERIC * (v_item->>'unit_price')::NUMERIC, p_business_id, p_branch_id);
  END LOOP;

  RETURN jsonb_build_object('id', v_quote_id, 'quote_number', v_number);
END;
$$;

-- ─── create_auto_parts_delivery_note: pass branch_id ───
DROP FUNCTION IF EXISTS public.create_auto_parts_delivery_note(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB);
CREATE OR REPLACE FUNCTION public.create_auto_parts_delivery_note(
  p_business_id UUID,
  p_sale_id UUID DEFAULT NULL,
  p_client_id UUID DEFAULT NULL,
  p_client_name TEXT DEFAULT NULL,
  p_client_phone TEXT DEFAULT NULL,
  p_client_address TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'draft',
  p_notes TEXT DEFAULT NULL,
  p_prefix TEXT DEFAULT 'BL-',
  p_branch_id UUID DEFAULT NULL,
  p_items JSONB DEFAULT '[]'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_number TEXT;
  v_item JSONB;
  v_delivered_at TIMESTAMPTZ;
BEGIN
  v_number := generate_auto_parts_delivery_note_number(p_prefix);
  IF p_status = 'delivered' THEN v_delivered_at := now(); END IF;

  INSERT INTO public.auto_parts_delivery_notes
    (business_id, branch_id, delivery_note_number, sale_id, client_id, client_name, client_phone, client_address,
     status, delivered_at, notes, created_by)
  VALUES
    (p_business_id, p_branch_id, v_number, p_sale_id, p_client_id, p_client_name, p_client_phone, p_client_address,
     p_status, v_delivered_at, p_notes, auth.uid())
  RETURNING id INTO v_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.auto_parts_delivery_note_items
      (delivery_note_id, product_id, product_name, quantity, unit, business_id, branch_id)
    VALUES (v_id, (v_item->>'product_id')::UUID, v_item->>'product_name', (v_item->>'quantity')::NUMERIC, COALESCE(v_item->>'unit', 'pce'), p_business_id, p_branch_id);
  END LOOP;

  RETURN jsonb_build_object('id', v_id, 'delivery_note_number', v_number);
END;
$$;

-- ─── create_auto_parts_stock_movement: pass branch_id ───
DROP FUNCTION IF EXISTS public.create_auto_parts_stock_movement(UUID, UUID, TEXT, NUMERIC, NUMERIC, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.create_auto_parts_stock_movement(
  p_business_id UUID,
  p_product_id UUID,
  p_type TEXT,
  p_quantity NUMERIC,
  p_unit_price NUMERIC DEFAULT NULL,
  p_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.auto_parts_stock_movements (product_id, type, quantity, unit_price, reference, notes, business_id, branch_id, created_by)
  VALUES (p_product_id, p_type, p_quantity, p_unit_price, p_reference, p_notes, p_business_id, p_branch_id, auth.uid())
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'status', 'created');
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- PART 4 — RPC: list business branches (for auto-parts frontend)
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.list_auto_parts_branches(p_business_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(
    (SELECT jsonb_agg(to_jsonb(bb) ORDER BY bb.name)
     FROM public.business_branches bb
     WHERE bb.business_id = p_business_id AND bb.active = true),
    '[]'::jsonb
  );
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- GRANTS
-- ════════════════════════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION public.list_auto_parts_branches TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_dashboard_counts TO anon, authenticated;

DO $$ BEGIN RAISE NOTICE 'Migration 20260806 applied: multi-establishment branch_id architecture'; END $$;

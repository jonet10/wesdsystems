-- Hardening of SECURITY DEFINER functions for Multi-Tenant Isolation (Safe Edition)
-- Generated on: 2026-07-12
-- Excludes public / login / session-based functions to prevent breaking production workflows.

CREATE OR REPLACE FUNCTION public.import_standard_beverage_catalog(
  p_branch_id UUID,
  p_include_salon_products BOOLEAN DEFAULT true
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted INTEGER := 0;
BEGIN
  IF p_branch_id IS NOT NULL AND NOT public.is_super_admin() AND (SELECT business_id FROM public.business_branches WHERE id = p_branch_id) IS DISTINCT FROM public.current_user_business_id() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.salon_beverages (
    branch_id, master_beverage_id, catalog_category_id, catalog_brand, is_custom,
    sku, name, description, brand, unit_price, cost_price, units_per_case,
    stock_cases, stock_units, reorder_level_units, barcode, is_active
  )
  SELECT
    p_branch_id,
    mb.id,
    mb.category_id,
    COALESCE(mb.brand, mb.name),
    false,
    mb.sku,
    mb.name,
    mb.description,
    COALESCE(mb.brand, mb.name),
    0,
    NULL,
    mb.units_per_case,
    0,
    0,
    50,
    NULL,
    true
  FROM public.master_beverages mb
  WHERE mb.active = true
    AND (
      p_include_salon_products
      OR mb.category_id <> (SELECT id FROM public.master_beverage_categories WHERE slug = 'salon-products' LIMIT 1)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.salon_beverages sb
      WHERE sb.branch_id = p_branch_id
        AND sb.master_beverage_id = mb.id
    );

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.import_standard_beverage_catalog(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_standard_beverage_catalog(UUID, BOOLEAN) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.generate_auto_parts_invoice_number(p_business_id UUID DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  next_val BIGINT;
  v_prefix TEXT := 'INV-';
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  IF p_business_id IS NOT NULL THEN
    SELECT invoice_prefix INTO v_prefix
    FROM public.auto_parts_business_settings
    WHERE business_id = p_business_id;
  END IF;
  next_val := nextval('public.auto_parts_invoice_seq');
  RETURN COALESCE(v_prefix, 'INV-') || LPAD(next_val::TEXT, 6, '0');
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.generate_auto_parts_invoice_number(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_auto_parts_invoice_number(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.update_auto_parts_quote(
  p_id UUID,
  p_business_id UUID DEFAULT NULL,
  p_client_id UUID DEFAULT NULL,
  p_client_name TEXT DEFAULT NULL,
  p_client_phone TEXT DEFAULT NULL,
  p_client_email TEXT DEFAULT NULL,
  p_subtotal NUMERIC DEFAULT NULL,
  p_tax_rate NUMERIC DEFAULT NULL,
  p_tax_amount NUMERIC DEFAULT NULL,
  p_discount_type TEXT DEFAULT NULL,
  p_discount_value NUMERIC DEFAULT NULL,
  p_discount_amount NUMERIC DEFAULT NULL,
  p_total NUMERIC DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_valid_until DATE DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_terms TEXT DEFAULT NULL,
  p_items JSONB DEFAULT '[]'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_biz UUID;
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  SELECT business_id INTO v_biz FROM public.auto_parts_quotes WHERE id = p_id;
  IF v_biz IS NULL OR (p_business_id IS NOT NULL AND v_biz != p_business_id) THEN
    RETURN jsonb_build_object('error', 'Accès refusé');
  END IF;

  DELETE FROM public.auto_parts_quote_items WHERE quote_id = p_id;

  UPDATE public.auto_parts_quotes SET
    client_id       = COALESCE(p_client_id, client_id),
    client_name     = COALESCE(p_client_name, client_name),
    client_phone    = COALESCE(p_client_phone, client_phone),
    client_email    = COALESCE(p_client_email, client_email),
    subtotal        = COALESCE(p_subtotal, subtotal),
    tax_rate        = COALESCE(p_tax_rate, tax_rate),
    tax_amount      = COALESCE(p_tax_amount, tax_amount),
    discount_type   = COALESCE(p_discount_type, discount_type),
    discount_value  = COALESCE(p_discount_value, discount_value),
    discount_amount = COALESCE(p_discount_amount, discount_amount),
    total           = COALESCE(p_total, total),
    status          = COALESCE(p_status, status),
    valid_until     = COALESCE(p_valid_until, valid_until),
    notes           = COALESCE(p_notes, notes),
    terms           = COALESCE(p_terms, terms)
  WHERE id = p_id;

  INSERT INTO public.auto_parts_quote_items (quote_id, product_id, product_name, quantity, unit_price, total_price, business_id)
  SELECT p_id, (v_item->>'product_id')::UUID, v_item->>'product_name',
         (v_item->>'quantity')::NUMERIC, (v_item->>'unit_price')::NUMERIC,
         (v_item->>'quantity')::NUMERIC * (v_item->>'unit_price')::NUMERIC, v_biz
  FROM jsonb_array_elements(p_items) v_item;

  RETURN jsonb_build_object('id', p_id, 'status', 'updated');
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.update_auto_parts_quote(UUID, UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, DATE, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_auto_parts_quote(UUID, UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, DATE, TEXT, TEXT, JSONB) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delete_auto_parts_quote(p_id UUID, p_business_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_biz UUID;
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  SELECT business_id INTO v_biz FROM public.auto_parts_quotes WHERE id = p_id;
  IF v_biz IS NULL OR (p_business_id IS NOT NULL AND v_biz != p_business_id) THEN
    RETURN jsonb_build_object('error', 'Accès refusé');
  END IF;
  DELETE FROM public.auto_parts_quote_items WHERE quote_id = p_id;
  DELETE FROM public.auto_parts_quotes WHERE id = p_id;
  RETURN jsonb_build_object('id', p_id, 'status', 'deleted');
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.delete_auto_parts_quote(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_auto_parts_quote(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_auto_parts_quote(p_id UUID, p_business_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_result JSONB;
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  SELECT to_jsonb(q) || jsonb_build_object('items',
    COALESCE((SELECT jsonb_agg(to_jsonb(qi) ORDER BY qi.id)
      FROM public.auto_parts_quote_items qi WHERE qi.quote_id = q.id), '[]'::jsonb)
  ) INTO v_result
  FROM public.auto_parts_quotes q
  WHERE q.id = p_id AND (q.business_id = p_business_id OR p_business_id IS NULL);
  RETURN v_result;
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.get_auto_parts_quote(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_auto_parts_quote(UUID, UUID) TO authenticated, service_role;

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
  p_amount_paid NUMERIC DEFAULT NULL,
  p_balance_due NUMERIC DEFAULT NULL,
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
  v_available NUMERIC;
  v_staff_name TEXT;
  v_amount_paid NUMERIC;
  v_balance_due NUMERIC;
  v_payment_status TEXT;
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  v_amount_paid := LEAST(GREATEST(COALESCE(p_amount_paid, p_total), 0), p_total);
  v_balance_due := GREATEST(COALESCE(p_balance_due, p_total - v_amount_paid), 0);
  v_payment_status := CASE
    WHEN v_balance_due <= 0 THEN 'paid'
    WHEN v_amount_paid <= 0 THEN 'unpaid'
    ELSE 'partial'
  END;

  IF v_balance_due > 0 AND p_client_id IS NULL AND NULLIF(TRIM(COALESCE(p_client_name, '')), '') IS NULL THEN
    RAISE EXCEPTION 'CLIENT_REQUIRED_FOR_PARTIAL_PAYMENT'
      USING HINT = 'Un client est requis pour enregistrer un paiement partiel.';
  END IF;

  v_invoice := generate_auto_parts_invoice_number(p_business_id);
  v_staff_name := (
    SELECT name FROM public.auto_parts_staff
    WHERE id = p_staff_id AND business_id = p_business_id
  );

  INSERT INTO public.auto_parts_sales (
    invoice_number, business_id, branch_id, client_id, client_name,
    subtotal, tax_rate, tax_amount, discount_type, discount_value, discount_amount,
    total, amount_paid, balance_due, payment_method, payment_status, notes, staff_id, staff_name
  ) VALUES (
    v_invoice, p_business_id, p_branch_id, p_client_id, p_client_name,
    p_subtotal, p_tax_rate, p_tax_amount, p_discount_type, p_discount_value, p_discount_amount,
    p_total, v_amount_paid, v_balance_due, p_payment_method, v_payment_status, p_notes, p_staff_id, v_staff_name
  ) RETURNING id INTO v_sale_id;

  IF p_client_id IS NOT NULL AND v_balance_due > 0 THEN
    UPDATE public.auto_parts_clients
    SET credit_balance = COALESCE(credit_balance, 0) + v_balance_due
    WHERE id = p_client_id
      AND business_id = p_business_id;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_product_name := v_item->>'product_name';
    v_quantity := (v_item->>'quantity')::NUMERIC;
    v_unit_price := (v_item->>'unit_price')::NUMERIC;

    IF v_product_id IS NOT NULL THEN
      SELECT COALESCE(i.stock_quantity, 0) - COALESCE(i.reserved_quantity, 0), COALESCE(i.cost_price, 0)
      INTO v_available, v_cost_price
      FROM public.auto_parts_product_inventory i
      WHERE i.product_id = v_product_id
        AND i.business_id = p_business_id
        AND (p_branch_id IS NULL OR i.branch_id = p_branch_id OR i.branch_id IS NULL)
      ORDER BY CASE WHEN i.branch_id = p_branch_id THEN 0 ELSE 1 END
      LIMIT 1;

      IF COALESCE(v_available, 0) < v_quantity THEN
        RAISE EXCEPTION 'STOCK_INSUFFICIENT_%', v_product_id
          USING HINT = format('Stock insuffisant pour %s', v_product_name);
      END IF;
    ELSE
      v_cost_price := 0;
    END IF;

    INSERT INTO public.auto_parts_sale_items (
      sale_id, product_id, product_name, quantity, unit_price, total_price, business_id, branch_id
    ) VALUES (
      v_sale_id, v_product_id, v_product_name, v_quantity, v_unit_price,
      v_quantity * v_unit_price, p_business_id, p_branch_id
    );

    IF v_product_id IS NOT NULL THEN
      INSERT INTO public.auto_parts_stock_movements (
        product_id, type, quantity, unit_price, cost_price, reference, business_id, branch_id, created_by
      ) VALUES (
        v_product_id, 'sale', -v_quantity, v_unit_price, v_cost_price, v_invoice, p_business_id, p_branch_id, auth.uid()
      );
    END IF;
  END LOOP;

  RETURN (
    SELECT jsonb_build_object(
      'id', s.id,
      'invoice_number', s.invoice_number,
      'total', s.total,
      'amount_paid', s.amount_paid,
      'balance_due', s.balance_due,
      'payment_status', s.payment_status
    )
    FROM public.auto_parts_sales s
    WHERE s.id = v_sale_id
  );
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.create_auto_parts_sale(UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, UUID, TEXT, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_auto_parts_sale(UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, UUID, TEXT, UUID, JSONB) TO authenticated, service_role;

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
  v_product_id UUID;
  v_quantity NUMERIC;
  v_unit_price NUMERIC;
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.auto_parts_purchases (
    business_id, branch_id, supplier_id, supplier_name, reference_number,
    status, subtotal, tax_amount, total, notes, created_by
  )
  VALUES (
    p_business_id, p_branch_id, p_supplier_id, p_supplier_name, p_reference_number,
    p_status, p_subtotal, p_tax_amount, p_total, p_notes, auth.uid()
  )
  RETURNING id INTO v_purchase_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::NUMERIC;
    v_unit_price := (v_item->>'unit_price')::NUMERIC;

    INSERT INTO public.auto_parts_purchase_items (
      purchase_id, product_id, product_name, quantity, unit_price, total_price, business_id, branch_id
    )
    VALUES (
      v_purchase_id, v_product_id, v_item->>'product_name',
      v_quantity, v_unit_price, v_quantity * v_unit_price, p_business_id, p_branch_id
    );

    IF p_status = 'delivered' AND v_product_id IS NOT NULL THEN
      UPDATE public.auto_parts_product_inventory
      SET cost_price = v_unit_price
      WHERE business_id = p_business_id
        AND product_id = v_product_id
        AND ((p_branch_id IS NULL AND branch_id IS NULL) OR branch_id = p_branch_id);

      INSERT INTO public.auto_parts_stock_movements (
        product_id, type, quantity, unit_price, cost_price, reference, business_id, branch_id, created_by
      )
      VALUES (
        v_product_id, 'in', v_quantity, v_unit_price, v_unit_price,
        p_reference_number, p_business_id, p_branch_id, auth.uid()
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object('id', v_purchase_id, 'status', 'created');
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.create_auto_parts_purchase(UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_auto_parts_purchase(UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, UUID, JSONB) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.auto_parts_list_products(p_business_id UUID, p_branch_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  PERFORM public.ensure_auto_parts_inventory_for_business(p_business_id);

  RETURN COALESCE(jsonb_agg(public.auto_parts_inventory_row_json(p, i, c, p_business_id) ORDER BY p.name), '[]'::jsonb)
  FROM public.auto_parts_products p
  LEFT JOIN public.auto_parts_categories c ON c.id = p.category_id
  LEFT JOIN LATERAL (
    SELECT inv.*
    FROM public.auto_parts_product_inventory inv
    WHERE inv.business_id = p_business_id
      AND inv.product_id = p.id
      AND (p_branch_id IS NULL OR inv.branch_id = p_branch_id OR inv.branch_id IS NULL)
    ORDER BY CASE WHEN inv.branch_id = p_branch_id THEN 0 ELSE 1 END
    LIMIT 1
  ) i ON true
  WHERE COALESCE(p.active, true) = true
    AND COALESCE(i.active, true) = true;
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.auto_parts_list_products(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_parts_list_products(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.auto_parts_create_product(
  p_session_token TEXT,
  p_business_id UUID,
  p_name TEXT,
  p_category_id UUID DEFAULT NULL,
  p_sku TEXT DEFAULT NULL,
  p_barcode TEXT DEFAULT NULL,
  p_unit_price NUMERIC DEFAULT NULL,
  p_cost_price NUMERIC DEFAULT NULL,
  p_stock_quantity NUMERIC DEFAULT 0,
  p_min_stock NUMERIC DEFAULT 0,
  p_max_stock NUMERIC DEFAULT NULL,
  p_location TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_image_url TEXT DEFAULT NULL,
  p_active BOOLEAN DEFAULT true
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  IF p_session_token IS NOT NULL
     AND NOT public.auto_parts_has_permission(p_session_token, 'products.manage', p_business_id) THEN
    RAISE EXCEPTION 'ACCESS_DENIED' USING HINT = 'Permission requise: products.manage';
  END IF;

  RETURN public.upsert_auto_parts_product(
    p_business_id,
    NULL,
    jsonb_build_object(
      'name', p_name,
      'category_id', p_category_id,
      'sku', p_sku,
      'barcode', p_barcode,
      'unit_price', p_unit_price,
      'cost_price', p_cost_price,
      'stock_quantity', COALESCE(p_stock_quantity, 0),
      'min_stock', COALESCE(p_min_stock, 0),
      'max_stock', p_max_stock,
      'location', p_location,
      'description', p_description,
      'notes', p_notes,
      'image_url', p_image_url,
      'active', COALESCE(p_active, true)
    ),
    NULL
  );
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.auto_parts_create_product(TEXT, UUID, TEXT, UUID, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_parts_create_product(TEXT, UUID, TEXT, UUID, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.auto_parts_search_products(
  p_business_id UUID,
  p_query TEXT,
  p_branch_id UUID DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_query TEXT := '%' || COALESCE(p_query, '') || '%';
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  PERFORM public.ensure_auto_parts_inventory_for_business(p_business_id);

  RETURN COALESCE(jsonb_agg(public.auto_parts_inventory_row_json(p, i, c, p_business_id) ORDER BY p.name), '[]'::jsonb)
  FROM public.auto_parts_products p
  LEFT JOIN public.auto_parts_categories c ON c.id = p.category_id
  LEFT JOIN LATERAL (
    SELECT inv.*
    FROM public.auto_parts_product_inventory inv
    WHERE inv.business_id = p_business_id
      AND inv.product_id = p.id
      AND (p_branch_id IS NULL OR inv.branch_id = p_branch_id OR inv.branch_id IS NULL)
    ORDER BY CASE WHEN inv.branch_id = p_branch_id THEN 0 ELSE 1 END
    LIMIT 1
  ) i ON true
  WHERE COALESCE(p.active, true) = true
    AND COALESCE(i.active, true) = true
    AND (
      p.name ILIKE v_query
      OR p.sku ILIKE v_query
      OR p.barcode ILIKE v_query
      OR p.oem_code ILIKE v_query
      OR p.manufacturer ILIKE v_query
    )
  LIMIT 50;
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.auto_parts_search_products(UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_parts_search_products(UUID, TEXT, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.auto_parts_get_product(p_id UUID, p_business_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  IF p_business_id IS NOT NULL THEN
    PERFORM public.ensure_auto_parts_inventory_for_business(p_business_id);
  END IF;

  SELECT public.auto_parts_inventory_row_json(p, i, c, p_business_id)
  INTO v_result
  FROM public.auto_parts_products p
  LEFT JOIN public.auto_parts_categories c ON c.id = p.category_id
  LEFT JOIN LATERAL (
    SELECT inv.*
    FROM public.auto_parts_product_inventory inv
    WHERE inv.business_id = p_business_id
      AND inv.product_id = p.id
    ORDER BY CASE WHEN inv.branch_id IS NULL THEN 0 ELSE 1 END
    LIMIT 1
  ) i ON p_business_id IS NOT NULL
  WHERE p.id = p_id;

  RETURN v_result;
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.auto_parts_get_product(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_parts_get_product(UUID, UUID) TO authenticated, service_role;

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
  v_month_start TIMESTAMPTZ := date_trunc('month', now());
  v_day_start TIMESTAMPTZ := date_trunc('day', now());
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  PERFORM public.ensure_auto_parts_inventory_for_business(p_business_id);

  SELECT COUNT(*),
         COALESCE(SUM(COALESCE(i.cost_price, 0) * COALESCE(i.stock_quantity, 0)), 0),
         COUNT(*) FILTER (WHERE COALESCE(i.stock_quantity, 0) <= 0),
         COUNT(*) FILTER (WHERE COALESCE(i.stock_quantity, 0) > 0 AND COALESCE(i.stock_quantity, 0) <= COALESCE(i.min_stock, 0))
  INTO v_total_products, v_total_stock_value, v_out_of_stock, v_low_stock
  FROM public.auto_parts_products p
  JOIN public.auto_parts_product_inventory i ON i.product_id = p.id
  WHERE i.business_id = p_business_id
    AND COALESCE(p.active, true)
    AND COALESCE(i.active, true)
    AND (p_branch_id IS NULL OR i.branch_id = p_branch_id OR i.branch_id IS NULL);

  SELECT COALESCE(SUM(total), 0) INTO v_today_sales
  FROM public.auto_parts_sales
  WHERE business_id = p_business_id
    AND created_at >= v_day_start
    AND refund_status IS DISTINCT FROM 'full'
    AND (p_staff_id IS NULL OR staff_id = p_staff_id)
    AND (p_branch_id IS NULL OR branch_id IS NULL OR branch_id = p_branch_id);

  SELECT COALESCE(SUM(total), 0) INTO v_month_sales
  FROM public.auto_parts_sales
  WHERE business_id = p_business_id
    AND created_at >= v_month_start
    AND refund_status IS DISTINCT FROM 'full'
    AND (p_staff_id IS NULL OR staff_id = p_staff_id)
    AND (p_branch_id IS NULL OR branch_id IS NULL OR branch_id = p_branch_id);

  SELECT COALESCE(SUM(total), 0) INTO v_month_purchases
  FROM public.auto_parts_purchases
  WHERE business_id = p_business_id
    AND created_at >= v_month_start
    AND status = 'delivered'
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
$$;;

REVOKE EXECUTE ON FUNCTION public.auto_parts_dashboard_counts(UUID, TEXT, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_parts_dashboard_counts(UUID, TEXT, UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.auto_parts_category_repartition(p_business_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  PERFORM public.ensure_auto_parts_inventory_for_business(p_business_id);

  RETURN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('name', COALESCE(c.name, 'Sans catégorie'), 'count', v.cnt)), '[]'::jsonb)
    FROM (
      SELECT p.category_id, COUNT(*) AS cnt
      FROM public.auto_parts_products p
      JOIN public.auto_parts_product_inventory i ON i.product_id = p.id
      WHERE i.business_id = p_business_id
        AND COALESCE(p.active, true)
        AND COALESCE(i.active, true)
      GROUP BY p.category_id
    ) v
    LEFT JOIN public.auto_parts_categories c ON c.id = v.category_id
  );
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.auto_parts_category_repartition(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_parts_category_repartition(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.auto_parts_dormant_products(
  p_business_id UUID,
  p_days INT DEFAULT 30
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cutoff TIMESTAMPTZ := now() - (p_days || ' days')::INTERVAL;
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  PERFORM public.ensure_auto_parts_inventory_for_business(p_business_id);

  RETURN COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'sku', p.sku,
      'stock_quantity', i.stock_quantity,
      'cost_price', COALESCE(i.cost_price, 0),
      'stock_value', COALESCE(i.cost_price, 0) * COALESCE(i.stock_quantity, 0),
      'unit_price', i.unit_price,
      'potential_revenue', COALESCE(i.unit_price, 0) * COALESCE(i.stock_quantity, 0),
      'potential_profit', (COALESCE(i.unit_price, 0) - COALESCE(i.cost_price, 0)) * COALESCE(i.stock_quantity, 0),
      'category_name', c.name,
      'last_sale_date', last_sale.last_date,
      'days_since_sale', CASE WHEN last_sale.last_date IS NOT NULL
        THEN EXTRACT(DAY FROM now() - last_sale.last_date)::INT ELSE p_days * 2 END
    )
    ORDER BY COALESCE(i.stock_quantity, 0) * COALESCE(i.cost_price, 0) DESC
  ), '[]'::jsonb)
  FROM public.auto_parts_products p
  JOIN public.auto_parts_product_inventory i ON i.product_id = p.id AND i.business_id = p_business_id
  LEFT JOIN public.auto_parts_categories c ON c.id = p.category_id
  LEFT JOIN LATERAL (
    SELECT MAX(s.created_at) AS last_date
    FROM public.auto_parts_sale_items si
    JOIN public.auto_parts_sales s ON s.id = si.sale_id
    WHERE si.product_id = p.id
      AND s.business_id = p_business_id
      AND s.refund_status IS DISTINCT FROM 'full'
  ) last_sale ON true
  LEFT JOIN LATERAL (
    SELECT MAX(sm.created_at) AS last_date
    FROM public.auto_parts_stock_movements sm
    WHERE sm.product_id = p.id
      AND sm.business_id = p_business_id
      AND sm.type IN ('in', 'out', 'sale')
  ) last_movement ON true
  WHERE COALESCE(p.active, true)
    AND COALESCE(i.active, true)
    AND COALESCE(i.stock_quantity, 0) > 0
    AND (last_sale.last_date IS NULL OR last_sale.last_date < v_cutoff)
    AND (last_movement.last_date IS NULL OR last_movement.last_date < v_cutoff);
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.auto_parts_dormant_products(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_parts_dormant_products(UUID, INT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.auto_parts_stock_forecast(
  p_business_id UUID,
  p_lookback_days INT DEFAULT 90
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cutoff TIMESTAMPTZ := now() - (p_lookback_days || ' days')::INTERVAL;
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  PERFORM public.ensure_auto_parts_inventory_for_business(p_business_id);

  RETURN COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'sku', p.sku,
      'stock_quantity', i.stock_quantity,
      'min_stock', i.min_stock,
      'unit_price', i.unit_price,
      'avg_daily_sales', ROUND(COALESCE(ds.qty, 0) / GREATEST(p_lookback_days, 1), 2),
      'days_until_rupture', CASE
        WHEN COALESCE(ds.qty, 0) <= 0 THEN NULL
        ELSE ROUND(COALESCE(i.stock_quantity, 0) / NULLIF(COALESCE(ds.qty, 0) / GREATEST(p_lookback_days, 1), 0))
      END,
      'risk_level', CASE
        WHEN COALESCE(i.stock_quantity, 0) <= 0 THEN 'rupture'
        WHEN COALESCE(ds.qty, 0) <= 0 THEN 'unknown'
        WHEN COALESCE(i.stock_quantity, 0) / NULLIF(COALESCE(ds.qty, 0) / GREATEST(p_lookback_days, 1), 0) <= 7 THEN 'high'
        WHEN COALESCE(i.stock_quantity, 0) / NULLIF(COALESCE(ds.qty, 0) / GREATEST(p_lookback_days, 1), 0) <= 30 THEN 'medium'
        WHEN COALESCE(i.stock_quantity, 0) / NULLIF(COALESCE(ds.qty, 0) / GREATEST(p_lookback_days, 1), 0) <= 90 THEN 'low'
        ELSE 'safe'
      END
    )
    ORDER BY COALESCE(i.stock_quantity, 0) ASC
  ), '[]'::jsonb)
  FROM public.auto_parts_products p
  JOIN public.auto_parts_product_inventory i ON i.product_id = p.id AND i.business_id = p_business_id
  LEFT JOIN LATERAL (
    SELECT SUM(si.quantity)::NUMERIC AS qty
    FROM public.auto_parts_sale_items si
    JOIN public.auto_parts_sales s ON s.id = si.sale_id
    WHERE si.product_id = p.id
      AND s.business_id = p_business_id
      AND s.created_at >= v_cutoff
      AND s.refund_status IS DISTINCT FROM 'full'
  ) ds ON true
  WHERE COALESCE(p.active, true)
    AND COALESCE(i.active, true)
    AND (COALESCE(i.stock_quantity, 0) <= COALESCE(i.min_stock, 0) OR COALESCE(i.stock_quantity, 0) <= 0);
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.auto_parts_stock_forecast(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_parts_stock_forecast(UUID, INT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.auto_parts_store_health(p_business_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_total_products INT;
  v_active_products INT;
  v_out_of_stock INT;
  v_dormant_count INT;
  v_category_count INT;
  v_rupture_ratio NUMERIC := 0;
  v_score NUMERIC := 70;
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  PERFORM public.ensure_auto_parts_inventory_for_business(p_business_id);

  SELECT
    COUNT(*)::INT,
    COUNT(*) FILTER (WHERE COALESCE(i.active, true) AND COALESCE(p.active, true))::INT,
    COUNT(*) FILTER (WHERE COALESCE(i.active, true) AND COALESCE(p.active, true) AND COALESCE(i.stock_quantity, 0) <= 0)::INT,
    COUNT(DISTINCT p.category_id)::INT
  INTO v_total_products, v_active_products, v_out_of_stock, v_category_count
  FROM public.auto_parts_products p
  JOIN public.auto_parts_product_inventory i ON i.product_id = p.id
  WHERE i.business_id = p_business_id;

  SELECT jsonb_array_length(public.auto_parts_dormant_products(p_business_id, 90))
  INTO v_dormant_count;

  IF v_active_products > 0 THEN
    v_rupture_ratio := (v_out_of_stock::NUMERIC / v_active_products) * 100;
  END IF;

  v_score := GREATEST(0, LEAST(100, 100 - v_rupture_ratio));

  RETURN jsonb_build_object(
    'score', ROUND(v_score)::INT,
    'sales_growth', 0,
    'stock_turnover', 0,
    'dormant_ratio', CASE WHEN v_active_products > 0 THEN ROUND((v_dormant_count::NUMERIC / v_active_products) * 100, 1) ELSE 0 END,
    'rupture_ratio', ROUND(v_rupture_ratio, 1),
    'margin_pct', 0,
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
    'recommendations', CASE
      WHEN v_out_of_stock > 0 THEN jsonb_build_array('Renseigner les stocks et prix des produits du catalogue global.')
      ELSE '[]'::jsonb
    END
  );
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.auto_parts_store_health(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_parts_store_health(UUID) TO authenticated, service_role;

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
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.auto_parts_stock_movements (
    product_id, type, quantity, unit_price, reference, notes, business_id, branch_id, created_by
  )
  VALUES (p_product_id, p_type, p_quantity, p_unit_price, p_reference, p_notes, p_business_id, p_branch_id, auth.uid())
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'status', 'created');
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.create_auto_parts_stock_movement(UUID, UUID, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_auto_parts_stock_movement(UUID, UUID, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ensure_auto_parts_inventory_for_business(p_business_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.auto_parts_product_inventory (
    business_id, product_id, stock_quantity, reserved_quantity, min_stock,
    cost_price, unit_price, active
  )
  SELECT p_business_id, p.id, 0, 0, 0, NULL, NULL, true
  FROM public.auto_parts_products p
  ON CONFLICT DO NOTHING;
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.ensure_auto_parts_inventory_for_business(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_auto_parts_inventory_for_business(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.upsert_auto_parts_product(
  p_business_id UUID,
  p_product_id UUID DEFAULT NULL,
  p_values JSONB DEFAULT '{}'::jsonb,
  p_branch_id UUID DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_product_id UUID := p_product_id;
  v_category_id UUID := NULLIF(p_values->>'category_id', '')::UUID;
  v_sku TEXT := NULLIF(btrim(COALESCE(p_values->>'sku', '')), '');
  v_barcode TEXT := NULLIF(btrim(COALESCE(p_values->>'barcode', '')), '');
  v_name TEXT := NULLIF(btrim(COALESCE(p_values->>'name', '')), '');
  v_inventory_id UUID;
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  IF v_product_id IS NULL THEN
    IF v_name IS NULL THEN
      RAISE EXCEPTION 'PRODUCT_NAME_REQUIRED';
    END IF;

    SELECT id INTO v_product_id
    FROM public.auto_parts_products
    WHERE (v_sku IS NOT NULL AND lower(sku) = lower(v_sku))
       OR (v_barcode IS NOT NULL AND lower(barcode) = lower(v_barcode))
       OR (v_sku IS NULL AND v_barcode IS NULL AND lower(name) = lower(v_name))
    ORDER BY created_at
    LIMIT 1;

    IF v_product_id IS NULL THEN
      INSERT INTO public.auto_parts_products (
        name, description, category_id, sku, barcode, oem_code, manufacturer,
        subcategory, compatible_vehicle, unit, image_url, active,
        business_id, salon_id, branch_id, unit_price, cost_price,
        stock_quantity, reserved_quantity, min_stock
      )
      VALUES (
        v_name,
        NULLIF(p_values->>'description', ''),
        v_category_id,
        v_sku,
        v_barcode,
        NULLIF(p_values->>'oem_code', ''),
        NULLIF(p_values->>'manufacturer', ''),
        NULLIF(p_values->>'subcategory', ''),
        NULLIF(p_values->>'compatible_vehicle', ''),
        COALESCE(NULLIF(p_values->>'unit', ''), 'piece'),
        NULLIF(p_values->>'image_url', ''),
        COALESCE((p_values->>'active')::BOOLEAN, true),
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        0,
        0,
        0
      )
      RETURNING id INTO v_product_id;

      INSERT INTO public.auto_parts_product_inventory (
        business_id, product_id, stock_quantity, reserved_quantity, min_stock,
        cost_price, unit_price, active
      )
      SELECT b.id, v_product_id, 0, 0, 0, NULL, NULL, true
      FROM public.businesses b
      ON CONFLICT DO NOTHING;
    END IF;
  ELSE
    UPDATE public.auto_parts_products
    SET
      name = COALESCE(v_name, name),
      description = COALESCE(NULLIF(p_values->>'description', ''), description),
      category_id = COALESCE(v_category_id, category_id),
      sku = COALESCE(v_sku, sku),
      barcode = COALESCE(v_barcode, barcode),
      oem_code = COALESCE(NULLIF(p_values->>'oem_code', ''), oem_code),
      manufacturer = COALESCE(NULLIF(p_values->>'manufacturer', ''), manufacturer),
      subcategory = COALESCE(NULLIF(p_values->>'subcategory', ''), subcategory),
      compatible_vehicle = COALESCE(NULLIF(p_values->>'compatible_vehicle', ''), compatible_vehicle),
      unit = COALESCE(NULLIF(p_values->>'unit', ''), unit),
      image_url = COALESCE(NULLIF(p_values->>'image_url', ''), image_url),
      updated_at = now()
    WHERE id = v_product_id;
  END IF;

  INSERT INTO public.auto_parts_product_inventory (
    business_id, branch_id, product_id, stock_quantity, reserved_quantity, min_stock,
    cost_price, unit_price, max_stock, location, notes, active
  )
  VALUES (
    p_business_id,
    p_branch_id,
    v_product_id,
    COALESCE((p_values->>'stock_quantity')::NUMERIC, 0),
    COALESCE((p_values->>'reserved_quantity')::NUMERIC, 0),
    COALESCE((p_values->>'min_stock')::NUMERIC, 0),
    NULLIF(p_values->>'cost_price', '')::NUMERIC,
    NULLIF(p_values->>'unit_price', '')::NUMERIC,
    NULLIF(p_values->>'max_stock', '')::NUMERIC,
    NULLIF(p_values->>'location', ''),
    NULLIF(p_values->>'notes', ''),
    COALESCE((p_values->>'active')::BOOLEAN, true)
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_inventory_id;

  IF v_inventory_id IS NULL THEN
    UPDATE public.auto_parts_product_inventory
    SET
      cost_price = CASE WHEN p_values ? 'cost_price' THEN NULLIF(p_values->>'cost_price', '')::NUMERIC ELSE cost_price END,
      unit_price = CASE WHEN p_values ? 'unit_price' THEN NULLIF(p_values->>'unit_price', '')::NUMERIC ELSE unit_price END,
      stock_quantity = CASE WHEN p_values ? 'stock_quantity' THEN (p_values->>'stock_quantity')::NUMERIC ELSE stock_quantity END,
      reserved_quantity = CASE WHEN p_values ? 'reserved_quantity' THEN (p_values->>'reserved_quantity')::NUMERIC ELSE reserved_quantity END,
      min_stock = CASE WHEN p_values ? 'min_stock' THEN (p_values->>'min_stock')::NUMERIC ELSE min_stock END,
      max_stock = CASE WHEN p_values ? 'max_stock' THEN NULLIF(p_values->>'max_stock', '')::NUMERIC ELSE max_stock END,
      location = CASE WHEN p_values ? 'location' THEN NULLIF(p_values->>'location', '') ELSE location END,
      notes = CASE WHEN p_values ? 'notes' THEN NULLIF(p_values->>'notes', '') ELSE notes END,
      active = COALESCE((p_values->>'active')::BOOLEAN, active)
    WHERE business_id = p_business_id
      AND product_id = v_product_id
      AND ((p_branch_id IS NULL AND branch_id IS NULL) OR branch_id = p_branch_id);
  END IF;

  RETURN public.auto_parts_get_product(v_product_id, p_business_id);
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.upsert_auto_parts_product(UUID, UUID, JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_auto_parts_product(UUID, UUID, JSONB, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delete_auto_parts_product_for_business(
  p_product_id UUID,
  p_business_id UUID
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  UPDATE public.auto_parts_product_inventory
  SET active = false
  WHERE product_id = p_product_id
    AND business_id = p_business_id;

  RETURN jsonb_build_object('id', p_product_id, 'status', 'deactivated_for_business');
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.delete_auto_parts_product_for_business(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_auto_parts_product_for_business(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.record_auto_parts_stock_movement(
  p_business_id UUID,
  p_product_id UUID,
  p_type TEXT,
  p_quantity NUMERIC,
  p_unit_price NUMERIC DEFAULT NULL,
  p_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_movement_id UUID;
  v_creator UUID;
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  v_creator := COALESCE(p_created_by, current_setting('request.jwt.claims', true)::json->>'sub');
  INSERT INTO public.auto_parts_stock_movements (product_id, type, quantity, unit_price, reference, notes, business_id, branch_id, created_by)
  VALUES (p_product_id, p_type, p_quantity, p_unit_price, p_reference, p_notes, p_business_id, p_branch_id, v_creator)
  RETURNING id INTO v_movement_id;
  RETURN jsonb_build_object('id', v_movement_id);
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.record_auto_parts_stock_movement(UUID, UUID, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_auto_parts_stock_movement(UUID, UUID, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, UUID, UUID) TO authenticated, service_role;

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
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  SELECT staff_role INTO v_role
  FROM public.require_staff_permission(p_session_token, 'dashboard.view');

  SELECT COUNT(*) INTO v_total_products
  FROM public.auto_parts_products
  WHERE business_id = p_business_id;

  SELECT COUNT(*) INTO v_out_of_stock
  FROM public.auto_parts_products
  WHERE business_id = p_business_id
    AND active = true AND stock_quantity <= 0;

  SELECT COUNT(*) INTO v_low_stock
  FROM public.auto_parts_products
  WHERE business_id = p_business_id
    AND active = true AND stock_quantity > 0 AND stock_quantity <= min_stock;

  SELECT COALESCE(SUM(cost_price * stock_quantity), 0) INTO v_total_stock_value
  FROM public.auto_parts_products
  WHERE business_id = p_business_id;

  SELECT COUNT(*) INTO v_today_sales
  FROM public.auto_parts_sales
  WHERE business_id = p_business_id
    AND created_at >= v_day_start;

  SELECT COALESCE(SUM(total), 0) INTO v_month_sales
  FROM public.auto_parts_sales
  WHERE business_id = p_business_id
    AND created_at >= v_month_start;

  SELECT COUNT(*) INTO v_month_purchases
  FROM public.auto_parts_purchases
  WHERE business_id = p_business_id
    AND created_at >= v_month_start AND status = 'delivered';

  SELECT COUNT(*) INTO v_pending_orders
  FROM public.auto_parts_purchases
  WHERE business_id = p_business_id
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
$$;;

REVOKE EXECUTE ON FUNCTION public.auto_parts_dashboard_stats(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_parts_dashboard_stats(TEXT, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.update_auto_parts_purchase(
  p_id UUID,
  p_business_id UUID DEFAULT NULL,
  p_supplier_id UUID DEFAULT NULL,
  p_supplier_name TEXT DEFAULT NULL,
  p_reference_number TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_subtotal NUMERIC DEFAULT NULL,
  p_tax_amount NUMERIC DEFAULT NULL,
  p_total NUMERIC DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_items JSONB DEFAULT '[]'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_biz UUID;
  v_old_status TEXT;
  v_new_status TEXT;
  v_ref TEXT;
  v_now_delivered BOOLEAN := false;
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  SELECT business_id, status, reference_number
  INTO v_biz, v_old_status, v_ref
  FROM public.auto_parts_purchases WHERE id = p_id;

  IF v_biz IS NULL OR (p_business_id IS NOT NULL AND v_biz != p_business_id) THEN
    RETURN jsonb_build_object('error', 'Accès refusé');
  END IF;

  v_new_status := COALESCE(p_status, v_old_status);
  v_ref := COALESCE(p_reference_number, v_ref);

  -- Detect transition to 'delivered'
  IF v_old_status IS DISTINCT FROM 'delivered' AND v_new_status = 'delivered' THEN
    v_now_delivered := true;
  END IF;

  DELETE FROM public.auto_parts_purchase_items WHERE purchase_id = p_id;

  UPDATE public.auto_parts_purchases SET
    supplier_id      = COALESCE(p_supplier_id, supplier_id),
    supplier_name    = COALESCE(p_supplier_name, supplier_name),
    reference_number = v_ref,
    status           = v_new_status,
    subtotal         = COALESCE(p_subtotal, subtotal),
    tax_amount       = COALESCE(p_tax_amount, tax_amount),
    total            = COALESCE(p_total, total),
    notes            = COALESCE(p_notes, notes)
  WHERE id = p_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.auto_parts_purchase_items (purchase_id, product_id, product_name, quantity, unit_price, total_price, business_id)
    VALUES (
      p_id,
      (v_item->>'product_id')::UUID,
      v_item->>'product_name',
      (v_item->>'quantity')::NUMERIC,
      (v_item->>'unit_price')::NUMERIC,
      (v_item->>'quantity')::NUMERIC * (v_item->>'unit_price')::NUMERIC,
      v_biz
    );

    -- Create stock movement only when transitioning to 'delivered'
    IF v_now_delivered AND (v_item->>'product_id')::UUID IS NOT NULL THEN
      INSERT INTO public.auto_parts_stock_movements
        (product_id, type, quantity, unit_price, reference, business_id, created_by)
      VALUES (
        (v_item->>'product_id')::UUID,
        'in',
        (v_item->>'quantity')::NUMERIC,
        (v_item->>'unit_price')::NUMERIC,
        v_ref,
        v_biz,
        auth.uid()
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object('id', p_id, 'status', 'updated');
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.update_auto_parts_purchase(UUID, UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_auto_parts_purchase(UUID, UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, JSONB) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delete_auto_parts_purchase(p_id UUID, p_business_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_biz UUID;
  v_status TEXT;
  v_ref TEXT;
  v_item RECORD;
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  SELECT business_id, status, reference_number
  INTO v_biz, v_status, v_ref
  FROM public.auto_parts_purchases WHERE id = p_id;

  IF v_biz IS NULL OR (p_business_id IS NOT NULL AND v_biz != p_business_id) THEN
    RETURN jsonb_build_object('error', 'Accès refusé');
  END IF;

  -- Reverse stock movements if purchase was delivered
  IF v_status = 'delivered' THEN
    FOR v_item IN SELECT product_id, quantity, unit_price FROM public.auto_parts_purchase_items WHERE purchase_id = p_id
    LOOP
      IF v_item.product_id IS NOT NULL THEN
        INSERT INTO public.auto_parts_stock_movements
          (product_id, type, quantity, unit_price, reference, business_id, created_by)
        VALUES (
          v_item.product_id,
          'out',
          v_item.quantity,
          v_item.unit_price,
          'CANCEL-' || v_ref,
          v_biz,
          auth.uid()
        );
      END IF;
    END LOOP;
  END IF;

  DELETE FROM public.auto_parts_purchase_items WHERE purchase_id = p_id;
  DELETE FROM public.auto_parts_purchases WHERE id = p_id;
  RETURN jsonb_build_object('id', p_id, 'status', 'deleted');
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.delete_auto_parts_purchase(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_auto_parts_purchase(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_auto_parts_staff(
  p_business_id UUID,
  p_name TEXT,
  p_username TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_role TEXT DEFAULT 'cashier',
  p_pin_code TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.auto_parts_staff (business_id, name, username, email, phone, role, pin_code)
  VALUES (p_business_id, p_name, p_username, p_email, p_phone, p_role, p_pin_code)
  RETURNING id INTO v_id;
  RETURN (
    SELECT jsonb_build_object('id', id, 'name', name, 'role', role)
    FROM public.auto_parts_staff WHERE id = v_id
  );
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.create_auto_parts_staff(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_auto_parts_staff(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.issue_auto_parts_staff_session(
  p_staff_id UUID,
  p_business_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  v_token TEXT;
  v_hash TEXT;
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  UPDATE public.auto_parts_staff_sessions SET revoked_at = now()
  WHERE staff_id = p_staff_id AND revoked_at IS NULL;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_hash := encode(sha256(v_token::bytea), 'hex');

  INSERT INTO public.auto_parts_staff_sessions (staff_id, business_id, session_token_hash, expires_at)
  VALUES (p_staff_id, p_business_id, v_hash, now() + INTERVAL '12 hours');

  RETURN jsonb_build_object(
    'session_token', v_token,
    'expires_at', to_char(now() + INTERVAL '12 hours', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.issue_auto_parts_staff_session(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_auto_parts_staff_session(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.update_auto_parts_staff(
  p_id UUID,
  p_business_id UUID DEFAULT NULL,
  p_name TEXT DEFAULT NULL,
  p_username TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_role TEXT DEFAULT NULL,
  p_pin_code TEXT DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_biz UUID;
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  SELECT business_id INTO v_biz FROM public.auto_parts_staff WHERE id = p_id;
  IF v_biz IS NULL OR (p_business_id IS NOT NULL AND v_biz != p_business_id) THEN
    RETURN jsonb_build_object('error', 'Accès refusé');
  END IF;

  UPDATE public.auto_parts_staff SET
    name       = COALESCE(p_name, name),
    username   = CASE WHEN p_username IS NOT NULL THEN NULLIF(p_username, '') ELSE username END,
    email      = CASE WHEN p_email IS NOT NULL THEN NULLIF(p_email, '') ELSE email END,
    phone      = CASE WHEN p_phone IS NOT NULL THEN NULLIF(p_phone, '') ELSE phone END,
    role       = COALESCE(p_role, role),
    pin_code   = CASE WHEN p_pin_code IS NOT NULL THEN NULLIF(p_pin_code, '') ELSE pin_code END,
    is_active  = COALESCE(p_is_active, is_active),
    updated_at = now()
  WHERE id = p_id;
  RETURN jsonb_build_object('id', p_id, 'status', 'updated');
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.update_auto_parts_staff(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_auto_parts_staff(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delete_auto_parts_staff(p_id UUID, p_business_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_biz UUID;
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  SELECT business_id INTO v_biz FROM public.auto_parts_staff WHERE id = p_id;
  IF v_biz IS NULL OR (p_business_id IS NOT NULL AND v_biz != p_business_id) THEN
    RETURN jsonb_build_object('error', 'Accès refusé');
  END IF;

  DELETE FROM public.auto_parts_staff WHERE id = p_id;
  RETURN jsonb_build_object('id', p_id, 'status', 'deleted');
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.delete_auto_parts_staff(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_auto_parts_staff(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.auto_parts_get_sale(p_id UUID, p_business_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  SELECT to_jsonb(s) || jsonb_build_object('items',
    COALESCE((SELECT jsonb_agg(to_jsonb(si) ORDER BY si.id)
      FROM public.auto_parts_sale_items si WHERE si.sale_id = s.id), '[]'::jsonb)
  ) INTO v_result
  FROM public.auto_parts_sales s
  WHERE s.id = p_id
    AND (s.business_id = p_business_id OR p_business_id IS NULL);
  RETURN v_result;
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.auto_parts_get_sale(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_parts_get_sale(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.auto_parts_list_categories(p_business_id UUID, p_branch_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.sort_order, c.name), '[]'::jsonb)
  FROM public.auto_parts_categories c
  WHERE (c.business_id = p_business_id OR c.business_id IS NULL)
    AND (p_branch_id IS NULL OR c.branch_id IS NULL OR c.branch_id = p_branch_id);
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.auto_parts_list_categories(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_parts_list_categories(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.auto_parts_list_suppliers(p_business_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.name), '[]'::jsonb)
    FROM public.auto_parts_suppliers s
    WHERE s.business_id = p_business_id OR s.business_id IS NULL
  );
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.auto_parts_list_suppliers(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_parts_list_suppliers(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.auto_parts_list_clients(p_business_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.name), '[]'::jsonb)
    FROM public.auto_parts_clients c
    WHERE c.business_id = p_business_id
  );
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.auto_parts_list_clients(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_parts_list_clients(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.auto_parts_search_clients(p_business_id UUID, p_query TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.name), '[]'::jsonb)
    FROM public.auto_parts_clients c
    WHERE c.business_id = p_business_id AND c.name ILIKE '%' || p_query || '%'
    LIMIT 20
  );
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.auto_parts_search_clients(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_parts_search_clients(UUID, TEXT) TO authenticated, service_role;

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
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

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
$$;;

REVOKE EXECUTE ON FUNCTION public.auto_parts_create_sale(TEXT, UUID, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, UUID, TEXT, UUID, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_parts_create_sale(TEXT, UUID, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, UUID, TEXT, UUID, JSONB, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.auto_parts_list_staff(p_business_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(to_jsonb(st) ORDER BY st.name), '[]'::jsonb)
    FROM public.auto_parts_staff st
    WHERE st.business_id = p_business_id AND st.is_active = true
  );
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.auto_parts_list_staff(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_parts_list_staff(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.auto_parts_list_stock_movements(p_business_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

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
$$;;

REVOKE EXECUTE ON FUNCTION public.auto_parts_list_stock_movements(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_parts_list_stock_movements(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.auto_parts_list_sales(
  p_business_id UUID,
  p_branch_id   UUID DEFAULT NULL,
  p_staff_id    UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_result JSONB;
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(
    to_jsonb(s) || jsonb_build_object('items',
      COALESCE((SELECT jsonb_agg(to_jsonb(si) ORDER BY si.id)
        FROM public.auto_parts_sale_items si WHERE si.sale_id = s.id), '[]'::jsonb)
    )
    ORDER BY s.created_at DESC
  ), '[]'::jsonb) INTO v_result
  FROM public.auto_parts_sales s
  WHERE s.business_id = p_business_id
    AND (p_branch_id IS NULL OR s.branch_id IS NULL OR s.branch_id = p_branch_id)
    AND (p_staff_id IS NULL OR s.staff_id = p_staff_id)
  LIMIT 100;
  RETURN v_result;
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.auto_parts_list_sales(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_parts_list_sales(UUID, UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.auto_parts_list_return_requests(
  p_business_id UUID,
  p_staff_id    UUID DEFAULT NULL,
  p_status      TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(
      to_jsonb(r) || jsonb_build_object(
        'items', COALESCE(
          (SELECT jsonb_agg(to_jsonb(i) ORDER BY i.created_at)
           FROM public.auto_parts_return_request_items i WHERE i.request_id = r.id),
          '[]'::jsonb
        )
      )
      ORDER BY r.created_at DESC
    ), '[]'::jsonb)
    FROM public.auto_parts_return_requests r
    WHERE r.business_id = p_business_id
      AND (p_staff_id IS NULL OR r.staff_id = p_staff_id)
      AND (p_status IS NULL OR r.status = p_status)
    LIMIT 200
  );
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.auto_parts_list_return_requests(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_parts_list_return_requests(UUID, UUID, TEXT) TO authenticated, service_role;

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
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

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
$$;;

REVOKE EXECUTE ON FUNCTION public.auto_parts_monthly_sales(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_parts_monthly_sales(UUID, UUID) TO authenticated, service_role;

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
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

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
$$;;

REVOKE EXECUTE ON FUNCTION public.process_auto_parts_return(UUID, UUID, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_auto_parts_return(UUID, UUID, JSONB, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.auto_parts_list_returns(p_business_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(
      to_jsonb(sm) || jsonb_build_object(
        'product', CASE WHEN sm.product_id IS NOT NULL THEN
          (SELECT to_jsonb(pr) FROM (SELECT p.id, p.name FROM public.auto_parts_products p WHERE p.id = sm.product_id) pr)
        ELSE NULL END,
        'sale', CASE WHEN sm.reference IS NOT NULL THEN
          (SELECT to_jsonb(s) FROM (
            SELECT s.id, s.invoice_number, s.total, s.refund_status, s.refunded_at, s.client_name
            FROM public.auto_parts_sales s WHERE s.invoice_number = sm.reference
          ) s)
        ELSE NULL END
      )
      ORDER BY sm.created_at DESC
    ), '[]'::jsonb)
    FROM public.auto_parts_stock_movements sm
    WHERE sm.business_id = p_business_id AND sm.type = 'return'
    LIMIT 200
  );
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.auto_parts_list_returns(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_parts_list_returns(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_employee_dashboard_stats(
  p_session_token TEXT,
  p_branch_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp_id       UUID;
  v_branch_id    UUID;
  v_emp_name     TEXT;
  v_emp_role     TEXT;
  v_now          TIMESTAMPTZ := now();
  v_today_start  TIMESTAMPTZ;
  v_week_start   TIMESTAMPTZ;
  v_month_start  TIMESTAMPTZ;
  v_tz           TEXT := 'America/Port-au-Prince';
  v_today_sales  JSONB;
  v_day          JSONB;
  v_week         JSONB;
  v_month        JSONB;
  
  -- Extensions
  v_evolution    JSONB := '[]'::jsonb;
  v_top_products JSONB := '[]'::jsonb;
  v_out_of_stock JSONB := '[]'::jsonb;
  v_category_dist JSONB := '[]'::jsonb;
BEGIN
  IF p_branch_id IS NOT NULL AND NOT public.is_super_admin() AND (SELECT business_id FROM public.business_branches WHERE id = p_branch_id) IS DISTINCT FROM public.current_user_business_id() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  -- Resolve employee session
  SELECT s.employee_id, s.branch_id, s.employee_name, s.employee_role
    INTO v_emp_id, v_branch_id, v_emp_name, v_emp_role
  FROM public.resolve_employee_session(p_session_token) s;

  IF v_emp_id IS NULL THEN
    RAISE EXCEPTION 'Session employé invalide ou expirée' USING ERRCODE = '28000';
  END IF;

  IF p_branch_id IS NOT NULL AND p_branch_id <> v_branch_id THEN
    RAISE EXCEPTION 'Accès non autorisé à cette branche' USING ERRCODE = '42501';
  END IF;

  v_today_start := date_trunc('day',    v_now AT TIME ZONE v_tz) AT TIME ZONE v_tz;
  v_week_start  := date_trunc('week',   v_now AT TIME ZONE v_tz) AT TIME ZONE v_tz;
  v_month_start := date_trunc('month',  v_now AT TIME ZONE v_tz) AT TIME ZONE v_tz;

  -- ── Today's detailed sales (net of returns) ──
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',             s.id,
      'sale_number',    s.sale_number,
      'total_amount',   s.total_amount - COALESCE(s.return_amount, 0),
      'payment_method', s.payment_method,
      'customer_name',  s.customer_name,
      'created_at',     s.created_at
    ) ORDER BY s.created_at DESC
  ), '[]'::jsonb)
  INTO v_today_sales
  FROM public.salon_sales s
  WHERE s.branch_id   = v_branch_id
    AND s.cashier_id  = v_emp_id
    AND s.created_at >= v_today_start
    AND s.created_at <  (v_today_start + INTERVAL '1 day')
    AND s.refund_status IS DISTINCT FROM 'full';

  -- ── Day aggregate (net of returns) ──
  SELECT jsonb_build_object(
    'revenue',  COALESCE(SUM(s.total_amount - COALESCE(s.return_amount, 0)), 0),
    'tickets',  COUNT(*)
  )
  INTO v_day
  FROM public.salon_sales s
  WHERE s.branch_id   = v_branch_id
    AND s.cashier_id  = v_emp_id
    AND s.created_at >= v_today_start
    AND s.created_at <  (v_today_start + INTERVAL '1 day')
    AND s.refund_status IS DISTINCT FROM 'full';

  -- ── Week aggregate (today + last 6, net of returns) ──
  SELECT jsonb_build_object(
    'revenue',  COALESCE(SUM(s.total_amount - COALESCE(s.return_amount, 0)), 0),
    'tickets',  COUNT(*)
  )
  INTO v_week
  FROM public.salon_sales s
  WHERE s.branch_id   = v_branch_id
    AND s.cashier_id  = v_emp_id
    AND s.created_at >= (v_today_start - INTERVAL '6 days')
    AND s.created_at <  (v_today_start + INTERVAL '1 day')
    AND s.refund_status IS DISTINCT FROM 'full';

  -- ── Month aggregate (net of returns) ──
  SELECT jsonb_build_object(
    'revenue',  COALESCE(SUM(s.total_amount - COALESCE(s.return_amount, 0)), 0),
    'tickets',  COUNT(*)
  )
  INTO v_month
  FROM public.salon_sales s
  WHERE s.branch_id   = v_branch_id
    AND s.cashier_id  = v_emp_id
    AND s.created_at >= (v_today_start - INTERVAL '29 days')
    AND s.created_at <  (v_today_start + INTERVAL '1 day')
    AND s.refund_status IS DISTINCT FROM 'full';


  -- ── NEW: Evolution des ventes (7 days) ──
  WITH last_7_days AS (
    SELECT generate_series((v_today_start - INTERVAL '6 days'), v_today_start, '1 day'::interval) AS d
  ),
  daily_sales AS (
    SELECT 
      date_trunc('day', s.created_at AT TIME ZONE v_tz) AT TIME ZONE v_tz AS sale_date,
      SUM(s.total_amount - COALESCE(s.return_amount, 0)) AS revenue
    FROM public.salon_sales s
    WHERE s.branch_id = v_branch_id
      AND (v_emp_role = 'manager' OR s.cashier_id = v_emp_id)
      AND s.created_at >= (v_today_start - INTERVAL '6 days')
      AND s.created_at < (v_today_start + INTERVAL '1 day')
      AND s.refund_status IS DISTINCT FROM 'full'
    GROUP BY 1
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'label', to_char(ld.d, 'Dy'),
      'total', COALESCE(ds.revenue, 0)
    ) ORDER BY ld.d
  ), '[]'::jsonb)
  INTO v_evolution
  FROM last_7_days ld
  LEFT JOIN daily_sales ds ON ld.d = ds.sale_date;

  -- ── NEW: Top Produits (30 days) ──
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'name', COALESCE(sp.name, ss.name, 'Article Inconnu'),
      'quantity', COALESCE(t.total_qty, 0)
    ) ORDER BY t.total_qty DESC
  ), '[]'::jsonb)
  INTO v_top_products
  FROM (
    SELECT 
      si.product_id,
      si.service_id,
      SUM(si.quantity) AS total_qty
    FROM public.salon_sale_items si
    JOIN public.salon_sales s ON si.sale_id = s.id
    WHERE s.branch_id = v_branch_id
      AND (v_emp_role = 'manager' OR s.cashier_id = v_emp_id)
      AND s.created_at >= (v_today_start - INTERVAL '29 days')
      AND s.refund_status IS DISTINCT FROM 'full'
    GROUP BY si.product_id, si.service_id
    ORDER BY total_qty DESC
    LIMIT 4
  ) t
  LEFT JOIN public.salon_products sp ON t.product_id = sp.id
  LEFT JOIN public.salon_services ss ON t.service_id = ss.id;

  -- ── NEW: Ruptures de Stock ──
  IF v_emp_role = 'manager' THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'name', p.name
      )
    ), '[]'::jsonb)
    INTO v_out_of_stock
    FROM public.salon_products p
    WHERE p.branch_id = v_branch_id
      AND p.is_active = true
      AND p.quantity_in_stock <= p.reorder_level
    LIMIT 5;
  END IF;

  -- ── NEW: Distribution par Catégorie (30 days) ──
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'name', t.category,
      'value', t.total_val
    )
  ), '[]'::jsonb)
  INTO v_category_dist
  FROM (
    SELECT 
      CASE 
        WHEN si.product_id IS NOT NULL THEN 'Produits'
        WHEN si.service_id IS NOT NULL THEN 'Services'
        ELSE 'Autres'
      END AS category,
      SUM(si.total_price) AS total_val
    FROM public.salon_sale_items si
    JOIN public.salon_sales s ON si.sale_id = s.id
    WHERE s.branch_id = v_branch_id
      AND (v_emp_role = 'manager' OR s.cashier_id = v_emp_id)
      AND s.created_at >= (v_today_start - INTERVAL '29 days')
      AND s.refund_status IS DISTINCT FROM 'full'
    GROUP BY 1
    HAVING SUM(si.total_price) > 0
  ) t;

  RETURN jsonb_build_object(
    'employee_id',    v_emp_id,
    'branch_id',      v_branch_id,
    'employee_name',  v_emp_name,
    'employee_role',  v_emp_role,
    'today_sales',    v_today_sales,
    'day',            v_day,
    'week',           v_week,
    'month',          v_month,
    'evolution',      v_evolution,
    'top_products',   v_top_products,
    'out_of_stock',   v_out_of_stock,
    'category_dist',  v_category_dist
  );
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.get_employee_dashboard_stats(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_employee_dashboard_stats(TEXT, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.process_salon_return(
  p_business_id UUID,
  p_branch_id UUID,
  p_sale_id UUID,
  p_items JSONB,
  p_reason TEXT DEFAULT NULL,
  p_cashier_id UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sale RECORD;
  v_item JSONB;
  v_product_id UUID;
  v_product_name TEXT;
  v_quantity INTEGER;
  v_unit_price NUMERIC;
  v_total_return_amount NUMERIC := 0;
  v_total_sold_qty INTEGER := 0;
  v_total_return_qty INTEGER := 0;
  v_staff_id UUID;
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  -- Validate sale exists and belongs to this business
  SELECT * INTO v_sale
  FROM public.salon_sales
  WHERE id = p_sale_id AND business_id = p_business_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Vente introuvable');
  END IF;

  IF v_sale.branch_id <> p_branch_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'La vente n''appartient pas à cette branche');
  END IF;

  v_staff_id := COALESCE(p_cashier_id, auth.uid());

  -- Process each returned item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_product_name := v_item->>'product_name';
    v_quantity := (v_item->>'quantity')::INTEGER;
    v_unit_price := (v_item->>'unit_price')::NUMERIC;
    v_total_return_qty := v_total_return_qty + v_quantity;
    v_total_return_amount := v_total_return_amount + (v_quantity * v_unit_price);

    -- Record stock movement (positive delta = stock goes back in)
    INSERT INTO public.salon_stock_movements
      (business_id, branch_id, product_id, movement_type, quantity_delta, reason, reference_id, created_by)
    VALUES
      (p_business_id, p_branch_id, v_product_id, 'return', v_quantity, COALESCE(p_reason, 'Retour client'), p_sale_id, v_staff_id);

    -- Restore product stock
    UPDATE public.salon_products
    SET quantity_in_stock = quantity_in_stock + v_quantity,
        updated_at = now()
    WHERE id = v_product_id AND branch_id = p_branch_id;

    -- Mark returned quantity on sale item
    UPDATE public.salon_sale_items
    SET returned_quantity = returned_quantity + v_quantity
    WHERE sale_id = p_sale_id AND product_id = v_product_id;
  END LOOP;

  -- Compute total sold quantity for this sale
  SELECT COALESCE(SUM(quantity), 0) INTO v_total_sold_qty
  FROM public.salon_sale_items
  WHERE sale_id = p_sale_id;

  -- Update refund_status and return_amount
  IF v_total_return_qty >= v_total_sold_qty THEN
    UPDATE public.salon_sales
    SET refund_status = 'full',
        refunded_at = now(),
        return_amount = return_amount + v_total_return_amount
    WHERE id = p_sale_id;
  ELSE
    UPDATE public.salon_sales
    SET refund_status = 'partial',
        refunded_at = now(),
        return_amount = return_amount + v_total_return_amount
    WHERE id = p_sale_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'sale_id', p_sale_id,
    'refund_status', CASE WHEN v_total_return_qty >= v_total_sold_qty THEN 'full' ELSE 'partial' END,
    'return_amount', v_total_return_amount
  );
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.process_salon_return(UUID, UUID, UUID, JSONB, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_salon_return(UUID, UUID, UUID, JSONB, TEXT, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.salon_list_returns(
  p_business_id UUID,
  p_branch_id UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(
      to_jsonb(sm) || jsonb_build_object(
        'product', CASE WHEN sm.product_id IS NOT NULL THEN
          (SELECT to_jsonb(pr) FROM (SELECT p.id, p.name FROM public.salon_products p WHERE p.id = sm.product_id) pr)
        ELSE NULL END,
        'sale', CASE WHEN sm.reference_id IS NOT NULL THEN
          (SELECT to_jsonb(s) FROM (
            SELECT s.id, s.sale_number, s.total_amount, s.refund_status, s.refunded_at, s.customer_name
            FROM public.salon_sales s WHERE s.id = sm.reference_id
          ) s)
        ELSE NULL END
      )
      ORDER BY sm.created_at DESC
    ), '[]'::jsonb)
    FROM public.salon_stock_movements sm
    WHERE sm.business_id = p_business_id
      AND sm.movement_type = 'return'
      AND (p_branch_id IS NULL OR sm.branch_id = p_branch_id)
    LIMIT 200
  );
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.salon_list_returns(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salon_list_returns(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_subscription_payment(
  p_business_id UUID,
  p_plan_id UUID,
  p_amount NUMERIC,
  p_currency_code VARCHAR DEFAULT 'HTG',
  p_payment_method VARCHAR DEFAULT 'moncash',
  p_transaction_reference TEXT DEFAULT '',
  p_status VARCHAR DEFAULT 'pending'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.subscription_payments (
    business_id,
    plan_id,
    amount,
    currency_code,
    payment_method,
    transaction_reference,
    status
  ) VALUES (
    p_business_id,
    p_plan_id,
    p_amount,
    p_currency_code,
    p_payment_method,
    p_transaction_reference,
    p_status
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.create_subscription_payment(UUID, UUID, NUMERIC, VARCHAR, VARCHAR, TEXT, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_subscription_payment(UUID, UUID, NUMERIC, VARCHAR, VARCHAR, TEXT, VARCHAR) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_moncash_subscription_payment(
  p_business_id UUID,
  p_plan_id UUID,
  p_subscription_payment_id UUID DEFAULT NULL,
  p_billing_cycle VARCHAR DEFAULT 'monthly',
  p_duration_months INT DEFAULT 1,
  p_payment_provider VARCHAR DEFAULT 'moncash',
  p_amount NUMERIC DEFAULT 0,
  p_currency_code VARCHAR DEFAULT 'HTG',
  p_order_id TEXT DEFAULT '',
  p_status VARCHAR DEFAULT 'redirected',
  p_redirect_url TEXT DEFAULT NULL,
  p_gateway_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.moncash_subscription_payments (
    business_id,
    plan_id,
    subscription_payment_id,
    billing_cycle,
    duration_months,
    payment_provider,
    amount,
    currency_code,
    order_id,
    status,
    redirect_url,
    gateway_payload
  ) VALUES (
    p_business_id,
    p_plan_id,
    p_subscription_payment_id,
    p_billing_cycle,
    p_duration_months,
    p_payment_provider,
    p_amount,
    p_currency_code,
    p_order_id,
    p_status,
    p_redirect_url,
    p_gateway_payload
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.create_moncash_subscription_payment(UUID, UUID, UUID, VARCHAR, INT, VARCHAR, NUMERIC, VARCHAR, TEXT, VARCHAR, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_moncash_subscription_payment(UUID, UUID, UUID, VARCHAR, INT, VARCHAR, NUMERIC, VARCHAR, TEXT, VARCHAR, TEXT, JSONB) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.extend_or_create_subscription(
  p_business_id UUID,
  p_plan_id UUID,
  p_duration_months INTEGER DEFAULT 1,
  p_amount NUMERIC DEFAULT 0,
  p_currency_code VARCHAR DEFAULT 'HTG',
  p_billing_cycle VARCHAR DEFAULT 'monthly',
  p_order_id TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription_id UUID;
  v_end_date DATE;
  v_today DATE := CURRENT_DATE;
  v_existing_status TEXT;
  v_existing_end_date DATE;
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  -- Lock the existing subscription row (if any) so concurrent calls see
  -- the updated end_date after the first call commits.
  SELECT id, status, end_date
  INTO v_subscription_id, v_existing_status, v_existing_end_date
  FROM public.business_subscriptions
  WHERE business_id = p_business_id
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  -- Compute the new end_date
  IF v_subscription_id IS NOT NULL AND v_existing_status = 'active' AND v_existing_end_date IS NOT NULL AND v_existing_end_date >= v_today THEN
    v_end_date := v_existing_end_date + (p_duration_months || ' months')::INTERVAL;
  ELSE
    v_end_date := v_today + (p_duration_months || ' months')::INTERVAL;
  END IF;

  IF v_subscription_id IS NOT NULL THEN
    UPDATE public.business_subscriptions
    SET
      plan_id = p_plan_id,
      start_date = v_today,
      end_date = v_end_date,
      status = 'active',
      billing_cycle = p_billing_cycle,
      auto_renew = true,
      price_snapshot = p_amount,
      currency_code = p_currency_code,
      notes = COALESCE(p_notes, notes),
      updated_at = now()
    WHERE id = v_subscription_id;
  ELSE
    INSERT INTO public.business_subscriptions (
      business_id, plan_id, start_date, end_date, status,
      billing_cycle, auto_renew, price_snapshot, currency_code, notes
    ) VALUES (
      p_business_id, p_plan_id, v_today, v_end_date, 'active',
      p_billing_cycle, true, p_amount, p_currency_code, p_notes
    )
    RETURNING id INTO v_subscription_id;
  END IF;

  UPDATE public.businesses
  SET plan_id = p_plan_id, status = 'active'
  WHERE id = p_business_id;

  RETURN jsonb_build_object('success', true, 'subscription_id', v_subscription_id, 'end_date', v_end_date::TEXT);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un abonnement actif existe déjà pour cet établissement');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.extend_or_create_subscription(UUID, UUID, INTEGER, NUMERIC, VARCHAR, VARCHAR, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.extend_or_create_subscription(UUID, UUID, INTEGER, NUMERIC, VARCHAR, VARCHAR, TEXT, TEXT) TO authenticated, service_role;

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
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

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
$$;;

REVOKE EXECUTE ON FUNCTION public.auto_parts_weekly_trend(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_parts_weekly_trend(UUID, INT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.auto_parts_client_summary(
  p_business_id UUID
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

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
$$;;

REVOKE EXECUTE ON FUNCTION public.auto_parts_client_summary(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_parts_client_summary(UUID) TO authenticated, service_role;

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
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

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
$$;;

REVOKE EXECUTE ON FUNCTION public.auto_parts_cashier_monthly_progress(UUID, UUID, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_parts_cashier_monthly_progress(UUID, UUID, NUMERIC) TO authenticated, service_role;

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
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

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
$$;;

REVOKE EXECUTE ON FUNCTION public.auto_parts_write_audit_log(UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_parts_write_audit_log(UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.upsert_auto_parts_business_settings(
  p_business_id UUID,
  p_company_name TEXT DEFAULT '',
  p_logo_url TEXT DEFAULT NULL,
  p_slogan TEXT DEFAULT NULL,
  p_whatsapp TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_website TEXT DEFAULT NULL,
  p_nif TEXT DEFAULT NULL,
  p_patente TEXT DEFAULT NULL,
  p_rc TEXT DEFAULT NULL,
  p_bank_name TEXT DEFAULT NULL,
  p_bank_account TEXT DEFAULT NULL,
  p_invoice_prefix TEXT DEFAULT 'INV-',
  p_quote_prefix TEXT DEFAULT 'DEV-',
  p_delivery_note_prefix TEXT DEFAULT 'BL-',
  p_receipt_footer TEXT DEFAULT NULL,
  p_receipt_header TEXT DEFAULT NULL,
  p_low_stock_threshold INTEGER DEFAULT 5,
  p_session_token TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  IF NOT public.auto_parts_has_permission(p_session_token, 'products.manage', p_business_id) THEN
    RETURN jsonb_build_object('error', 'Accès refusé');
  END IF;

  INSERT INTO public.auto_parts_business_settings
    (business_id, company_name, logo_url, slogan, whatsapp, address, phone, email, website,
     nif, patente, rc, bank_name, bank_account,
     invoice_prefix, quote_prefix, delivery_note_prefix,
     receipt_footer, receipt_header, low_stock_threshold)
  VALUES
    (p_business_id, p_company_name, p_logo_url, p_slogan, p_whatsapp, p_address, p_phone, p_email, p_website,
     p_nif, p_patente, p_rc, p_bank_name, p_bank_account,
     p_invoice_prefix, p_quote_prefix, p_delivery_note_prefix,
     p_receipt_footer, p_receipt_header, p_low_stock_threshold)
  ON CONFLICT (business_id) DO UPDATE SET
    company_name          = EXCLUDED.company_name,
    logo_url              = EXCLUDED.logo_url,
    slogan                = EXCLUDED.slogan,
    whatsapp              = EXCLUDED.whatsapp,
    address               = EXCLUDED.address,
    phone                 = EXCLUDED.phone,
    email                 = EXCLUDED.email,
    website               = EXCLUDED.website,
    nif                   = EXCLUDED.nif,
    patente               = EXCLUDED.patente,
    rc                    = EXCLUDED.rc,
    bank_name             = EXCLUDED.bank_name,
    bank_account          = EXCLUDED.bank_account,
    invoice_prefix        = EXCLUDED.invoice_prefix,
    quote_prefix          = EXCLUDED.quote_prefix,
    delivery_note_prefix  = EXCLUDED.delivery_note_prefix,
    receipt_footer        = EXCLUDED.receipt_footer,
    receipt_header        = EXCLUDED.receipt_header,
    low_stock_threshold   = EXCLUDED.low_stock_threshold
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'status', 'saved');
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.upsert_auto_parts_business_settings(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_auto_parts_business_settings(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT) TO authenticated, service_role;

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
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

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
$$;;

REVOKE EXECUTE ON FUNCTION public.create_auto_parts_quote(UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC, NUMERIC, NUMERIC, DATE, TEXT, TEXT, TEXT, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_auto_parts_quote(UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC, NUMERIC, NUMERIC, DATE, TEXT, TEXT, TEXT, UUID, JSONB) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.list_auto_parts_quotes(p_business_id UUID, p_branch_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE(jsonb_agg(
    to_jsonb(q) || jsonb_build_object('items',
      COALESCE((SELECT jsonb_agg(to_jsonb(qi) ORDER BY qi.id)
        FROM public.auto_parts_quote_items qi WHERE qi.quote_id = q.id), '[]'::jsonb)
    )
    ORDER BY q.created_at DESC
  ), '[]'::jsonb)
  FROM public.auto_parts_quotes q
  WHERE q.business_id = p_business_id
    AND (p_branch_id IS NULL OR q.branch_id IS NULL OR q.branch_id = p_branch_id)
  LIMIT 100;
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.list_auto_parts_quotes(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_auto_parts_quotes(UUID, UUID) TO authenticated, service_role;

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
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

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
$$;;

REVOKE EXECUTE ON FUNCTION public.create_auto_parts_delivery_note(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_auto_parts_delivery_note(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, JSONB) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.list_auto_parts_delivery_notes(p_business_id UUID, p_branch_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE(jsonb_agg(
    to_jsonb(dn) || jsonb_build_object('items',
      COALESCE((SELECT jsonb_agg(to_jsonb(dni) ORDER BY dni.id)
        FROM public.auto_parts_delivery_note_items dni WHERE dni.delivery_note_id = dn.id), '[]'::jsonb)
    )
    ORDER BY dn.created_at DESC
  ), '[]'::jsonb)
  FROM public.auto_parts_delivery_notes dn
  WHERE dn.business_id = p_business_id
    AND (p_branch_id IS NULL OR dn.branch_id IS NULL OR dn.branch_id = p_branch_id)
  LIMIT 100;
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.list_auto_parts_delivery_notes(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_auto_parts_delivery_notes(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.auto_parts_list_purchases(p_business_id UUID, p_branch_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE(jsonb_agg(
    to_jsonb(p) || jsonb_build_object('items',
      COALESCE((SELECT jsonb_agg(to_jsonb(pi) ORDER BY pi.id)
        FROM public.auto_parts_purchase_items pi WHERE pi.purchase_id = p.id), '[]'::jsonb)
    )
    ORDER BY p.created_at DESC
  ), '[]'::jsonb)
  FROM public.auto_parts_purchases p
  WHERE p.business_id = p_business_id
    AND (p_branch_id IS NULL OR p.branch_id IS NULL OR p.branch_id = p_branch_id)
  LIMIT 100;
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.auto_parts_list_purchases(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_parts_list_purchases(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.list_auto_parts_stock_movements(p_business_id UUID, p_branch_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

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
    AND (p_branch_id IS NULL OR sm.branch_id IS NULL OR sm.branch_id = p_branch_id)
  LIMIT 200;
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.list_auto_parts_stock_movements(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_auto_parts_stock_movements(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.list_auto_parts_branches(p_business_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE(
    (SELECT jsonb_agg(to_jsonb(bb) ORDER BY bb.name)
     FROM public.business_branches bb
     WHERE bb.business_id = p_business_id AND bb.active = true),
    '[]'::jsonb
  );
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.list_auto_parts_branches(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_auto_parts_branches(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_auto_parts_delivery_note(p_id UUID, p_business_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_result JSONB;
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  SELECT to_jsonb(dn) || jsonb_build_object('items',
    COALESCE((SELECT jsonb_agg(to_jsonb(dni) ORDER BY dni.id)
      FROM public.auto_parts_delivery_note_items dni WHERE dni.delivery_note_id = dn.id), '[]'::jsonb)
  ) INTO v_result
  FROM public.auto_parts_delivery_notes dn
  WHERE dn.id = p_id AND (dn.business_id = p_business_id OR p_business_id IS NULL);
  RETURN v_result;
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.get_auto_parts_delivery_note(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_auto_parts_delivery_note(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.update_auto_parts_delivery_note(
  p_id UUID,
  p_business_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_items JSONB DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_biz UUID; v_old_status TEXT; v_delivered_at TIMESTAMPTZ;
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  SELECT business_id, status INTO v_biz, v_old_status FROM public.auto_parts_delivery_notes WHERE id = p_id;
  IF v_biz IS NULL OR (p_business_id IS NOT NULL AND v_biz != p_business_id) THEN
    RETURN jsonb_build_object('error', 'Accès refusé');
  END IF;

  IF p_status = 'delivered' AND v_old_status != 'delivered' THEN v_delivered_at := now(); END IF;

  UPDATE public.auto_parts_delivery_notes SET
    status = COALESCE(p_status, status),
    notes = COALESCE(p_notes, notes),
    delivered_at = COALESCE(v_delivered_at, delivered_at)
  WHERE id = p_id;

  IF p_items IS NOT NULL THEN
    DELETE FROM public.auto_parts_delivery_note_items WHERE delivery_note_id = p_id;
    INSERT INTO public.auto_parts_delivery_note_items
      (delivery_note_id, product_id, product_name, quantity, unit, business_id)
    SELECT p_id, (v_item->>'product_id')::UUID, v_item->>'product_name',
           (v_item->>'quantity')::NUMERIC, COALESCE(v_item->>'unit', 'pce'), v_biz
    FROM jsonb_array_elements(p_items) v_item;
  END IF;

  RETURN jsonb_build_object('id', p_id, 'status', 'updated');
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.update_auto_parts_delivery_note(UUID, UUID, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_auto_parts_delivery_note(UUID, UUID, TEXT, TEXT, JSONB) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delete_auto_parts_delivery_note(p_id UUID, p_business_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_biz UUID;
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  SELECT business_id INTO v_biz FROM public.auto_parts_delivery_notes WHERE id = p_id;
  IF v_biz IS NULL OR (p_business_id IS NOT NULL AND v_biz != p_business_id) THEN
    RETURN jsonb_build_object('error', 'Accès refusé');
  END IF;
  DELETE FROM public.auto_parts_delivery_note_items WHERE delivery_note_id = p_id;
  DELETE FROM public.auto_parts_delivery_notes WHERE id = p_id;
  RETURN jsonb_build_object('id', p_id, 'status', 'deleted');
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.delete_auto_parts_delivery_note(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_auto_parts_delivery_note(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_auto_parts_return_request(
  p_business_id UUID,
  p_sale_id     UUID,
  p_staff_id    UUID DEFAULT NULL,
  p_reason      TEXT DEFAULT NULL,
  p_items       JSONB DEFAULT '[]'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sale        RECORD;
  v_request_id  UUID;
  v_staff_name  TEXT;
  v_item        JSONB;
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  -- Validate sale
  SELECT * INTO v_sale
  FROM public.auto_parts_sales
  WHERE id = p_sale_id AND business_id = p_business_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Vente introuvable');
  END IF;

  IF v_sale.status = 'RETURNED' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cette facture a déjà été retournée intégralement');
  END IF;

  -- Resolve staff name (try auto_parts_staff first, fallback to profiles for admins/owners)
  SELECT name INTO v_staff_name FROM public.auto_parts_staff WHERE id = p_staff_id;
  IF v_staff_name IS NULL AND p_staff_id IS NOT NULL THEN
    SELECT COALESCE(full_name, email) INTO v_staff_name FROM public.profiles WHERE id = p_staff_id;
  END IF;

  -- Create request
  INSERT INTO public.auto_parts_return_requests
    (business_id, branch_id, sale_id, invoice_number, staff_id, staff_name, reason, status)
  VALUES
    (p_business_id, v_sale.branch_id, p_sale_id, v_sale.invoice_number, p_staff_id, v_staff_name, p_reason, 'EN_ATTENTE')
  RETURNING id INTO v_request_id;

  -- Insert items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.auto_parts_return_request_items
      (request_id, product_id, product_name, quantity, unit_price)
    VALUES (
      v_request_id,
      NULLIF(v_item->>'product_id', '')::UUID,
      v_item->>'product_name',
      (v_item->>'quantity')::NUMERIC,
      COALESCE((v_item->>'unit_price')::NUMERIC, 0)
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_request_id,
    'status', 'EN_ATTENTE'
  );
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.create_auto_parts_return_request(UUID, UUID, UUID, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_auto_parts_return_request(UUID, UUID, UUID, TEXT, JSONB) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.auto_parts_cashier_dashboard(
  p_business_id UUID,
  p_staff_id    UUID,
  p_branch_id   UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_day_start    TIMESTAMPTZ := date_trunc('day',   now());
  v_week_start   TIMESTAMPTZ := date_trunc('week',  now());
  v_month_start  TIMESTAMPTZ := date_trunc('month', now());

  -- Transaction counts
  v_sales_today  INT     := 0;
  v_sales_week   INT     := 0;
  v_sales_month  INT     := 0;

  -- Revenue (CA)
  v_rev_today    NUMERIC := 0;
  v_rev_week     NUMERIC := 0;
  v_rev_month    NUMERIC := 0;

  -- Product quantities sold
  v_items_today  NUMERIC := 0;
  v_items_week   NUMERIC := 0;
  v_items_month  NUMERIC := 0;
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  -- ── Transaction counts & revenue ─────────────────────────────────────────
  SELECT
    COUNT(*)                                                      AS cnt_today,
    COALESCE(SUM(total), 0)                                       AS rev_today
  INTO v_sales_today, v_rev_today
  FROM public.auto_parts_sales
  WHERE business_id = p_business_id
    AND staff_id    = p_staff_id
    AND status      = 'ACTIVE'
    AND created_at >= v_day_start
    AND (p_branch_id IS NULL OR branch_id IS NULL OR branch_id = p_branch_id);

  SELECT
    COUNT(*),
    COALESCE(SUM(total), 0)
  INTO v_sales_week, v_rev_week
  FROM public.auto_parts_sales
  WHERE business_id = p_business_id
    AND staff_id    = p_staff_id
    AND status      = 'ACTIVE'
    AND created_at >= v_week_start
    AND (p_branch_id IS NULL OR branch_id IS NULL OR branch_id = p_branch_id);

  SELECT
    COUNT(*),
    COALESCE(SUM(total), 0)
  INTO v_sales_month, v_rev_month
  FROM public.auto_parts_sales
  WHERE business_id = p_business_id
    AND staff_id    = p_staff_id
    AND status      = 'ACTIVE'
    AND created_at >= v_month_start
    AND (p_branch_id IS NULL OR branch_id IS NULL OR branch_id = p_branch_id);

  -- ── Product quantities sold ───────────────────────────────────────────────
  SELECT COALESCE(SUM(si.quantity), 0) INTO v_items_today
  FROM public.auto_parts_sales s
  JOIN public.auto_parts_sale_items si ON si.sale_id = s.id
  WHERE s.business_id = p_business_id AND s.staff_id = p_staff_id
    AND s.status = 'ACTIVE' AND s.created_at >= v_day_start
    AND (p_branch_id IS NULL OR s.branch_id IS NULL OR s.branch_id = p_branch_id);

  SELECT COALESCE(SUM(si.quantity), 0) INTO v_items_week
  FROM public.auto_parts_sales s
  JOIN public.auto_parts_sale_items si ON si.sale_id = s.id
  WHERE s.business_id = p_business_id AND s.staff_id = p_staff_id
    AND s.status = 'ACTIVE' AND s.created_at >= v_week_start
    AND (p_branch_id IS NULL OR s.branch_id IS NULL OR s.branch_id = p_branch_id);

  SELECT COALESCE(SUM(si.quantity), 0) INTO v_items_month
  FROM public.auto_parts_sales s
  JOIN public.auto_parts_sale_items si ON si.sale_id = s.id
  WHERE s.business_id = p_business_id AND s.staff_id = p_staff_id
    AND s.status = 'ACTIVE' AND s.created_at >= v_month_start
    AND (p_branch_id IS NULL OR s.branch_id IS NULL OR s.branch_id = p_branch_id);

  RETURN jsonb_build_object(
    -- Counts
    'salesToday',    v_sales_today,
    'salesWeek',     v_sales_week,
    'salesMonth',    v_sales_month,
    -- Invoice counts (same as sales in this model)
    'invoicesToday', v_sales_today,
    'invoicesWeek',  v_sales_week,
    'invoicesMonth', v_sales_month,
    -- Revenue (CA)
    'revenueToday',  v_rev_today,
    'revenueWeek',   v_rev_week,
    'revenueMonth',  v_rev_month,
    -- Products sold
    'itemsSoldToday',  v_items_today,
    'itemsSoldWeek',   v_items_week,
    'itemsSoldMonth',  v_items_month
  );
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.auto_parts_cashier_dashboard(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_parts_cashier_dashboard(UUID, UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.auto_parts_admin_cashier_stats(
  p_business_id UUID,
  p_branch_id   UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_day_start   TIMESTAMPTZ := date_trunc('day',   now());
  v_week_start  TIMESTAMPTZ := date_trunc('week',  now());
  v_month_start TIMESTAMPTZ := date_trunc('month', now());
  v_global      JSONB;
  v_by_cashier  JSONB;
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  -- ── Global stats (revenue + invoice counts, ACTIVE only) ─────────────────
  SELECT jsonb_build_object(
    'salesToday',    COALESCE(SUM(CASE WHEN s.created_at >= v_day_start   THEN s.total ELSE 0 END), 0),
    'salesWeek',     COALESCE(SUM(CASE WHEN s.created_at >= v_week_start  THEN s.total ELSE 0 END), 0),
    'salesMonth',    COALESCE(SUM(CASE WHEN s.created_at >= v_month_start THEN s.total ELSE 0 END), 0),
    'invoicesToday', COUNT(CASE WHEN s.created_at >= v_day_start   THEN 1 END),
    'invoicesWeek',  COUNT(CASE WHEN s.created_at >= v_week_start  THEN 1 END),
    'invoicesMonth', COUNT(CASE WHEN s.created_at >= v_month_start THEN 1 END)
  ) INTO v_global
  FROM public.auto_parts_sales s
  WHERE s.business_id = p_business_id
    AND s.status = 'ACTIVE'
    AND (p_branch_id IS NULL OR s.branch_id IS NULL OR s.branch_id = p_branch_id);

  -- ── Per-cashier stats (revenue + counts + products sold, ACTIVE only) ────
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'staffId',        COALESCE(agg.staff_id::TEXT, 'unknown'),
      'staffName',      COALESCE(agg.staff_name, 'Non assigné'),
      -- Revenue
      'salesToday',     agg.rev_today,
      'salesWeek',      agg.rev_week,
      'salesMonth',     agg.rev_month,
      -- Counts
      'invoicesToday',  agg.cnt_today,
      'invoicesWeek',   agg.cnt_week,
      'invoicesTotal',  agg.cnt_month,
      -- Products sold this month
      'itemsSoldMonth', COALESCE(qty.items_month, 0)
    )
    ORDER BY agg.rev_month DESC
  ), '[]'::jsonb) INTO v_by_cashier
  FROM (
    SELECT
      s.staff_id,
      s.staff_name,
      SUM(CASE WHEN s.created_at >= v_day_start   THEN s.total ELSE 0 END) AS rev_today,
      SUM(CASE WHEN s.created_at >= v_week_start  THEN s.total ELSE 0 END) AS rev_week,
      SUM(CASE WHEN s.created_at >= v_month_start THEN s.total ELSE 0 END) AS rev_month,
      COUNT(CASE WHEN s.created_at >= v_day_start   THEN 1 END)            AS cnt_today,
      COUNT(CASE WHEN s.created_at >= v_week_start  THEN 1 END)            AS cnt_week,
      COUNT(CASE WHEN s.created_at >= v_month_start THEN 1 END)            AS cnt_month
    FROM public.auto_parts_sales s
    WHERE s.business_id = p_business_id
      AND s.status = 'ACTIVE'
      AND (p_branch_id IS NULL OR s.branch_id IS NULL OR s.branch_id = p_branch_id)
    GROUP BY s.staff_id, s.staff_name
  ) agg
  LEFT JOIN LATERAL (
    -- Products sold this month per cashier
    SELECT COALESCE(SUM(si.quantity), 0) AS items_month
    FROM public.auto_parts_sales s2
    JOIN public.auto_parts_sale_items si ON si.sale_id = s2.id
    WHERE s2.business_id = p_business_id
      AND s2.staff_id IS NOT DISTINCT FROM agg.staff_id
      AND s2.staff_name IS NOT DISTINCT FROM agg.staff_name
      AND s2.status      = 'ACTIVE'
      AND s2.created_at >= v_month_start
      AND (p_branch_id IS NULL OR s2.branch_id IS NULL OR s2.branch_id = p_branch_id)
  ) qty ON true;

  RETURN jsonb_build_object('global', v_global, 'byCashier', v_by_cashier);
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.auto_parts_admin_cashier_stats(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_parts_admin_cashier_stats(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.generate_school_matricule(p_business_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next_val BIGINT;
  v_year     TEXT;
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  v_year := TO_CHAR(NOW(), 'YYYY');

  -- Upsert: insert if missing, then increment atomically
  INSERT INTO public.school_matricule_seq (business_id, last_value)
  VALUES (p_business_id, 1)
  ON CONFLICT (business_id)
  DO UPDATE SET last_value = school_matricule_seq.last_value + 1
  RETURNING last_value INTO v_next_val;

  RETURN v_year || '-' || LPAD(v_next_val::TEXT, 6, '0');
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.generate_school_matricule(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_school_matricule(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_school_staff(
    p_business_id UUID,
    p_name TEXT,
    p_role TEXT,
    p_email TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_pin_code TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_id UUID;
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

    INSERT INTO public.school_staff_members (
        business_id, name, role, email, phone, pin_code
    ) VALUES (
        p_business_id, p_name, p_role, p_email, p_phone, p_pin_code
    ) RETURNING id INTO v_new_id;
    
    RETURN v_new_id;
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.create_school_staff(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_school_staff(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.update_school_staff(
    p_id UUID,
    p_business_id UUID,
    p_name TEXT DEFAULT NULL,
    p_role TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_pin_code TEXT DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

    UPDATE public.school_staff_members
    SET
        name = COALESCE(p_name, name),
        role = COALESCE(p_role, role),
        email = COALESCE(p_email, email),
        phone = COALESCE(p_phone, phone),
        pin_code = COALESCE(p_pin_code, pin_code),
        is_active = COALESCE(p_is_active, is_active),
        updated_at = NOW()
    WHERE id = p_id AND (p_business_id IS NULL OR business_id = p_business_id);
    
    RETURN FOUND;
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.update_school_staff(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_school_staff(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delete_school_staff(p_id UUID, p_business_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

    DELETE FROM public.school_staff_members
    WHERE id = p_id AND (p_business_id IS NULL OR business_id = p_business_id);
    
    RETURN FOUND;
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.delete_school_staff(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_school_staff(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_employee_dashboard_data(
  p_session_token TEXT,
  p_branch_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_today_start TIMESTAMPTZ;
  v_today_end   TIMESTAMPTZ;
  v_week_start  TIMESTAMPTZ;
  v_sales_today NUMERIC;
  v_sales_count_today INT;
  v_week_sales  JSONB;
BEGIN
  IF p_branch_id IS NOT NULL AND NOT public.is_super_admin() AND (SELECT business_id FROM public.business_branches WHERE id = p_branch_id) IS DISTINCT FROM public.current_user_business_id() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  -- 1. Validate the session token
  SELECT *
  INTO v_session
  FROM public.resolve_employee_session(p_session_token);

  IF v_session.employee_id IS NULL THEN
    RAISE EXCEPTION 'Session employé invalide ou expirée' USING ERRCODE = '28000';
  END IF;

  -- 2. Ensure the branch matches
  IF p_branch_id <> v_session.branch_id THEN
    RAISE EXCEPTION 'Accès non autorisé à cette branche' USING ERRCODE = '42501';
  END IF;

  -- 3. Compute time ranges (UTC)
  v_today_start := date_trunc('day', NOW() AT TIME ZONE 'UTC');
  v_today_end   := v_today_start + INTERVAL '1 day' - INTERVAL '1 millisecond';
  v_week_start  := v_today_start - INTERVAL '6 days';

  -- 4. Today's sales (filtered by employee role)
  IF v_session.employee_role IN ('manager', 'salon_admin') THEN
    -- Managers see all branch sales
    SELECT
      COALESCE(SUM(total_amount - COALESCE(return_amount, 0)), 0),
      COUNT(*)
    INTO v_sales_today, v_sales_count_today
    FROM public.salon_sales
    WHERE branch_id = p_branch_id
      AND created_at BETWEEN v_today_start AND v_today_end
      AND payment_status = 'completed';
  ELSE
    -- Regular employees only see their own sales
    SELECT
      COALESCE(SUM(total_amount - COALESCE(return_amount, 0)), 0),
      COUNT(*)
    INTO v_sales_today, v_sales_count_today
    FROM public.salon_sales
    WHERE branch_id = p_branch_id
      AND created_at BETWEEN v_today_start AND v_today_end
      AND payment_status = 'completed'
      AND (cashier_id = v_session.employee_id OR employee_id = v_session.employee_id);
  END IF;

  -- 5. Weekly sales (last 7 days)
  IF v_session.employee_role IN ('manager', 'salon_admin') THEN
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'created_at', s.created_at,
          'total_amount', s.total_amount,
          'return_amount', COALESCE(s.return_amount, 0)
        )
        ORDER BY s.created_at
      ),
      '[]'::jsonb
    )
    INTO v_week_sales
    FROM public.salon_sales s
    WHERE s.branch_id = p_branch_id
      AND s.created_at BETWEEN v_week_start AND v_today_end
      AND s.payment_status = 'completed';
  ELSE
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'created_at', s.created_at,
          'total_amount', s.total_amount,
          'return_amount', COALESCE(s.return_amount, 0)
        )
        ORDER BY s.created_at
      ),
      '[]'::jsonb
    )
    INTO v_week_sales
    FROM public.salon_sales s
    WHERE s.branch_id = p_branch_id
      AND s.created_at BETWEEN v_week_start AND v_today_end
      AND s.payment_status = 'completed'
      AND (s.cashier_id = v_session.employee_id OR s.employee_id = v_session.employee_id);
  END IF;

  RETURN jsonb_build_object(
    'today_revenue', v_sales_today,
    'today_count',   v_sales_count_today,
    'week_sales',    COALESCE(v_week_sales, '[]'::jsonb),
    'employee_id',   v_session.employee_id,
    'employee_role', v_session.employee_role,
    'branch_id',     v_session.branch_id,
    'business_id',   v_session.business_id
  );
END;
$$;;

REVOKE EXECUTE ON FUNCTION public.get_employee_dashboard_data(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_employee_dashboard_data(TEXT, UUID) TO authenticated, service_role;


-- Manual Plpgsql Rewrite for school_list_staff
CREATE OR REPLACE FUNCTION public.school_list_staff(p_business_id UUID)
RETURNS SETOF public.school_staff_members
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT * FROM public.school_staff_members
  WHERE business_id = p_business_id
  ORDER BY name ASC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.school_list_staff(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.school_list_staff(UUID) TO authenticated, service_role;

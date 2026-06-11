-- ════════════════════════════════════════════════════════════════════════════
-- WESD AUTO PARTS — Fix data isolation (multi-tenant security)
-- Adds p_business_id to SECURITY DEFINER RPCs that were missing it.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. auto_parts_get_product — was missing business_id filter ───
DROP FUNCTION IF EXISTS public.auto_parts_get_product(UUID);
CREATE OR REPLACE FUNCTION public.auto_parts_get_product(p_id UUID, p_business_id UUID DEFAULT NULL)
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
  WHERE p.id = p_id
    AND (p.business_id = p_business_id OR p.business_id IS NULL OR p_business_id IS NULL);
  RETURN v_result;
END;
$$;

-- ─── 2. auto_parts_get_sale — was missing business_id filter ───
DROP FUNCTION IF EXISTS public.auto_parts_get_sale(UUID);
CREATE OR REPLACE FUNCTION public.auto_parts_get_sale(p_id UUID, p_business_id UUID DEFAULT NULL)
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
  WHERE s.id = p_id
    AND (s.business_id = p_business_id OR p_business_id IS NULL);
  RETURN v_result;
END;
$$;

-- ─── 3. auto_parts_search_clients — was missing business_id filter ───
DROP FUNCTION IF EXISTS public.auto_parts_search_clients(TEXT);
CREATE OR REPLACE FUNCTION public.auto_parts_search_clients(p_query TEXT, p_business_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.name), '[]'::jsonb)
    FROM public.auto_parts_clients c
    WHERE c.name ILIKE '%' || p_query || '%'
      AND (c.business_id = p_business_id OR p_business_id IS NULL)
    LIMIT 20
  );
END;
$$;

-- ─── 4. update_auto_parts_purchase — was missing business_id filter ───
DROP FUNCTION IF EXISTS public.update_auto_parts_purchase(UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, JSONB);
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
BEGIN
  SELECT business_id INTO v_biz FROM public.auto_parts_purchases WHERE id = p_id;
  IF v_biz IS NULL OR (p_business_id IS NOT NULL AND v_biz != p_business_id) THEN
    RETURN jsonb_build_object('error', 'Accès refusé');
  END IF;

  DELETE FROM public.auto_parts_purchase_items WHERE purchase_id = p_id;

  UPDATE public.auto_parts_purchases SET
    supplier_id      = COALESCE(p_supplier_id, supplier_id),
    supplier_name    = COALESCE(p_supplier_name, supplier_name),
    reference_number = COALESCE(p_reference_number, reference_number),
    status           = COALESCE(p_status, status),
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
  END LOOP;

  RETURN jsonb_build_object('id', p_id, 'status', 'updated');
END;
$$;

-- ─── 5. delete_auto_parts_purchase — was missing business_id filter ───
DROP FUNCTION IF EXISTS public.delete_auto_parts_purchase(UUID);
CREATE OR REPLACE FUNCTION public.delete_auto_parts_purchase(p_id UUID, p_business_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_biz UUID;
BEGIN
  SELECT business_id INTO v_biz FROM public.auto_parts_purchases WHERE id = p_id;
  IF v_biz IS NULL OR (p_business_id IS NOT NULL AND v_biz != p_business_id) THEN
    RETURN jsonb_build_object('error', 'Accès refusé');
  END IF;

  DELETE FROM public.auto_parts_purchase_items WHERE purchase_id = p_id;
  DELETE FROM public.auto_parts_purchases WHERE id = p_id;
  RETURN jsonb_build_object('id', p_id, 'status', 'deleted');
END;
$$;

-- ─── 6. update_auto_parts_staff — was missing business_id filter ───
DROP FUNCTION IF EXISTS public.update_auto_parts_staff(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN);
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
$$;

-- ─── 7. delete_auto_parts_staff — was missing business_id filter ───
DROP FUNCTION IF EXISTS public.delete_auto_parts_staff(UUID);
CREATE OR REPLACE FUNCTION public.delete_auto_parts_staff(p_id UUID, p_business_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_biz UUID;
BEGIN
  SELECT business_id INTO v_biz FROM public.auto_parts_staff WHERE id = p_id;
  IF v_biz IS NULL OR (p_business_id IS NOT NULL AND v_biz != p_business_id) THEN
    RETURN jsonb_build_object('error', 'Accès refusé');
  END IF;

  DELETE FROM public.auto_parts_staff WHERE id = p_id;
  RETURN jsonb_build_object('id', p_id, 'status', 'deleted');
END;
$$;

-- ─── 8. Record stock movement — set created_by properly ───
CREATE OR REPLACE FUNCTION public.record_auto_parts_stock_movement(
  p_business_id UUID,
  p_product_id UUID,
  p_type TEXT,
  p_quantity NUMERIC,
  p_unit_price NUMERIC DEFAULT NULL,
  p_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_movement_id UUID;
  v_creator UUID;
BEGIN
  v_creator := COALESCE(p_created_by, auth.uid());
  INSERT INTO public.auto_parts_stock_movements (product_id, type, quantity, unit_price, reference, notes, business_id, created_by)
  VALUES (p_product_id, p_type, p_quantity, p_unit_price, p_reference, p_notes, p_business_id, v_creator)
  RETURNING id INTO v_movement_id;
  RETURN jsonb_build_object('id', v_movement_id);
END;
$$;

DO $$ BEGIN RAISE NOTICE 'Data isolation fixes applied successfully'; END $$;

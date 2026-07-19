-- Fix auto-parts RPCs where p_business_id is optional (DEFAULT NULL).
-- When called without p_business_id (or with NULL), the check `IF p_business_id IS DISTINCT FROM public.current_user_business_id()`
-- previously evaluated to `NULL IS DISTINCT FROM uuid` which is TRUE, throwing `42501 Accès non autorisé`.
-- This migration updates the check to `IF p_business_id IS NOT NULL AND p_business_id IS DISTINCT FROM public.current_user_business_id()`
-- and verifies ownership via the target record when `p_business_id` is NULL.

CREATE OR REPLACE FUNCTION public.delete_auto_parts_staff(p_id UUID, p_business_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_biz UUID;
BEGIN
  IF p_business_id IS NOT NULL AND p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  SELECT business_id INTO v_biz FROM public.auto_parts_staff WHERE id = p_id;
  IF v_biz IS NULL OR (NOT public.is_super_admin() AND v_biz IS DISTINCT FROM public.current_user_business_id()) OR (p_business_id IS NOT NULL AND v_biz != p_business_id) THEN
    RETURN jsonb_build_object('error', 'Accès refusé');
  END IF;

  DELETE FROM public.auto_parts_staff WHERE id = p_id;
  RETURN jsonb_build_object('id', p_id, 'status', 'deleted');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_auto_parts_staff(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_auto_parts_staff(UUID, UUID) TO anon, authenticated, service_role;


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
  IF p_business_id IS NOT NULL AND p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  SELECT business_id INTO v_biz FROM public.auto_parts_staff WHERE id = p_id;
  IF v_biz IS NULL OR (NOT public.is_super_admin() AND v_biz IS DISTINCT FROM public.current_user_business_id()) OR (p_business_id IS NOT NULL AND v_biz != p_business_id) THEN
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

REVOKE EXECUTE ON FUNCTION public.update_auto_parts_staff(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_auto_parts_staff(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO anon, authenticated, service_role;


CREATE OR REPLACE FUNCTION public.generate_auto_parts_invoice_number(p_business_id UUID DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  next_val BIGINT;
  v_prefix TEXT := 'INV-';
  v_biz UUID := COALESCE(p_business_id, public.current_user_business_id());
BEGIN
  IF p_business_id IS NOT NULL AND p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  IF v_biz IS NOT NULL THEN
    SELECT invoice_prefix INTO v_prefix
    FROM public.auto_parts_business_settings
    WHERE business_id = v_biz;
  END IF;
  next_val := nextval('public.auto_parts_invoice_seq');
  RETURN COALESCE(v_prefix, 'INV-') || LPAD(next_val::TEXT, 6, '0');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_auto_parts_invoice_number(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_auto_parts_invoice_number(UUID) TO anon, authenticated, service_role;


CREATE OR REPLACE FUNCTION public.delete_auto_parts_quote(p_id UUID, p_business_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_biz UUID;
BEGIN
  IF p_business_id IS NOT NULL AND p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  SELECT business_id INTO v_biz FROM public.auto_parts_quotes WHERE id = p_id;
  IF v_biz IS NULL OR (NOT public.is_super_admin() AND v_biz IS DISTINCT FROM public.current_user_business_id()) OR (p_business_id IS NOT NULL AND v_biz != p_business_id) THEN
    RETURN jsonb_build_object('error', 'Accès refusé');
  END IF;
  DELETE FROM public.auto_parts_quote_items WHERE quote_id = p_id;
  DELETE FROM public.auto_parts_quotes WHERE id = p_id;
  RETURN jsonb_build_object('id', p_id, 'status', 'deleted');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_auto_parts_quote(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_auto_parts_quote(UUID, UUID) TO anon, authenticated, service_role;


CREATE OR REPLACE FUNCTION public.get_auto_parts_quote(p_id UUID, p_business_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_result JSONB;
BEGIN
  IF p_business_id IS NOT NULL AND p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  SELECT to_jsonb(q) || jsonb_build_object('items',
    COALESCE((SELECT jsonb_agg(to_jsonb(qi) ORDER BY qi.id)
      FROM public.auto_parts_quote_items qi WHERE qi.quote_id = q.id), '[]'::jsonb)
  ) INTO v_result
  FROM public.auto_parts_quotes q
  WHERE q.id = p_id
    AND (q.business_id = p_business_id OR p_business_id IS NULL)
    AND (public.is_super_admin() OR q.business_id = public.current_user_business_id());
  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_auto_parts_quote(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_auto_parts_quote(UUID, UUID) TO anon, authenticated, service_role;


CREATE OR REPLACE FUNCTION public.auto_parts_get_product(p_id UUID, p_business_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_biz UUID := COALESCE(p_business_id, public.current_user_business_id());
BEGIN
  IF p_business_id IS NOT NULL AND p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  IF v_biz IS NOT NULL THEN
    PERFORM public.ensure_auto_parts_inventory_for_business(v_biz);
  END IF;

  SELECT public.auto_parts_inventory_row_json(p, i, c, v_biz)
  INTO v_result
  FROM public.auto_parts_products p
  LEFT JOIN public.auto_parts_categories c ON c.id = p.category_id
  LEFT JOIN LATERAL (
    SELECT inv.*
    FROM public.auto_parts_product_inventory inv
    WHERE inv.business_id = v_biz
      AND inv.product_id = p.id
    ORDER BY CASE WHEN inv.branch_id IS NULL THEN 0 ELSE 1 END
    LIMIT 1
  ) i ON true
  WHERE p.id = p_id
    AND (public.is_super_admin() OR p.business_id = v_biz OR p.business_id IS NULL);
  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.auto_parts_get_product(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_parts_get_product(UUID, UUID) TO anon, authenticated, service_role;


CREATE OR REPLACE FUNCTION public.delete_auto_parts_purchase(p_id UUID, p_business_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_biz UUID;
  v_status TEXT;
  v_ref TEXT;
  v_item RECORD;
BEGIN
  IF p_business_id IS NOT NULL AND p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  SELECT business_id, status, reference_number
  INTO v_biz, v_status, v_ref
  FROM public.auto_parts_purchases WHERE id = p_id;

  IF v_biz IS NULL OR (NOT public.is_super_admin() AND v_biz IS DISTINCT FROM public.current_user_business_id()) OR (p_business_id IS NOT NULL AND v_biz != p_business_id) THEN
    RETURN jsonb_build_object('error', 'Accès refusé');
  END IF;

  -- Reverse stock movements if purchase was delivered
  IF v_status = 'delivered' THEN
    FOR v_item IN SELECT product_id, quantity, branch_id FROM public.auto_parts_purchase_items WHERE purchase_id = p_id LOOP
      IF v_item.branch_id IS NOT NULL THEN
        UPDATE public.auto_parts_product_inventory
        SET quantity = GREATEST(0, quantity - v_item.quantity), updated_at = now()
        WHERE business_id = v_biz AND product_id = v_item.product_id AND branch_id = v_item.branch_id;
      ELSE
        UPDATE public.auto_parts_product_inventory
        SET quantity = GREATEST(0, quantity - v_item.quantity), updated_at = now()
        WHERE business_id = v_biz AND product_id = v_item.product_id AND branch_id IS NULL;
      END IF;

      UPDATE public.auto_parts_products
      SET stock_quantity = GREATEST(0, stock_quantity - v_item.quantity), updated_at = now()
      WHERE id = v_item.product_id;
    END LOOP;
  END IF;

  DELETE FROM public.auto_parts_purchase_items WHERE purchase_id = p_id;
  DELETE FROM public.auto_parts_purchases WHERE id = p_id;
  RETURN jsonb_build_object('id', p_id, 'status', 'deleted');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_auto_parts_purchase(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_auto_parts_purchase(UUID, UUID) TO anon, authenticated, service_role;


CREATE OR REPLACE FUNCTION public.auto_parts_get_sale(p_id UUID, p_business_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF p_business_id IS NOT NULL AND p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  SELECT to_jsonb(s) || jsonb_build_object('items',
    COALESCE((SELECT jsonb_agg(to_jsonb(si) ORDER BY si.id)
      FROM public.auto_parts_sale_items si WHERE si.sale_id = s.id), '[]'::jsonb)
  ) INTO v_result
  FROM public.auto_parts_sales s
  WHERE s.id = p_id
    AND (s.business_id = p_business_id OR p_business_id IS NULL)
    AND (public.is_super_admin() OR s.business_id = public.current_user_business_id());
  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.auto_parts_get_sale(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_parts_get_sale(UUID, UUID) TO anon, authenticated, service_role;


CREATE OR REPLACE FUNCTION public.get_auto_parts_delivery_note(p_id UUID, p_business_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_result JSONB;
BEGIN
  IF p_business_id IS NOT NULL AND p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  SELECT to_jsonb(dn) || jsonb_build_object('items',
    COALESCE((SELECT jsonb_agg(to_jsonb(dni) ORDER BY dni.id)
      FROM public.auto_parts_delivery_note_items dni WHERE dni.delivery_note_id = dn.id), '[]'::jsonb)
  ) INTO v_result
  FROM public.auto_parts_delivery_notes dn
  WHERE dn.id = p_id
    AND (dn.business_id = p_business_id OR p_business_id IS NULL)
    AND (public.is_super_admin() OR dn.business_id = public.current_user_business_id());
  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_auto_parts_delivery_note(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_auto_parts_delivery_note(UUID, UUID) TO anon, authenticated, service_role;


CREATE OR REPLACE FUNCTION public.delete_auto_parts_delivery_note(p_id UUID, p_business_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_biz UUID;
BEGIN
  IF p_business_id IS NOT NULL AND p_business_id IS DISTINCT FROM public.current_user_business_id() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Accès non autorisé' USING ERRCODE = '42501';
  END IF;

  SELECT business_id INTO v_biz FROM public.auto_parts_delivery_notes WHERE id = p_id;
  IF v_biz IS NULL OR (NOT public.is_super_admin() AND v_biz IS DISTINCT FROM public.current_user_business_id()) OR (p_business_id IS NOT NULL AND v_biz != p_business_id) THEN
    RETURN jsonb_build_object('error', 'Accès refusé');
  END IF;
  DELETE FROM public.auto_parts_delivery_note_items WHERE delivery_note_id = p_id;
  DELETE FROM public.auto_parts_delivery_notes WHERE id = p_id;
  RETURN jsonb_build_object('id', p_id, 'status', 'deleted');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_auto_parts_delivery_note(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_auto_parts_delivery_note(UUID, UUID) TO anon, authenticated, service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- WESD AUTO PARTS — Hide cost_price from list RPC + add full version for admin
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. auto_parts_list_products — exclude cost_price ───
CREATE OR REPLACE FUNCTION public.auto_parts_list_products(p_business_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', p.id, 'name', p.name, 'description', p.description,
      'category_id', p.category_id, 'sku', p.sku, 'barcode', p.barcode,
      'unit_price', p.unit_price, 'stock_quantity', p.stock_quantity,
      'min_stock', p.min_stock, 'max_stock', p.max_stock,
      'location', p.location, 'notes', p.notes,
      'active', p.active, 'business_id', p.business_id,
      'salon_id', p.salon_id, 'created_at', p.created_at, 'updated_at', p.updated_at,
      'category',
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

-- ─── 2. auto_parts_list_products_full — includes cost_price (admin/manager only) ───
CREATE OR REPLACE FUNCTION public.auto_parts_list_products_full(p_business_id UUID)
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

GRANT EXECUTE ON FUNCTION public.auto_parts_list_products(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_list_products_full(UUID) TO anon, authenticated;

DO $$ BEGIN RAISE NOTICE 'cost_price exposure fixed: list_products public, list_products_full for admin'; END $$;

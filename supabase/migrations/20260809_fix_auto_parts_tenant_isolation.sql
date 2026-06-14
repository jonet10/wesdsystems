-- Fix tenant isolation across auto parts RPCs
-- Keeps global data for categories and suppliers (business_id IS NULL)
-- Enforces strict isolation for clients and sales

-- 1. Clients (Strictly isolated)
DROP FUNCTION IF EXISTS public.auto_parts_list_clients(UUID);
CREATE OR REPLACE FUNCTION public.auto_parts_list_clients(p_business_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.name), '[]'::jsonb)
    FROM public.auto_parts_clients c
    WHERE c.business_id = p_business_id
  );
END;
$$;

DROP FUNCTION IF EXISTS public.auto_parts_search_clients(TEXT);
DROP FUNCTION IF EXISTS public.auto_parts_search_clients(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.auto_parts_search_clients(p_business_id UUID, p_query TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.name), '[]'::jsonb)
    FROM public.auto_parts_clients c
    WHERE c.business_id = p_business_id AND c.name ILIKE '%' || p_query || '%'
    LIMIT 20
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.auto_parts_search_clients(UUID, TEXT) TO anon, authenticated;

-- 2. Categories (Restore global categories visibility)
DROP FUNCTION IF EXISTS public.auto_parts_list_categories(UUID);
CREATE OR REPLACE FUNCTION public.auto_parts_list_categories(p_business_id UUID, p_branch_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.sort_order, c.name), '[]'::jsonb)
  FROM public.auto_parts_categories c
  WHERE (c.business_id = p_business_id OR c.business_id IS NULL)
    AND (p_branch_id IS NULL OR c.branch_id IS NULL OR c.branch_id = p_branch_id);
END;
$$;

-- 3. Sales (Strictly isolated)
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
    AND (p_branch_id IS NULL OR s.branch_id IS NULL OR s.branch_id = p_branch_id)
  LIMIT 100;
  RETURN v_result;
END;
$$;

-- 4. Suppliers (Restore global suppliers visibility)
DROP FUNCTION IF EXISTS public.auto_parts_list_suppliers(UUID);
CREATE OR REPLACE FUNCTION public.auto_parts_list_suppliers(p_business_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.name), '[]'::jsonb)
    FROM public.auto_parts_suppliers s
    WHERE s.business_id = p_business_id OR s.business_id IS NULL
  );
END;
$$;

-- 5. Category Repartition Dashboard (Restore global categories visibility)
DROP FUNCTION IF EXISTS public.auto_parts_category_repartition(UUID);
CREATE OR REPLACE FUNCTION public.auto_parts_category_repartition(p_business_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('name', COALESCE(c.name, 'Sans catégorie'), 'count', v.cnt)), '[]'::jsonb)
    FROM (
      SELECT p.category_id, COUNT(*) AS cnt
      FROM public.auto_parts_products p
      WHERE p.business_id = p_business_id
      GROUP BY p.category_id
    ) v
    LEFT JOIN public.auto_parts_categories c ON c.id = v.category_id
  );
END;
$$;

-- Clean up invalid clients
DELETE FROM public.auto_parts_clients WHERE business_id IS NULL;
NOTIFY pgrst, 'reload schema';

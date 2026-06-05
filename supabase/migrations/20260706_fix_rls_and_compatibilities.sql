-- ════════════════════════════════════════════════════════════════════════════
-- WESD AUTO PARTS — Fix RLS policies & clean compatibilities seed
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. FIX RLS FOR CATEGORIES (allow NULL business_id for global seed data) ───
DROP POLICY IF EXISTS auto_parts_categories_tenant_guard ON public.auto_parts_categories;
CREATE POLICY auto_parts_categories_tenant_guard ON public.auto_parts_categories
  FOR ALL
  USING (public.is_super_admin() OR COALESCE(salon_id, business_id) IS NULL OR COALESCE(salon_id, business_id) = public.current_user_business_id())
  WITH CHECK (public.is_super_admin() OR COALESCE(salon_id, business_id) IS NULL OR COALESCE(salon_id, business_id) = public.current_user_business_id());

-- ─── 2. FIX RLS FOR PRODUCTS (allow NULL business_id for global seed data) ───
DROP POLICY IF EXISTS auto_parts_products_tenant_guard ON public.auto_parts_products;
CREATE POLICY auto_parts_products_tenant_guard ON public.auto_parts_products
  FOR ALL
  USING (public.is_super_admin() OR COALESCE(salon_id, business_id) IS NULL OR COALESCE(salon_id, business_id) = public.current_user_business_id())
  WITH CHECK (public.is_super_admin() OR COALESCE(salon_id, business_id) IS NULL OR COALESCE(salon_id, business_id) = public.current_user_business_id());

-- ─── 3. FIX RLS FOR SUPPLIERS (allow NULL business_id) ───
DROP POLICY IF EXISTS auto_parts_suppliers_tenant_guard ON public.auto_parts_suppliers;
CREATE POLICY auto_parts_suppliers_tenant_guard ON public.auto_parts_suppliers
  FOR ALL
  USING (public.is_super_admin() OR COALESCE(salon_id, business_id) IS NULL OR COALESCE(salon_id, business_id) = public.current_user_business_id())
  WITH CHECK (public.is_super_admin() OR COALESCE(salon_id, business_id) IS NULL OR COALESCE(salon_id, business_id) = public.current_user_business_id());

-- ─── 4. FIX RLS FOR CLIENTS (allow NULL business_id) ───
DROP POLICY IF EXISTS auto_parts_clients_tenant_guard ON public.auto_parts_clients;
CREATE POLICY auto_parts_clients_tenant_guard ON public.auto_parts_clients
  FOR ALL
  USING (public.is_super_admin() OR COALESCE(salon_id, business_id) IS NULL OR COALESCE(salon_id, business_id) = public.current_user_business_id())
  WITH CHECK (public.is_super_admin() OR COALESCE(salon_id, business_id) IS NULL OR COALESCE(salon_id, business_id) = public.current_user_business_id());

-- ─── 5. FIX RLS FOR STOCK MOVEMENTS (allow NULL business_id) ───
DROP POLICY IF EXISTS auto_parts_stock_movements_tenant_guard ON public.auto_parts_stock_movements;
CREATE POLICY auto_parts_stock_movements_tenant_guard ON public.auto_parts_stock_movements
  FOR ALL
  USING (public.is_super_admin() OR COALESCE(salon_id, business_id) IS NULL OR COALESCE(salon_id, business_id) = public.current_user_business_id())
  WITH CHECK (public.is_super_admin() OR COALESCE(salon_id, business_id) IS NULL OR COALESCE(salon_id, business_id) = public.current_user_business_id());

-- ─── 6. FIX RLS FOR SALES (allow NULL business_id) ───
DROP POLICY IF EXISTS auto_parts_sales_tenant_guard ON public.auto_parts_sales;
CREATE POLICY auto_parts_sales_tenant_guard ON public.auto_parts_sales
  FOR ALL
  USING (public.is_super_admin() OR COALESCE(salon_id, business_id) IS NULL OR COALESCE(salon_id, business_id) = public.current_user_business_id())
  WITH CHECK (public.is_super_admin() OR COALESCE(salon_id, business_id) IS NULL OR COALESCE(salon_id, business_id) = public.current_user_business_id());

-- ─── 7. FIX RLS FOR PURCHASES (allow NULL business_id) ───
DROP POLICY IF EXISTS auto_parts_purchases_tenant_guard ON public.auto_parts_purchases;
CREATE POLICY auto_parts_purchases_tenant_guard ON public.auto_parts_purchases
  FOR ALL
  USING (public.is_super_admin() OR COALESCE(salon_id, business_id) IS NULL OR COALESCE(salon_id, business_id) = public.current_user_business_id())
  WITH CHECK (public.is_super_admin() OR COALESCE(salon_id, business_id) IS NULL OR COALESCE(salon_id, business_id) = public.current_user_business_id());

-- ─── 8. FIX RLS FOR ALERTS (allow NULL business_id) ───
DROP POLICY IF EXISTS auto_parts_alerts_tenant_guard ON public.auto_parts_alerts;
CREATE POLICY auto_parts_alerts_tenant_guard ON public.auto_parts_alerts
  FOR ALL
  USING (public.is_super_admin() OR COALESCE(salon_id, business_id) IS NULL OR COALESCE(salon_id, business_id) = public.current_user_business_id())
  WITH CHECK (public.is_super_admin() OR COALESCE(salon_id, business_id) IS NULL OR COALESCE(salon_id, business_id) = public.current_user_business_id());

-- ─── 9. CLEAN AND RESEED COMPATIBILITIES ───
-- Remove all existing compatibilities (which may have duplicates from multiple runs)
DELETE FROM public.auto_parts_vehicle_compatibilities;

-- Add a unique constraint to prevent future duplicates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_product_brand_model'
  ) THEN
    ALTER TABLE public.auto_parts_vehicle_compatibilities
      ADD CONSTRAINT uq_product_brand_model UNIQUE (product_id, brand_id, model_id);
  END IF;
END $$;

-- Map each product to a matching brand (via name) + a random model of that brand
DO $$
DECLARE
  prod RECORD;
  v_brand_id UUID;
  v_model_id UUID;
  v_brand_name TEXT;
  v_count INTEGER := 0;
BEGIN
  FOR prod IN SELECT id, name FROM public.auto_parts_products
  LOOP
    v_brand_name := NULL;
    IF prod.name ILIKE '%toyota%' THEN v_brand_name := 'Toyota';
    ELSIF prod.name ILIKE '%honda%' THEN v_brand_name := 'Honda';
    ELSIF prod.name ILIKE '%nissan%' THEN v_brand_name := 'Nissan';
    ELSIF prod.name ILIKE '%hyundai%' THEN v_brand_name := 'Hyundai';
    ELSIF prod.name ILIKE '%kia%' THEN v_brand_name := 'Kia';
    ELSIF prod.name ILIKE '%mazda%' THEN v_brand_name := 'Mazda';
    ELSIF prod.name ILIKE '%mitsubishi%' THEN v_brand_name := 'Mitsubishi';
    ELSIF prod.name ILIKE '%suzuki%' THEN v_brand_name := 'Suzuki';
    ELSIF prod.name ILIKE '%ford%' THEN v_brand_name := 'Ford';
    ELSIF prod.name ILIKE '%chevrolet%' OR prod.name ILIKE '%chevy%' THEN v_brand_name := 'Chevrolet';
    ELSIF prod.name ILIKE '%isuzu%' THEN v_brand_name := 'Isuzu';
    ELSIF prod.name ILIKE '%bmw%' THEN v_brand_name := 'BMW';
    ELSIF prod.name ILIKE '%mercedes%' OR prod.name ILIKE '%benz%' THEN v_brand_name := 'Mercedes-Benz';
    ELSIF prod.name ILIKE '%lexus%' THEN v_brand_name := 'Lexus';
    ELSIF prod.name ILIKE '%garmin%' OR prod.name ILIKE '%tomtom%' THEN v_brand_name := 'Toyota';
    ELSIF prod.name ILIKE '%obd2%' THEN v_brand_name := 'BMW';
    END IF;

    IF v_brand_name IS NOT NULL THEN
      SELECT id INTO v_brand_id FROM public.auto_parts_brands WHERE name = v_brand_name;
      IF v_brand_id IS NOT NULL THEN
        SELECT id INTO v_model_id FROM public.auto_parts_models WHERE brand_id = v_brand_id ORDER BY random() LIMIT 1;
        IF v_model_id IS NOT NULL THEN
          BEGIN
            INSERT INTO public.auto_parts_vehicle_compatibilities (product_id, brand_id, model_id)
            VALUES (prod.id, v_brand_id, v_model_id);
            v_count := v_count + 1;
          EXCEPTION WHEN unique_violation THEN
            NULL;
          END;
        END IF;
      END IF;
    END IF;
  END LOOP;

  RAISE NOTICE 'Compatibilities seeded: %', v_count;
END $$;

-- ─── 10. FIX STOCK MOVEMENT TRIGGER (out/sale should ADD negative quantity, not subtract) ───
CREATE OR REPLACE FUNCTION public.auto_parts_update_stock_on_movement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.auto_parts_products
    SET stock_quantity = stock_quantity - OLD.quantity,
        updated_at = now()
    WHERE id = OLD.product_id;
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    IF NEW.type IN ('in', 'return') THEN
      UPDATE public.auto_parts_products
      SET stock_quantity = stock_quantity + NEW.quantity,
          updated_at = now()
      WHERE id = NEW.product_id;
    ELSIF NEW.type IN ('out', 'sale') THEN
      UPDATE public.auto_parts_products
      SET stock_quantity = stock_quantity + NEW.quantity,
          updated_at = now()
      WHERE id = NEW.product_id;
    ELSIF NEW.type = 'adjustment' THEN
      UPDATE public.auto_parts_products
      SET stock_quantity = NEW.quantity,
          updated_at = now()
      WHERE id = NEW.product_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- ─── 11. CREATE MISSING RPC FUNCTIONS ───

-- Create sale with items and stock movements
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
BEGIN
  v_invoice := generate_auto_parts_invoice_number();

  INSERT INTO public.auto_parts_sales (
    invoice_number, business_id, client_id, client_name,
    subtotal, tax_rate, tax_amount, discount_type, discount_value, discount_amount,
    total, payment_method, payment_status, notes
  ) VALUES (
    v_invoice, p_business_id, p_client_id, p_client_name,
    p_subtotal, p_tax_rate, p_tax_amount, p_discount_type, p_discount_value, p_discount_amount,
    p_total, p_payment_method, p_payment_status, p_notes
  ) RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_product_name := v_item->>'product_name';
    v_quantity := (v_item->>'quantity')::NUMERIC;
    v_unit_price := (v_item->>'unit_price')::NUMERIC;

    INSERT INTO public.auto_parts_sale_items (sale_id, product_id, product_name, quantity, unit_price, total_price, business_id)
    VALUES (v_sale_id, v_product_id, v_product_name, v_quantity, v_unit_price, v_quantity * v_unit_price, p_business_id);

    IF v_product_id IS NOT NULL THEN
      INSERT INTO public.auto_parts_stock_movements (product_id, type, quantity, unit_price, reference, business_id, created_by)
      VALUES (v_product_id, 'sale', -v_quantity, v_unit_price, v_invoice, p_business_id, auth.uid());
    END IF;
  END LOOP;

  RETURN (
    SELECT jsonb_build_object('id', s.id, 'invoice_number', s.invoice_number, 'total', s.total)
    FROM public.auto_parts_sales s WHERE s.id = v_sale_id
  );
END;
$$;

-- Create purchase with items and stock movements (if delivered)
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
  p_items JSONB DEFAULT '[]'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_purchase_id UUID;
  v_item JSONB;
  v_product_id UUID;
  v_product_name TEXT;
  v_quantity NUMERIC;
  v_unit_price NUMERIC;
  v_ref TEXT;
BEGIN
  v_ref := COALESCE(p_reference_number, 'PO-' || LPAD(nextval('public.auto_parts_invoice_seq')::TEXT, 6, '0'));

  INSERT INTO public.auto_parts_purchases (
    supplier_id, supplier_name, reference_number, status,
    subtotal, tax_amount, total, notes, business_id
  ) VALUES (
    p_supplier_id, p_supplier_name, v_ref, p_status,
    p_subtotal, p_tax_amount, p_total, p_notes, p_business_id
  ) RETURNING id INTO v_purchase_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_product_name := v_item->>'product_name';
    v_quantity := (v_item->>'quantity')::NUMERIC;
    v_unit_price := (v_item->>'unit_price')::NUMERIC;

    INSERT INTO public.auto_parts_purchase_items (purchase_id, product_id, product_name, quantity, unit_price, total_price, business_id)
    VALUES (v_purchase_id, v_product_id, v_product_name, v_quantity, v_unit_price, v_quantity * v_unit_price, p_business_id);

    IF v_product_id IS NOT NULL AND p_status = 'delivered' THEN
      INSERT INTO public.auto_parts_stock_movements (product_id, type, quantity, unit_price, reference, business_id, created_by)
      VALUES (v_product_id, 'in', v_quantity, v_unit_price, v_ref, p_business_id, auth.uid());
    END IF;
  END LOOP;

  RETURN (
    SELECT jsonb_build_object('id', id, 'reference_number', reference_number, 'status', status)
    FROM public.auto_parts_purchases WHERE id = v_purchase_id
  );
END;
$$;

-- Record a stock movement (used by StockMovements page)
CREATE OR REPLACE FUNCTION public.record_auto_parts_stock_movement(
  p_business_id UUID,
  p_product_id UUID,
  p_type TEXT,
  p_quantity NUMERIC,
  p_unit_price NUMERIC DEFAULT NULL,
  p_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_movement_id UUID;
BEGIN
  INSERT INTO public.auto_parts_stock_movements (product_id, type, quantity, unit_price, reference, notes, business_id, created_by)
  VALUES (p_product_id, p_type, p_quantity, p_unit_price, p_reference, p_notes, p_business_id, auth.uid())
  RETURNING id INTO v_movement_id;

  RETURN jsonb_build_object('id', v_movement_id);
END;
$$;

-- Raise notice so user knows these were created
DO $$ BEGIN RAISE NOTICE 'RPC functions created: create_auto_parts_sale, create_auto_parts_purchase, record_auto_parts_stock_movement'; END $$;

-- ─── 11. VERIFY DATA ───
DO $$
DECLARE
  v_categories INT;
  v_products INT;
  v_brands INT;
  v_models INT;
  v_compatibilities INT;
BEGIN
  SELECT COUNT(*) INTO v_categories FROM public.auto_parts_categories;
  SELECT COUNT(*) INTO v_products FROM public.auto_parts_products;
  SELECT COUNT(*) INTO v_brands FROM public.auto_parts_brands;
  SELECT COUNT(*) INTO v_models FROM public.auto_parts_models;
  SELECT COUNT(*) INTO v_compatibilities FROM public.auto_parts_vehicle_compatibilities;

  RAISE NOTICE '══════════════════════════════════════════';
  RAISE NOTICE 'AUTO PARTS — VERIFICATION REPORT';
  RAISE NOTICE '══════════════════════════════════════════';
  RAISE NOTICE 'Catégories:  %', v_categories;
  RAISE NOTICE 'Produits:    %', v_products;
  RAISE NOTICE 'Marques:     %', v_brands;
  RAISE NOTICE 'Modèles:     %', v_models;
  RAISE NOTICE 'Compat:      %', v_compatibilities;
  RAISE NOTICE '══════════════════════════════════════════';
END $$;

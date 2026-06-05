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
  p_staff_id UUID DEFAULT NULL,
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
BEGIN
  v_invoice := generate_auto_parts_invoice_number();
  v_staff_name := (SELECT name FROM public.auto_parts_staff WHERE id = p_staff_id);

  INSERT INTO public.auto_parts_sales (
    invoice_number, business_id, client_id, client_name,
    subtotal, tax_rate, tax_amount, discount_type, discount_value, discount_amount,
    total, payment_method, payment_status, notes, staff_id, staff_name
  ) VALUES (
    v_invoice, p_business_id, p_client_id, p_client_name,
    p_subtotal, p_tax_rate, p_tax_amount, p_discount_type, p_discount_value, p_discount_amount,
    p_total, p_payment_method, p_payment_status, p_notes, p_staff_id, v_staff_name
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

-- ─── 12. PURCHASE UPDATE/DELETE RPCS ───
CREATE OR REPLACE FUNCTION public.update_auto_parts_purchase(
  p_id UUID,
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
BEGIN
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
    INSERT INTO public.auto_parts_purchase_items (purchase_id, product_id, product_name, quantity, unit_price, total_price)
    VALUES (
      p_id,
      (v_item->>'product_id')::UUID,
      v_item->>'product_name',
      (v_item->>'quantity')::NUMERIC,
      (v_item->>'unit_price')::NUMERIC,
      (v_item->>'quantity')::NUMERIC * (v_item->>'unit_price')::NUMERIC
    );
  END LOOP;

  RETURN jsonb_build_object('id', p_id, 'status', 'updated');
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_auto_parts_purchase(p_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM public.auto_parts_purchase_items WHERE purchase_id = p_id;
  DELETE FROM public.auto_parts_purchases WHERE id = p_id;
  RETURN jsonb_build_object('id', p_id, 'status', 'deleted');
END;
$$;

-- ─── 13. AUTO PARTS STAFF TABLE ───
CREATE TABLE IF NOT EXISTS public.auto_parts_staff (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  role        TEXT NOT NULL DEFAULT 'cashier' CHECK (role IN ('admin', 'manager', 'cashier')),
  pin_code    TEXT,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.auto_parts_staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auto_parts_staff_select" ON public.auto_parts_staff;
CREATE POLICY "auto_parts_staff_select" ON public.auto_parts_staff
  FOR SELECT USING (
    public.is_super_admin() OR business_id = public.current_user_business_id()
  );

DROP POLICY IF EXISTS "auto_parts_staff_insert" ON public.auto_parts_staff;
CREATE POLICY "auto_parts_staff_insert" ON public.auto_parts_staff
  FOR INSERT WITH CHECK (
    public.is_super_admin() OR business_id = public.current_user_business_id()
  );

DROP POLICY IF EXISTS "auto_parts_staff_update" ON public.auto_parts_staff;
CREATE POLICY "auto_parts_staff_update" ON public.auto_parts_staff
  FOR UPDATE USING (
    public.is_super_admin() OR business_id = public.current_user_business_id()
  ) WITH CHECK (
    public.is_super_admin() OR business_id = public.current_user_business_id()
  );

DROP POLICY IF EXISTS "auto_parts_staff_delete" ON public.auto_parts_staff;
CREATE POLICY "auto_parts_staff_delete" ON public.auto_parts_staff
  FOR DELETE USING (
    public.is_super_admin() OR business_id = public.current_user_business_id()
  );

-- Add created_by FK to auto_parts_sales if not exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auto_parts_sales' AND column_name = 'staff_id'
  ) THEN
    ALTER TABLE public.auto_parts_sales ADD COLUMN staff_id UUID REFERENCES public.auto_parts_staff(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ─── 14. AUTO PARTS STAFF RPCs (bypass RLS via SECURITY DEFINER) ───
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
  INSERT INTO public.auto_parts_staff (business_id, name, username, email, phone, role, pin_code)
  VALUES (p_business_id, p_name, p_username, p_email, p_phone, p_role, p_pin_code)
  RETURNING id INTO v_id;
  RETURN (
    SELECT jsonb_build_object('id', id, 'name', name, 'role', role)
    FROM public.auto_parts_staff WHERE id = v_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_auto_parts_staff(
  p_id UUID,
  p_name TEXT DEFAULT NULL,
  p_username TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_role TEXT DEFAULT NULL,
  p_pin_code TEXT DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.auto_parts_staff SET
    name       = p_name,
    username   = NULLIF(p_username, ''),
    email      = NULLIF(p_email, ''),
    phone      = NULLIF(p_phone, ''),
    role       = COALESCE(p_role, role),
    pin_code   = NULLIF(p_pin_code, ''),
    is_active  = COALESCE(p_is_active, is_active),
    updated_at = now()
  WHERE id = p_id;
  RETURN jsonb_build_object('id', p_id, 'status', 'updated');
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_auto_parts_staff(p_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM public.auto_parts_staff WHERE id = p_id;
  RETURN jsonb_build_object('id', p_id, 'status', 'deleted');
END;
$$;

DO $$ BEGIN RAISE NOTICE 'Migration 20260706 complete: +purchase CRUD RPCs, +auto_parts_staff table, +staff RPCs'; END $$;

-- ─── 15. AUTO PARTS STAFF AUTH (sessions, login) ───
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auto_parts_staff' AND column_name = 'username'
  ) THEN
    ALTER TABLE public.auto_parts_staff ADD COLUMN username TEXT;
    ALTER TABLE public.auto_parts_staff ADD CONSTRAINT auto_parts_staff_username_key UNIQUE (username);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.auto_parts_staff_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.auto_parts_staff(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  session_token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

ALTER TABLE public.auto_parts_staff_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS auto_parts_staff_sessions_no_direct_access ON public.auto_parts_staff_sessions;
CREATE POLICY auto_parts_staff_sessions_no_direct_access ON public.auto_parts_staff_sessions
  FOR ALL USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.issue_auto_parts_staff_session(
  p_staff_id UUID,
  p_business_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_token TEXT;
  v_hash TEXT;
BEGIN
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
$$;

CREATE OR REPLACE FUNCTION public.check_auto_parts_staff_login(
  p_username TEXT,
  p_pin TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_staff public.auto_parts_staff;
  v_session JSONB;
BEGIN
  SELECT * INTO v_staff FROM public.auto_parts_staff
  WHERE username = p_username AND is_active = true LIMIT 1;

  IF v_staff.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Identifiants incorrects');
  END IF;

  IF v_staff.pin_code IS NULL OR v_staff.pin_code <> p_pin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Code PIN incorrect');
  END IF;

  v_session := public.issue_auto_parts_staff_session(v_staff.id, v_staff.business_id);

  RETURN jsonb_build_object(
    'success', true,
    'staff', jsonb_build_object(
      'id', v_staff.id,
      'name', v_staff.name,
      'role', v_staff.role,
      'business_id', v_staff.business_id,
      'session_token', (v_session->>'session_token'),
      'expires_at', (v_session->>'expires_at')
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_auto_parts_staff_session(p_session_token TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_hash TEXT;
BEGIN
  IF p_session_token IS NULL OR p_session_token = '' THEN RETURN; END IF;
  v_hash := encode(sha256(p_session_token::bytea), 'hex');
  UPDATE public.auto_parts_staff_sessions SET revoked_at = now()
  WHERE session_token_hash = v_hash AND revoked_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_auto_parts_staff_session(p_session_token TEXT)
RETURNS TABLE(staff_id UUID, name TEXT, role TEXT, business_id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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

DO $$ BEGIN RAISE NOTICE 'Staff auth RPCs created: login, session, revoke, resolve'; END $$;

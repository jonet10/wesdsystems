-- ════════════════════════════════════════════════════════════════════════════
-- WESD AUTO PARTS MODULE INIT
-- Core tables, RLS, triggers for auto parts inventory management
-- ════════════════════════════════════════════════════════════════════════════

-- ─── CATEGORIES ───
CREATE TABLE IF NOT EXISTS public.auto_parts_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── VEHICLE BRANDS ───
CREATE TABLE IF NOT EXISTS public.auto_parts_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── VEHICLE MODELS ───
CREATE TABLE IF NOT EXISTS public.auto_parts_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.auto_parts_brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_year INTEGER,
  end_year INTEGER,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── PRODUCTS ───
CREATE TABLE IF NOT EXISTS public.auto_parts_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES public.auto_parts_categories(id) ON DELETE SET NULL,
  sku TEXT,
  barcode TEXT,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock_quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
  reserved_quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
  min_stock NUMERIC(10,2) NOT NULL DEFAULT 5,
  max_stock NUMERIC(10,2),
  location TEXT,
  image_url TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── VEHICLE COMPATIBILITIES ───
CREATE TABLE IF NOT EXISTS public.auto_parts_vehicle_compatibilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.auto_parts_products(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES public.auto_parts_brands(id) ON DELETE CASCADE,
  model_id UUID REFERENCES public.auto_parts_models(id) ON DELETE CASCADE,
  year_start INTEGER,
  year_end INTEGER,
  engine TEXT,
  notes TEXT,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── SUPPLIERS ───
CREATE TABLE IF NOT EXISTS public.auto_parts_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  address TEXT,
  country TEXT DEFAULT 'Haïti',
  currency TEXT DEFAULT 'HTG',
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── CLIENTS ───
CREATE TABLE IF NOT EXISTS public.auto_parts_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  address TEXT,
  company TEXT,
  notes TEXT,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── STOCK MOVEMENTS ───
CREATE TABLE IF NOT EXISTS public.auto_parts_stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.auto_parts_products(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('in', 'out', 'adjustment', 'sale', 'return')),
  quantity NUMERIC(10,2) NOT NULL,
  unit_price NUMERIC(12,2),
  reference TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── SALES ───
CREATE TABLE IF NOT EXISTS public.auto_parts_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL,
  client_id UUID REFERENCES public.auto_parts_clients(id) ON DELETE SET NULL,
  client_name TEXT,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) DEFAULT 0,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed', 'none')) DEFAULT 'none',
  discount_value NUMERIC(12,2) DEFAULT 0,
  discount_amount NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'transfer', 'moncash', 'natcash')),
  payment_status TEXT NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'partial', 'unpaid')),
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── SALE ITEMS ───
CREATE TABLE IF NOT EXISTS public.auto_parts_sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.auto_parts_sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.auto_parts_products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  total_price NUMERIC(12,2) NOT NULL,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE
);

-- ─── PURCHASES ───
CREATE TABLE IF NOT EXISTS public.auto_parts_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES public.auto_parts_suppliers(id) ON DELETE SET NULL,
  supplier_name TEXT,
  reference_number TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled')),
  subtotal NUMERIC(12,2) DEFAULT 0,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── PURCHASE ITEMS ───
CREATE TABLE IF NOT EXISTS public.auto_parts_purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES public.auto_parts_purchases(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.auto_parts_products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  total_price NUMERIC(12,2) NOT NULL,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE
);

-- ─── ALERTS ───
CREATE TABLE IF NOT EXISTS public.auto_parts_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('low_stock', 'out_of_stock', 'new_order', 'payment_received', 'unpaid_invoice')),
  message TEXT NOT NULL,
  reference_id UUID,
  reference_type TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── ADD salon_id TO ALL TENANT TABLES (idempotent) ───
DO $$ DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'auto_parts_categories',
    'auto_parts_products',
    'auto_parts_vehicle_compatibilities',
    'auto_parts_suppliers',
    'auto_parts_clients',
    'auto_parts_stock_movements',
    'auto_parts_sales',
    'auto_parts_purchases',
    'auto_parts_alerts'
  ]) LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS salon_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE', tbl);
    EXCEPTION WHEN duplicate_column THEN
      NULL;
    END;
  END LOOP;
END $$;

-- ─── AUTO-INVOICE NUMBER SEQUENCE ───
CREATE SEQUENCE IF NOT EXISTS public.auto_parts_invoice_seq START 1;

-- ─── INDEXES ───
CREATE INDEX IF NOT EXISTS idx_auto_parts_models_brand ON public.auto_parts_models(brand_id);
CREATE INDEX IF NOT EXISTS idx_auto_parts_products_category ON public.auto_parts_products(category_id);
CREATE INDEX IF NOT EXISTS idx_auto_parts_products_sku ON public.auto_parts_products(sku);
CREATE INDEX IF NOT EXISTS idx_auto_parts_comp_product ON public.auto_parts_vehicle_compatibilities(product_id);
CREATE INDEX IF NOT EXISTS idx_auto_parts_comp_vehicle ON public.auto_parts_vehicle_compatibilities(brand_id, model_id);
CREATE INDEX IF NOT EXISTS idx_auto_parts_stock_movements_product ON public.auto_parts_stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_auto_parts_stock_movements_created ON public.auto_parts_stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auto_parts_sales_invoice ON public.auto_parts_sales(invoice_number);
CREATE INDEX IF NOT EXISTS idx_auto_parts_sale_items_sale ON public.auto_parts_sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_auto_parts_purchase_items_purchase ON public.auto_parts_purchase_items(purchase_id);

DO $$ DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'auto_parts_products',
    'auto_parts_sales',
    'auto_parts_purchases',
    'auto_parts_alerts'
  ]) LOOP
    BEGIN
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(business_id, created_at DESC)', format('idx_%s_business_created', tbl), tbl);
    EXCEPTION WHEN undefined_column THEN
      NULL;
    END;
  END LOOP;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- RLS: Enable row-level security on all tables
-- ════════════════════════════════════════════════════════════════════════════

DO $$ DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'auto_parts_categories', 'auto_parts_brands', 'auto_parts_models',
    'auto_parts_products', 'auto_parts_vehicle_compatibilities',
    'auto_parts_suppliers', 'auto_parts_clients', 'auto_parts_stock_movements',
    'auto_parts_sales', 'auto_parts_sale_items', 'auto_parts_purchases',
    'auto_parts_purchase_items', 'auto_parts_alerts'
  ]) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
  END LOOP;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- RLS POLICIES (tenant guard + super admin access)
-- ════════════════════════════════════════════════════════════════════════════

DO $$ DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'auto_parts_categories', 'auto_parts_products', 'auto_parts_suppliers',
    'auto_parts_clients', 'auto_parts_stock_movements', 'auto_parts_sales',
    'auto_parts_purchases', 'auto_parts_alerts'
  ]) LOOP
    EXECUTE format('
      DROP POLICY IF EXISTS %I ON public.%I;
      CREATE POLICY %I ON public.%I
        FOR ALL
        USING (public.is_super_admin() OR COALESCE(salon_id, business_id) = public.current_user_business_id())
        WITH CHECK (public.is_super_admin() OR COALESCE(salon_id, business_id) = public.current_user_business_id());
    ', format('%s_tenant_guard', tbl), tbl, format('%s_tenant_guard', tbl), tbl);
  END LOOP;
END $$;

-- Vehicle brands and models: shared data, readable by all authenticated, writable by super_admin
DROP POLICY IF EXISTS auto_parts_brands_tenant_guard ON public.auto_parts_brands;
CREATE POLICY auto_parts_brands_tenant_guard ON public.auto_parts_brands
  FOR ALL USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS auto_parts_brands_read ON public.auto_parts_brands;
CREATE POLICY auto_parts_brands_read ON public.auto_parts_brands
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS auto_parts_models_tenant_guard ON public.auto_parts_models;
CREATE POLICY auto_parts_models_tenant_guard ON public.auto_parts_models
  FOR ALL USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS auto_parts_models_read ON public.auto_parts_models;
CREATE POLICY auto_parts_models_read ON public.auto_parts_models
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS auto_parts_vehicle_compatibilities_tenant_guard ON public.auto_parts_vehicle_compatibilities;
CREATE POLICY auto_parts_vehicle_compatibilities_tenant_guard ON public.auto_parts_vehicle_compatibilities
  FOR ALL
  USING (public.is_super_admin() OR COALESCE(salon_id, business_id) IS NULL OR COALESCE(salon_id, business_id) = public.current_user_business_id())
  WITH CHECK (public.is_super_admin() OR COALESCE(salon_id, business_id) IS NULL OR COALESCE(salon_id, business_id) = public.current_user_business_id());

-- Sale items and purchase items: inherit from parent via business_id
DROP POLICY IF EXISTS auto_parts_sale_items_tenant_guard ON public.auto_parts_sale_items;
CREATE POLICY auto_parts_sale_items_tenant_guard ON public.auto_parts_sale_items
  FOR ALL USING (public.is_super_admin() OR business_id = public.current_user_business_id())
  WITH CHECK (public.is_super_admin() OR business_id = public.current_user_business_id());

DROP POLICY IF EXISTS auto_parts_purchase_items_tenant_guard ON public.auto_parts_purchase_items;
CREATE POLICY auto_parts_purchase_items_tenant_guard ON public.auto_parts_purchase_items
  FOR ALL USING (public.is_super_admin() OR business_id = public.current_user_business_id())
  WITH CHECK (public.is_super_admin() OR business_id = public.current_user_business_id());

-- ════════════════════════════════════════════════════════════════════════════
-- TRIGGERS: auto-set salon_id on insert/update
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.sync_auto_parts_salon_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.salon_id := COALESCE(NEW.salon_id, NEW.business_id, public.current_user_business_id());
  RETURN NEW;
END;
$$;

DO $$ DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'auto_parts_categories', 'auto_parts_products', 'auto_parts_suppliers',
    'auto_parts_clients', 'auto_parts_stock_movements', 'auto_parts_sales',
    'auto_parts_purchases', 'auto_parts_alerts'
  ]) LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS %I ON public.%I;
      CREATE TRIGGER %I
        BEFORE INSERT OR UPDATE ON public.%I
        FOR EACH ROW EXECUTE FUNCTION public.sync_auto_parts_salon_id();
    ', format('trg_%s_sync_salon_id', tbl), tbl, format('trg_%s_sync_salon_id', tbl), tbl);
  END LOOP;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- AUTO-INVOICE FUNCTION
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.generate_auto_parts_invoice_number()
RETURNS TEXT LANGUAGE plpgsql
AS $$
DECLARE
  next_val BIGINT;
BEGIN
  next_val := nextval('public.auto_parts_invoice_seq');
  RETURN 'INV-' || LPAD(next_val::TEXT, 6, '0');
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- STOCK UPDATE TRIGGER
-- ════════════════════════════════════════════════════════════════════════════

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
      SET stock_quantity = stock_quantity - NEW.quantity,
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
END $$;

DROP TRIGGER IF EXISTS trg_auto_parts_stock_movement ON public.auto_parts_stock_movements;
CREATE TRIGGER trg_auto_parts_stock_movement
  AFTER INSERT OR DELETE ON public.auto_parts_stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.auto_parts_update_stock_on_movement();

-- ════════════════════════════════════════════════════════════════════════════
-- LOW STOCK ALERT TRIGGER
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.auto_parts_check_low_stock()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF NEW.stock_quantity <= 0 THEN
    INSERT INTO public.auto_parts_alerts (type, message, reference_id, reference_type, business_id, salon_id)
    VALUES ('out_of_stock', 'Rupture de stock : ' || NEW.name, NEW.id, 'product', NEW.business_id, NEW.salon_id);
  ELSIF NEW.stock_quantity <= NEW.min_stock THEN
    INSERT INTO public.auto_parts_alerts (type, message, reference_id, reference_type, business_id, salon_id)
    VALUES ('low_stock', 'Stock faible : ' || NEW.name || ' (' || NEW.stock_quantity || ' restant(s))', NEW.id, 'product', NEW.business_id, NEW.salon_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_auto_parts_low_stock ON public.auto_parts_products;
CREATE TRIGGER trg_auto_parts_low_stock
  AFTER UPDATE OF stock_quantity ON public.auto_parts_products
  FOR EACH ROW
  WHEN (NEW.stock_quantity <= NEW.min_stock AND OLD.stock_quantity > NEW.min_stock)
  EXECUTE FUNCTION public.auto_parts_check_low_stock();

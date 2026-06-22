-- ════════════════════════════════════════════════════════════════════════════
-- WESD PHARMACY MODULE INIT
-- Core tables, RLS, triggers for pharmacy inventory management & POS
-- ════════════════════════════════════════════════════════════════════════════

-- ─── SETTINGS ───
CREATE TABLE IF NOT EXISTS public.pharmacy_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE UNIQUE,
  currency TEXT DEFAULT 'HTG',
  receipt_prefix TEXT DEFAULT 'PH-',
  invoice_prefix TEXT DEFAULT 'INV-PH-',
  prescription_required BOOLEAN DEFAULT false,
  enable_fefo BOOLEAN DEFAULT true,
  low_stock_threshold INTEGER DEFAULT 10,
  expiring_soon_days INTEGER DEFAULT 60,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── CATEGORIES ───
CREATE TABLE IF NOT EXISTS public.pharmacy_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── PRODUCTS ───
CREATE TABLE IF NOT EXISTS public.pharmacy_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.pharmacy_categories(id) ON DELETE SET NULL,
  sku TEXT,
  barcode TEXT,
  name TEXT NOT NULL,
  generic_name TEXT,
  description TEXT,
  form TEXT, -- e.g. Comprimé, Sirop, Injection
  laboratory TEXT,
  requires_prescription BOOLEAN DEFAULT false,
  min_stock_alert NUMERIC(10,2) DEFAULT 10,
  total_stock_quantity NUMERIC(10,2) DEFAULT 0, -- Auto-calculated base unit
  active BOOLEAN DEFAULT true,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── PRODUCT UNITS (Conversion) ───
CREATE TABLE IF NOT EXISTS public.pharmacy_product_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.pharmacy_products(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- e.g. Boîte, Plaquette, Comprimé
  barcode TEXT,
  conversion_factor NUMERIC(10,2) NOT NULL DEFAULT 1, -- How many base units? (Base unit has factor 1)
  is_base_unit BOOLEAN DEFAULT false,
  cost_price NUMERIC(12,2) DEFAULT 0,
  sale_price NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── SUPPLIERS ───
CREATE TABLE IF NOT EXISTS public.pharmacy_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  contact_person TEXT,
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── PURCHASES ───
CREATE TABLE IF NOT EXISTS public.pharmacy_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.pharmacy_suppliers(id) ON DELETE SET NULL,
  purchase_number TEXT NOT NULL,
  total_amount NUMERIC(12,2) DEFAULT 0,
  paid_amount NUMERIC(12,2) DEFAULT 0,
  status TEXT DEFAULT 'received' CHECK (status IN ('pending', 'received', 'cancelled')),
  payment_status TEXT DEFAULT 'paid' CHECK (payment_status IN ('paid', 'partial', 'unpaid')),
  purchase_date TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── BATCHES (Lots FEFO) ───
CREATE TABLE IF NOT EXISTS public.pharmacy_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.pharmacy_products(id) ON DELETE CASCADE,
  purchase_id UUID REFERENCES public.pharmacy_purchases(id) ON DELETE SET NULL,
  batch_number TEXT NOT NULL,
  manufacture_date DATE,
  expiration_date DATE NOT NULL,
  initial_quantity NUMERIC(10,2) NOT NULL, -- in base unit
  current_quantity NUMERIC(10,2) NOT NULL, -- in base unit
  cost_price NUMERIC(12,2) DEFAULT 0, -- per base unit
  sale_price NUMERIC(12,2) DEFAULT 0, -- per base unit
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── PURCHASE ITEMS ───
CREATE TABLE IF NOT EXISTS public.pharmacy_purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  purchase_id UUID REFERENCES public.pharmacy_purchases(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.pharmacy_products(id) ON DELETE SET NULL,
  batch_id UUID REFERENCES public.pharmacy_batches(id) ON DELETE SET NULL,
  unit_id UUID REFERENCES public.pharmacy_product_units(id) ON DELETE SET NULL,
  quantity NUMERIC(10,2) NOT NULL, -- in selected unit
  unit_price NUMERIC(12,2) NOT NULL,
  total_price NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── STOCK MOVEMENTS ───
CREATE TABLE IF NOT EXISTS public.pharmacy_stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.pharmacy_products(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES public.pharmacy_batches(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('in', 'out', 'adjustment', 'sale', 'return')),
  quantity NUMERIC(10,2) NOT NULL, -- in base unit
  reference TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── CUSTOMERS / PATIENTS ───
CREATE TABLE IF NOT EXISTS public.pharmacy_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('M', 'F', 'Other')),
  medical_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── PRESCRIPTIONS ───
CREATE TABLE IF NOT EXISTS public.pharmacy_prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.pharmacy_customers(id) ON DELETE SET NULL,
  doctor_name TEXT,
  prescription_date DATE,
  notes TEXT,
  file_url TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── CASH REGISTERS ───
CREATE TABLE IF NOT EXISTS public.pharmacy_cash_registers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  opened_by UUID REFERENCES public.profiles(id),
  closed_by UUID REFERENCES public.profiles(id),
  opened_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ,
  initial_amount NUMERIC(12,2) DEFAULT 0,
  expected_amount NUMERIC(12,2) DEFAULT 0,
  actual_amount NUMERIC(12,2),
  difference NUMERIC(12,2),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── SALES ───
CREATE TABLE IF NOT EXISTS public.pharmacy_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  register_id UUID REFERENCES public.pharmacy_cash_registers(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.pharmacy_customers(id) ON DELETE SET NULL,
  prescription_id UUID REFERENCES public.pharmacy_prescriptions(id) ON DELETE SET NULL,
  receipt_number TEXT NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  discount_amount NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'moncash', 'natcash', 'transfer', 'credit')),
  payment_status TEXT NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'credit', 'partial')),
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── SALE ITEMS ───
CREATE TABLE IF NOT EXISTS public.pharmacy_sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES public.pharmacy_sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.pharmacy_products(id) ON DELETE SET NULL,
  unit_id UUID REFERENCES public.pharmacy_product_units(id) ON DELETE SET NULL,
  batch_id UUID REFERENCES public.pharmacy_batches(id) ON DELETE SET NULL,
  quantity NUMERIC(10,2) NOT NULL, -- in selected unit
  unit_price NUMERIC(12,2) NOT NULL,
  total_price NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── CUSTOMER CREDITS ───
CREATE TABLE IF NOT EXISTS public.pharmacy_customer_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.pharmacy_customers(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES public.pharmacy_sales(id) ON DELETE CASCADE,
  total_amount NUMERIC(12,2) NOT NULL,
  paid_amount NUMERIC(12,2) DEFAULT 0,
  balance NUMERIC(12,2) NOT NULL,
  due_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── CREDIT PAYMENTS ───
CREATE TABLE IF NOT EXISTS public.pharmacy_credit_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  credit_id UUID NOT NULL REFERENCES public.pharmacy_customer_credits(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  payment_method TEXT NOT NULL,
  payment_date TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── EXPENSES ───
CREATE TABLE IF NOT EXISTS public.pharmacy_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  register_id UUID REFERENCES public.pharmacy_cash_registers(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL,
  expense_date DATE NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ════════════════════════════════════════════════════════════════════════════
-- ENABLE ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.pharmacy_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_product_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_customer_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_credit_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_expenses ENABLE ROW LEVEL SECURITY;

-- ════════════════════════════════════════════════════════════════════════════
-- RLS POLICIES (Tenant Guard)
-- ════════════════════════════════════════════════════════════════════════════

-- Generic Tenant Guard using public.current_user_business_id()
CREATE POLICY pharmacy_tenant_guard ON public.pharmacy_settings FOR ALL USING (public.is_super_admin() OR business_id = public.current_user_business_id()) WITH CHECK (public.is_super_admin() OR business_id = public.current_user_business_id());
CREATE POLICY pharmacy_tenant_guard ON public.pharmacy_categories FOR ALL USING (public.is_super_admin() OR business_id = public.current_user_business_id()) WITH CHECK (public.is_super_admin() OR business_id = public.current_user_business_id());
CREATE POLICY pharmacy_tenant_guard ON public.pharmacy_products FOR ALL USING (public.is_super_admin() OR business_id = public.current_user_business_id()) WITH CHECK (public.is_super_admin() OR business_id = public.current_user_business_id());
CREATE POLICY pharmacy_tenant_guard ON public.pharmacy_product_units FOR ALL USING (public.is_super_admin() OR business_id = public.current_user_business_id()) WITH CHECK (public.is_super_admin() OR business_id = public.current_user_business_id());
CREATE POLICY pharmacy_tenant_guard ON public.pharmacy_suppliers FOR ALL USING (public.is_super_admin() OR business_id = public.current_user_business_id()) WITH CHECK (public.is_super_admin() OR business_id = public.current_user_business_id());
CREATE POLICY pharmacy_tenant_guard ON public.pharmacy_purchases FOR ALL USING (public.is_super_admin() OR business_id = public.current_user_business_id()) WITH CHECK (public.is_super_admin() OR business_id = public.current_user_business_id());
CREATE POLICY pharmacy_tenant_guard ON public.pharmacy_purchase_items FOR ALL USING (public.is_super_admin() OR business_id = public.current_user_business_id()) WITH CHECK (public.is_super_admin() OR business_id = public.current_user_business_id());
CREATE POLICY pharmacy_tenant_guard ON public.pharmacy_batches FOR ALL USING (public.is_super_admin() OR business_id = public.current_user_business_id()) WITH CHECK (public.is_super_admin() OR business_id = public.current_user_business_id());
CREATE POLICY pharmacy_tenant_guard ON public.pharmacy_stock_movements FOR ALL USING (public.is_super_admin() OR business_id = public.current_user_business_id()) WITH CHECK (public.is_super_admin() OR business_id = public.current_user_business_id());
CREATE POLICY pharmacy_tenant_guard ON public.pharmacy_customers FOR ALL USING (public.is_super_admin() OR business_id = public.current_user_business_id()) WITH CHECK (public.is_super_admin() OR business_id = public.current_user_business_id());
CREATE POLICY pharmacy_tenant_guard ON public.pharmacy_prescriptions FOR ALL USING (public.is_super_admin() OR business_id = public.current_user_business_id()) WITH CHECK (public.is_super_admin() OR business_id = public.current_user_business_id());
CREATE POLICY pharmacy_tenant_guard ON public.pharmacy_sales FOR ALL USING (public.is_super_admin() OR business_id = public.current_user_business_id()) WITH CHECK (public.is_super_admin() OR business_id = public.current_user_business_id());
CREATE POLICY pharmacy_tenant_guard ON public.pharmacy_sale_items FOR ALL USING (public.is_super_admin() OR business_id = public.current_user_business_id()) WITH CHECK (public.is_super_admin() OR business_id = public.current_user_business_id());
CREATE POLICY pharmacy_tenant_guard ON public.pharmacy_customer_credits FOR ALL USING (public.is_super_admin() OR business_id = public.current_user_business_id()) WITH CHECK (public.is_super_admin() OR business_id = public.current_user_business_id());
CREATE POLICY pharmacy_tenant_guard ON public.pharmacy_credit_payments FOR ALL USING (public.is_super_admin() OR business_id = public.current_user_business_id()) WITH CHECK (public.is_super_admin() OR business_id = public.current_user_business_id());
CREATE POLICY pharmacy_tenant_guard ON public.pharmacy_cash_registers FOR ALL USING (public.is_super_admin() OR business_id = public.current_user_business_id()) WITH CHECK (public.is_super_admin() OR business_id = public.current_user_business_id());
CREATE POLICY pharmacy_tenant_guard ON public.pharmacy_expenses FOR ALL USING (public.is_super_admin() OR business_id = public.current_user_business_id()) WITH CHECK (public.is_super_admin() OR business_id = public.current_user_business_id());

-- ════════════════════════════════════════════════════════════════════════════
-- STOCK AGGREGATION TRIGGER (Update Product Total Stock)
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.pharmacy_update_product_stock()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE public.pharmacy_products
    SET total_stock_quantity = (
      SELECT COALESCE(SUM(current_quantity), 0)
      FROM public.pharmacy_batches
      WHERE product_id = NEW.product_id
      AND current_quantity > 0
    )
    WHERE id = NEW.product_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.pharmacy_products
    SET total_stock_quantity = (
      SELECT COALESCE(SUM(current_quantity), 0)
      FROM public.pharmacy_batches
      WHERE product_id = OLD.product_id
      AND current_quantity > 0
    )
    WHERE id = OLD.product_id;
    RETURN OLD;
  END IF;
END $$;

CREATE TRIGGER trg_pharmacy_batch_stock_update
  AFTER INSERT OR UPDATE OR DELETE ON public.pharmacy_batches
  FOR EACH ROW EXECUTE FUNCTION public.pharmacy_update_product_stock();

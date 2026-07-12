-- ==============================================================================
-- UNIVERSAL MODULE ENGINE (si non existant)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.business_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.business_branches(id) ON DELETE CASCADE,
  module_name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(branch_id, module_name)
);
ALTER TABLE public.business_modules ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.module_seed_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.business_branches(id) ON DELETE CASCADE,
  module_name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  seeded_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(branch_id, module_name)
);
ALTER TABLE public.module_seed_versions ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- STATIONERY MODULE TABLES
-- ==============================================================================

-- 1. Settings
CREATE TABLE IF NOT EXISTS public.stationery_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.business_branches(id) ON DELETE CASCADE,
  logo_url TEXT,
  business_name TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  currency TEXT DEFAULT 'HTG',
  invoice_prefix TEXT DEFAULT 'INV-',
  receipt_prefix TEXT DEFAULT 'REC-',
  thank_you_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(branch_id)
);
ALTER TABLE public.stationery_settings ENABLE ROW LEVEL SECURITY;

-- 2. Categories
CREATE TABLE IF NOT EXISTS public.stationery_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.business_branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  icon TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.stationery_categories ENABLE ROW LEVEL SECURITY;

-- 3. Products
CREATE TABLE IF NOT EXISTS public.stationery_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.business_branches(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.stationery_categories(id) ON DELETE SET NULL,
  sku TEXT,
  barcode TEXT,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  purchase_price DECIMAL(10,2) DEFAULT 0,
  selling_price DECIMAL(10,2) DEFAULT 0,
  stock_quantity INTEGER DEFAULT 0,
  min_stock_alert INTEGER DEFAULT 5,
  selling_unit TEXT DEFAULT 'unité', -- unité, paquet, boîte, douzaine, carton
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS stationery_products_barcode_idx ON public.stationery_products(branch_id, barcode) WHERE barcode IS NOT NULL AND barcode != '';
ALTER TABLE public.stationery_products ENABLE ROW LEVEL SECURITY;

-- 4. Product Variants
CREATE TABLE IF NOT EXISTS public.stationery_product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.stationery_products(id) ON DELETE CASCADE,
  variant_type TEXT NOT NULL, -- color, size, pages, model
  variant_value TEXT NOT NULL,
  sku_suffix TEXT,
  price_adjustment DECIMAL(10,2) DEFAULT 0,
  stock_quantity INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.stationery_product_variants ENABLE ROW LEVEL SECURITY;

-- 5. Customers
CREATE TABLE IF NOT EXISTS public.stationery_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.business_branches(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.stationery_customers ENABLE ROW LEVEL SECURITY;

-- 6. Suppliers
CREATE TABLE IF NOT EXISTS public.stationery_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.business_branches(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.stationery_suppliers ENABLE ROW LEVEL SECURITY;

-- 7. Purchases
CREATE TABLE IF NOT EXISTS public.stationery_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.business_branches(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.stationery_suppliers(id) ON DELETE SET NULL,
  invoice_number TEXT,
  total_amount DECIMAL(12,2) DEFAULT 0,
  status TEXT DEFAULT 'completed',
  purchase_date TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.stationery_purchases ENABLE ROW LEVEL SECURITY;

-- 8. Purchase Items
CREATE TABLE IF NOT EXISTS public.stationery_purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID REFERENCES public.stationery_purchases(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.stationery_products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.stationery_product_variants(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL,
  unit_cost DECIMAL(10,2) NOT NULL,
  total DECIMAL(12,2) NOT NULL
);
ALTER TABLE public.stationery_purchase_items ENABLE ROW LEVEL SECURITY;

-- 9. Sales
CREATE TABLE IF NOT EXISTS public.stationery_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.business_branches(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.stationery_customers(id) ON DELETE SET NULL,
  cashier_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  total_amount DECIMAL(12,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  payment_method TEXT DEFAULT 'cash',
  amount_paid DECIMAL(12,2) DEFAULT 0,
  balance DECIMAL(12,2) DEFAULT 0,
  sale_date TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.stationery_sales ENABLE ROW LEVEL SECURITY;

-- 10. Sale Items
CREATE TABLE IF NOT EXISTS public.stationery_sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES public.stationery_sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.stationery_products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.stationery_product_variants(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total DECIMAL(12,2) NOT NULL
);
ALTER TABLE public.stationery_sale_items ENABLE ROW LEVEL SECURITY;

-- 11. Expenses
CREATE TABLE IF NOT EXISTS public.stationery_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.business_branches(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  description TEXT,
  expense_date TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.stationery_expenses ENABLE ROW LEVEL SECURITY;

-- 12. Stock Movements
CREATE TABLE IF NOT EXISTS public.stationery_stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.business_branches(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.stationery_products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.stationery_product_variants(id) ON DELETE SET NULL,
  movement_type TEXT NOT NULL, -- in, out, adjustment, return
  quantity INTEGER NOT NULL,
  reference TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.stationery_stock_movements ENABLE ROW LEVEL SECURITY;

-- 13. Inventory Adjustments
CREATE TABLE IF NOT EXISTS public.stationery_inventory_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.business_branches(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.stationery_products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.stationery_product_variants(id) ON DELETE SET NULL,
  adjustment_type TEXT NOT NULL, -- loss, breakage, correction
  quantity_changed INTEGER NOT NULL,
  reason TEXT,
  adjusted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.stationery_inventory_adjustments ENABLE ROW LEVEL SECURITY;


-- ==============================================================================
-- UNIVERSAL INITIALIZATION FUNCTION
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.initialize_module_for_branch(
    p_branch_id UUID,
    p_module_name TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_business_id UUID;
    v_version INTEGER;
    v_cat_id UUID;
BEGIN
    -- Get business_id from branch
    SELECT business_id INTO v_business_id FROM public.business_branches WHERE id = p_branch_id;
    IF v_business_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Ensure module is activated
    INSERT INTO public.business_modules (business_id, branch_id, module_name, active)
    VALUES (v_business_id, p_branch_id, p_module_name, true)
    ON CONFLICT (branch_id, module_name) DO UPDATE SET active = true;

    -- Check seed version
    SELECT version INTO v_version FROM public.module_seed_versions 
    WHERE branch_id = p_branch_id AND module_name = p_module_name;

    IF v_version IS NULL THEN
        -- VERSION 1: Initial Seed for Stationery
        IF p_module_name = 'stationery' THEN
            -- Create default categories
            INSERT INTO public.stationery_categories (business_id, branch_id, name, description, color)
            VALUES 
                (v_business_id, p_branch_id, 'Cahiers', 'Cahiers de toutes tailles', '#3b82f6'),
                (v_business_id, p_branch_id, 'Stylos', 'Stylos billes, gels, plumes', '#ef4444'),
                (v_business_id, p_branch_id, 'Crayons', 'Crayons HB, couleurs', '#eab308'),
                (v_business_id, p_branch_id, 'Dessin', 'Matériel de dessin', '#f59e0b'),
                (v_business_id, p_branch_id, 'Bureau', 'Fournitures de bureau', '#64748b'),
                (v_business_id, p_branch_id, 'Informatique', 'Accessoires informatiques', '#8b5cf6'),
                (v_business_id, p_branch_id, 'Impression', 'Papier, cartouches', '#10b981')
            RETURNING id INTO v_cat_id;
            
            -- Basic Demo Product
            INSERT INTO public.stationery_products (business_id, branch_id, category_id, name, sku, barcode, selling_price, stock_quantity, selling_unit)
            VALUES 
                (v_business_id, p_branch_id, v_cat_id, 'Ramette papier A4', 'P-A4', '1234567890123', 500, 100, 'paquet');

        END IF;

        -- Record seed version
        INSERT INTO public.module_seed_versions (business_id, branch_id, module_name, version)
        VALUES (v_business_id, p_branch_id, p_module_name, 1);
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==============================================================================
-- RLS POLICIES (Simplified wrapper for this script)
-- ==============================================================================

DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name LIKE 'stationery_%'
    LOOP
        EXECUTE format('
            CREATE POLICY "Allow read access for business users" ON public.%I FOR SELECT USING (
                auth.uid() IN (
                    SELECT id FROM public.profiles WHERE business_id = %I.business_id
                )
            );
            CREATE POLICY "Allow all access for business users" ON public.%I FOR ALL USING (
                auth.uid() IN (
                    SELECT id FROM public.profiles WHERE business_id = %I.business_id
                )
            );
        ', t, t, t, t);
    END LOOP;
END;
$$;

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
            DECLARE
                v_cat_cahiers UUID; v_cat_stylos UUID; v_cat_crayons UUID; v_cat_correction UUID;
                v_cat_geometrie UUID; v_cat_papier UUID; v_cat_enveloppes UUID; v_cat_bristol UUID;
            BEGIN
                -- Create default categories
                INSERT INTO public.stationery_categories (business_id, branch_id, name, description, color) VALUES (v_business_id, p_branch_id, 'Cahiers', 'Cahiers de toutes tailles', '#3b82f6') RETURNING id INTO v_cat_cahiers;
                INSERT INTO public.stationery_categories (business_id, branch_id, name, description, color) VALUES (v_business_id, p_branch_id, 'Stylos & Écriture', 'Stylos, marqueurs, surligneurs', '#ef4444') RETURNING id INTO v_cat_stylos;
                INSERT INTO public.stationery_categories (business_id, branch_id, name, description, color) VALUES (v_business_id, p_branch_id, 'Crayons & Dessin', 'Matériel de dessin', '#eab308') RETURNING id INTO v_cat_crayons;
                INSERT INTO public.stationery_categories (business_id, branch_id, name, description, color) VALUES (v_business_id, p_branch_id, 'Correction', 'Gommes, correcteurs', '#8b5cf6') RETURNING id INTO v_cat_correction;
                INSERT INTO public.stationery_categories (business_id, branch_id, name, description, color) VALUES (v_business_id, p_branch_id, 'Géométrie', 'Règles, compas', '#14b8a6') RETURNING id INTO v_cat_geometrie;
                INSERT INTO public.stationery_categories (business_id, branch_id, name, description, color) VALUES (v_business_id, p_branch_id, 'Papier & Impression', 'Ramettes, calque', '#10b981') RETURNING id INTO v_cat_papier;
                INSERT INTO public.stationery_categories (business_id, branch_id, name, description, color) VALUES (v_business_id, p_branch_id, 'Enveloppes', 'Enveloppes', '#64748b') RETURNING id INTO v_cat_enveloppes;
                INSERT INTO public.stationery_categories (business_id, branch_id, name, description, color) VALUES (v_business_id, p_branch_id, 'Bristol & Photo', 'Papier Bristol divers', '#f43f5e') RETURNING id INTO v_cat_bristol;

                -- Insert Products
                INSERT INTO public.stationery_products (business_id, branch_id, category_id, name, sku, selling_price, stock_quantity, selling_unit) VALUES
                -- Cahiers
                (v_business_id, p_branch_id, v_cat_cahiers, 'Cahier 32 pages', 'CAH-032', 0, 0, 'unité'),
                (v_business_id, p_branch_id, v_cat_cahiers, 'Cahier 48 pages', 'CAH-048', 0, 0, 'unité'),
                (v_business_id, p_branch_id, v_cat_cahiers, 'Cahier 64 pages', 'CAH-064', 0, 0, 'unité'),
                (v_business_id, p_branch_id, v_cat_cahiers, 'Cahier 96 pages', 'CAH-096', 0, 0, 'unité'),
                (v_business_id, p_branch_id, v_cat_cahiers, 'Cahier 120 pages', 'CAH-120', 0, 0, 'unité'),
                (v_business_id, p_branch_id, v_cat_cahiers, 'Cahier 144 pages', 'CAH-144', 0, 0, 'unité'),
                (v_business_id, p_branch_id, v_cat_cahiers, 'Cahier 192 pages', 'CAH-192', 0, 0, 'unité'),
                (v_business_id, p_branch_id, v_cat_cahiers, 'Cahier 200 pages', 'CAH-200', 0, 0, 'unité'),
                (v_business_id, p_branch_id, v_cat_cahiers, 'Cahier Spirale', 'CAH-SPI', 0, 0, 'unité'),
                (v_business_id, p_branch_id, v_cat_cahiers, 'Cahier Pratique', 'CAH-PRA', 0, 0, 'unité'),
                (v_business_id, p_branch_id, v_cat_cahiers, 'Cahier de Composition', 'CAH-COM', 0, 0, 'unité'),
                (v_business_id, p_branch_id, v_cat_cahiers, 'Cahier de Dessin', 'CAH-DES', 0, 0, 'unité'),
                (v_business_id, p_branch_id, v_cat_cahiers, 'Cahier Quadrillé', 'CAH-QUA', 0, 0, 'unité'),
                -- Stylos & Écriture
                (v_business_id, p_branch_id, v_cat_stylos, 'Stylo Bleu', 'STY-BLE', 0, 0, 'unité'),
                (v_business_id, p_branch_id, v_cat_stylos, 'Stylo Noir', 'STY-NOI', 0, 0, 'unité'),
                (v_business_id, p_branch_id, v_cat_stylos, 'Stylo Rouge', 'STY-ROU', 0, 0, 'unité'),
                (v_business_id, p_branch_id, v_cat_stylos, 'Stylo Vert', 'STY-VER', 0, 0, 'unité'),
                (v_business_id, p_branch_id, v_cat_stylos, 'Stylo Gel Bleu', 'STY-G-BL', 0, 0, 'unité'),
                (v_business_id, p_branch_id, v_cat_stylos, 'Stylo Gel Noir', 'STY-G-NO', 0, 0, 'unité'),
                (v_business_id, p_branch_id, v_cat_stylos, 'Stylo Gel Rouge', 'STY-G-RO', 0, 0, 'unité'),
                (v_business_id, p_branch_id, v_cat_stylos, 'Stylo Effaçable', 'STY-EFF', 0, 0, 'unité'),
                (v_business_id, p_branch_id, v_cat_stylos, 'Marqueur Noir', 'MAR-NOI', 0, 0, 'unité'),
                (v_business_id, p_branch_id, v_cat_stylos, 'Marqueur Bleu', 'MAR-BLE', 0, 0, 'unité'),
                (v_business_id, p_branch_id, v_cat_stylos, 'Marqueur Rouge', 'MAR-ROU', 0, 0, 'unité'),
                (v_business_id, p_branch_id, v_cat_stylos, 'Marqueur Permanent', 'MAR-PER', 0, 0, 'unité'),
                (v_business_id, p_branch_id, v_cat_stylos, 'Surligneur Jaune', 'SUR-JAU', 0, 0, 'unité'),
                (v_business_id, p_branch_id, v_cat_stylos, 'Surligneur Vert', 'SUR-VER', 0, 0, 'unité'),
                (v_business_id, p_branch_id, v_cat_stylos, 'Surligneur Rose', 'SUR-ROS', 0, 0, 'unité'),
                -- Crayons & Dessin
                (v_business_id, p_branch_id, v_cat_crayons, 'Crayon HB', 'CRA-HB', 0, 0, 'unité'),
                (v_business_id, p_branch_id, v_cat_crayons, 'Crayon 2B', 'CRA-2B', 0, 0, 'unité'),
                (v_business_id, p_branch_id, v_cat_crayons, 'Crayon de Couleur (12)', 'CRA-C12', 0, 0, 'boîte'),
                (v_business_id, p_branch_id, v_cat_crayons, 'Crayon de Couleur (24)', 'CRA-C24', 0, 0, 'boîte'),
                (v_business_id, p_branch_id, v_cat_crayons, 'Porte-Mine', 'POR-MIN', 0, 0, 'unité'),
                (v_business_id, p_branch_id, v_cat_crayons, 'Mine de Rechange', 'MIN-REC', 0, 0, 'boîte'),
                (v_business_id, p_branch_id, v_cat_crayons, 'Craie Blanche', 'CRA-BLA', 0, 0, 'boîte'),
                (v_business_id, p_branch_id, v_cat_crayons, 'Craie Couleur', 'CRA-COU', 0, 0, 'boîte'),
                (v_business_id, p_branch_id, v_cat_crayons, 'Fusain', 'FUS-001', 0, 0, 'unité'),
                (v_business_id, p_branch_id, v_cat_crayons, 'Peinture Aquarelle', 'PEI-AQU', 0, 0, 'boîte'),
                -- Correction
                (v_business_id, p_branch_id, v_cat_correction, 'Gomme Blanche', 'GOM-BLA', 0, 0, 'unité'),
                (v_business_id, p_branch_id, v_cat_correction, 'Gomme Couleur', 'GOM-COU', 0, 0, 'unité'),
                (v_business_id, p_branch_id, v_cat_correction, 'Correcteur Liquide', 'COR-LIQ', 0, 0, 'unité'),
                (v_business_id, p_branch_id, v_cat_correction, 'Correcteur Ruban', 'COR-RUB', 0, 0, 'unité'),
                (v_business_id, p_branch_id, v_cat_correction, 'Effaceur Stylo', 'EFF-STY', 0, 0, 'unité'),
                -- Géométrie
                (v_business_id, p_branch_id, v_cat_geometrie, 'Règle 20 cm', 'REG-20', 0, 0, 'unité'),
                (v_business_id, p_branch_id, v_cat_geometrie, 'Règle 30 cm', 'REG-30', 0, 0, 'unité'),
                (v_business_id, p_branch_id, v_cat_geometrie, 'Équerre', 'EQU-001', 0, 0, 'unité'),
                (v_business_id, p_branch_id, v_cat_geometrie, 'Rapporteur', 'RAP-001', 0, 0, 'unité'),
                (v_business_id, p_branch_id, v_cat_geometrie, 'Compas', 'COM-001', 0, 0, 'unité'),
                (v_business_id, p_branch_id, v_cat_geometrie, 'Kit Géométrique', 'KIT-GEO', 0, 0, 'boîte'),
                -- Papier & Impression
                (v_business_id, p_branch_id, v_cat_papier, 'Ramette Papier A4', 'P-A4', 0, 0, 'paquet'),
                (v_business_id, p_branch_id, v_cat_papier, 'Ramette Papier Lettre', 'P-LET', 0, 0, 'paquet'),
                (v_business_id, p_branch_id, v_cat_papier, 'Papier Cartonné Blanc', 'P-CAB', 0, 0, 'paquet'),
                (v_business_id, p_branch_id, v_cat_papier, 'Papier Cartonné Couleur', 'P-CAC', 0, 0, 'paquet'),
                (v_business_id, p_branch_id, v_cat_papier, 'Papier Calque', 'P-CAL', 0, 0, 'paquet'),
                (v_business_id, p_branch_id, v_cat_papier, 'Papier Autocollant', 'P-AUT', 0, 0, 'paquet'),
                -- Enveloppes
                (v_business_id, p_branch_id, v_cat_enveloppes, 'Enveloppe #10 Blanche', 'ENV-10B', 0, 0, 'paquet'),
                -- Bristol & Photo
                (v_business_id, p_branch_id, v_cat_bristol, 'Bristol Blanc Mat', 'BRI-BM', 0, 0, 'paquet'),
                (v_business_id, p_branch_id, v_cat_bristol, 'Bristol Blanc Glacé', 'BRI-BG', 0, 0, 'paquet'),
                (v_business_id, p_branch_id, v_cat_bristol, 'Bristol Couleur Mat', 'BRI-CM', 0, 0, 'paquet'),
                (v_business_id, p_branch_id, v_cat_bristol, 'Bristol Couleur Glacé', 'BRI-CG', 0, 0, 'paquet'),
                (v_business_id, p_branch_id, v_cat_bristol, 'Bristol 180g', 'BRI-180', 0, 0, 'paquet'),
                (v_business_id, p_branch_id, v_cat_bristol, 'Bristol 200g', 'BRI-200', 0, 0, 'paquet'),
                (v_business_id, p_branch_id, v_cat_bristol, 'Bristol 220g', 'BRI-220', 0, 0, 'paquet'),
                (v_business_id, p_branch_id, v_cat_bristol, 'Bristol 250g', 'BRI-250', 0, 0, 'paquet'),
                (v_business_id, p_branch_id, v_cat_bristol, 'Bristol 300g', 'BRI-300', 0, 0, 'paquet'),
                (v_business_id, p_branch_id, v_cat_bristol, 'Papier Photo Brillant', 'PHO-BRI', 0, 0, 'paquet'),
                (v_business_id, p_branch_id, v_cat_bristol, 'Papier Photo Mat', 'PHO-MAT', 0, 0, 'paquet');
            END;
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
        WHERE table_schema = 'public' 
        AND table_name LIKE 'stationery_%'
        AND table_name NOT IN ('stationery_product_variants', 'stationery_purchase_items', 'stationery_sale_items')
    LOOP
        EXECUTE format('
            DROP POLICY IF EXISTS "Allow read access for business users" ON public.%I;
            CREATE POLICY "Allow read access for business users" ON public.%I FOR SELECT USING (
                auth.uid() IN (SELECT id FROM public.profiles WHERE business_id = %I.business_id)
            );
            
            DROP POLICY IF EXISTS "Allow all access for business users" ON public.%I;
            CREATE POLICY "Allow all access for business users" ON public.%I FOR ALL USING (
                auth.uid() IN (SELECT id FROM public.profiles WHERE business_id = %I.business_id)
            );
        ', t, t, t, t, t, t);
    END LOOP;
END;
$$;

-- Specific policies for items without business_id
DROP POLICY IF EXISTS "Allow access for variants" ON public.stationery_product_variants;
CREATE POLICY "Allow access for variants" ON public.stationery_product_variants FOR ALL USING (
    product_id IN (SELECT id FROM public.stationery_products WHERE business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()))
);

DROP POLICY IF EXISTS "Allow access for purchase items" ON public.stationery_purchase_items;
CREATE POLICY "Allow access for purchase items" ON public.stationery_purchase_items FOR ALL USING (
    purchase_id IN (SELECT id FROM public.stationery_purchases WHERE business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()))
);

DROP POLICY IF EXISTS "Allow access for sale items" ON public.stationery_sale_items;
CREATE POLICY "Allow access for sale items" ON public.stationery_sale_items FOR ALL USING (
    sale_id IN (SELECT id FROM public.stationery_sales WHERE business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()))
);

-- Migration pour le module d'inventaire et POS des fournitures scolaires

-- 1. Table des produits (Fournitures)
CREATE TABLE IF NOT EXISTS public.school_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    sku TEXT,
    cost_price DECIMAL(12,2) DEFAULT 0,
    price DECIMAL(12,2) NOT NULL DEFAULT 0,
    stock_quantity INTEGER DEFAULT 0,
    min_stock_alert INTEGER DEFAULT 5,
    active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table des mouvements de stock
CREATE TABLE IF NOT EXISTS public.school_stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL,
    product_id UUID NOT NULL REFERENCES public.school_products(id) ON DELETE CASCADE,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('ENTREE', 'SORTIE', 'VENTE', 'AJUSTEMENT', 'RETOUR')),
    quantity INTEGER NOT NULL,
    previous_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    reference_id TEXT, -- ID de la vente ou du bon
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Table des ventes directes (POS)
CREATE TABLE IF NOT EXISTS public.school_sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL,
    receipt_number TEXT NOT NULL,
    student_id UUID REFERENCES public.school_students(id) ON DELETE SET NULL,
    customer_name TEXT,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount DECIMAL(12,2) DEFAULT 0,
    tax DECIMAL(12,2) DEFAULT 0,
    total DECIMAL(12,2) NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL,
    status TEXT DEFAULT 'completed',
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Table des articles vendus
CREATE TABLE IF NOT EXISTS public.school_sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL REFERENCES public.school_sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.school_products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to update updated_at on school_products
DROP TRIGGER IF EXISTS update_school_products_updated_at ON public.school_products;
CREATE TRIGGER update_school_products_updated_at
BEFORE UPDATE ON public.school_products
FOR EACH ROW
EXECUTE FUNCTION update_school_updated_at();

-- RLS Policies
ALTER TABLE public.school_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_sale_items ENABLE ROW LEVEL SECURITY;

-- Products Policies
DROP POLICY IF EXISTS "Users can view products of their business" ON public.school_products;
CREATE POLICY "Users can view products of their business"
ON public.school_products FOR SELECT
USING (business_id IN (
    SELECT business_id FROM public.profiles WHERE id = auth.uid()
));

DROP POLICY IF EXISTS "Admins can manage products" ON public.school_products;
CREATE POLICY "Admins can manage products"
ON public.school_products FOR ALL
USING (business_id IN (
    SELECT business_id FROM public.profiles WHERE id = auth.uid()
));

-- Stock Movements Policies
DROP POLICY IF EXISTS "Users can view stock movements of their business" ON public.school_stock_movements;
CREATE POLICY "Users can view stock movements of their business"
ON public.school_stock_movements FOR SELECT
USING (business_id IN (
    SELECT business_id FROM public.profiles WHERE id = auth.uid()
));

DROP POLICY IF EXISTS "Admins can manage stock movements" ON public.school_stock_movements;
CREATE POLICY "Admins can manage stock movements"
ON public.school_stock_movements FOR ALL
USING (business_id IN (
    SELECT business_id FROM public.profiles WHERE id = auth.uid()
));

-- Sales Policies
DROP POLICY IF EXISTS "Users can view sales of their business" ON public.school_sales;
CREATE POLICY "Users can view sales of their business"
ON public.school_sales FOR SELECT
USING (business_id IN (
    SELECT business_id FROM public.profiles WHERE id = auth.uid()
));

DROP POLICY IF EXISTS "Users can insert sales" ON public.school_sales;
CREATE POLICY "Users can insert sales"
ON public.school_sales FOR INSERT
WITH CHECK (business_id IN (
    SELECT business_id FROM public.profiles WHERE id = auth.uid()
));

-- Sale Items Policies
DROP POLICY IF EXISTS "Users can view sale items of their business" ON public.school_sale_items;
CREATE POLICY "Users can view sale items of their business"
ON public.school_sale_items FOR SELECT
USING (sale_id IN (
    SELECT id FROM public.school_sales WHERE business_id IN (
        SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
));

DROP POLICY IF EXISTS "Users can insert sale items" ON public.school_sale_items;
CREATE POLICY "Users can insert sale items"
ON public.school_sale_items FOR INSERT
WITH CHECK (sale_id IN (
    SELECT id FROM public.school_sales WHERE business_id IN (
        SELECT business_id FROM public.profiles WHERE id = auth.uid()
    )
));

-- Grant permissions to authenticated users
GRANT ALL ON public.school_products TO authenticated;
GRANT ALL ON public.school_stock_movements TO authenticated;
GRANT ALL ON public.school_sales TO authenticated;
GRANT ALL ON public.school_sale_items TO authenticated;

-- ============================================================================
-- WESD SYSTEMS — Bar / Restaurant Module
-- ============================================================================

-- -----------------------------------------------------------------------
-- 1. ENUMS & TYPES
-- -----------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bar_movement_type') THEN
        CREATE TYPE public.bar_movement_type AS ENUM ('ENTREE', 'VENTE', 'AJUSTEMENT', 'CASSE', 'CONSOMMATION_INTERNE', 'RETOUR_FOURNISSEUR');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bar_sale_type') THEN
        CREATE TYPE public.bar_sale_type AS ENUM ('BAR', 'RESTAURANT');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bar_payment_method') THEN
        CREATE TYPE public.bar_payment_method AS ENUM ('ESPECES', 'CARTE', 'TRANSFERT', 'CREDIT');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bar_sale_item_type') THEN
        CREATE TYPE public.bar_sale_item_type AS ENUM ('CAISSE', 'UNITE', 'COCKTAIL');
    END IF;
END$$;

-- -----------------------------------------------------------------------
-- 2. TABLES
-- -----------------------------------------------------------------------

-- Catégories par défaut (Bières, Sodas, Rhums...)
CREATE TABLE IF NOT EXISTS public.bar_categories (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                    VARCHAR(120) NOT NULL,
  default_units_per_case  INTEGER NOT NULL DEFAULT 24,
  icon                    VARCHAR(60) DEFAULT 'ti-glass',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fournisseurs
CREATE TABLE IF NOT EXISTS public.bar_suppliers (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id   UUID NOT NULL,
  name        VARCHAR(255) NOT NULL,
  phone       VARCHAR(50),
  email       VARCHAR(255),
  address     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Produits (Double Stock)
CREATE TABLE IF NOT EXISTS public.bar_products (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id             UUID NOT NULL,
  category_id           UUID REFERENCES public.bar_categories(id) ON DELETE SET NULL,
  supplier_id           UUID REFERENCES public.bar_suppliers(id) ON DELETE SET NULL,
  name                  VARCHAR(255) NOT NULL,
  brand                 VARCHAR(120),
  sku                   VARCHAR(100),
  barcode               VARCHAR(100),
  
  -- Stock
  stock_cases           INTEGER NOT NULL DEFAULT 0,
  stock_units           INTEGER NOT NULL DEFAULT 0,
  units_per_case        INTEGER NOT NULL DEFAULT 24,
  
  -- Cocktails Volume
  volume_ml             INTEGER DEFAULT 0, -- volume in ml per unit (e.g. 750 for a 750ml bottle)
  
  -- Prices
  price_per_case        NUMERIC(10, 2) NOT NULL DEFAULT 0,
  price_per_unit        NUMERIC(10, 2) NOT NULL DEFAULT 0,
  cost_per_case         NUMERIC(10, 2) NOT NULL DEFAULT 0,
  cost_per_unit         NUMERIC(10, 2) NOT NULL DEFAULT 0,
  
  -- Alerts
  min_stock_level       INTEGER NOT NULL DEFAULT 10,
  critical_stock_level  INTEGER NOT NULL DEFAULT 5,
  
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cocktails
CREATE TABLE IF NOT EXISTS public.bar_cocktails (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id   UUID NOT NULL,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  price       NUMERIC(10, 2) NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ingrédients des Cocktails
CREATE TABLE IF NOT EXISTS public.bar_cocktail_ingredients (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cocktail_id UUID NOT NULL REFERENCES public.bar_cocktails(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES public.bar_products(id) ON DELETE CASCADE,
  quantity_ml INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mouvements de stock
CREATE TABLE IF NOT EXISTS public.bar_stock_movements (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id               UUID NOT NULL,
  product_id              UUID NOT NULL REFERENCES public.bar_products(id) ON DELETE CASCADE,
  movement_type           public.bar_movement_type NOT NULL,
  quantity_cases          INTEGER NOT NULL DEFAULT 0,
  quantity_units          INTEGER NOT NULL DEFAULT 0,
  notes                   TEXT,
  reference_id            UUID,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ventes
CREATE TABLE IF NOT EXISTS public.bar_sales (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id       UUID NOT NULL,
  sale_type       public.bar_sale_type NOT NULL DEFAULT 'BAR',
  payment_method  public.bar_payment_method NOT NULL DEFAULT 'ESPECES',
  subtotal        NUMERIC(10, 2) NOT NULL DEFAULT 0,
  discount        NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total           NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status          VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Articles de Vente
CREATE TABLE IF NOT EXISTS public.bar_sale_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id     UUID NOT NULL REFERENCES public.bar_sales(id) ON DELETE CASCADE,
  product_id  UUID REFERENCES public.bar_products(id) ON DELETE CASCADE,
  cocktail_id UUID REFERENCES public.bar_cocktails(id) ON DELETE CASCADE,
  item_type   public.bar_sale_item_type NOT NULL,
  quantity    INTEGER NOT NULL,
  unit_price  NUMERIC(10, 2) NOT NULL,
  subtotal    NUMERIC(10, 2) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------
-- 3. RLS POLICIES
-- -----------------------------------------------------------------------
ALTER TABLE public.bar_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_cocktails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_cocktail_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bar_sale_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bar_categories_all" ON public.bar_categories;
CREATE POLICY "bar_categories_all" ON public.bar_categories FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "bar_suppliers_all" ON public.bar_suppliers;
CREATE POLICY "bar_suppliers_all" ON public.bar_suppliers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "bar_products_all" ON public.bar_products;
CREATE POLICY "bar_products_all" ON public.bar_products FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "bar_cocktails_all" ON public.bar_cocktails;
CREATE POLICY "bar_cocktails_all" ON public.bar_cocktails FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "bar_cocktail_ingredients_all" ON public.bar_cocktail_ingredients;
CREATE POLICY "bar_cocktail_ingredients_all" ON public.bar_cocktail_ingredients FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "bar_stock_movements_all" ON public.bar_stock_movements;
CREATE POLICY "bar_stock_movements_all" ON public.bar_stock_movements FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "bar_sales_all" ON public.bar_sales;
CREATE POLICY "bar_sales_all" ON public.bar_sales FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "bar_sale_items_all" ON public.bar_sale_items;
CREATE POLICY "bar_sale_items_all" ON public.bar_sale_items FOR ALL USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------
-- 4. SEED DATA
-- -----------------------------------------------------------------------
INSERT INTO public.bar_categories (name, default_units_per_case)
SELECT * FROM (VALUES
  ('Bières', 24),
  ('Sodas', 24),
  ('Jus', 24),
  ('Eaux', 24),
  ('Boissons énergisantes', 24),
  ('Boissons maltées', 24),
  ('Rhums', 12),
  ('Vins', 12),
  ('Champagnes', 6),
  ('Liqueurs premium', 12),
  ('Cafés', 1),
  ('Thés', 1),
  ('Cocktails', 1),
  ('Autres boissons', 24)
) AS v(name, default_units_per_case)
WHERE NOT EXISTS (
  SELECT 1 FROM public.bar_categories LIMIT 1
);

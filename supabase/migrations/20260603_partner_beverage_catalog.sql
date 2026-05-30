-- ============================================================================
-- Wesd Systems - Partner registration + global beverage catalog
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Partner registration enrichment
-- ---------------------------------------------------------------------------

ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS partner_type TEXT,
  ADD COLUMN IF NOT EXISTS facebook_url TEXT,
  ADD COLUMN IF NOT EXISTS instagram_url TEXT,
  ADD COLUMN IF NOT EXISTS tiktok_url TEXT,
  ADD COLUMN IF NOT EXISTS youtube_url TEXT,
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS moncash_number TEXT,
  ADD COLUMN IF NOT EXISTS natcash_number TEXT,
  ADD COLUMN IF NOT EXISTS bank_account JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS application_source TEXT DEFAULT 'self_service',
  ADD COLUMN IF NOT EXISTS code_generated_at TIMESTAMPTZ;

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL;

CREATE SEQUENCE IF NOT EXISTS public.partner_code_sequence START 1;

CREATE OR REPLACE FUNCTION public.generate_partner_code(p_full_name TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_base TEXT;
  v_code TEXT;
  v_suffix TEXT;
BEGIN
  v_base := upper(regexp_replace(coalesce(p_full_name, ''), '[^A-Za-z0-9]+', '', 'g'));

  IF length(v_base) < 6 THEN
    v_base := 'PARTNER';
  END IF;

  v_code := v_base;

  IF EXISTS (SELECT 1 FROM public.partners WHERE referral_code = v_code) THEN
    v_suffix := lpad(nextval('public.partner_code_sequence')::TEXT, 4, '0');
    IF v_base = 'PARTNER' THEN
      v_code := 'PARTNER-' || v_suffix;
    ELSE
      v_code := v_base || '-' || v_suffix;
    END IF;
  END IF;

  WHILE EXISTS (SELECT 1 FROM public.partners WHERE referral_code = v_code) LOOP
    v_suffix := lpad(nextval('public.partner_code_sequence')::TEXT, 4, '0');
    v_code := 'PARTNER-' || v_suffix;
  END LOOP;

  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_partner_application(
  p_partner_id UUID,
  p_partner_tier_id UUID DEFAULT NULL
)
RETURNS public.partners
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner public.partners%ROWTYPE;
  v_code TEXT;
BEGIN
  SELECT * INTO v_partner
  FROM public.partners
  WHERE id = p_partner_id
  FOR UPDATE;

  IF v_partner.id IS NULL THEN
    RAISE EXCEPTION 'Partner not found';
  END IF;

  v_code := public.generate_partner_code(coalesce(v_partner.full_name, v_partner.display_name));

  UPDATE public.partners
  SET
    status = 'active',
    referral_code = v_code,
    referral_url = 'https://wesdsystems.store/register?ref=' || v_code,
    partner_tier_id = COALESCE(p_partner_tier_id, partner_tier_id),
    approved_at = now(),
    code_generated_at = now(),
    updated_at = now()
  WHERE id = p_partner_id
  RETURNING * INTO v_partner;

  RETURN v_partner;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_partner_application(UUID, UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Global beverage catalog
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.master_beverage_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.master_beverage_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.master_beverages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.master_beverage_categories(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES public.master_beverage_brands(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  brand TEXT,
  sku TEXT UNIQUE,
  description TEXT,
  units_per_case INTEGER NOT NULL DEFAULT 24,
  image_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.salon_beverages
  ADD COLUMN IF NOT EXISTS master_beverage_id UUID REFERENCES public.master_beverages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS catalog_category_id UUID REFERENCES public.master_beverage_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_custom BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS catalog_brand TEXT;

CREATE INDEX IF NOT EXISTS idx_master_beverages_category_id ON public.master_beverages(category_id);
CREATE INDEX IF NOT EXISTS idx_master_beverages_brand_id ON public.master_beverages(brand_id);
CREATE INDEX IF NOT EXISTS idx_salon_beverages_master_beverage_id ON public.salon_beverages(master_beverage_id);

CREATE OR REPLACE FUNCTION public.set_master_catalog_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_master_beverage_categories_updated_at ON public.master_beverage_categories;
CREATE TRIGGER trg_master_beverage_categories_updated_at
  BEFORE UPDATE ON public.master_beverage_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_master_catalog_updated_at();

DROP TRIGGER IF EXISTS trg_master_beverage_brands_updated_at ON public.master_beverage_brands;
CREATE TRIGGER trg_master_beverage_brands_updated_at
  BEFORE UPDATE ON public.master_beverage_brands
  FOR EACH ROW EXECUTE FUNCTION public.set_master_catalog_updated_at();

DROP TRIGGER IF EXISTS trg_master_beverages_updated_at ON public.master_beverages;
CREATE TRIGGER trg_master_beverages_updated_at
  BEFORE UPDATE ON public.master_beverages
  FOR EACH ROW EXECUTE FUNCTION public.set_master_catalog_updated_at();

INSERT INTO public.master_beverage_categories (name, slug, description, sort_order, active)
VALUES
  ('Beer', 'beer', 'Bières et lagers', 1, true),
  ('Malta', 'malta', 'Boissons malta', 2, true),
  ('Soft Drinks', 'soft-drinks', 'Boissons gazeuses', 3, true),
  ('Energy Drinks', 'energy-drinks', 'Boissons énergisantes', 4, true),
  ('Water', 'water', 'Eaux plates et minérales', 5, true),
  ('Juices', 'juices', 'Jus et nectars', 6, true),
  ('Salon Products', 'salon-products', 'Produits de salon', 7, true)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    active = EXCLUDED.active,
    updated_at = now();

INSERT INTO public.master_beverage_brands (name, description, active)
VALUES
  ('Prestige', 'Brasserie Nationale', true),
  ('Guinness', 'Guinness brand', true),
  ('Heineken', 'Heineken brand', true),
  ('Turbo King', 'Turbo King brand', true),
  ('Malta H', 'Malta H brand', true),
  ('Cola Couronne', 'Cola Couronne brand', true),
  ('Coca-Cola', 'Coca-Cola brand', true),
  ('Sprite', 'Sprite brand', true),
  ('Fanta', 'Fanta brand', true),
  ('Pepsi', 'Pepsi brand', true),
  ('7UP', '7UP brand', true),
  ('Toro', 'Toro brand', true),
  ('Ragaman', 'Ragaman brand', true),
  ('Culligan', 'Culligan brand', true),
  ('Cristalline', 'Cristalline brand', true),
  ('Tampico', 'Tampico brand', true),
  ('Del Prado', 'Del Prado brand', true),
  ('Hair Gel', 'Salon product', true),
  ('Shampoo', 'Salon product', true),
  ('Conditioner', 'Salon product', true),
  ('Beard Oil', 'Salon product', true),
  ('Hair Wax', 'Salon product', true),
  ('Hair Color', 'Salon product', true),
  ('Nail Polish', 'Salon product', true),
  ('Acetone', 'Salon product', true),
  ('Facial Cream', 'Salon product', true)
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description,
    active = EXCLUDED.active,
    updated_at = now();

WITH category_lookup AS (
  SELECT id, slug FROM public.master_beverage_categories
),
brand_lookup AS (
  SELECT id, name FROM public.master_beverage_brands
)
INSERT INTO public.master_beverages (category_id, brand_id, name, brand, sku, description, units_per_case, image_url, active, sort_order)
VALUES
  ((SELECT id FROM category_lookup WHERE slug = 'beer'), (SELECT id FROM brand_lookup WHERE name = 'Prestige'), 'Prestige', 'Prestige', 'BEV-PRESTIGE', 'Beer from Haiti', 24, NULL, true, 1),
  ((SELECT id FROM category_lookup WHERE slug = 'beer'), (SELECT id FROM brand_lookup WHERE name = 'Guinness'), 'Guinness', 'Guinness', 'BEV-GUINNESS', 'Beer from Haiti', 24, NULL, true, 2),
  ((SELECT id FROM category_lookup WHERE slug = 'beer'), (SELECT id FROM brand_lookup WHERE name = 'Heineken'), 'Heineken', 'Heineken', 'BEV-HEINEKEN', 'Beer from Haiti', 24, NULL, true, 3),
  ((SELECT id FROM category_lookup WHERE slug = 'beer'), (SELECT id FROM brand_lookup WHERE name = 'Turbo King'), 'Turbo King', 'Turbo King', 'BEV-TURBOKING', 'Beer from Haiti', 24, NULL, true, 4),
  ((SELECT id FROM category_lookup WHERE slug = 'malta'), (SELECT id FROM brand_lookup WHERE name = 'Malta H'), 'Malta H', 'Malta H', 'BEV-MALTAH', 'Malta beverage', 24, NULL, true, 1),
  ((SELECT id FROM category_lookup WHERE slug = 'soft-drinks'), (SELECT id FROM brand_lookup WHERE name = 'Cola Couronne'), 'Cola Couronne', 'Cola Couronne', 'BEV-COLACOURONNE', 'Soft drink', 24, NULL, true, 1),
  ((SELECT id FROM category_lookup WHERE slug = 'soft-drinks'), (SELECT id FROM brand_lookup WHERE name = 'Coca-Cola'), 'Coca-Cola', 'Coca-Cola', 'BEV-COCACOLA', 'Soft drink', 24, NULL, true, 2),
  ((SELECT id FROM category_lookup WHERE slug = 'soft-drinks'), (SELECT id FROM brand_lookup WHERE name = 'Sprite'), 'Sprite', 'Sprite', 'BEV-SPRITE', 'Soft drink', 24, NULL, true, 3),
  ((SELECT id FROM category_lookup WHERE slug = 'soft-drinks'), (SELECT id FROM brand_lookup WHERE name = 'Fanta'), 'Fanta', 'Fanta', 'BEV-FANTA', 'Soft drink', 24, NULL, true, 4),
  ((SELECT id FROM category_lookup WHERE slug = 'soft-drinks'), (SELECT id FROM brand_lookup WHERE name = 'Pepsi'), 'Pepsi', 'Pepsi', 'BEV-PEPSI', 'Soft drink', 24, NULL, true, 5),
  ((SELECT id FROM category_lookup WHERE slug = 'soft-drinks'), (SELECT id FROM brand_lookup WHERE name = '7UP'), '7UP', '7UP', 'BEV-7UP', 'Soft drink', 24, NULL, true, 6),
  ((SELECT id FROM category_lookup WHERE slug = 'energy-drinks'), (SELECT id FROM brand_lookup WHERE name = 'Toro'), 'Toro', 'Toro', 'BEV-TORO', 'Energy drink', 24, NULL, true, 1),
  ((SELECT id FROM category_lookup WHERE slug = 'energy-drinks'), (SELECT id FROM brand_lookup WHERE name = 'Ragaman'), 'Ragaman', 'Ragaman', 'BEV-RAGAMAN', 'Energy drink', 24, NULL, true, 2),
  ((SELECT id FROM category_lookup WHERE slug = 'water'), (SELECT id FROM brand_lookup WHERE name = 'Culligan'), 'Culligan', 'Culligan', 'BEV-CULLIGAN', 'Water', 24, NULL, true, 1),
  ((SELECT id FROM category_lookup WHERE slug = 'water'), (SELECT id FROM brand_lookup WHERE name = 'Cristalline'), 'Cristalline', 'Cristalline', 'BEV-CRISTALLINE', 'Water', 24, NULL, true, 2),
  ((SELECT id FROM category_lookup WHERE slug = 'juices'), (SELECT id FROM brand_lookup WHERE name = 'Tampico'), 'Tampico', 'Tampico', 'BEV-TAMPICO', 'Juice', 24, NULL, true, 1),
  ((SELECT id FROM category_lookup WHERE slug = 'juices'), (SELECT id FROM brand_lookup WHERE name = 'Del Prado'), 'Del Prado', 'Del Prado', 'BEV-DELPRADO', 'Juice', 24, NULL, true, 2),
  ((SELECT id FROM category_lookup WHERE slug = 'salon-products'), (SELECT id FROM brand_lookup WHERE name = 'Hair Gel'), 'Hair Gel', 'Hair Gel', 'SALON-HAIR-GEL', 'Salon product', 12, NULL, true, 1),
  ((SELECT id FROM category_lookup WHERE slug = 'salon-products'), (SELECT id FROM brand_lookup WHERE name = 'Shampoo'), 'Shampoo', 'Shampoo', 'SALON-SHAMPOO', 'Salon product', 12, NULL, true, 2),
  ((SELECT id FROM category_lookup WHERE slug = 'salon-products'), (SELECT id FROM brand_lookup WHERE name = 'Conditioner'), 'Conditioner', 'Conditioner', 'SALON-CONDITIONER', 'Salon product', 12, NULL, true, 3),
  ((SELECT id FROM category_lookup WHERE slug = 'salon-products'), (SELECT id FROM brand_lookup WHERE name = 'Beard Oil'), 'Beard Oil', 'Beard Oil', 'SALON-BEARDOIL', 'Salon product', 12, NULL, true, 4),
  ((SELECT id FROM category_lookup WHERE slug = 'salon-products'), (SELECT id FROM brand_lookup WHERE name = 'Hair Wax'), 'Hair Wax', 'Hair Wax', 'SALON-HAIRWAX', 'Salon product', 12, NULL, true, 5),
  ((SELECT id FROM category_lookup WHERE slug = 'salon-products'), (SELECT id FROM brand_lookup WHERE name = 'Hair Color'), 'Hair Color', 'Hair Color', 'SALON-HAIRCOLOR', 'Salon product', 12, NULL, true, 6),
  ((SELECT id FROM category_lookup WHERE slug = 'salon-products'), (SELECT id FROM brand_lookup WHERE name = 'Nail Polish'), 'Nail Polish', 'Nail Polish', 'SALON-NAILPOLISH', 'Salon product', 12, NULL, true, 7),
  ((SELECT id FROM category_lookup WHERE slug = 'salon-products'), (SELECT id FROM brand_lookup WHERE name = 'Acetone'), 'Acetone', 'Acetone', 'SALON-ACETONE', 'Salon product', 12, NULL, true, 8),
  ((SELECT id FROM category_lookup WHERE slug = 'salon-products'), (SELECT id FROM brand_lookup WHERE name = 'Facial Cream'), 'Facial Cream', 'Facial Cream', 'SALON-FACIALCREAM', 'Salon product', 12, NULL, true, 9)
ON CONFLICT (sku) DO UPDATE
SET name = EXCLUDED.name,
    brand = EXCLUDED.brand,
    description = EXCLUDED.description,
    units_per_case = EXCLUDED.units_per_case,
    image_url = EXCLUDED.image_url,
    active = EXCLUDED.active,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

-- ---------------------------------------------------------------------------
-- Import helper for business beverage catalog
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.import_standard_beverage_catalog(
  p_branch_id UUID,
  p_include_salon_products BOOLEAN DEFAULT true
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted INTEGER := 0;
BEGIN
  INSERT INTO public.salon_beverages (
    branch_id, master_beverage_id, catalog_category_id, catalog_brand, is_custom,
    sku, name, description, brand, unit_price, cost_price, units_per_case,
    stock_cases, stock_units, reorder_level_units, barcode, is_active
  )
  SELECT
    p_branch_id,
    mb.id,
    mb.category_id,
    COALESCE(mb.brand, mb.name),
    false,
    mb.sku,
    mb.name,
    mb.description,
    COALESCE(mb.brand, mb.name),
    0,
    NULL,
    mb.units_per_case,
    0,
    0,
    50,
    NULL,
    true
  FROM public.master_beverages mb
  WHERE mb.active = true
    AND (
      p_include_salon_products
      OR mb.category_id <> (SELECT id FROM public.master_beverage_categories WHERE slug = 'salon-products' LIMIT 1)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.salon_beverages sb
      WHERE sb.branch_id = p_branch_id
        AND sb.master_beverage_id = mb.id
    );

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.import_standard_beverage_catalog(UUID, BOOLEAN) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.master_beverage_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_beverage_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_beverages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "master beverage categories readable" ON public.master_beverage_categories;
CREATE POLICY "master beverage categories readable" ON public.master_beverage_categories
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "master beverage categories manage" ON public.master_beverage_categories;
CREATE POLICY "master beverage categories manage" ON public.master_beverage_categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

DROP POLICY IF EXISTS "master beverage brands readable" ON public.master_beverage_brands;
CREATE POLICY "master beverage brands readable" ON public.master_beverage_brands
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "master beverage brands manage" ON public.master_beverage_brands;
CREATE POLICY "master beverage brands manage" ON public.master_beverage_brands
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

DROP POLICY IF EXISTS "master beverages readable" ON public.master_beverages;
CREATE POLICY "master beverages readable" ON public.master_beverages
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "master beverages manage" ON public.master_beverages;
CREATE POLICY "master beverages manage" ON public.master_beverages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

DROP POLICY IF EXISTS "partner application self access" ON public.partners;
CREATE POLICY "partner application self access" ON public.partners
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

DROP POLICY IF EXISTS "partner application self insert" ON public.partners;
CREATE POLICY "partner application self insert" ON public.partners
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "partner application manage" ON public.partners;
CREATE POLICY "partner application manage" ON public.partners
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
    OR user_id = auth.uid()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
    OR user_id = auth.uid()
  );


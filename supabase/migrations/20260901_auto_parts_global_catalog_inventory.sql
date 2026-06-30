-- ============================================================================
-- WESD AUTO PARTS: GLOBAL PRODUCT CATALOG + PER-BUSINESS INVENTORY
--
-- auto_parts_products becomes the global catalog.
-- auto_parts_product_inventory stores business-specific stock/prices.
-- ============================================================================

ALTER TABLE public.auto_parts_products
  ADD COLUMN IF NOT EXISTS oem_code TEXT,
  ADD COLUMN IF NOT EXISTS manufacturer TEXT,
  ADD COLUMN IF NOT EXISTS subcategory TEXT,
  ADD COLUMN IF NOT EXISTS compatible_vehicle TEXT,
  ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'piece';

ALTER TABLE public.auto_parts_stock_movements
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12,2);

ALTER TABLE public.auto_parts_products
  ALTER COLUMN unit_price DROP NOT NULL,
  ALTER COLUMN cost_price DROP NOT NULL,
  ALTER COLUMN min_stock SET DEFAULT 0;

ALTER TABLE public.auto_parts_products
  ALTER COLUMN business_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.auto_parts_product_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES public.auto_parts_products(id) ON DELETE CASCADE,
  cost_price NUMERIC(12,2),
  unit_price NUMERIC(12,2),
  stock_quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
  reserved_quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
  min_stock NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_stock NUMERIC(10,2),
  location TEXT,
  entry_date TIMESTAMPTZ,
  preferred_supplier_id UUID REFERENCES public.auto_parts_suppliers(id) ON DELETE SET NULL,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_auto_parts_inventory_business_product_main
  ON public.auto_parts_product_inventory(business_id, product_id)
  WHERE branch_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_auto_parts_inventory_business_branch_product
  ON public.auto_parts_product_inventory(business_id, branch_id, product_id)
  WHERE branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_auto_parts_inventory_product
  ON public.auto_parts_product_inventory(product_id);

CREATE INDEX IF NOT EXISTS idx_auto_parts_inventory_business_stock
  ON public.auto_parts_product_inventory(business_id, stock_quantity);

ALTER TABLE public.auto_parts_product_inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auto_parts_product_inventory_tenant_guard ON public.auto_parts_product_inventory;
CREATE POLICY auto_parts_product_inventory_tenant_guard
  ON public.auto_parts_product_inventory
  FOR ALL
  USING (public.is_super_admin() OR business_id = public.current_user_business_id())
  WITH CHECK (public.is_super_admin() OR business_id = public.current_user_business_id());

DROP POLICY IF EXISTS auto_parts_products_tenant_guard ON public.auto_parts_products;
DROP POLICY IF EXISTS auto_parts_products_global_read ON public.auto_parts_products;
CREATE POLICY auto_parts_products_global_read
  ON public.auto_parts_products
  FOR SELECT
  USING (auth.uid() IS NOT NULL OR public.is_super_admin());

DROP POLICY IF EXISTS auto_parts_products_global_write ON public.auto_parts_products;
CREATE POLICY auto_parts_products_global_write
  ON public.auto_parts_products
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ============================================================================
-- Normalize existing products into one global catalog row per logical product.
-- Existing commercial values are copied into inventory before tenant ownership is
-- removed from the catalog rows.
-- ============================================================================

CREATE TEMP TABLE tmp_auto_parts_product_canon ON COMMIT DROP AS
WITH keyed AS (
  SELECT
    id,
    business_id,
    branch_id,
    lower(regexp_replace(coalesce(nullif(btrim(sku), ''), nullif(btrim(barcode), ''), btrim(name)), '\s+', ' ', 'g')) AS product_key
  FROM public.auto_parts_products
),
canon AS (
  SELECT product_key, min(id::text)::uuid AS canonical_id
  FROM keyed
  GROUP BY product_key
)
SELECT k.id AS old_id, k.business_id, k.branch_id, c.canonical_id
FROM keyed k
JOIN canon c ON c.product_key = k.product_key;

INSERT INTO public.auto_parts_product_inventory (
  business_id, branch_id, product_id, cost_price, unit_price, stock_quantity,
  reserved_quantity, min_stock, max_stock, location, notes, active, created_at, updated_at
)
SELECT DISTINCT ON (p.business_id, p.branch_id, m.canonical_id)
  p.business_id,
  p.branch_id,
  m.canonical_id,
  p.cost_price,
  p.unit_price,
  COALESCE(p.stock_quantity, 0),
  COALESCE(p.reserved_quantity, 0),
  COALESCE(p.min_stock, 0),
  p.max_stock,
  p.location,
  p.notes,
  COALESCE(p.active, true),
  COALESCE(p.created_at, now()),
  COALESCE(p.updated_at, now())
FROM public.auto_parts_products p
JOIN tmp_auto_parts_product_canon m ON m.old_id = p.id
WHERE p.business_id IS NOT NULL
ORDER BY p.business_id, p.branch_id, m.canonical_id, p.updated_at DESC NULLS LAST
ON CONFLICT DO NOTHING;

UPDATE public.auto_parts_sale_items si
SET product_id = m.canonical_id
FROM tmp_auto_parts_product_canon m
WHERE si.product_id = m.old_id
  AND si.product_id <> m.canonical_id;

UPDATE public.auto_parts_purchase_items pi
SET product_id = m.canonical_id
FROM tmp_auto_parts_product_canon m
WHERE pi.product_id = m.old_id
  AND pi.product_id <> m.canonical_id;

UPDATE public.auto_parts_stock_movements sm
SET product_id = m.canonical_id
FROM tmp_auto_parts_product_canon m
WHERE sm.product_id = m.old_id
  AND sm.product_id <> m.canonical_id;

UPDATE public.auto_parts_vehicle_compatibilities vc
SET product_id = m.canonical_id
FROM tmp_auto_parts_product_canon m
WHERE vc.product_id = m.old_id
  AND vc.product_id <> m.canonical_id;

DELETE FROM public.auto_parts_products p
USING tmp_auto_parts_product_canon m
WHERE p.id = m.old_id
  AND m.old_id <> m.canonical_id;

UPDATE public.auto_parts_products
SET
  business_id = NULL,
  salon_id = NULL,
  branch_id = NULL,
  unit_price = NULL,
  cost_price = NULL,
  stock_quantity = 0,
  reserved_quantity = 0,
  min_stock = 0,
  max_stock = NULL,
  location = NULL,
  updated_at = now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_auto_parts_products_global_sku
  ON public.auto_parts_products(lower(sku))
  WHERE sku IS NOT NULL AND btrim(sku) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_auto_parts_products_global_barcode
  ON public.auto_parts_products(lower(barcode))
  WHERE barcode IS NOT NULL AND btrim(barcode) <> '';

DROP TRIGGER IF EXISTS trg_auto_parts_products_sync_salon_id ON public.auto_parts_products;
DROP TRIGGER IF EXISTS trg_auto_parts_products_set_branch_id ON public.auto_parts_products;
DROP TRIGGER IF EXISTS trg_auto_parts_low_stock ON public.auto_parts_products;
DROP TRIGGER IF EXISTS trg_auto_parts_categories_sync_salon_id ON public.auto_parts_categories;
DROP TRIGGER IF EXISTS trg_auto_parts_categories_set_branch_id ON public.auto_parts_categories;

UPDATE public.auto_parts_categories
SET business_id = NULL,
    salon_id = NULL,
    branch_id = NULL;

DROP POLICY IF EXISTS auto_parts_categories_tenant_guard ON public.auto_parts_categories;
DROP POLICY IF EXISTS auto_parts_categories_global_read ON public.auto_parts_categories;
CREATE POLICY auto_parts_categories_global_read
  ON public.auto_parts_categories
  FOR SELECT
  USING (auth.uid() IS NOT NULL OR public.is_super_admin());

DROP POLICY IF EXISTS auto_parts_categories_global_write ON public.auto_parts_categories;
CREATE POLICY auto_parts_categories_global_write
  ON public.auto_parts_categories
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ============================================================================
-- Seed a realistic global catalog. Prices and stock remain NULL/0 per business.
-- ============================================================================

WITH cat AS (
  SELECT id, name FROM public.auto_parts_categories
),
brands(name) AS (
  VALUES
    ('Bosch'), ('Denso'), ('NGK'), ('Valeo'), ('SKF'), ('Gates'), ('Continental'),
    ('Brembo'), ('TRW'), ('Delphi'), ('Mann Filter'), ('Mahle'), ('Monroe'),
    ('KYB'), ('Sachs'), ('Aisin'), ('Total'), ('Mobil'), ('Shell'), ('Castrol')
),
parts(name, category, subcategory, unit) AS (
  VALUES
    ('Filtre à huile', 'Moteur', 'Filtration', 'piece'),
    ('Filtre à air', 'Moteur', 'Filtration', 'piece'),
    ('Filtre à carburant', 'Moteur', 'Filtration', 'piece'),
    ('Filtre habitacle', 'Moteur', 'Filtration', 'piece'),
    ('Huile moteur 5W30', 'Moteur', 'Lubrifiant', 'bidon'),
    ('Huile moteur 10W40', 'Moteur', 'Lubrifiant', 'bidon'),
    ('Courroie distribution', 'Moteur', 'Distribution', 'piece'),
    ('Courroie accessoires', 'Moteur', 'Distribution', 'piece'),
    ('Galet tendeur', 'Moteur', 'Distribution', 'piece'),
    ('Pompe à eau', 'Moteur', 'Refroidissement', 'piece'),
    ('Joint de culasse', 'Moteur', 'Joints', 'piece'),
    ('Piston', 'Moteur', 'Interne moteur', 'piece'),
    ('Segments piston', 'Moteur', 'Interne moteur', 'jeu'),
    ('Soupape admission', 'Moteur', 'Interne moteur', 'piece'),
    ('Soupape échappement', 'Moteur', 'Interne moteur', 'piece'),
    ('Arbre à cames', 'Moteur', 'Interne moteur', 'piece'),
    ('Vilebrequin', 'Moteur', 'Interne moteur', 'piece'),
    ('Coussinets moteur', 'Moteur', 'Interne moteur', 'jeu'),
    ('Bougie allumage', 'Moteur', 'Allumage', 'piece'),
    ('Bougie préchauffage', 'Moteur', 'Allumage', 'piece'),
    ('Bobine allumage', 'Moteur', 'Allumage', 'piece'),
    ('Injecteur carburant', 'Moteur', 'Injection', 'piece'),
    ('Pompe à carburant', 'Moteur', 'Injection', 'piece'),
    ('Turbo compresseur', 'Moteur', 'Suralimentation', 'piece'),
    ('Intercooler', 'Moteur', 'Suralimentation', 'piece'),
    ('Thermostat', 'Moteur', 'Refroidissement', 'piece'),
    ('Radiateur moteur', 'Moteur', 'Refroidissement', 'piece'),
    ('Plaquettes de frein', 'Freinage', 'Freins disque', 'jeu'),
    ('Disques de frein', 'Freinage', 'Freins disque', 'jeu'),
    ('Tambour de frein', 'Freinage', 'Freins tambour', 'piece'),
    ('Mâchoires de frein', 'Freinage', 'Freins tambour', 'jeu'),
    ('Étrier de frein', 'Freinage', 'Hydraulique', 'piece'),
    ('Maître-cylindre frein', 'Freinage', 'Hydraulique', 'piece'),
    ('Servo-frein', 'Freinage', 'Hydraulique', 'piece'),
    ('Liquide de frein DOT4', 'Freinage', 'Liquide', 'bidon'),
    ('Flexible de frein', 'Freinage', 'Hydraulique', 'piece'),
    ('Capteur ABS', 'Freinage', 'ABS', 'piece'),
    ('Amortisseur avant', 'Suspension', 'Amortissement', 'piece'),
    ('Amortisseur arrière', 'Suspension', 'Amortissement', 'piece'),
    ('Ressort suspension', 'Suspension', 'Ressort', 'piece'),
    ('Rotule suspension', 'Suspension', 'Train roulant', 'piece'),
    ('Biellette stabilisatrice', 'Suspension', 'Train roulant', 'piece'),
    ('Bras de suspension', 'Suspension', 'Train roulant', 'piece'),
    ('Silentbloc suspension', 'Suspension', 'Train roulant', 'piece'),
    ('Roulement de roue', 'Suspension', 'Roulements', 'piece'),
    ('Kit embrayage', 'Transmission', 'Embrayage', 'kit'),
    ('Volant moteur', 'Transmission', 'Embrayage', 'piece'),
    ('Cardan complet', 'Transmission', 'Cardan', 'piece'),
    ('Soufflet cardan', 'Transmission', 'Cardan', 'piece'),
    ('Boîte manuelle', 'Transmission', 'Boîte de vitesses', 'piece'),
    ('Boîte automatique', 'Transmission', 'Boîte de vitesses', 'piece'),
    ('Différentiel', 'Transmission', 'Pont', 'piece'),
    ('Crémaillère direction', 'Direction', 'Direction', 'piece'),
    ('Pompe de direction', 'Direction', 'Direction assistée', 'piece'),
    ('Rotule de direction', 'Direction', 'Direction', 'piece'),
    ('Colonne de direction', 'Direction', 'Direction', 'piece'),
    ('Radiateur refroidissement', 'Refroidissement', 'Circuit eau', 'piece'),
    ('Ventilateur radiateur', 'Refroidissement', 'Ventilation', 'piece'),
    ('Vase expansion', 'Refroidissement', 'Circuit eau', 'piece'),
    ('Durite radiateur', 'Refroidissement', 'Circuit eau', 'piece'),
    ('Compresseur climatisation', 'Climatisation', 'Climatisation', 'piece'),
    ('Condenseur climatisation', 'Climatisation', 'Climatisation', 'piece'),
    ('Évaporateur climatisation', 'Climatisation', 'Climatisation', 'piece'),
    ('Filtre déshydrateur', 'Climatisation', 'Climatisation', 'piece'),
    ('Batterie 12V', 'Électricité', 'Alimentation', 'piece'),
    ('Alternateur', 'Électricité', 'Charge', 'piece'),
    ('Démarreur', 'Électricité', 'Démarrage', 'piece'),
    ('Fusibles auto', 'Électricité', 'Protection', 'boite'),
    ('Relais 12V', 'Électricité', 'Commande', 'piece'),
    ('Ampoule H4', 'Électricité', 'Éclairage', 'piece'),
    ('Capteur moteur', 'Électricité', 'Capteurs', 'piece'),
    ('Calculateur ECU', 'Électricité', 'Électronique', 'piece'),
    ('Pare-chocs avant', 'Carrosserie', 'Extérieur', 'piece'),
    ('Pare-chocs arrière', 'Carrosserie', 'Extérieur', 'piece'),
    ('Capot moteur', 'Carrosserie', 'Extérieur', 'piece'),
    ('Aile avant', 'Carrosserie', 'Extérieur', 'piece'),
    ('Portière', 'Carrosserie', 'Extérieur', 'piece'),
    ('Coffre arrière', 'Carrosserie', 'Extérieur', 'piece'),
    ('Pare-brise', 'Carrosserie', 'Vitrage', 'piece'),
    ('Rétroviseur', 'Carrosserie', 'Extérieur', 'piece'),
    ('Phare avant', 'Carrosserie', 'Éclairage', 'piece'),
    ('Feu arrière', 'Carrosserie', 'Éclairage', 'piece'),
    ('Pneu tourisme', 'Pneus', 'Pneumatiques', 'piece'),
    ('Jante aluminium', 'Jantes', 'Roues', 'piece'),
    ('Valve pneu', 'Pneus', 'Accessoires roue', 'piece'),
    ('Écrous de roue', 'Jantes', 'Accessoires roue', 'jeu'),
    ('Graisse multiusage', 'Huiles et Lubrifiants', 'Graisse', 'tube'),
    ('Liquide refroidissement', 'Huiles et Lubrifiants', 'Liquide', 'bidon'),
    ('Liquide direction assistée', 'Huiles et Lubrifiants', 'Liquide', 'bidon'),
    ('Liquide lave-glace', 'Huiles et Lubrifiants', 'Liquide', 'bidon'),
    ('Additif carburant', 'Huiles et Lubrifiants', 'Additif', 'flacon'),
    ('Nettoyant injecteurs', 'Huiles et Lubrifiants', 'Additif', 'flacon')
)
INSERT INTO public.auto_parts_products (
  name, description, category_id, sku, manufacturer, subcategory, unit,
  active, business_id, salon_id, branch_id, unit_price, cost_price,
  stock_quantity, reserved_quantity, min_stock
)
SELECT
  p.name || ' - ' || b.name,
  p.name || ' ' || b.name || ' pour catalogue global Auto-Part',
  c.id,
  upper(regexp_replace(b.name, '[^A-Za-z0-9]+', '', 'g')) || '-' ||
    upper(regexp_replace(p.name, '[^A-Za-z0-9]+', '', 'g')),
  b.name,
  p.subcategory,
  p.unit,
  true,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  0,
  0,
  0
FROM parts p
JOIN brands b ON true
JOIN cat c ON c.name = p.category
ON CONFLICT DO NOTHING;

-- Every business gets an inventory row for every global product.
INSERT INTO public.auto_parts_product_inventory (
  business_id, product_id, stock_quantity, reserved_quantity, min_stock,
  cost_price, unit_price, active
)
SELECT b.id, p.id, 0, 0, 0, NULL, NULL, true
FROM public.businesses b
CROSS JOIN public.auto_parts_products p
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Helpers and triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_parts_touch_inventory_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_parts_inventory_updated_at ON public.auto_parts_product_inventory;
CREATE TRIGGER trg_auto_parts_inventory_updated_at
  BEFORE UPDATE ON public.auto_parts_product_inventory
  FOR EACH ROW EXECUTE FUNCTION public.auto_parts_touch_inventory_updated_at();

CREATE OR REPLACE FUNCTION public.ensure_auto_parts_inventory_for_business(p_business_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.auto_parts_product_inventory (
    business_id, product_id, stock_quantity, reserved_quantity, min_stock,
    cost_price, unit_price, active
  )
  SELECT p_business_id, p.id, 0, 0, 0, NULL, NULL, true
  FROM public.auto_parts_products p
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_parts_seed_inventory_for_new_business()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.ensure_auto_parts_inventory_for_business(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_parts_seed_inventory_for_new_business ON public.businesses;
CREATE TRIGGER trg_auto_parts_seed_inventory_for_new_business
  AFTER INSERT ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.auto_parts_seed_inventory_for_new_business();

CREATE OR REPLACE FUNCTION public.auto_parts_inventory_row_json(
  p public.auto_parts_products,
  i public.auto_parts_product_inventory,
  c public.auto_parts_categories,
  p_business_id UUID
)
RETURNS JSONB LANGUAGE sql STABLE AS $$
  SELECT to_jsonb(p)
    || jsonb_build_object(
      'business_id', p_business_id,
      'branch_id', i.branch_id,
      'unit_price', i.unit_price,
      'cost_price', i.cost_price,
      'stock_quantity', COALESCE(i.stock_quantity, 0),
      'reserved_quantity', COALESCE(i.reserved_quantity, 0),
      'available_quantity', GREATEST(COALESCE(i.stock_quantity, 0) - COALESCE(i.reserved_quantity, 0), 0),
      'min_stock', COALESCE(i.min_stock, 0),
      'max_stock', i.max_stock,
      'location', i.location,
      'notes', COALESCE(i.notes, p.notes),
      'active', COALESCE(p.active, true) AND COALESCE(i.active, true),
      'inventory_id', i.id,
      'preferred_supplier_id', i.preferred_supplier_id,
      'entry_date', i.entry_date,
      'category', CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object('id', c.id, 'name', c.name) END
    );
$$;

-- ============================================================================
-- Product/catalog RPCs
-- ============================================================================

DROP FUNCTION IF EXISTS public.auto_parts_list_products(UUID);
DROP FUNCTION IF EXISTS public.auto_parts_list_products(UUID, UUID);
CREATE OR REPLACE FUNCTION public.auto_parts_list_products(p_business_id UUID, p_branch_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.ensure_auto_parts_inventory_for_business(p_business_id);

  RETURN COALESCE(jsonb_agg(public.auto_parts_inventory_row_json(p, i, c, p_business_id) ORDER BY p.name), '[]'::jsonb)
  FROM public.auto_parts_products p
  LEFT JOIN public.auto_parts_categories c ON c.id = p.category_id
  LEFT JOIN LATERAL (
    SELECT inv.*
    FROM public.auto_parts_product_inventory inv
    WHERE inv.business_id = p_business_id
      AND inv.product_id = p.id
      AND (p_branch_id IS NULL OR inv.branch_id = p_branch_id OR inv.branch_id IS NULL)
    ORDER BY CASE WHEN inv.branch_id = p_branch_id THEN 0 ELSE 1 END
    LIMIT 1
  ) i ON true
  WHERE COALESCE(p.active, true) = true
    AND COALESCE(i.active, true) = true;
END;
$$;

DROP FUNCTION IF EXISTS public.auto_parts_list_products_full(UUID);
DROP FUNCTION IF EXISTS public.auto_parts_list_products_full(UUID, TEXT);
DROP FUNCTION IF EXISTS public.auto_parts_list_products_full(UUID, TEXT, UUID);
CREATE OR REPLACE FUNCTION public.auto_parts_list_products_full(
  p_business_id UUID,
  p_session_token TEXT DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_session_token IS NOT NULL
     AND NOT public.auto_parts_has_permission(p_session_token, 'products.manage', p_business_id) THEN
    RAISE EXCEPTION 'ACCESS_DENIED' USING HINT = 'Permission requise: products.manage';
  END IF;

  RETURN public.auto_parts_list_products(p_business_id, p_branch_id);
END;
$$;

DROP FUNCTION IF EXISTS public.auto_parts_search_products(UUID, TEXT);
DROP FUNCTION IF EXISTS public.auto_parts_search_products(UUID, TEXT, UUID);
CREATE OR REPLACE FUNCTION public.auto_parts_search_products(
  p_business_id UUID,
  p_query TEXT,
  p_branch_id UUID DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_query TEXT := '%' || COALESCE(p_query, '') || '%';
BEGIN
  PERFORM public.ensure_auto_parts_inventory_for_business(p_business_id);

  RETURN COALESCE(jsonb_agg(public.auto_parts_inventory_row_json(p, i, c, p_business_id) ORDER BY p.name), '[]'::jsonb)
  FROM public.auto_parts_products p
  LEFT JOIN public.auto_parts_categories c ON c.id = p.category_id
  LEFT JOIN LATERAL (
    SELECT inv.*
    FROM public.auto_parts_product_inventory inv
    WHERE inv.business_id = p_business_id
      AND inv.product_id = p.id
      AND (p_branch_id IS NULL OR inv.branch_id = p_branch_id OR inv.branch_id IS NULL)
    ORDER BY CASE WHEN inv.branch_id = p_branch_id THEN 0 ELSE 1 END
    LIMIT 1
  ) i ON true
  WHERE COALESCE(p.active, true) = true
    AND COALESCE(i.active, true) = true
    AND (
      p.name ILIKE v_query
      OR p.sku ILIKE v_query
      OR p.barcode ILIKE v_query
      OR p.oem_code ILIKE v_query
      OR p.manufacturer ILIKE v_query
    )
  LIMIT 50;
END;
$$;

DROP FUNCTION IF EXISTS public.auto_parts_get_product(UUID);
DROP FUNCTION IF EXISTS public.auto_parts_get_product(UUID, UUID);
CREATE OR REPLACE FUNCTION public.auto_parts_get_product(p_id UUID, p_business_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF p_business_id IS NOT NULL THEN
    PERFORM public.ensure_auto_parts_inventory_for_business(p_business_id);
  END IF;

  SELECT public.auto_parts_inventory_row_json(p, i, c, p_business_id)
  INTO v_result
  FROM public.auto_parts_products p
  LEFT JOIN public.auto_parts_categories c ON c.id = p.category_id
  LEFT JOIN LATERAL (
    SELECT inv.*
    FROM public.auto_parts_product_inventory inv
    WHERE inv.business_id = p_business_id
      AND inv.product_id = p.id
    ORDER BY CASE WHEN inv.branch_id IS NULL THEN 0 ELSE 1 END
    LIMIT 1
  ) i ON p_business_id IS NOT NULL
  WHERE p.id = p_id;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_auto_parts_product(
  p_business_id UUID,
  p_product_id UUID DEFAULT NULL,
  p_values JSONB DEFAULT '{}'::jsonb,
  p_branch_id UUID DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_product_id UUID := p_product_id;
  v_category_id UUID := NULLIF(p_values->>'category_id', '')::UUID;
  v_sku TEXT := NULLIF(btrim(COALESCE(p_values->>'sku', '')), '');
  v_barcode TEXT := NULLIF(btrim(COALESCE(p_values->>'barcode', '')), '');
  v_name TEXT := NULLIF(btrim(COALESCE(p_values->>'name', '')), '');
  v_inventory_id UUID;
BEGIN
  IF v_product_id IS NULL THEN
    IF v_name IS NULL THEN
      RAISE EXCEPTION 'PRODUCT_NAME_REQUIRED';
    END IF;

    SELECT id INTO v_product_id
    FROM public.auto_parts_products
    WHERE (v_sku IS NOT NULL AND lower(sku) = lower(v_sku))
       OR (v_barcode IS NOT NULL AND lower(barcode) = lower(v_barcode))
       OR (v_sku IS NULL AND v_barcode IS NULL AND lower(name) = lower(v_name))
    ORDER BY created_at
    LIMIT 1;

    IF v_product_id IS NULL THEN
      INSERT INTO public.auto_parts_products (
        name, description, category_id, sku, barcode, oem_code, manufacturer,
        subcategory, compatible_vehicle, unit, image_url, active,
        business_id, salon_id, branch_id, unit_price, cost_price,
        stock_quantity, reserved_quantity, min_stock
      )
      VALUES (
        v_name,
        NULLIF(p_values->>'description', ''),
        v_category_id,
        v_sku,
        v_barcode,
        NULLIF(p_values->>'oem_code', ''),
        NULLIF(p_values->>'manufacturer', ''),
        NULLIF(p_values->>'subcategory', ''),
        NULLIF(p_values->>'compatible_vehicle', ''),
        COALESCE(NULLIF(p_values->>'unit', ''), 'piece'),
        NULLIF(p_values->>'image_url', ''),
        COALESCE((p_values->>'active')::BOOLEAN, true),
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        0,
        0,
        0
      )
      RETURNING id INTO v_product_id;

      INSERT INTO public.auto_parts_product_inventory (
        business_id, product_id, stock_quantity, reserved_quantity, min_stock,
        cost_price, unit_price, active
      )
      SELECT b.id, v_product_id, 0, 0, 0, NULL, NULL, true
      FROM public.businesses b
      ON CONFLICT DO NOTHING;
    END IF;
  ELSE
    UPDATE public.auto_parts_products
    SET
      name = COALESCE(v_name, name),
      description = COALESCE(NULLIF(p_values->>'description', ''), description),
      category_id = COALESCE(v_category_id, category_id),
      sku = COALESCE(v_sku, sku),
      barcode = COALESCE(v_barcode, barcode),
      oem_code = COALESCE(NULLIF(p_values->>'oem_code', ''), oem_code),
      manufacturer = COALESCE(NULLIF(p_values->>'manufacturer', ''), manufacturer),
      subcategory = COALESCE(NULLIF(p_values->>'subcategory', ''), subcategory),
      compatible_vehicle = COALESCE(NULLIF(p_values->>'compatible_vehicle', ''), compatible_vehicle),
      unit = COALESCE(NULLIF(p_values->>'unit', ''), unit),
      image_url = COALESCE(NULLIF(p_values->>'image_url', ''), image_url),
      updated_at = now()
    WHERE id = v_product_id;
  END IF;

  INSERT INTO public.auto_parts_product_inventory (
    business_id, branch_id, product_id, stock_quantity, reserved_quantity, min_stock,
    cost_price, unit_price, max_stock, location, notes, active
  )
  VALUES (
    p_business_id,
    p_branch_id,
    v_product_id,
    COALESCE((p_values->>'stock_quantity')::NUMERIC, 0),
    COALESCE((p_values->>'reserved_quantity')::NUMERIC, 0),
    COALESCE((p_values->>'min_stock')::NUMERIC, 0),
    NULLIF(p_values->>'cost_price', '')::NUMERIC,
    NULLIF(p_values->>'unit_price', '')::NUMERIC,
    NULLIF(p_values->>'max_stock', '')::NUMERIC,
    NULLIF(p_values->>'location', ''),
    NULLIF(p_values->>'notes', ''),
    COALESCE((p_values->>'active')::BOOLEAN, true)
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_inventory_id;

  IF v_inventory_id IS NULL THEN
    UPDATE public.auto_parts_product_inventory
    SET
      cost_price = CASE WHEN p_values ? 'cost_price' THEN NULLIF(p_values->>'cost_price', '')::NUMERIC ELSE cost_price END,
      unit_price = CASE WHEN p_values ? 'unit_price' THEN NULLIF(p_values->>'unit_price', '')::NUMERIC ELSE unit_price END,
      stock_quantity = CASE WHEN p_values ? 'stock_quantity' THEN (p_values->>'stock_quantity')::NUMERIC ELSE stock_quantity END,
      reserved_quantity = CASE WHEN p_values ? 'reserved_quantity' THEN (p_values->>'reserved_quantity')::NUMERIC ELSE reserved_quantity END,
      min_stock = CASE WHEN p_values ? 'min_stock' THEN (p_values->>'min_stock')::NUMERIC ELSE min_stock END,
      max_stock = CASE WHEN p_values ? 'max_stock' THEN NULLIF(p_values->>'max_stock', '')::NUMERIC ELSE max_stock END,
      location = CASE WHEN p_values ? 'location' THEN NULLIF(p_values->>'location', '') ELSE location END,
      notes = CASE WHEN p_values ? 'notes' THEN NULLIF(p_values->>'notes', '') ELSE notes END,
      active = COALESCE((p_values->>'active')::BOOLEAN, active)
    WHERE business_id = p_business_id
      AND product_id = v_product_id
      AND ((p_branch_id IS NULL AND branch_id IS NULL) OR branch_id = p_branch_id);
  END IF;

  RETURN public.auto_parts_get_product(v_product_id, p_business_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_auto_parts_product_for_business(
  p_product_id UUID,
  p_business_id UUID
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.auto_parts_product_inventory
  SET active = false
  WHERE product_id = p_product_id
    AND business_id = p_business_id;

  RETURN jsonb_build_object('id', p_product_id, 'status', 'deactivated_for_business');
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_auto_parts_category(
  p_category_id UUID DEFAULT NULL,
  p_values JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id UUID := p_category_id;
  v_name TEXT := NULLIF(btrim(COALESCE(p_values->>'name', '')), '');
  v_result JSONB;
BEGIN
  IF v_id IS NULL THEN
    IF v_name IS NULL THEN
      RAISE EXCEPTION 'CATEGORY_NAME_REQUIRED';
    END IF;

    SELECT id INTO v_id
    FROM public.auto_parts_categories
    WHERE lower(name) = lower(v_name)
    LIMIT 1;

    IF v_id IS NULL THEN
      INSERT INTO public.auto_parts_categories (
        name, description, icon, sort_order, business_id, salon_id, branch_id
      )
      VALUES (
        v_name,
        NULLIF(p_values->>'description', ''),
        NULLIF(p_values->>'icon', ''),
        COALESCE((p_values->>'sort_order')::INT, 0),
        NULL,
        NULL,
        NULL
      )
      RETURNING id INTO v_id;
    END IF;
  ELSE
    UPDATE public.auto_parts_categories
    SET
      name = COALESCE(v_name, name),
      description = CASE WHEN p_values ? 'description' THEN NULLIF(p_values->>'description', '') ELSE description END,
      icon = CASE WHEN p_values ? 'icon' THEN NULLIF(p_values->>'icon', '') ELSE icon END,
      sort_order = CASE WHEN p_values ? 'sort_order' THEN COALESCE((p_values->>'sort_order')::INT, 0) ELSE sort_order END,
      business_id = NULL,
      salon_id = NULL,
      branch_id = NULL
    WHERE id = v_id;
  END IF;

  SELECT to_jsonb(c) INTO v_result
  FROM public.auto_parts_categories c
  WHERE c.id = v_id;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_auto_parts_category(p_category_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.auto_parts_products WHERE category_id = p_category_id) THEN
    RAISE EXCEPTION 'CATEGORY_IN_USE' USING HINT = 'Cette catégorie est utilisée par le catalogue global.';
  END IF;

  DELETE FROM public.auto_parts_categories WHERE id = p_category_id;
  RETURN jsonb_build_object('id', p_category_id, 'status', 'deleted');
END;
$$;

DROP FUNCTION IF EXISTS public.auto_parts_create_product(
  TEXT, UUID, TEXT, UUID, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC,
  NUMERIC, TEXT, TEXT, TEXT, TEXT, BOOLEAN
);
CREATE OR REPLACE FUNCTION public.auto_parts_create_product(
  p_session_token TEXT,
  p_business_id UUID,
  p_name TEXT,
  p_category_id UUID DEFAULT NULL,
  p_sku TEXT DEFAULT NULL,
  p_barcode TEXT DEFAULT NULL,
  p_unit_price NUMERIC DEFAULT NULL,
  p_cost_price NUMERIC DEFAULT NULL,
  p_stock_quantity NUMERIC DEFAULT 0,
  p_min_stock NUMERIC DEFAULT 0,
  p_max_stock NUMERIC DEFAULT NULL,
  p_location TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_image_url TEXT DEFAULT NULL,
  p_active BOOLEAN DEFAULT true
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_session_token IS NOT NULL
     AND NOT public.auto_parts_has_permission(p_session_token, 'products.manage', p_business_id) THEN
    RAISE EXCEPTION 'ACCESS_DENIED' USING HINT = 'Permission requise: products.manage';
  END IF;

  RETURN public.upsert_auto_parts_product(
    p_business_id,
    NULL,
    jsonb_build_object(
      'name', p_name,
      'category_id', p_category_id,
      'sku', p_sku,
      'barcode', p_barcode,
      'unit_price', p_unit_price,
      'cost_price', p_cost_price,
      'stock_quantity', COALESCE(p_stock_quantity, 0),
      'min_stock', COALESCE(p_min_stock, 0),
      'max_stock', p_max_stock,
      'location', p_location,
      'description', p_description,
      'notes', p_notes,
      'image_url', p_image_url,
      'active', COALESCE(p_active, true)
    ),
    NULL
  );
END;
$$;

-- ============================================================================
-- Stock, sales, purchases and dashboard now use inventory rows.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_parts_update_stock_on_movement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_delta NUMERIC;
  v_target_branch UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.business_id IS NOT NULL THEN
      SELECT inv.branch_id INTO v_target_branch
      FROM public.auto_parts_product_inventory inv
      WHERE inv.business_id = OLD.business_id
        AND inv.product_id = OLD.product_id
        AND (OLD.branch_id IS NULL OR inv.branch_id = OLD.branch_id OR inv.branch_id IS NULL)
      ORDER BY CASE WHEN inv.branch_id = OLD.branch_id THEN 0 ELSE 1 END
      LIMIT 1;

      UPDATE public.auto_parts_product_inventory
      SET stock_quantity = CASE
            WHEN OLD.type = 'adjustment' THEN stock_quantity
            ELSE stock_quantity - OLD.quantity
          END
      WHERE business_id = OLD.business_id
        AND product_id = OLD.product_id
        AND ((v_target_branch IS NULL AND branch_id IS NULL) OR branch_id = v_target_branch);
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.business_id IS NOT NULL THEN
      SELECT inv.branch_id INTO v_target_branch
      FROM public.auto_parts_product_inventory inv
      WHERE inv.business_id = NEW.business_id
        AND inv.product_id = NEW.product_id
        AND (NEW.branch_id IS NULL OR inv.branch_id = NEW.branch_id OR inv.branch_id IS NULL)
      ORDER BY CASE WHEN inv.branch_id = NEW.branch_id THEN 0 ELSE 1 END
      LIMIT 1;

      INSERT INTO public.auto_parts_product_inventory (
        business_id, branch_id, product_id, stock_quantity, reserved_quantity, min_stock,
        cost_price, unit_price, active
      )
      VALUES (NEW.business_id, v_target_branch, NEW.product_id, 0, 0, 0, NULL, NULL, true)
      ON CONFLICT DO NOTHING;

      v_delta := CASE
        WHEN NEW.type = 'adjustment' THEN NEW.quantity
        ELSE NEW.quantity
      END;

      UPDATE public.auto_parts_product_inventory
      SET
        stock_quantity = CASE
          WHEN NEW.type = 'adjustment' THEN v_delta
          ELSE stock_quantity + v_delta
        END,
        unit_price = COALESCE(NEW.unit_price, unit_price)
      WHERE business_id = NEW.business_id
        AND product_id = NEW.product_id
        AND ((v_target_branch IS NULL AND branch_id IS NULL) OR branch_id = v_target_branch);
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

DROP FUNCTION IF EXISTS public.create_auto_parts_stock_movement(UUID, UUID, TEXT, NUMERIC, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_auto_parts_stock_movement(UUID, UUID, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, UUID);
CREATE OR REPLACE FUNCTION public.create_auto_parts_stock_movement(
  p_business_id UUID,
  p_product_id UUID,
  p_type TEXT,
  p_quantity NUMERIC,
  p_unit_price NUMERIC DEFAULT NULL,
  p_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.auto_parts_stock_movements (
    product_id, type, quantity, unit_price, reference, notes, business_id, branch_id, created_by
  )
  VALUES (p_product_id, p_type, p_quantity, p_unit_price, p_reference, p_notes, p_business_id, p_branch_id, auth.uid())
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'status', 'created');
END;
$$;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT oidvectortypes(proargtypes) AS args
    FROM pg_catalog.pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname = 'create_auto_parts_sale'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS public.create_auto_parts_sale(%s)', r.args);
  END LOOP;
END $$;

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
  p_amount_paid NUMERIC DEFAULT NULL,
  p_balance_due NUMERIC DEFAULT NULL,
  p_payment_method TEXT DEFAULT 'cash',
  p_payment_status TEXT DEFAULT 'paid',
  p_notes TEXT DEFAULT NULL,
  p_staff_id UUID DEFAULT NULL,
  p_invoice_prefix TEXT DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL,
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
  v_cost_price NUMERIC;
  v_available NUMERIC;
  v_staff_name TEXT;
  v_amount_paid NUMERIC;
  v_balance_due NUMERIC;
  v_payment_status TEXT;
BEGIN
  v_amount_paid := LEAST(GREATEST(COALESCE(p_amount_paid, p_total), 0), p_total);
  v_balance_due := GREATEST(COALESCE(p_balance_due, p_total - v_amount_paid), 0);
  v_payment_status := CASE
    WHEN v_balance_due <= 0 THEN 'paid'
    WHEN v_amount_paid <= 0 THEN 'unpaid'
    ELSE 'partial'
  END;

  IF v_balance_due > 0 AND p_client_id IS NULL AND NULLIF(TRIM(COALESCE(p_client_name, '')), '') IS NULL THEN
    RAISE EXCEPTION 'CLIENT_REQUIRED_FOR_PARTIAL_PAYMENT'
      USING HINT = 'Un client est requis pour enregistrer un paiement partiel.';
  END IF;

  v_invoice := generate_auto_parts_invoice_number(p_business_id);
  v_staff_name := (
    SELECT name FROM public.auto_parts_staff
    WHERE id = p_staff_id AND business_id = p_business_id
  );

  INSERT INTO public.auto_parts_sales (
    invoice_number, business_id, branch_id, client_id, client_name,
    subtotal, tax_rate, tax_amount, discount_type, discount_value, discount_amount,
    total, amount_paid, balance_due, payment_method, payment_status, notes, staff_id, staff_name
  ) VALUES (
    v_invoice, p_business_id, p_branch_id, p_client_id, p_client_name,
    p_subtotal, p_tax_rate, p_tax_amount, p_discount_type, p_discount_value, p_discount_amount,
    p_total, v_amount_paid, v_balance_due, p_payment_method, v_payment_status, p_notes, p_staff_id, v_staff_name
  ) RETURNING id INTO v_sale_id;

  IF p_client_id IS NOT NULL AND v_balance_due > 0 THEN
    UPDATE public.auto_parts_clients
    SET credit_balance = COALESCE(credit_balance, 0) + v_balance_due
    WHERE id = p_client_id
      AND business_id = p_business_id;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_product_name := v_item->>'product_name';
    v_quantity := (v_item->>'quantity')::NUMERIC;
    v_unit_price := (v_item->>'unit_price')::NUMERIC;

    IF v_product_id IS NOT NULL THEN
      SELECT COALESCE(i.stock_quantity, 0) - COALESCE(i.reserved_quantity, 0), COALESCE(i.cost_price, 0)
      INTO v_available, v_cost_price
      FROM public.auto_parts_product_inventory i
      WHERE i.product_id = v_product_id
        AND i.business_id = p_business_id
        AND (p_branch_id IS NULL OR i.branch_id = p_branch_id OR i.branch_id IS NULL)
      ORDER BY CASE WHEN i.branch_id = p_branch_id THEN 0 ELSE 1 END
      LIMIT 1;

      IF COALESCE(v_available, 0) < v_quantity THEN
        RAISE EXCEPTION 'STOCK_INSUFFICIENT_%', v_product_id
          USING HINT = format('Stock insuffisant pour %s', v_product_name);
      END IF;
    ELSE
      v_cost_price := 0;
    END IF;

    INSERT INTO public.auto_parts_sale_items (
      sale_id, product_id, product_name, quantity, unit_price, total_price, business_id, branch_id
    ) VALUES (
      v_sale_id, v_product_id, v_product_name, v_quantity, v_unit_price,
      v_quantity * v_unit_price, p_business_id, p_branch_id
    );

    IF v_product_id IS NOT NULL THEN
      INSERT INTO public.auto_parts_stock_movements (
        product_id, type, quantity, unit_price, cost_price, reference, business_id, branch_id, created_by
      ) VALUES (
        v_product_id, 'sale', -v_quantity, v_unit_price, v_cost_price, v_invoice, p_business_id, p_branch_id, auth.uid()
      );
    END IF;
  END LOOP;

  RETURN (
    SELECT jsonb_build_object(
      'id', s.id,
      'invoice_number', s.invoice_number,
      'total', s.total,
      'amount_paid', s.amount_paid,
      'balance_due', s.balance_due,
      'payment_status', s.payment_status
    )
    FROM public.auto_parts_sales s
    WHERE s.id = v_sale_id
  );
END;
$$;

DROP FUNCTION IF EXISTS public.create_auto_parts_purchase(UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.create_auto_parts_purchase(UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, UUID, JSONB);
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
  p_branch_id UUID DEFAULT NULL,
  p_items JSONB DEFAULT '[]'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_purchase_id UUID;
  v_item JSONB;
  v_product_id UUID;
  v_quantity NUMERIC;
  v_unit_price NUMERIC;
BEGIN
  INSERT INTO public.auto_parts_purchases (
    business_id, branch_id, supplier_id, supplier_name, reference_number,
    status, subtotal, tax_amount, total, notes, created_by
  )
  VALUES (
    p_business_id, p_branch_id, p_supplier_id, p_supplier_name, p_reference_number,
    p_status, p_subtotal, p_tax_amount, p_total, p_notes, auth.uid()
  )
  RETURNING id INTO v_purchase_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::NUMERIC;
    v_unit_price := (v_item->>'unit_price')::NUMERIC;

    INSERT INTO public.auto_parts_purchase_items (
      purchase_id, product_id, product_name, quantity, unit_price, total_price, business_id, branch_id
    )
    VALUES (
      v_purchase_id, v_product_id, v_item->>'product_name',
      v_quantity, v_unit_price, v_quantity * v_unit_price, p_business_id, p_branch_id
    );

    IF p_status = 'delivered' AND v_product_id IS NOT NULL THEN
      UPDATE public.auto_parts_product_inventory
      SET cost_price = v_unit_price
      WHERE business_id = p_business_id
        AND product_id = v_product_id
        AND ((p_branch_id IS NULL AND branch_id IS NULL) OR branch_id = p_branch_id);

      INSERT INTO public.auto_parts_stock_movements (
        product_id, type, quantity, unit_price, cost_price, reference, business_id, branch_id, created_by
      )
      VALUES (
        v_product_id, 'in', v_quantity, v_unit_price, v_unit_price,
        p_reference_number, p_business_id, p_branch_id, auth.uid()
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object('id', v_purchase_id, 'status', 'created');
END;
$$;

DROP FUNCTION IF EXISTS public.auto_parts_dashboard_counts(UUID);
DROP FUNCTION IF EXISTS public.auto_parts_dashboard_counts(UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS public.auto_parts_dashboard_counts(UUID, TEXT, UUID, UUID);
CREATE OR REPLACE FUNCTION public.auto_parts_dashboard_counts(
  p_business_id UUID,
  p_session_token TEXT DEFAULT NULL,
  p_staff_id UUID DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_total_products INT;
  v_total_stock_value NUMERIC;
  v_out_of_stock INT;
  v_low_stock INT;
  v_today_sales NUMERIC;
  v_month_sales NUMERIC;
  v_month_purchases NUMERIC;
  v_pending_orders INT;
  v_month_start TIMESTAMPTZ := date_trunc('month', now());
  v_day_start TIMESTAMPTZ := date_trunc('day', now());
BEGIN
  PERFORM public.ensure_auto_parts_inventory_for_business(p_business_id);

  SELECT COUNT(*),
         COALESCE(SUM(COALESCE(i.cost_price, 0) * COALESCE(i.stock_quantity, 0)), 0),
         COUNT(*) FILTER (WHERE COALESCE(i.stock_quantity, 0) <= 0),
         COUNT(*) FILTER (WHERE COALESCE(i.stock_quantity, 0) > 0 AND COALESCE(i.stock_quantity, 0) <= COALESCE(i.min_stock, 0))
  INTO v_total_products, v_total_stock_value, v_out_of_stock, v_low_stock
  FROM public.auto_parts_products p
  JOIN public.auto_parts_product_inventory i ON i.product_id = p.id
  WHERE i.business_id = p_business_id
    AND COALESCE(p.active, true)
    AND COALESCE(i.active, true)
    AND (p_branch_id IS NULL OR i.branch_id = p_branch_id OR i.branch_id IS NULL);

  SELECT COALESCE(SUM(total), 0) INTO v_today_sales
  FROM public.auto_parts_sales
  WHERE business_id = p_business_id
    AND created_at >= v_day_start
    AND refund_status IS DISTINCT FROM 'full'
    AND (p_staff_id IS NULL OR staff_id = p_staff_id)
    AND (p_branch_id IS NULL OR branch_id IS NULL OR branch_id = p_branch_id);

  SELECT COALESCE(SUM(total), 0) INTO v_month_sales
  FROM public.auto_parts_sales
  WHERE business_id = p_business_id
    AND created_at >= v_month_start
    AND refund_status IS DISTINCT FROM 'full'
    AND (p_staff_id IS NULL OR staff_id = p_staff_id)
    AND (p_branch_id IS NULL OR branch_id IS NULL OR branch_id = p_branch_id);

  SELECT COALESCE(SUM(total), 0) INTO v_month_purchases
  FROM public.auto_parts_purchases
  WHERE business_id = p_business_id
    AND created_at >= v_month_start
    AND status = 'delivered'
    AND (p_branch_id IS NULL OR branch_id IS NULL OR branch_id = p_branch_id);

  SELECT COUNT(*) INTO v_pending_orders
  FROM public.auto_parts_purchases
  WHERE business_id = p_business_id
    AND status IN ('pending', 'confirmed')
    AND (p_branch_id IS NULL OR branch_id IS NULL OR branch_id = p_branch_id);

  RETURN jsonb_build_object(
    'totalProducts', v_total_products,
    'totalStockValue', v_total_stock_value,
    'outOfStock', v_out_of_stock,
    'lowStock', v_low_stock,
    'todaySales', v_today_sales,
    'monthSales', v_month_sales,
    'monthPurchases', v_month_purchases,
    'pendingOrders', v_pending_orders
  );
END;
$$;

DROP FUNCTION IF EXISTS public.auto_parts_category_repartition(UUID);
CREATE OR REPLACE FUNCTION public.auto_parts_category_repartition(p_business_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.ensure_auto_parts_inventory_for_business(p_business_id);

  RETURN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('name', COALESCE(c.name, 'Sans catégorie'), 'count', v.cnt)), '[]'::jsonb)
    FROM (
      SELECT p.category_id, COUNT(*) AS cnt
      FROM public.auto_parts_products p
      JOIN public.auto_parts_product_inventory i ON i.product_id = p.id
      WHERE i.business_id = p_business_id
        AND COALESCE(p.active, true)
        AND COALESCE(i.active, true)
      GROUP BY p.category_id
    ) v
    LEFT JOIN public.auto_parts_categories c ON c.id = v.category_id
  );
END;
$$;

DROP FUNCTION IF EXISTS public.auto_parts_dormant_products(UUID, INT);
CREATE OR REPLACE FUNCTION public.auto_parts_dormant_products(
  p_business_id UUID,
  p_days INT DEFAULT 30
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cutoff TIMESTAMPTZ := now() - (p_days || ' days')::INTERVAL;
BEGIN
  PERFORM public.ensure_auto_parts_inventory_for_business(p_business_id);

  RETURN COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'sku', p.sku,
      'stock_quantity', i.stock_quantity,
      'cost_price', COALESCE(i.cost_price, 0),
      'stock_value', COALESCE(i.cost_price, 0) * COALESCE(i.stock_quantity, 0),
      'unit_price', i.unit_price,
      'potential_revenue', COALESCE(i.unit_price, 0) * COALESCE(i.stock_quantity, 0),
      'potential_profit', (COALESCE(i.unit_price, 0) - COALESCE(i.cost_price, 0)) * COALESCE(i.stock_quantity, 0),
      'category_name', c.name,
      'last_sale_date', last_sale.last_date,
      'days_since_sale', CASE WHEN last_sale.last_date IS NOT NULL
        THEN EXTRACT(DAY FROM now() - last_sale.last_date)::INT ELSE p_days * 2 END
    )
    ORDER BY COALESCE(i.stock_quantity, 0) * COALESCE(i.cost_price, 0) DESC
  ), '[]'::jsonb)
  FROM public.auto_parts_products p
  JOIN public.auto_parts_product_inventory i ON i.product_id = p.id AND i.business_id = p_business_id
  LEFT JOIN public.auto_parts_categories c ON c.id = p.category_id
  LEFT JOIN LATERAL (
    SELECT MAX(s.created_at) AS last_date
    FROM public.auto_parts_sale_items si
    JOIN public.auto_parts_sales s ON s.id = si.sale_id
    WHERE si.product_id = p.id
      AND s.business_id = p_business_id
      AND s.refund_status IS DISTINCT FROM 'full'
  ) last_sale ON true
  LEFT JOIN LATERAL (
    SELECT MAX(sm.created_at) AS last_date
    FROM public.auto_parts_stock_movements sm
    WHERE sm.product_id = p.id
      AND sm.business_id = p_business_id
      AND sm.type IN ('in', 'out', 'sale')
  ) last_movement ON true
  WHERE COALESCE(p.active, true)
    AND COALESCE(i.active, true)
    AND COALESCE(i.stock_quantity, 0) > 0
    AND (last_sale.last_date IS NULL OR last_sale.last_date < v_cutoff)
    AND (last_movement.last_date IS NULL OR last_movement.last_date < v_cutoff);
END;
$$;

DROP FUNCTION IF EXISTS public.auto_parts_stock_forecast(UUID, INT);
CREATE OR REPLACE FUNCTION public.auto_parts_stock_forecast(
  p_business_id UUID,
  p_lookback_days INT DEFAULT 90
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cutoff TIMESTAMPTZ := now() - (p_lookback_days || ' days')::INTERVAL;
BEGIN
  PERFORM public.ensure_auto_parts_inventory_for_business(p_business_id);

  RETURN COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'sku', p.sku,
      'stock_quantity', i.stock_quantity,
      'min_stock', i.min_stock,
      'unit_price', i.unit_price,
      'avg_daily_sales', ROUND(COALESCE(ds.qty, 0) / GREATEST(p_lookback_days, 1), 2),
      'days_until_rupture', CASE
        WHEN COALESCE(ds.qty, 0) <= 0 THEN NULL
        ELSE ROUND(COALESCE(i.stock_quantity, 0) / NULLIF(COALESCE(ds.qty, 0) / GREATEST(p_lookback_days, 1), 0))
      END,
      'risk_level', CASE
        WHEN COALESCE(i.stock_quantity, 0) <= 0 THEN 'rupture'
        WHEN COALESCE(ds.qty, 0) <= 0 THEN 'unknown'
        WHEN COALESCE(i.stock_quantity, 0) / NULLIF(COALESCE(ds.qty, 0) / GREATEST(p_lookback_days, 1), 0) <= 7 THEN 'high'
        WHEN COALESCE(i.stock_quantity, 0) / NULLIF(COALESCE(ds.qty, 0) / GREATEST(p_lookback_days, 1), 0) <= 30 THEN 'medium'
        WHEN COALESCE(i.stock_quantity, 0) / NULLIF(COALESCE(ds.qty, 0) / GREATEST(p_lookback_days, 1), 0) <= 90 THEN 'low'
        ELSE 'safe'
      END
    )
    ORDER BY COALESCE(i.stock_quantity, 0) ASC
  ), '[]'::jsonb)
  FROM public.auto_parts_products p
  JOIN public.auto_parts_product_inventory i ON i.product_id = p.id AND i.business_id = p_business_id
  LEFT JOIN LATERAL (
    SELECT SUM(si.quantity)::NUMERIC AS qty
    FROM public.auto_parts_sale_items si
    JOIN public.auto_parts_sales s ON s.id = si.sale_id
    WHERE si.product_id = p.id
      AND s.business_id = p_business_id
      AND s.created_at >= v_cutoff
      AND s.refund_status IS DISTINCT FROM 'full'
  ) ds ON true
  WHERE COALESCE(p.active, true)
    AND COALESCE(i.active, true)
    AND (COALESCE(i.stock_quantity, 0) <= COALESCE(i.min_stock, 0) OR COALESCE(i.stock_quantity, 0) <= 0);
END;
$$;

DROP FUNCTION IF EXISTS public.auto_parts_profit_summary(UUID, TIMESTAMPTZ, TIMESTAMPTZ);
CREATE OR REPLACE FUNCTION public.auto_parts_profit_summary(
  p_business_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT date_trunc('month', now()),
  p_end_date TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN (
    WITH sale_profits AS (
      SELECT
        si.product_id,
        si.product_name,
        si.quantity,
        si.unit_price,
        si.total_price,
        COALESCE(sm.cost_price, i.cost_price, 0) AS cost_price,
        si.total_price - (si.quantity * COALESCE(sm.cost_price, i.cost_price, 0)) AS profit,
        c.name AS category_name
      FROM public.auto_parts_sale_items si
      JOIN public.auto_parts_sales s ON s.id = si.sale_id
      LEFT JOIN public.auto_parts_product_inventory i ON i.product_id = si.product_id AND i.business_id = s.business_id
      LEFT JOIN public.auto_parts_products p ON p.id = si.product_id
      LEFT JOIN public.auto_parts_categories c ON c.id = p.category_id
      LEFT JOIN LATERAL (
        SELECT cost_price
        FROM public.auto_parts_stock_movements sm
        WHERE sm.product_id = si.product_id
          AND sm.business_id = s.business_id
          AND sm.reference = s.invoice_number
          AND sm.type = 'sale'
        ORDER BY sm.created_at DESC
        LIMIT 1
      ) sm ON true
      WHERE s.business_id = p_business_id
        AND s.created_at >= p_start_date
        AND s.created_at < p_end_date
        AND s.refund_status IS DISTINCT FROM 'full'
    ),
    aggregated AS (
      SELECT
        COUNT(*)::INT AS item_count,
        COALESCE(SUM(total_price), 0)::NUMERIC AS total_revenue,
        COALESCE(SUM(cost_price * quantity), 0)::NUMERIC AS total_cost,
        COALESCE(SUM(profit), 0)::NUMERIC AS total_profit,
        CASE WHEN COALESCE(SUM(total_price), 0) > 0
          THEN ROUND((SUM(profit) / SUM(total_price)) * 100, 1) ELSE 0 END AS margin_pct
      FROM sale_profits
    ),
    top_products AS (
      SELECT COALESCE(jsonb_agg(row_to_json(sub)), '[]'::jsonb) AS data
      FROM (
        SELECT product_name, SUM(quantity)::INT AS qty, SUM(total_price)::NUMERIC AS revenue,
               SUM(cost_price * quantity)::NUMERIC AS cost, SUM(profit)::NUMERIC AS profit,
               CASE WHEN SUM(total_price) > 0 THEN ROUND((SUM(profit) / SUM(total_price)) * 100, 1) ELSE 0 END AS margin_pct
        FROM sale_profits
        WHERE product_id IS NOT NULL
        GROUP BY product_name
        ORDER BY profit DESC
        LIMIT 10
      ) sub
    ),
    top_categories AS (
      SELECT COALESCE(jsonb_agg(row_to_json(sub)), '[]'::jsonb) AS data
      FROM (
        SELECT COALESCE(category_name, 'Sans catégorie') AS category_name,
               SUM(quantity)::INT AS qty, SUM(total_price)::NUMERIC AS revenue,
               SUM(cost_price * quantity)::NUMERIC AS cost, SUM(profit)::NUMERIC AS profit,
               CASE WHEN SUM(total_price) > 0 THEN ROUND((SUM(profit) / SUM(total_price)) * 100, 1) ELSE 0 END AS margin_pct
        FROM sale_profits
        GROUP BY category_name
        ORDER BY profit DESC
        LIMIT 10
      ) sub
    )
    SELECT jsonb_build_object(
      'summary', row_to_json(a),
      'top_products', tp.data,
      'top_categories', tc.data,
      'top_suppliers', '[]'::jsonb
    )
    FROM aggregated a, top_products tp, top_categories tc
  );
END;
$$;

DROP FUNCTION IF EXISTS public.auto_parts_store_health(UUID);
CREATE OR REPLACE FUNCTION public.auto_parts_store_health(p_business_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_total_products INT;
  v_active_products INT;
  v_out_of_stock INT;
  v_dormant_count INT;
  v_category_count INT;
  v_rupture_ratio NUMERIC := 0;
  v_score NUMERIC := 70;
BEGIN
  PERFORM public.ensure_auto_parts_inventory_for_business(p_business_id);

  SELECT
    COUNT(*)::INT,
    COUNT(*) FILTER (WHERE COALESCE(i.active, true) AND COALESCE(p.active, true))::INT,
    COUNT(*) FILTER (WHERE COALESCE(i.active, true) AND COALESCE(p.active, true) AND COALESCE(i.stock_quantity, 0) <= 0)::INT,
    COUNT(DISTINCT p.category_id)::INT
  INTO v_total_products, v_active_products, v_out_of_stock, v_category_count
  FROM public.auto_parts_products p
  JOIN public.auto_parts_product_inventory i ON i.product_id = p.id
  WHERE i.business_id = p_business_id;

  SELECT jsonb_array_length(public.auto_parts_dormant_products(p_business_id, 90))
  INTO v_dormant_count;

  IF v_active_products > 0 THEN
    v_rupture_ratio := (v_out_of_stock::NUMERIC / v_active_products) * 100;
  END IF;

  v_score := GREATEST(0, LEAST(100, 100 - v_rupture_ratio));

  RETURN jsonb_build_object(
    'score', ROUND(v_score)::INT,
    'sales_growth', 0,
    'stock_turnover', 0,
    'dormant_ratio', CASE WHEN v_active_products > 0 THEN ROUND((v_dormant_count::NUMERIC / v_active_products) * 100, 1) ELSE 0 END,
    'rupture_ratio', ROUND(v_rupture_ratio, 1),
    'margin_pct', 0,
    'category_count', v_category_count,
    'total_products', v_total_products,
    'active_products', v_active_products,
    'out_of_stock', v_out_of_stock,
    'dormant_count', v_dormant_count,
    'level', CASE
      WHEN v_score >= 90 THEN 'excellent'
      WHEN v_score >= 75 THEN 'bon'
      WHEN v_score >= 50 THEN 'moyen'
      WHEN v_score >= 25 THEN 'surveiller'
      ELSE 'critique'
    END,
    'recommendations', CASE
      WHEN v_out_of_stock > 0 THEN jsonb_build_array('Renseigner les stocks et prix des produits du catalogue global.')
      ELSE '[]'::jsonb
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_auto_parts_inventory_for_business(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_list_products(UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_list_products_full(UUID, TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_search_products(UUID, TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_get_product(UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_auto_parts_product(UUID, UUID, JSONB, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_auto_parts_product_for_business(UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_auto_parts_category(UUID, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_auto_parts_category(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_auto_parts_stock_movement(UUID, UUID, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_auto_parts_purchase(UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, UUID, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_auto_parts_sale(
  UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC, NUMERIC, NUMERIC,
  NUMERIC, NUMERIC, TEXT, TEXT, TEXT, UUID, TEXT, UUID, JSONB
) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_dashboard_counts(UUID, TEXT, UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_category_repartition(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_dormant_products(UUID, INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_stock_forecast(UUID, INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_profit_summary(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_store_health(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_parts_create_product(
  TEXT, UUID, TEXT, UUID, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC,
  NUMERIC, TEXT, TEXT, TEXT, TEXT, BOOLEAN
) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

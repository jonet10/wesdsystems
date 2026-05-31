-- ============================================================================
-- Business Refactor: products, services, inventory, and beverage migration
-- ============================================================================

ALTER TABLE public.salon_products
  ADD COLUMN IF NOT EXISTS brand TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.salon_service_categories
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.salon_services
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Copy existing beverages into salon_products as category "Boissons"
INSERT INTO public.salon_products (
  branch_id,
  sku,
  name,
  description,
  category,
  brand,
  barcode,
  unit_price,
  cost_price,
  packaging_type,
  package_quantity,
  purchase_price_global,
  unit_cost_price,
  unit_profit,
  package_profit,
  quantity_in_stock,
  reorder_level,
  is_active,
  metadata
)
SELECT
  sb.branch_id,
  sb.sku,
  sb.name,
  sb.description,
  'Boissons',
  sb.brand,
  sb.barcode,
  sb.unit_price,
  COALESCE(sb.unit_cost_price, sb.cost_price, 0),
  'case',
  COALESCE(sb.units_per_case, 24),
  COALESCE(sb.purchase_price_global, sb.cost_price * COALESCE(sb.units_per_case, 24), 0),
  COALESCE(sb.unit_cost_price, sb.cost_price, 0),
  COALESCE(sb.unit_profit, sb.unit_price - COALESCE(sb.unit_cost_price, sb.cost_price, 0)),
  COALESCE(sb.package_profit, (sb.unit_price - COALESCE(sb.unit_cost_price, sb.cost_price, 0)) * COALESCE(sb.units_per_case, 24)),
  COALESCE(sb.total_units_available, (sb.stock_cases * COALESCE(sb.units_per_case, 24) + sb.stock_units), 0),
  COALESCE(sb.reorder_level_units, 50),
  sb.is_active,
  jsonb_build_object(
    'source_table', 'salon_beverages',
    'source_id', sb.id,
    'units_per_case', COALESCE(sb.units_per_case, 24),
    'stock_cases', COALESCE(sb.stock_cases, 0),
    'stock_units', COALESCE(sb.stock_units, 0)
  )
FROM public.salon_beverages sb
WHERE NOT EXISTS (
  SELECT 1
  FROM public.salon_products sp
  WHERE sp.branch_id = sb.branch_id
    AND COALESCE(sp.sku, '') = COALESCE(sb.sku, '')
    AND sp.name = sb.name
    AND sp.category = 'Boissons'
);

-- Seed service categories for every existing branch
WITH branches AS (
  SELECT id FROM public.business_branches
  UNION
  SELECT id FROM public.salon_branches
),
seed_categories AS (
  SELECT * FROM (VALUES
    ('PÉDICURE', 'Pédicure', 'footprints', 1, jsonb_build_object(
      'addon_options', jsonb_build_array(
        jsonb_build_object('name', 'Fleur', 'extra_price', 0),
        jsonb_build_object('name', 'Charme', 'extra_price', 0),
        jsonb_build_object('name', 'Breloque', 'extra_price', 0)
      )
    )),
    ('MANICURE', 'Manicure', 'handshake', 2, jsonb_build_object('addon_options', jsonb_build_array())),
    ('COIFFURE / BEAUTÉ', 'Coiffure / Beauté', 'scissors', 3, jsonb_build_object('addon_options', jsonb_build_array()))
  ) AS t(code, name, icon, sort_order, metadata)
)
INSERT INTO public.salon_service_categories (
  branch_id,
  name,
  description,
  icon,
  color,
  sort_order,
  is_active,
  metadata
)
SELECT
  b.id,
  c.name,
  CASE
    WHEN c.code = 'PÉDICURE' THEN 'Prestations de pédicure et options associées'
    WHEN c.code = 'MANICURE' THEN 'Prestations de manicure'
    ELSE 'Prestations de coiffure et beauté'
  END,
  c.icon,
  CASE
    WHEN c.code = 'PÉDICURE' THEN 'emerald'
    WHEN c.code = 'MANICURE' THEN 'violet'
    ELSE 'orange'
  END,
  c.sort_order,
  true,
  c.metadata
FROM branches b
CROSS JOIN seed_categories c
WHERE NOT EXISTS (
  SELECT 1
  FROM public.salon_service_categories sc
  WHERE sc.branch_id = b.id
    AND sc.name = c.name
);

WITH branches AS (
  SELECT id FROM public.business_branches
  UNION
  SELECT id FROM public.salon_branches
),
seed_categories AS (
  SELECT * FROM (VALUES
    ('PÉDICURE', 'Pédicure', 'footprints', 1, jsonb_build_object(
      'addon_options', jsonb_build_array(
        jsonb_build_object('name', 'Fleur', 'extra_price', 0),
        jsonb_build_object('name', 'Charme', 'extra_price', 0),
        jsonb_build_object('name', 'Breloque', 'extra_price', 0)
      )
    )),
    ('MANICURE', 'Manicure', 'handshake', 2, jsonb_build_object('addon_options', jsonb_build_array())),
    ('COIFFURE / BEAUTÉ', 'Coiffure / Beauté', 'scissors', 3, jsonb_build_object('addon_options', jsonb_build_array()))
  ) AS t(code, name, icon, sort_order, metadata)
),
categories AS (
  SELECT sc.id, sc.branch_id, sc.name, sc.description
  FROM public.salon_service_categories sc
  WHERE sc.is_active = true
),
service_seed AS (
  SELECT * FROM (VALUES
    ('PÉDICURE', 'Simple', 30, 0, 1),
    ('PÉDICURE', 'Vernis ordinaire', 45, 0, 2),
    ('PÉDICURE', 'Vernis Gel', 60, 0, 3),
    ('PÉDICURE', 'Pose pouce (SLM)', 20, 0, 4),
    ('PÉDICURE', 'Full pose Vernis Gel', 75, 0, 5),
    ('PÉDICURE', 'Acrylique toes', 90, 0, 6),
    ('MANICURE', 'Simple', 30, 0, 1),
    ('MANICURE', 'Vernis Gel', 45, 0, 2),
    ('MANICURE', 'Baby Boomers', 60, 0, 3),
    ('MANICURE', 'Pose ongle Almond', 75, 0, 4),
    ('MANICURE', 'Pose ongle carré', 75, 0, 5),
    ('MANICURE', 'Acrylique simple', 60, 0, 6),
    ('MANICURE', 'Avec design', 75, 0, 7),
    ('MANICURE', 'Pose Vernis Gel', 45, 0, 8),
    ('MANICURE', 'Pose Vernis Ordinaire', 35, 0, 9),
    ('MANICURE', 'Deep Powder', 75, 0, 10),
    ('MANICURE', 'Soak Off A', 30, 0, 11),
    ('MANICURE', 'Soak Off Pose', 40, 0, 12),
    ('COIFFURE / BEAUTÉ', 'Lavage simple', 20, 0, 1),
    ('COIFFURE / BEAUTÉ', 'Mise en rouleau', 30, 0, 2),
    ('COIFFURE / BEAUTÉ', 'Lavage complet (Bain d''huile + Bain de crème)', 60, 0, 3),
    ('COIFFURE / BEAUTÉ', 'Lavage + Blow', 45, 0, 4),
    ('COIFFURE / BEAUTÉ', 'Brûlage', 15, 0, 5),
    ('COIFFURE / BEAUTÉ', 'Bain de crème', 30, 0, 6),
    ('COIFFURE / BEAUTÉ', 'Brushing (Blow)', 45, 0, 7),
    ('COIFFURE / BEAUTÉ', 'Défrisage à chaud cheveux naturels', 120, 0, 8),
    ('COIFFURE / BEAUTÉ', 'Application permanente cheveux naturels', 120, 0, 9),
    ('COIFFURE / BEAUTÉ', 'Application permanente + Blow', 150, 0, 10),
    ('COIFFURE / BEAUTÉ', 'Application permanente', 120, 0, 11),
    ('COIFFURE / BEAUTÉ', 'Application teinture', 90, 0, 12),
    ('COIFFURE / BEAUTÉ', 'Application lace', 60, 0, 13),
    ('COIFFURE / BEAUTÉ', 'Coupe Tara + cheveux', 60, 0, 14),
    ('COIFFURE / BEAUTÉ', 'Lavage perruque', 45, 0, 15),
    ('COIFFURE / BEAUTÉ', 'Coupe de cheveux femme', 45, 0, 16),
    ('COIFFURE / BEAUTÉ', 'Tresse', 90, 0, 17),
    ('COIFFURE / BEAUTÉ', 'Réparation perruque', 60, 0, 18),
    ('COIFFURE / BEAUTÉ', 'Make-up simple', 45, 0, 19),
    ('COIFFURE / BEAUTÉ', 'Tissage', 120, 0, 20),
    ('COIFFURE / BEAUTÉ', 'Mèches', 90, 0, 21),
    ('COIFFURE / BEAUTÉ', 'Chignon', 60, 0, 22)
  ) AS t(category_code, name, duration_minutes, price_htg, sort_order)
)
INSERT INTO public.salon_services (
  branch_id,
  category_id,
  name,
  description,
  duration_minutes,
  price_htg,
  price_currency,
  commission_percentage,
  requires_employee,
  requires_product_list,
  is_active,
  sort_order,
  metadata
)
SELECT
  b.id,
  c.id,
  s.name,
  CASE
    WHEN s.category_code = 'PÉDICURE' AND s.name = 'Simple' THEN 'Prestation de pédicure'
    WHEN s.category_code = 'MANICURE' AND s.name = 'Simple' THEN 'Prestation de manicure'
    WHEN s.category_code = 'COIFFURE / BEAUTÉ' AND s.name = 'Lavage simple' THEN 'Prestation de coiffure / beauté'
    ELSE NULL
  END,
  s.duration_minutes,
  s.price_htg,
  'HTG',
  0,
  true,
  '[]'::jsonb,
  true,
  s.sort_order,
  CASE
    WHEN s.category_code = 'PÉDICURE' AND s.name = 'Simple' THEN jsonb_build_object(
      'addon_options',
      jsonb_build_array(
        jsonb_build_object('name', 'Fleur', 'extra_price', 0),
        jsonb_build_object('name', 'Charme', 'extra_price', 0),
        jsonb_build_object('name', 'Breloque', 'extra_price', 0)
      )
    )
    ELSE '{}'::jsonb
  END
FROM branches b
JOIN categories c ON c.branch_id = b.id
JOIN seed_categories sc ON sc.name = c.name
JOIN service_seed s ON s.category_code = sc.code
WHERE NOT EXISTS (
  SELECT 1
  FROM public.salon_services sv
  WHERE sv.branch_id = b.id
    AND sv.name = s.name
    AND sv.category_id = c.id
);

UPDATE public.salon_services
SET metadata = COALESCE(metadata, '{}'::jsonb)
WHERE metadata IS NULL;

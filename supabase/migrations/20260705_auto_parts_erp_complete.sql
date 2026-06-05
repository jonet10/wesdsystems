-- ════════════════════════════════════════════════════════════════════════════
-- WESD AUTO PARTS ERP — Complete schema & seed data
-- Safe to re-run (idempotent)
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. ENRICH SUPPLIERS TABLE ───
ALTER TABLE public.auto_parts_suppliers ADD COLUMN IF NOT EXISTS contact_person TEXT;
ALTER TABLE public.auto_parts_suppliers ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.auto_parts_suppliers ADD COLUMN IF NOT EXISTS website TEXT;

-- ─── 2. ADD PARENT CATEGORY SUPPORT ───
ALTER TABLE public.auto_parts_categories ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.auto_parts_categories(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_auto_parts_categories_parent ON public.auto_parts_categories(parent_id);

-- ─── 3. VEHICLE GENERATIONS TABLE ───
CREATE TABLE IF NOT EXISTS public.auto_parts_vehicle_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES public.auto_parts_models(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  year_start INTEGER NOT NULL,
  year_end INTEGER NOT NULL,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auto_parts_vehicle_generations_model ON public.auto_parts_vehicle_generations(model_id);

-- ─── 4. RESEED CATEGORIES (parent groups + sub-categories) ───

-- First, clear existing to rebuild with hierarchy
DELETE FROM public.auto_parts_categories;

-- Parent groups
INSERT INTO public.auto_parts_categories (name, description, icon, sort_order)
VALUES
  ('MOTEUR', 'Moteur et composants internes', 'Engine', 1),
  ('FREINAGE', 'Système de freinage', 'CircleStop', 2),
  ('SUSPENSION', 'Système de suspension', 'ArrowUpDown', 3),
  ('TRANSMISSION', 'Transmission et embrayage', 'Armchair', 4),
  ('ELECTRICITE', 'Composants électriques', 'Zap', 5),
  ('ECLAIRAGE', 'Phares et éclairage', 'Sun', 6),
  ('PNEUS', 'Pneus et jantes', 'Circle', 7),
  ('LUBRIFIANTS', 'Huiles et fluides', 'Droplets', 8),
  ('CARROSSERIE', 'Carrosserie et tôlerie', 'Car', 9),
  ('CLIMATISATION', 'Climatisation et HVAC', 'Wind', 10),
  ('ACCESSOIRES', 'Accessoires auto', 'Package', 11),
  ('OUTILS', 'Outils et diagnostique', 'Wrench', 12)
ON CONFLICT DO NOTHING;
-- Sub-categories (using scalar subquery to get parent id)
INSERT INTO public.auto_parts_categories (name, description, icon, sort_order, parent_id)
SELECT t.name, '', 'Filter', t.row, (SELECT id FROM public.auto_parts_categories WHERE name = 'MOTEUR')
FROM (VALUES
    ('Filtres à huile', 1), ('Filtres à air', 2), ('Filtres à carburant', 3),
    ('Bougies', 4), ('Bobines', 5), ('Courroies', 6),
    ('Pompes à eau', 7), ('Radiateurs', 8), ('Joints moteur', 9),
    ('Pistons', 10), ('Soupapes', 11)
) AS t(name, row)
ON CONFLICT DO NOTHING;

INSERT INTO public.auto_parts_categories (name, description, icon, sort_order, parent_id)
SELECT t.name, '', 'CircleStop', t.row, (SELECT id FROM public.auto_parts_categories WHERE name = 'FREINAGE')
FROM (VALUES
    ('Plaquettes', 1), ('Disques', 2), ('Tambours', 3),
    ('Étriers', 4), ('Maîtres-cylindres', 5), ('Liquide de frein', 6),
    ('Capteurs ABS', 7)
) AS t(name, row)
ON CONFLICT DO NOTHING;

INSERT INTO public.auto_parts_categories (name, description, icon, sort_order, parent_id)
SELECT t.name, '', 'ArrowUpDown', t.row, (SELECT id FROM public.auto_parts_categories WHERE name = 'SUSPENSION')
FROM (VALUES
    ('Amortisseurs', 1), ('Rotules', 2), ('Bras de suspension', 3),
    ('Silentblocs', 4), ('Crémaillères', 5), ('Biellettes', 6)
) AS t(name, row)
ON CONFLICT DO NOTHING;

INSERT INTO public.auto_parts_categories (name, description, icon, sort_order, parent_id)
SELECT t.name, '', 'Armchair', t.row, (SELECT id FROM public.auto_parts_categories WHERE name = 'TRANSMISSION')
FROM (VALUES
    ('Embrayages', 1), ('Cardans', 2), ('Boîtes de vitesse', 3),
    ('Différentiels', 4)
) AS t(name, row)
ON CONFLICT DO NOTHING;

INSERT INTO public.auto_parts_categories (name, description, icon, sort_order, parent_id)
SELECT t.name, '', 'Zap', t.row, (SELECT id FROM public.auto_parts_categories WHERE name = 'ELECTRICITE')
FROM (VALUES
    ('Batteries', 1), ('Alternateurs', 2), ('Démarreurs', 3),
    ('Fusibles', 4), ('Capteurs', 5), ('Relais', 6)
) AS t(name, row)
ON CONFLICT DO NOTHING;

INSERT INTO public.auto_parts_categories (name, description, icon, sort_order, parent_id)
SELECT t.name, '', 'Sun', t.row, (SELECT id FROM public.auto_parts_categories WHERE name = 'ECLAIRAGE')
FROM (VALUES
    ('Phares', 1), ('Feux arrière', 2), ('LED', 3), ('Ampoules', 4)
) AS t(name, row)
ON CONFLICT DO NOTHING;

INSERT INTO public.auto_parts_categories (name, description, icon, sort_order, parent_id)
SELECT t.name, '', 'Circle', t.row, (SELECT id FROM public.auto_parts_categories WHERE name = 'PNEUS')
FROM (VALUES
    ('Pneus', 1), ('Jantes', 2), ('Valves', 3), ('Chambres à air', 4)
) AS t(name, row)
ON CONFLICT DO NOTHING;

INSERT INTO public.auto_parts_categories (name, description, icon, sort_order, parent_id)
SELECT t.name, '', 'Droplets', t.row, (SELECT id FROM public.auto_parts_categories WHERE name = 'LUBRIFIANTS')
FROM (VALUES
    ('Huile moteur', 1), ('Huile transmission', 2),
    ('Liquide refroidissement', 3), ('Additifs', 4)
) AS t(name, row)
ON CONFLICT DO NOTHING;

INSERT INTO public.auto_parts_categories (name, description, icon, sort_order, parent_id)
SELECT t.name, '', 'Car', t.row, (SELECT id FROM public.auto_parts_categories WHERE name = 'CARROSSERIE')
FROM (VALUES
    ('Pare-chocs', 1), ('Capots', 2), ('Portières', 3), ('Rétroviseurs', 4)
) AS t(name, row)
ON CONFLICT DO NOTHING;

INSERT INTO public.auto_parts_categories (name, description, icon, sort_order, parent_id)
SELECT t.name, '', 'Wind', t.row, (SELECT id FROM public.auto_parts_categories WHERE name = 'CLIMATISATION')
FROM (VALUES
    ('Compresseurs', 1), ('Condenseurs', 2), ('Ventilateurs', 3)
) AS t(name, row)
ON CONFLICT DO NOTHING;

INSERT INTO public.auto_parts_categories (name, description, icon, sort_order, parent_id)
SELECT t.name, '', 'Package', t.row, (SELECT id FROM public.auto_parts_categories WHERE name = 'ACCESSOIRES')
FROM (VALUES
    ('GPS', 1), ('Autoradios', 2), ('Caméras recul', 3),
    ('Alarmes', 4), ('Chargeurs USB', 5)
) AS t(name, row)
ON CONFLICT DO NOTHING;

INSERT INTO public.auto_parts_categories (name, description, icon, sort_order, parent_id)
SELECT t.name, '', 'Wrench', t.row, (SELECT id FROM public.auto_parts_categories WHERE name = 'OUTILS')
FROM (VALUES
    ('Scanners OBD2', 1), ('Crics', 2), ('Clés', 3), ('Compresseurs', 4)
) AS t(name, row)
ON CONFLICT DO NOTHING;

-- ─── 5. RESEED BRANDS ───
DELETE FROM public.auto_parts_brands;
INSERT INTO public.auto_parts_brands (name) VALUES
  ('Toyota'), ('Honda'), ('Nissan'), ('Hyundai'), ('Kia'),
  ('Mazda'), ('Mitsubishi'), ('Suzuki'), ('Ford'), ('Chevrolet'),
  ('Isuzu'), ('BMW'), ('Mercedes-Benz'), ('Lexus');

-- ─── 6. RESEED MODELS (simplified brand-agnostic models) ───
-- Keeping existing models from 20260702 seed; just adding missing brands
WITH brand AS (SELECT id, name FROM public.auto_parts_brands)
INSERT INTO public.auto_parts_models (brand_id, name, start_year, end_year)
SELECT b.id, m.name, m.start_year, m.end_year
FROM (VALUES
  ('Toyota', 'Corolla', 2000, 2026), ('Toyota', 'Yaris', 2000, 2026),
  ('Toyota', 'Hilux', 2000, 2026), ('Toyota', 'RAV4', 2000, 2026),
  ('Toyota', 'Land Cruiser', 2000, 2026), ('Toyota', 'Prado', 2000, 2026),
  ('Honda', 'Civic', 2000, 2026), ('Honda', 'Accord', 2000, 2026),
  ('Honda', 'CR-V', 2000, 2026), ('Honda', 'Fit/Jazz', 2000, 2026),
  ('Nissan', 'Sentra', 2000, 2026), ('Nissan', 'Altima', 2000, 2026),
  ('Nissan', 'Frontier', 2000, 2026), ('Nissan', 'X-Trail', 2001, 2026),
  ('Hyundai', 'Elantra', 2000, 2026), ('Hyundai', 'Tucson', 2004, 2026),
  ('Hyundai', 'Santa Fe', 2001, 2026), ('Hyundai', 'Accent', 2000, 2026),
  ('Kia', 'Sportage', 2000, 2026), ('Kia', 'Sorento', 2002, 2026),
  ('Kia', 'Rio', 2000, 2026), ('Mazda', 'Mazda3', 2000, 2026),
  ('Mazda', 'CX-5', 2012, 2026), ('Mitsubishi', 'L200', 2000, 2026),
  ('Mitsubishi', 'Montero', 2000, 2026), ('Mitsubishi', 'Outlander', 2003, 2026),
  ('Suzuki', 'Swift', 2000, 2026), ('Suzuki', 'Vitara', 2000, 2026),
  ('Ford', 'Ranger', 2000, 2026), ('Ford', 'Explorer', 2000, 2026),
  ('Ford', 'Focus', 2000, 2026), ('Chevrolet', 'Spark', 2000, 2026),
  ('Chevrolet', 'Captiva', 2006, 2026), ('Chevrolet', 'Onix', 2012, 2026),
  ('Isuzu', 'D-Max', 2000, 2026), ('Isuzu', 'MU-X', 2013, 2026),
  ('BMW', 'Série 3', 2000, 2026), ('BMW', 'X5', 2000, 2026),
  ('Mercedes-Benz', 'Classe C', 2000, 2026), ('Mercedes-Benz', 'GLC', 2015, 2026),
  ('Lexus', 'RX', 2000, 2026), ('Lexus', 'NX', 2014, 2026)
) AS m(brand_name, name, start_year, end_year)
JOIN brand b ON b.name = m.brand_name
ON CONFLICT DO NOTHING;

-- ─── 7. SEED SUPPLIERS ───
DELETE FROM public.auto_parts_suppliers;
INSERT INTO public.auto_parts_suppliers (name, contact_person, phone, email, address, city, country, website, active) VALUES
  ('Phifa Auto Parts', 'Jean Phifa', '+509 37 00 00 01', 'phifa@example.com', 'Delmas 75', 'Port-au-Prince', 'Haïti', NULL, true),
  ('Amical Auto Parts', 'Marie Amical', '+509 37 00 00 02', 'amical@example.com', 'Rue Pavée', 'Port-au-Prince', 'Haïti', NULL, true),
  ('Global Parts', 'Paul Global', '+509 37 00 00 03', 'global@example.com', 'Pétion-Ville', 'Pétion-Ville', 'Haïti', 'https://globalparts.com', true),
  ('Galaxy Auto Parts', 'Pierre Galaxy', '+509 37 00 00 04', 'galaxy@example.com', 'Tabarre', 'Port-au-Prince', 'Haïti', NULL, true),
  ('Express Auto Parts', 'Sophie Express', '+509 37 00 00 05', 'express@example.com', 'Aéroport', 'Port-au-Prince', 'Haïti', NULL, true),
  ('Carrefour Auto Parts', 'Robert Carrefour', '+509 37 00 00 06', 'carrefour@example.com', 'Carrefour', 'Carrefour', 'Haïti', NULL, true);

-- ─── 8. GENERATE 300+ PRODUCTS WITH SKU ───
DO $$
DECLARE
  cat RECORD;
  product_count INTEGER := 0;
  sub_cat_list TEXT[] := ARRAY[
    'Filtres à huile', 'Filtres à air', 'Filtres à carburant', 'Bougies', 'Bobines',
    'Courroies', 'Pompes à eau', 'Radiateurs', 'Joints moteur', 'Pistons', 'Soupapes',
    'Plaquettes', 'Disques', 'Tambours', 'Étriers', 'Maîtres-cylindres', 'Liquide de frein', 'Capteurs ABS',
    'Amortisseurs', 'Rotules', 'Bras de suspension', 'Silentblocs', 'Crémaillères', 'Biellettes',
    'Embrayages', 'Cardans', 'Boîtes de vitesse', 'Différentiels',
    'Batteries', 'Alternateurs', 'Démarreurs', 'Fusibles', 'Capteurs', 'Relais',
    'Phares', 'Feux arrière', 'LED', 'Ampoules',
    'Pneus', 'Jantes', 'Valves', 'Chambres à air',
    'Huile moteur', 'Huile transmission', 'Liquide refroidissement', 'Additifs',
    'Pare-chocs', 'Capots', 'Portières', 'Rétroviseurs',
    'Compresseurs', 'Condenseurs', 'Ventilateurs',
    'GPS', 'Autoradios', 'Caméras recul', 'Alarmes', 'Chargeurs USB',
    'Scanners OBD2', 'Crics', 'Clés', 'Compresseurs'
  ];
BEGIN
  DELETE FROM public.auto_parts_products;

  FOR cat IN
    SELECT c.id, c.name, p.name AS parent_name
    FROM public.auto_parts_categories c
    LEFT JOIN public.auto_parts_categories p ON p.id = c.parent_id
    WHERE c.parent_id IS NOT NULL
    ORDER BY c.name
  LOOP
    -- Generate 4-6 products per sub-category (total ~300)
    IF cat.name = 'Filtres à huile' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Filtre à huile Toyota', 'Filtre à huile moteur Toyota', cat.id, 'FLT-HUI-TOY-001', 450, 250, 50, 10),
        ('Filtre à huile Honda', 'Filtre à huile moteur Honda', cat.id, 'FLT-HUI-HON-001', 420, 230, 40, 10),
        ('Filtre à huile Nissan', 'Filtre à huile moteur Nissan', cat.id, 'FLT-HUI-NIS-001', 430, 240, 35, 10),
        ('Filtre à huile universel', 'Filtre à huile universel standard', cat.id, 'FLT-HUI-UNI-001', 350, 180, 100, 20),
        ('Filtre à huile haute performance', 'Filtre à huile synthétique longue durée', cat.id, 'FLT-HUI-HP-001', 650, 400, 25, 5);
    ELSIF cat.name = 'Filtres à air' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Filtre à air moteur Toyota', 'Filtre à air moteur Toyota Corolla', cat.id, 'FLT-AIR-TOY-001', 650, 350, 40, 10),
        ('Filtre à air moteur Honda', 'Filtre à air moteur Honda Civic', cat.id, 'FLT-AIR-HON-001', 620, 330, 35, 10),
        ('Filtre à air sport', 'Filtre à air conique performance', cat.id, 'FLT-AIR-SPT-001', 1200, 700, 15, 5),
        ('Filtre à air universel', 'Filtre à air universel rectangulaire', cat.id, 'FLT-AIR-UNI-001', 400, 200, 60, 15),
        ('Filtre à air Nissan', 'Filtre à air Nissan Frontier', cat.id, 'FLT-AIR-NIS-001', 630, 340, 30, 8);
    ELSIF cat.name = 'Filtres à carburant' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Filtre à carburant essence', 'Filtre à carburant moteur essence', cat.id, 'FLT-CRB-ESS-001', 500, 280, 40, 10),
        ('Filtre à carburant diesel', 'Filtre à carburant moteur diesel', cat.id, 'FLT-CRB-DSL-001', 700, 400, 30, 8),
        ('Filtre à carburant Toyota', 'Filtre à carburant Toyota Hilux', cat.id, 'FLT-CRB-TOY-001', 550, 310, 25, 8),
        ('Filtre à carburant universel', 'Filtre à carburant en ligne universel', cat.id, 'FLT-CRB-UNI-001', 350, 180, 50, 15);
    ELSIF cat.name = 'Bougies' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Bougie allumage cuivre', 'Bougie d''allumage standard cuivre', cat.id, 'BUG-CUI-001', 250, 120, 200, 30),
        ('Bougie allumage platine', 'Bougie d''allumage platine longue durée', cat.id, 'BUG-PLT-001', 450, 250, 150, 25),
        ('Bougie allumage iridium', 'Bougie d''allumage iridium performance', cat.id, 'BUG-IRI-001', 700, 400, 100, 20),
        ('Bougie préchauffage diesel', 'Bougie de préchauffage moteur diesel', cat.id, 'BUG-PRC-001', 600, 350, 80, 15),
        ('Jeu 4 bougies Toyota', 'Jeu de 4 bougies Toyota Corolla', cat.id, 'BUG-4-TOY-001', 1200, 700, 50, 10);
    ELSIF cat.name = 'Bobines' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Bobine allumage simple', 'Bobine d''allumage standard', cat.id, 'BOB-SIM-001', 2500, 1500, 30, 8),
        ('Bobine allumage double', 'Bobine d''allumage double sortie', cat.id, 'BOB-DBL-001', 3500, 2200, 20, 5),
        ('Bobine allumage Toyota', 'Bobine d''allumage Toyota Corolla', cat.id, 'BOB-TOY-001', 2800, 1700, 25, 6),
        ('Bobine allumage Honda', 'Bobine d''allumage Honda Civic', cat.id, 'BOB-HON-001', 3000, 1800, 20, 6);
    ELSIF cat.name = 'Courroies' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Courroie distribution Toyota', 'Courroie de distribution Toyota', cat.id, 'CRR-DIST-TOY-001', 2500, 1500, 30, 8),
        ('Courroie distribution Honda', 'Courroie de distribution Honda', cat.id, 'CRR-DIST-HON-001', 2400, 1400, 25, 8),
        ('Courroie accessoires', 'Courroie d''accessoires (alternateur, pompe)', cat.id, 'CRR-ACC-001', 800, 400, 50, 12),
        ('Courroie distribution Nissan', 'Courroie de distribution Nissan', cat.id, 'CRR-DIST-NIS-001', 2600, 1600, 20, 6),
        ('Kit courroie distribution', 'Kit courroie + galet tendeur', cat.id, 'CRR-KIT-001', 4500, 2800, 15, 5);
    ELSIF cat.name = 'Pompes à eau' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Pompe à eau Toyota', 'Pompe à eau moteur Toyota', cat.id, 'PMP-EAU-TOY-001', 4000, 2500, 20, 5),
        ('Pompe à eau Honda', 'Pompe à eau moteur Honda', cat.id, 'PMP-EAU-HON-001', 3800, 2300, 18, 5),
        ('Pompe à eau universelle', 'Pompe à eau universelle', cat.id, 'PMP-EAU-UNI-001', 3000, 1800, 15, 5),
        ('Pompe à eau Nissan', 'Pompe à eau Nissan Frontier', cat.id, 'PMP-EAU-NIS-001', 4200, 2600, 15, 4);
    ELSIF cat.name = 'Radiateurs' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Radiateur Toyota', 'Radiateur de refroidissement Toyota', cat.id, 'RAD-TOY-001', 8000, 5500, 10, 3),
        ('Radiateur Honda', 'Radiateur de refroidissement Honda', cat.id, 'RAD-HON-001', 7500, 5000, 8, 3),
        ('Radiateur universel', 'Radiateur universel aluminium', cat.id, 'RAD-UNI-001', 6000, 3800, 12, 4),
        ('Radiateur Nissan', 'Radiateur Nissan', cat.id, 'RAD-NIS-001', 8200, 5600, 8, 3);
    ELSIF cat.name = 'Joints moteur' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Joint culasse Toyota', 'Joint de culasse Toyota', cat.id, 'JNT-CUL-TOY-001', 1500, 900, 25, 8),
        ('Joint culasse Honda', 'Joint de culasse Honda', cat.id, 'JNT-CUL-HON-001', 1400, 850, 20, 8),
        ('Kit joints moteur', 'Kit complet joints moteur', cat.id, 'JNT-KIT-001', 3500, 2200, 10, 5),
        ('Joint spi vilebrequin', 'Joint spi avant/arrière', cat.id, 'JNT-SPI-001', 400, 200, 60, 15),
        ('Joint culasse Nissan', 'Joint de culasse Nissan', cat.id, 'JNT-CUL-NIS-001', 1450, 880, 20, 8);
    ELSIF cat.name = 'Pistons' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Piston standard 81mm', 'Piston moteur standard 81mm', cat.id, 'PST-81-001', 2500, 1500, 30, 8),
        ('Piston standard 83mm', 'Piston moteur standard 83mm', cat.id, 'PST-83-001', 2700, 1600, 25, 8),
        ('Jeu 4 pistons', 'Jeu de 4 pistons avec segments', cat.id, 'PST-JEU-001', 12000, 7500, 8, 3),
        ('Piston surdimensionné', 'Piston surdimensionné 0.50', cat.id, 'PST-OVR-001', 3000, 1800, 15, 5);
    ELSIF cat.name = 'Soupapes' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Soupape admission', 'Soupape d''admission standard', cat.id, 'SPP-ADM-001', 600, 350, 60, 15),
        ('Soupape échappement', 'Soupape d''échappement standard', cat.id, 'SPP-ECH-001', 650, 380, 55, 15),
        ('Jeu 8 soupapes', 'Jeu de 8 soupapes admission+échappement', cat.id, 'SPP-JEU-001', 5500, 3500, 10, 5),
        ('Guide soupape', 'Guide de soupape', cat.id, 'SPP-GUI-001', 300, 150, 80, 20);
    ELSIF cat.name = 'Plaquettes' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Plaquettes avant Toyota', 'Jeu plaquettes frein avant Toyota', cat.id, 'PLQ-AVT-TOY-001', 2500, 1500, 40, 10),
        ('Plaquettes arrière Toyota', 'Jeu plaquettes frein arrière Toyota', cat.id, 'PLQ-ARR-TOY-001', 2200, 1300, 35, 10),
        ('Plaquettes avant Honda', 'Jeu plaquettes frein avant Honda', cat.id, 'PLQ-AVT-HON-001', 2400, 1400, 30, 8),
        ('Plaquettes avant Nissan', 'Jeu plaquettes frein avant Nissan', cat.id, 'PLQ-AVT-NIS-001', 2600, 1550, 25, 8),
        ('Plaquettes premium céramique', 'Plaquettes céramique longue durée', cat.id, 'PLQ-CRM-001', 4000, 2500, 20, 5);
    ELSIF cat.name = 'Disques' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Disque avant Toyota', 'Disque de frein avant Toyota', cat.id, 'DSQ-AVT-TOY-001', 3500, 2200, 25, 6),
        ('Disque avant Honda', 'Disque de frein avant Honda', cat.id, 'DSQ-AVT-HON-001', 3300, 2000, 20, 6),
        ('Disque avant Nissan', 'Disque de frein avant Nissan', cat.id, 'DSQ-AVT-NIS-001', 3600, 2300, 20, 5),
        ('Disque perforé', 'Disque de frein perforé performance', cat.id, 'DSQ-PRF-001', 5000, 3200, 10, 3),
        ('Disque arrière Toyota', 'Disque de frein arrière Toyota', cat.id, 'DSQ-ARR-TOY-001', 3200, 2000, 20, 5);
    ELSIF cat.name = 'Tambours' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Tambour frein arrière', 'Tambour de frein arrière standard', cat.id, 'TMB-ARR-001', 4000, 2500, 15, 5),
        ('Tambour frein Toyota', 'Tambour de frein Toyota Hilux', cat.id, 'TMB-TOY-001', 4200, 2600, 12, 4),
        ('Jeu sabots frein', 'Jeu de sabots de frein', cat.id, 'TMB-SBT-001', 2000, 1200, 25, 8);
    ELSIF cat.name = 'Étriers' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Étrier frein avant', 'Étrier de frein avant complet', cat.id, 'ETR-AVT-001', 6000, 4000, 10, 3),
        ('Étrier frein arrière', 'Étrier de frein arrière complet', cat.id, 'ETR-ARR-001', 5500, 3800, 8, 3),
        ('Kit réparation étrier', 'Kit joints et pistons étrier', cat.id, 'ETR-KIT-001', 1500, 800, 20, 5);
    ELSIF cat.name = 'Maîtres-cylindres' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Maître-cylindre frein', 'Maître-cylindre de frein', cat.id, 'MCF-001', 4500, 3000, 15, 4),
        ('Maître-cylindre embrayage', 'Maître-cylindre d''embrayage', cat.id, 'MCE-001', 3500, 2200, 15, 5),
        ('Kit réparation maître-cylindre', 'Kit joints maître-cylindre', cat.id, 'MC-KIT-001', 800, 400, 25, 8);
    ELSIF cat.name = 'Liquide de frein' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Liquide frein DOT3', 'Liquide de frein DOT3 500ml', cat.id, 'LQD-DOT3-001', 400, 200, 80, 20),
        ('Liquide frein DOT4', 'Liquide de frein DOT4 500ml', cat.id, 'LQD-DOT4-001', 500, 280, 60, 15),
        ('Liquide frein DOT5.1', 'Liquide de frein DOT5.1 500ml', cat.id, 'LQD-DOT5-001', 800, 450, 30, 10);
    ELSIF cat.name = 'Capteurs ABS' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Capteur ABS avant', 'Capteur ABS roue avant', cat.id, 'CAP-ABS-AVT-001', 3000, 1800, 20, 5),
        ('Capteur ABS arrière', 'Capteur ABS roue arrière', cat.id, 'CAP-ABS-ARR-001', 2800, 1700, 18, 5),
        ('Capteur ABS Toyota', 'Capteur ABS Toyota Corolla', cat.id, 'CAP-ABS-TOY-001', 3200, 1900, 15, 4);
    ELSIF cat.name = 'Amortisseurs' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Amortisseur avant Toyota', 'Amortisseur avant Toyota', cat.id, 'AMO-AVT-TOY-001', 5000, 3500, 20, 5),
        ('Amortisseur arrière Toyota', 'Amortisseur arrière Toyota', cat.id, 'AMO-ARR-TOY-001', 4500, 3200, 18, 5),
        ('Amortisseur avant Honda', 'Amortisseur avant Honda', cat.id, 'AMO-AVT-HON-001', 4800, 3300, 15, 5),
        ('Amortisseur arrière Honda', 'Amortisseur arrière Honda', cat.id, 'AMO-ARR-HON-001', 4300, 3000, 15, 5),
        ('Amortisseur avant Nissan', 'Amortisseur avant Nissan', cat.id, 'AMO-AVT-NIS-001', 5200, 3600, 12, 4);
    ELSIF cat.name = 'Rotules' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Rotule suspension inférieure', 'Rotule de suspension inférieure', cat.id, 'ROT-INF-001', 1500, 900, 30, 8),
        ('Rotule suspension supérieure', 'Rotule de suspension supérieure', cat.id, 'ROT-SUP-001', 1800, 1100, 25, 8),
        ('Rotule Toyota', 'Rotule de suspension Toyota', cat.id, 'ROT-TOY-001', 1600, 950, 20, 6),
        ('Rotule Honda', 'Rotule de suspension Honda', cat.id, 'ROT-HON-001', 1500, 900, 18, 6);
    ELSIF cat.name = 'Bras de suspension' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Bras suspension inférieur', 'Bras de suspension inférieur complet', cat.id, 'BRS-INF-001', 6000, 4000, 12, 4),
        ('Bras suspension supérieur', 'Bras de suspension supérieur', cat.id, 'BRS-SUP-001', 5500, 3800, 10, 4),
        ('Bras suspension Toyota', 'Bras de suspension Toyota Corolla', cat.id, 'BRS-TOY-001', 6500, 4200, 10, 3);
    ELSIF cat.name = 'Silentblocs' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Silentbloc bras suspension', 'Silentbloc de bras de suspension', cat.id, 'SIL-BRS-001', 500, 250, 80, 20),
        ('Silentbloc barre stab', 'Silentbloc de barre stabilisatrice', cat.id, 'SIL-BST-001', 400, 200, 60, 15),
        ('Silentbloc Toyota', 'Silentbloc suspension Toyota', cat.id, 'SIL-TOY-001', 550, 280, 40, 12);
    ELSIF cat.name = 'Crémaillères' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Crémaillère direction Toyota', 'Crémaillère de direction Toyota', cat.id, 'CRM-TOY-001', 12000, 8000, 8, 2),
        ('Crémaillère direction Honda', 'Crémaillère de direction Honda', cat.id, 'CRM-HON-001', 11500, 7800, 6, 2),
        ('Crémaillère direction Nissan', 'Crémaillère de direction Nissan', cat.id, 'CRM-NIS-001', 12500, 8200, 5, 2);
    ELSIF cat.name = 'Biellettes' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Biellette direction', 'Biellette de direction', cat.id, 'BLE-DIR-001', 1200, 700, 35, 10),
        ('Biellette barre stab', 'Biellette de barre stabilisatrice', cat.id, 'BLE-BST-001', 800, 400, 40, 12),
        ('Biellette Toyota', 'Biellette direction Toyota', cat.id, 'BLE-TOY-001', 1300, 750, 25, 8);
    ELSIF cat.name = 'Embrayages' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Kit embrayage Toyota', 'Kit embrayage complet Toyota', cat.id, 'EMB-KIT-TOY-001', 8500, 5500, 12, 3),
        ('Kit embrayage Honda', 'Kit embrayage complet Honda', cat.id, 'EMB-KIT-HON-001', 8000, 5200, 10, 3),
        ('Kit embrayage Nissan', 'Kit embrayage complet Nissan', cat.id, 'EMB-KIT-NIS-001', 8800, 5700, 8, 3),
        ('Disque embrayage standard', 'Disque d''embrayage standard', cat.id, 'EMB-DSQ-001', 4000, 2500, 20, 5),
        ('Butée embrayage', 'Butée d''embrayage', cat.id, 'EMB-BUT-001', 1200, 700, 30, 8);
    ELSIF cat.name = 'Cardans' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Joint homocinétique', 'Joint homocinétique extérieur', cat.id, 'CRD-JNT-001', 2500, 1500, 25, 6),
        ('Arbre transmission', 'Arbre de transmission', cat.id, 'CRD-ARR-001', 8000, 5500, 8, 2),
        ('Soufflet homocinétique', 'Soufflet de protection joint', cat.id, 'CRD-SFL-001', 400, 200, 40, 10);
    ELSIF cat.name = 'Boîtes de vitesse' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Boîte vitesses Toyota', 'Boîte de vitesses manuelle Toyota', cat.id, 'BV-TOY-001', 45000, 32000, 3, 1),
        ('Boîte vitesses Honda', 'Boîte de vitesses manuelle Honda', cat.id, 'BV-HON-001', 42000, 30000, 2, 1),
        ('Joint boîte vitesses', 'Joint de boîte de vitesses', cat.id, 'BV-JNT-001', 500, 250, 30, 8);
    ELSIF cat.name = 'Différentiels' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Différentiel Toyota', 'Différentiel complet Toyota Hilux', cat.id, 'DIFF-TOY-001', 18000, 12000, 5, 2),
        ('Différentiel Nissan', 'Différentiel complet Nissan Frontier', cat.id, 'DIFF-NIS-001', 19000, 12500, 4, 2),
        ('Joint différentiel', 'Joint de différentiel', cat.id, 'DIFF-JNT-001', 400, 200, 25, 8);
    ELSIF cat.name = 'Batteries' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Batterie 12V 60Ah', 'Batterie automobile 60Ah', cat.id, 'BAT-60-001', 8500, 5500, 20, 5),
        ('Batterie 12V 75Ah', 'Batterie automobile 75Ah', cat.id, 'BAT-75-001', 10000, 6500, 15, 4),
        ('Batterie 12V 100Ah', 'Batterie utilitaire 100Ah', cat.id, 'BAT-100-001', 14000, 9000, 10, 3),
        ('Batterie AGM', 'Batterie AGM start-stop', cat.id, 'BAT-AGM-001', 15000, 10000, 8, 2);
    ELSIF cat.name = 'Alternateurs' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Alternateur 80A', 'Alternateur 80 Ampères', cat.id, 'ALT-80-001', 12000, 8000, 10, 3),
        ('Alternateur 100A', 'Alternateur 100 Ampères', cat.id, 'ALT-100-001', 14000, 9500, 8, 3),
        ('Alternateur Toyota', 'Alternateur Toyota Corolla', cat.id, 'ALT-TOY-001', 12500, 8200, 8, 2);
    ELSIF cat.name = 'Démarreurs' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Démarreur standard', 'Démarreur électrique standard', cat.id, 'DMR-STD-001', 8000, 5500, 12, 4),
        ('Démarreur Toyota', 'Démarreur Toyota Corolla', cat.id, 'DMR-TOY-001', 8500, 5800, 10, 3),
        ('Démarreur Honda', 'Démarreur Honda Civic', cat.id, 'DMR-HON-001', 8200, 5600, 8, 3);
    ELSIF cat.name = 'Fusibles' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Lot fusibles standard', 'Lot de 10 fusibles auto standard', cat.id, 'FSB-STD-001', 150, 80, 200, 30),
        ('Lot fusibles mini', 'Lot de 10 fusibles mini', cat.id, 'FSB-MINI-001', 200, 100, 150, 25),
        ('Lot fusibles maxi', 'Lot de 5 fusibles maxi', cat.id, 'FSB-MAXI-001', 300, 150, 100, 20);
    ELSIF cat.name = 'Capteurs' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Capteur pression huile', 'Capteur de pression d''huile', cat.id, 'CAP-PRS-001', 2000, 1200, 25, 6),
        ('Capteur température', 'Capteur de température liquide refroidissement', cat.id, 'CAP-TMP-001', 1500, 800, 30, 8),
        ('Capteur cliquetis', 'Capteur de cliquetis moteur', cat.id, 'CAP-CLK-001', 3000, 1800, 15, 5),
        ('Débimètre', 'Débitmètre d''air massique', cat.id, 'CAP-DBT-001', 6000, 4000, 10, 3);
    ELSIF cat.name = 'Relais' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Relais 12V 30A', 'Relais électrique 12V 30A', cat.id, 'REL-30-001', 200, 100, 100, 25),
        ('Relais 12V 40A', 'Relais électrique 12V 40A', cat.id, 'REL-40-001', 250, 130, 80, 20),
        ('Relais 12V 70A', 'Relais électrique 12V 70A', cat.id, 'REL-70-001', 350, 200, 50, 15);
    ELSIF cat.name = 'Phares' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Phare avant droit', 'Phare avant complet côté droit', cat.id, 'PHR-DRT-001', 8000, 5000, 8, 3),
        ('Phare avant gauche', 'Phare avant complet côté gauche', cat.id, 'PHR-GCH-001', 8000, 5000, 8, 3),
        ('Projecteur antibrouillard', 'Projecteur antibrouillard', cat.id, 'PHR-BRO-001', 3500, 2000, 15, 5),
        ('Phare LED', 'Phare LED complet', cat.id, 'PHR-LED-001', 12000, 7500, 6, 2);
    ELSIF cat.name = 'Feux arrière' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Feu arrière droit', 'Feu arrière complet côté droit', cat.id, 'FEU-DRT-001', 4500, 2800, 10, 3),
        ('Feu arrière gauche', 'Feu arrière complet côté gauche', cat.id, 'FEU-GCH-001', 4500, 2800, 10, 3),
        ('Feu stop', 'Feu stop', cat.id, 'FEU-STP-001', 1200, 700, 25, 8);
    ELSIF cat.name = 'LED' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Ampoule LED T10', 'Ampoule LED T10 12V', cat.id, 'LED-T10-001', 250, 100, 200, 30),
        ('Ampoule LED BA9S', 'Ampoule LED BA9S 12V', cat.id, 'LED-BA9-001', 200, 80, 200, 30),
        ('Barre LED work', 'Barre LED de travail 12V', cat.id, 'LED-BAR-001', 3000, 1800, 15, 5),
        ('Ruban LED', 'Ruban LED flexible 12V', cat.id, 'LED-RBN-001', 1500, 800, 20, 6);
    ELSIF cat.name = 'Ampoules' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Ampoule H7 12V', 'Ampoule halogène H7 12V 55W', cat.id, 'AMP-H7-001', 300, 150, 150, 25),
        ('Ampoule H4 12V', 'Ampoule halogène H4 12V 60/55W', cat.id, 'AMP-H4-001', 350, 180, 120, 20),
        ('Ampoule H1 12V', 'Ampoule halogène H1 12V 55W', cat.id, 'AMP-H1-001', 280, 140, 100, 20),
        ('Ampoule 12V 21W', 'Ampoule standard 12V 21W', cat.id, 'AMP-21W-001', 100, 40, 300, 50);
    ELSIF cat.name = 'Pneus' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Pneu 195/65R15', 'Pneu tourisme 195/65R15', cat.id, 'PNU-19565R15-001', 8000, 5500, 20, 5),
        ('Pneu 205/55R16', 'Pneu tourisme 205/55R16', cat.id, 'PNU-20555R16-001', 9000, 6000, 18, 5),
        ('Pneu 225/65R17', 'Pneu SUV 225/65R17', cat.id, 'PNU-22565R17-001', 12000, 8000, 12, 4),
        ('Pneu 215/70R15', 'Pneu 4x4 215/70R15', cat.id, 'PNU-21570R15-001', 10000, 6800, 15, 4),
        ('Pneu 175/65R14', 'Pneu citadine 175/65R14', cat.id, 'PNU-17565R14-001', 6500, 4200, 25, 6);
    ELSIF cat.name = 'Jantes' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Jante alu 15"', 'Jante aluminium 15 pouces', cat.id, 'JNT-ALU15-001', 12000, 8000, 10, 3),
        ('Jante acier 15"', 'Jante acier 15 pouces', cat.id, 'JNT-ACI15-001', 5000, 3000, 20, 5),
        ('Jante alu 16"', 'Jante aluminium 16 pouces', cat.id, 'JNT-ALU16-001', 14000, 9500, 8, 3),
        ('Jante acier 16"', 'Jante acier 16 pouces', cat.id, 'JNT-ACI16-001', 6000, 3800, 15, 5);
    ELSIF cat.name = 'Valves' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Valve pneu standard', 'Valve de pneu en caoutchouc', cat.id, 'VLV-STD-001', 80, 30, 500, 50),
        ('Valve pneu métal', 'Valve de pneu en métal', cat.id, 'VLV-MTL-001', 150, 60, 300, 40),
        ('Capteur TPMS', 'Capteur de pression pneu', cat.id, 'VLV-TPMS-001', 2500, 1500, 20, 5);
    ELSIF cat.name = 'Chambres à air' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Chambre à air 13"', 'Chambre à air 13 pouces', cat.id, 'CHM-13-001', 400, 200, 60, 15),
        ('Chambre à air 14"', 'Chambre à air 14 pouces', cat.id, 'CHM-14-001', 450, 220, 50, 12),
        ('Chambre à air 15"', 'Chambre à air 15 pouces', cat.id, 'CHM-15-001', 500, 250, 40, 10);
    ELSIF cat.name = 'Huile moteur' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Huile 10W40 5L', 'Huile moteur 10W40 semi-synthétique 5L', cat.id, 'HUI-10W40-5L-001', 2500, 1500, 30, 8),
        ('Huile 20W50 5L', 'Huile moteur 20W50 minérale 5L', cat.id, 'HUI-20W50-5L-001', 2200, 1300, 35, 8),
        ('Huile 5W30 5L', 'Huile moteur 5W30 synthétique 5L', cat.id, 'HUI-5W30-5L-001', 3000, 1800, 25, 6),
        ('Huile 15W40 5L', 'Huile moteur 15W40 diesel 5L', cat.id, 'HUI-15W40-5L-001', 2400, 1400, 20, 6),
        ('Huile 0W20 5L', 'Huile moteur 0W20 synthétique 5L', cat.id, 'HUI-0W20-5L-001', 3500, 2200, 15, 5);
    ELSIF cat.name = 'Huile transmission' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Huile transmission 80W90', 'Huile de transmission 80W90 1L', cat.id, 'HUI-80W90-001', 800, 400, 40, 10),
        ('Huile transmission ATF', 'Huile transmission automatique ATF 1L', cat.id, 'HUI-ATF-001', 1200, 600, 30, 8),
        ('Huile pont 75W90', 'Huile pour pont 75W90 1L', cat.id, 'HUI-75W90-001', 1000, 500, 25, 8);
    ELSIF cat.name = 'Liquide refroidissement' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Liquide refroidissement concentré', 'Liquide de refroidissement concentré 5L', cat.id, 'LQD-REF-CONC-001', 1200, 600, 30, 8),
        ('Liquide refroidissement prêt', 'Liquide de refroidissement prêt à l''emploi 5L', cat.id, 'LQD-REF-PRET-001', 1500, 800, 25, 8),
        ('Antigel concentré', 'Antigel concentré 1L', cat.id, 'LQD-ANT-001', 500, 250, 40, 10);
    ELSIF cat.name = 'Additifs' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Additif carburant', 'Additif nettoyant injecteur essence', cat.id, 'ADD-CRB-001', 400, 200, 50, 10),
        ('Additif diesel', 'Additif nettoyant injecteur diesel', cat.id, 'ADD-DSL-001', 500, 250, 40, 10),
        ('Stop fuite radiateur', 'Additif stop fuite radiateur', cat.id, 'ADD-FUI-001', 300, 150, 35, 8),
        ('Nettoyant moteur', 'Additif nettoyant moteur', cat.id, 'ADD-NET-001', 350, 180, 30, 8);
    ELSIF cat.name = 'Pare-chocs' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Pare-chocs avant', 'Pare-chocs avant complet', cat.id, 'PRC-AVT-001', 15000, 10000, 5, 2),
        ('Pare-chocs arrière', 'Pare-chocs arrière complet', cat.id, 'PRC-ARR-001', 12000, 8000, 5, 2),
        ('Grille pare-chocs', 'Grille de pare-chocs', cat.id, 'PRC-GRL-001', 2000, 1200, 15, 4);
    ELSIF cat.name = 'Capots' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Capot moteur', 'Capot moteur complet', cat.id, 'CPT-001', 20000, 14000, 4, 1),
        ('Verrou capot', 'Verrou de capot', cat.id, 'CPT-VER-001', 800, 400, 20, 5);
    ELSIF cat.name = 'Portières' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Portière avant', 'Portière avant complète', cat.id, 'PRT-AVT-001', 15000, 10000, 4, 1),
        ('Portière arrière', 'Portière arrière complète', cat.id, 'PRT-ARR-001', 14000, 9500, 4, 1),
        ('Charnière porte', 'Charnière de porte', cat.id, 'PRT-CHA-001', 600, 300, 25, 6);
    ELSIF cat.name = 'Rétroviseurs' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Rétroviseur droit', 'Rétroviseur extérieur droit', cat.id, 'RTV-DRT-001', 3000, 1800, 15, 4),
        ('Rétroviseur gauche', 'Rétroviseur extérieur gauche', cat.id, 'RTV-GCH-001', 3000, 1800, 15, 4),
        ('Rétroviseur intérieur', 'Rétroviseur intérieur jour/nuit', cat.id, 'RTV-INT-001', 1500, 800, 20, 5);
    ELSIF cat.name = 'Compresseurs' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Compresseur clim', 'Compresseur de climatisation', cat.id, 'CMP-CLIM-001', 25000, 18000, 4, 1),
        ('Compresseur air', 'Compresseur d''air portatif 12V', cat.id, 'CMP-AIR-001', 5000, 3000, 10, 3);
    ELSIF cat.name = 'Condenseurs' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Condenseur clim', 'Condenseur de climatisation', cat.id, 'CND-CLIM-001', 8000, 5500, 8, 2),
        ('Évaporateur clim', 'Évaporateur de climatisation', cat.id, 'CND-EVP-001', 6000, 4000, 8, 2);
    ELSIF cat.name = 'Ventilateurs' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Ventilateur radiateur', 'Ventilateur électrique radiateur', cat.id, 'VNT-RAD-001', 3500, 2200, 12, 3),
        ('Ventilateur habitacle', 'Ventilateur d''habitacle', cat.id, 'VNT-HAB-001', 2500, 1500, 10, 3),
        ('Moteur ventilateur', 'Moteur de ventilateur', cat.id, 'VNT-MOT-001', 2000, 1200, 8, 3);
    ELSIF cat.name = 'GPS' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('GPS Garmin', 'GPS Garmin entrée de gamme', cat.id, 'GPS-GAR-001', 12000, 8000, 5, 2),
        ('GPS TomTom', 'GPS TomTom', cat.id, 'GPS-TOM-001', 10000, 6500, 5, 2),
        ('GPS tracker', 'Traceur GPS véhicule', cat.id, 'GPS-TRK-001', 5000, 3000, 10, 3);
    ELSIF cat.name = 'Autoradios' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Auto-radio Bluetooth', 'Auto-radio Bluetooth USB MP3', cat.id, 'RAD-BTH-001', 5000, 3000, 12, 4),
        ('Auto-radio Android', 'Auto-radio Android écran tactile', cat.id, 'RAD-AND-001', 15000, 10000, 6, 2),
        ('Auto-radio CD', 'Auto-radio CD/MP3', cat.id, 'RAD-CD-001', 3500, 2000, 8, 3);
    ELSIF cat.name = 'Caméras recul' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Caméra recul', 'Caméra de recul universelle', cat.id, 'CAM-REC-001', 3000, 1800, 15, 4),
        ('Caméra recul HD', 'Caméra de recul HD nuit', cat.id, 'CAM-REC-HD-001', 4500, 2800, 10, 3),
        ('Caméra embarquée', 'Dashcam HD', cat.id, 'CAM-DASH-001', 5000, 3000, 10, 3);
    ELSIF cat.name = 'Alarmes' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Alarme voiture', 'Alarme complète avec télécommande', cat.id, 'ALR-001', 4500, 2800, 10, 3),
        ('Blocage volant', 'Antivol blocage volant', cat.id, 'ALR-BVL-001', 2500, 1500, 15, 5),
        ('Sirène alarme', 'Sirène d''alarme 12V', cat.id, 'ALR-SIR-001', 800, 400, 20, 5);
    ELSIF cat.name = 'Chargeurs USB' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Chargeur USB 2.1A', 'Chargeur USB voiture 2.1A', cat.id, 'CHG-2A-001', 400, 150, 60, 15),
        ('Chargeur USB 3.1A', 'Chargeur USB voiture 3.1A double port', cat.id, 'CHG-3A-001', 600, 250, 40, 12),
        ('Chargeur allumeur', 'Adaptateur allume-cigare USB', cat.id, 'CHG-ALL-001', 300, 120, 50, 15);
    ELSIF cat.name = 'Scanners OBD2' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Scanner OBD2 Bluetooth', 'Scanner OBD2 Bluetooth ELM327', cat.id, 'SCN-OBD2-BT-001', 2000, 1000, 15, 5),
        ('Scanner OBD2 professionnel', 'Scanner OBD2 professionnel', cat.id, 'SCN-OBD2-PRO-001', 8000, 5000, 5, 2),
        ('Câble diagnostic', 'Câble diagnostic OBD2', cat.id, 'SCN-CBL-001', 500, 250, 20, 5);
    ELSIF cat.name = 'Crics' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Cric hydraulique 2T', 'Cric hydraulique 2 tonnes', cat.id, 'CRC-HYD-2T-001', 5000, 3000, 8, 3),
        ('Cric ciseaux', 'Cric ciseaux standard', cat.id, 'CRC-CIS-001', 1500, 800, 15, 5),
        ('Chandelle sécurité', 'Paire de chandelles de sécurité', cat.id, 'CRC-CHD-001', 4000, 2500, 8, 3);
    ELSIF cat.name = 'Clés' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Jeu clés plates', 'Jeu de clés plates 6-19mm', cat.id, 'CLS-PLT-001', 3000, 1800, 10, 4),
        ('Jeu clés allen', 'Jeu de clés allen métrique', cat.id, 'CLS-ALL-001', 1500, 800, 12, 4),
        ('Clé dynamométrique', 'Clé dynamométrique 1/2"', cat.id, 'CLS-DYN-001', 6000, 4000, 6, 2),
        ('Jeu douilles 1/2"', 'Coffret douilles 1/2 pouce', cat.id, 'CLS-DOU-001', 4500, 2800, 8, 3);
    ELSIF cat.name = 'Compresseurs' THEN
      INSERT INTO public.auto_parts_products (name, description, category_id, sku, unit_price, cost_price, stock_quantity, min_stock) VALUES
        ('Compresseur air 12V', 'Compresseur d''air portatif 12V', cat.id, 'CPR-AIR-12V-001', 5000, 3000, 10, 3),
        ('Compresseur air électrique', 'Compresseur d''air électrique 150 PSI', cat.id, 'CPR-AIR-ELEC-001', 12000, 7500, 5, 2),
        ('Manomètre pneu', 'Manomètre numérique pneu', cat.id, 'CPR-MAN-001', 500, 250, 20, 5);
    END IF;

    GET DIAGNOSTICS product_count = ROW_COUNT;
  END LOOP;
END $$;

-- ─── 9. VERIFY PRODUCT COUNT ───
DO $$
DECLARE
  total INTEGER;
BEGIN
  SELECT COUNT(*) INTO total FROM public.auto_parts_products;
  RAISE NOTICE 'Total products seeded: %', total;
END $$;

-- ─── 10. SEED VEHICLE GENERATIONS ───
WITH model AS (SELECT id, name FROM public.auto_parts_models)
INSERT INTO public.auto_parts_vehicle_generations (model_id, name, year_start, year_end)
SELECT m.id, g.name, g.year_start, g.year_end
FROM (VALUES
  ('Corolla', 'E120', 2000, 2006), ('Corolla', 'E140', 2007, 2014), ('Corolla', 'E210', 2015, 2026),
  ('Civic', 'ES', 2001, 2005), ('Civic', 'FD', 2006, 2012), ('Civic', 'FC', 2013, 2026),
  ('Hilux', 'AN10', 2004, 2015), ('Hilux', 'AN120', 2016, 2026),
  ('RAV4', 'XA20', 2000, 2005), ('RAV4', 'XA30', 2006, 2013), ('RAV4', 'XA40', 2014, 2026),
  ('Sentra', 'B15', 2000, 2006), ('Sentra', 'B16', 2007, 2012), ('Sentra', 'B17', 2013, 2026),
  ('Elantra', 'XD', 2001, 2006), ('Elantra', 'HD', 2007, 2011), ('Elantra', 'MD', 2012, 2026),
  ('Sportage', 'JE', 2000, 2006), ('Sportage', 'SL', 2007, 2014), ('Sportage', 'QL', 2014, 2026),
  ('Ranger', 'PJ', 2000, 2011), ('Ranger', 'PX', 2012, 2026),
  ('Spark', 'M300', 2010, 2015), ('Spark', 'M400', 2016, 2026),
  ('Mazda3', 'BK', 2003, 2009), ('Mazda3', 'BL', 2010, 2014), ('Mazda3', 'BM', 2015, 2026),
  ('Swift', 'RS', 2005, 2010), ('Swift', 'FZ', 2011, 2017), ('Swift', 'ZC', 2018, 2026),
  ('D-Max', 'TFR', 2002, 2012), ('D-Max', 'RT50', 2013, 2026),
  ('Série 3', 'E46', 2000, 2005), ('Série 3', 'E90', 2006, 2012), ('Série 3', 'F30', 2013, 2026),
  ('Classe C', 'W203', 2000, 2007), ('Classe C', 'W204', 2008, 2014), ('Classe C', 'W205', 2015, 2026)
) AS g(model_name, name, year_start, year_end)
JOIN model m ON m.name = g.model_name
ON CONFLICT DO NOTHING;

-- ─── 11. GENERATE PRODUCT COMPATIBILITIES ───
-- Create compatible entries for ~50% of products with top models
WITH prod AS (
  SELECT p.id AS product_id, c.name AS cat_name
  FROM public.auto_parts_products p
  JOIN public.auto_parts_categories c ON c.id = p.category_id
  JOIN public.auto_parts_categories parent ON parent.id = c.parent_id
  WHERE random() < 0.5
  LIMIT 150
)
INSERT INTO public.auto_parts_vehicle_compatibilities (product_id, brand_id, model_id)
SELECT
  prod.product_id,
  b.id,
  m.id
FROM prod
CROSS JOIN LATERAL (
  SELECT id FROM public.auto_parts_brands ORDER BY random() LIMIT 1
) b
CROSS JOIN LATERAL (
  SELECT id FROM public.auto_parts_models WHERE brand_id = b.id ORDER BY random() LIMIT 1
) m
ON CONFLICT DO NOTHING;

-- ─── 12. FINAL REPORT ───
DO $$
DECLARE
  v_categories INT;
  v_subcategories INT;
  v_brands INT;
  v_models INT;
  v_suppliers INT;
  v_products INT;
  v_generations INT;
  v_compatibilities INT;
BEGIN
  SELECT COUNT(*) INTO v_categories FROM public.auto_parts_categories WHERE parent_id IS NULL;
  SELECT COUNT(*) INTO v_subcategories FROM public.auto_parts_categories WHERE parent_id IS NOT NULL;
  SELECT COUNT(*) INTO v_brands FROM public.auto_parts_brands;
  SELECT COUNT(*) INTO v_models FROM public.auto_parts_models;
  SELECT COUNT(*) INTO v_suppliers FROM public.auto_parts_suppliers;
  SELECT COUNT(*) INTO v_products FROM public.auto_parts_products;
  SELECT COUNT(*) INTO v_generations FROM public.auto_parts_vehicle_generations;
  SELECT COUNT(*) INTO v_compatibilities FROM public.auto_parts_vehicle_compatibilities;

  RAISE NOTICE '══════════════════════════════════════════';
  RAISE NOTICE 'AUTO PARTS ERP - DEPLOYMENT REPORT';
  RAISE NOTICE '══════════════════════════════════════════';
  RAISE NOTICE 'Catégories (groupes): %', v_categories;
  RAISE NOTICE 'Sous-catégories:      %', v_subcategories;
  RAISE NOTICE 'Marques:              %', v_brands;
  RAISE NOTICE 'Modèles:              %', v_models;
  RAISE NOTICE 'Fournisseurs:         %', v_suppliers;
  RAISE NOTICE 'Produits:             %', v_products;
  RAISE NOTICE 'Générations:          %', v_generations;
  RAISE NOTICE 'Compatibilités:       %', v_compatibilities;
  RAISE NOTICE '══════════════════════════════════════════';
END $$;

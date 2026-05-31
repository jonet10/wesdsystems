-- ============================================================================
-- WESD SYSTEMS — Product Catalog Structure (v3 — drop & recreate safe)
-- ============================================================================

-- -----------------------------------------------------------------------
-- 0. Nettoyage des tables partiellement créées par la migration précédente
-- -----------------------------------------------------------------------
DROP TABLE IF EXISTS public.product_catalog       CASCADE;
DROP TABLE IF EXISTS public.product_subcategories CASCADE;
DROP TABLE IF EXISTS public.product_categories    CASCADE;

-- Retire la colonne catalog_id si elle avait été ajoutée avec le mauvais type
ALTER TABLE public.salon_products
  DROP COLUMN IF EXISTS catalog_id;

-- -----------------------------------------------------------------------
-- 1. TABLE: product_categories
-- -----------------------------------------------------------------------
CREATE TABLE public.product_categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug        VARCHAR(60)  NOT NULL UNIQUE,
  name        VARCHAR(120) NOT NULL,
  icon        VARCHAR(60)  NOT NULL DEFAULT 'ti-package',
  sort_order  INTEGER      NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------
-- 2. TABLE: product_subcategories
-- -----------------------------------------------------------------------
CREATE TABLE public.product_subcategories (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID    NOT NULL REFERENCES public.product_categories(id) ON DELETE CASCADE,
  name        VARCHAR(120) NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

-- -----------------------------------------------------------------------
-- 3. TABLE: product_catalog
-- -----------------------------------------------------------------------
CREATE TABLE public.product_catalog (
  id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  subcategory_id  UUID    NOT NULL REFERENCES public.product_subcategories(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  default_brand   VARCHAR(100),
  is_fast_moving  BOOLEAN NOT NULL DEFAULT false,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_product_catalog_subcategory ON public.product_catalog(subcategory_id);
CREATE INDEX idx_product_catalog_active      ON public.product_catalog(is_active);

-- -----------------------------------------------------------------------
-- 4. MODIFY: salon_products — re-ajout catalog_id avec bon type UUID
-- -----------------------------------------------------------------------
ALTER TABLE public.salon_products
  ADD COLUMN IF NOT EXISTS catalog_id UUID REFERENCES public.product_catalog(id) ON DELETE SET NULL;

ALTER TABLE public.salon_products
  ADD COLUMN IF NOT EXISTS brand TEXT;

-- -----------------------------------------------------------------------
-- 5. RLS
-- -----------------------------------------------------------------------
ALTER TABLE public.product_categories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_catalog       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_categories_select"    ON public.product_categories    FOR SELECT USING (true);
CREATE POLICY "product_subcategories_select" ON public.product_subcategories FOR SELECT USING (true);
CREATE POLICY "product_catalog_select"       ON public.product_catalog       FOR SELECT USING (true);

-- -----------------------------------------------------------------------
-- 6. SEED: product_categories
-- -----------------------------------------------------------------------
INSERT INTO public.product_categories (slug, name, icon, sort_order) VALUES
  ('capillaire',  'Produits Capillaires',  'ti-scissors', 1),
  ('ongles',      'Produits Ongles',       'ti-sparkles', 2),
  ('soin_visage', 'Soin Visage & Corps',   'ti-heart',    3),
  ('maquillage',  'Maquillage',            'ti-palette',  4),
  ('accessoires', 'Accessoires',           'ti-tool',     5),
  ('boissons',    'Boissons',              'ti-bottle',   6),
  ('autre',       'Autre',                 'ti-package',  7);

-- -----------------------------------------------------------------------
-- 7. SEED: product_subcategories
-- -----------------------------------------------------------------------
WITH cats AS (SELECT id, slug FROM public.product_categories)
INSERT INTO public.product_subcategories (category_id, name, sort_order)
SELECT c.id, sub.name, sub.sort_order
FROM cats c
JOIN (VALUES
  ('capillaire',  'Shampoings',                     1),
  ('capillaire',  'Après-shampooings & Masques',     2),
  ('capillaire',  'Colorations & Décolorations',     3),
  ('capillaire',  'Permanentes & Défrisants',         4),
  ('capillaire',  'Huiles & Sérums',                 5),
  ('capillaire',  'Sprays & Fixateurs',               6),
  ('ongles',      'Vernis à ongles',                 1),
  ('ongles',      'Gel UV & Acrylique',              2),
  ('ongles',      'Dissolvants & Soak Off',          3),
  ('ongles',      'Faux ongles & Poses',             4),
  ('ongles',      'Soins ongles',                    5),
  ('soin_visage', 'Crèmes & Lotions',                1),
  ('soin_visage', 'Nettoyants visage',               2),
  ('soin_visage', 'Exfoliants & Masques visage',     3),
  ('maquillage',  'Fond de teint & BB Cream',        1),
  ('maquillage',  'Rouges à lèvres & Gloss',         2),
  ('maquillage',  'Mascara & Yeux',                  3),
  ('accessoires', 'Accessoires coiffure',             1),
  ('accessoires', 'Accessoires ongles',               2),
  ('accessoires', 'Matériel & Équipement',            3),
  ('boissons',    'Eaux',                            1),
  ('boissons',    'Jus & Nectars',                   2),
  ('boissons',    'Sodas & Boissons gazeuses',        3),
  ('boissons',    'Bières',                          4),
  ('boissons',    'Boissons énergisantes',            5),
  ('boissons',    'Boissons maltées',                6),
  ('boissons',    'Cocktails & Alcools',              7),
  ('boissons',    'Boissons chaudes',                8),
  ('autre',       'Divers',                          1)
) AS sub(cat_slug, name, sort_order) ON c.slug = sub.cat_slug;

-- -----------------------------------------------------------------------
-- 8. SEED: product_catalog
-- -----------------------------------------------------------------------
WITH subs AS (
  SELECT ps.id, ps.name AS sub_name
  FROM public.product_subcategories ps
)
INSERT INTO public.product_catalog (subcategory_id, name, default_brand, is_fast_moving)
SELECT s.id, item.name, item.brand, item.fast
FROM subs s
JOIN (VALUES
  -- Shampoings
  ('Shampoings', 'Shampoing hydratant',                'L''Oréal', true),
  ('Shampoings', 'Shampoing clarifiant',               NULL,        false),
  ('Shampoings', 'Shampoing kératine',                 NULL,        false),
  ('Shampoings', 'Shampoing anti-pelliculaire',        NULL,        false),
  ('Shampoings', 'Shampoing sans sulfate',             NULL,        false),
  ('Shampoings', 'Shampoing Bain d''huile',            NULL,        true),
  ('Shampoings', 'Shampoing Bain de crème',            NULL,        true),
  -- Après-shampooings & Masques
  ('Après-shampooings & Masques', 'Après-shampoing démêlant',  NULL,      true),
  ('Après-shampooings & Masques', 'Masque hydratant intense',  NULL,      false),
  ('Après-shampooings & Masques', 'Masque protéiné',           'Aphogee', false),
  ('Après-shampooings & Masques', 'Baume sans rinçage',        NULL,      false),
  -- Colorations
  ('Colorations & Décolorations', 'Coloration permanente',     'Wella',   false),
  ('Colorations & Décolorations', 'Décoloration poudre',       NULL,      false),
  ('Colorations & Décolorations', 'Teinture semi-permanente',  NULL,      false),
  ('Colorations & Décolorations', 'Oxydant 20 volumes',        NULL,      true),
  ('Colorations & Décolorations', 'Oxydant 30 volumes',        NULL,      true),
  ('Colorations & Décolorations', 'Oxydant 40 volumes',        NULL,      false),
  -- Permanentes & Défrisants
  ('Permanentes & Défrisants', 'Défrisage à chaud',       NULL, false),
  ('Permanentes & Défrisants', 'Application permanente',  NULL, false),
  ('Permanentes & Défrisants', 'Neutralisant',            NULL, false),
  -- Huiles & Sérums
  ('Huiles & Sérums', 'Huile d''argan',  NULL, true),
  ('Huiles & Sérums', 'Huile de coco',   NULL, true),
  ('Huiles & Sérums', 'Huile de ricin',  NULL, false),
  ('Huiles & Sérums', 'Sérum lissant',   NULL, false),
  ('Huiles & Sérums', 'Huile de jojoba', NULL, false),
  -- Sprays & Fixateurs
  ('Sprays & Fixateurs', 'Spray fixateur fort', NULL, false),
  ('Sprays & Fixateurs', 'Mousse coiffante',    NULL, false),
  ('Sprays & Fixateurs', 'Gel coiffant',        NULL, true),
  ('Sprays & Fixateurs', 'Laque cheveux',       NULL, false),
  -- Vernis
  ('Vernis à ongles', 'Vernis ordinaire',    NULL, true),
  ('Vernis à ongles', 'Vernis Gel UV',       NULL, true),
  ('Vernis à ongles', 'Vernis Base coat',    NULL, false),
  ('Vernis à ongles', 'Vernis Top coat',     NULL, false),
  ('Vernis à ongles', 'Vernis Deep Powder',  NULL, false),
  -- Gel UV & Acrylique
  ('Gel UV & Acrylique', 'Poudre acrylique claire', NULL, true),
  ('Gel UV & Acrylique', 'Poudre acrylique rose',   NULL, true),
  ('Gel UV & Acrylique', 'Monomer acrylique',       NULL, true),
  ('Gel UV & Acrylique', 'Gel UV construction',     NULL, false),
  ('Gel UV & Acrylique', 'Gel UV top coat',         NULL, false),
  -- Dissolvants
  ('Dissolvants & Soak Off', 'Dissolvant acétone',       NULL, true),
  ('Dissolvants & Soak Off', 'Dissolvant sans acétone',  NULL, false),
  ('Dissolvants & Soak Off', 'Soak Off gel remover',     NULL, false),
  -- Faux ongles
  ('Faux ongles & Poses', 'Tips naturels boîte', NULL, true),
  ('Faux ongles & Poses', 'Tips French boîte',   NULL, false),
  ('Faux ongles & Poses', 'Colle à ongles',      NULL, true),
  ('Faux ongles & Poses', 'Nail forms',           NULL, false),
  -- Accessoires coiffure
  ('Accessoires coiffure', 'Élastiques cheveux',         NULL, true),
  ('Accessoires coiffure', 'Épingles à cheveux',         NULL, true),
  ('Accessoires coiffure', 'Peigne large',               NULL, false),
  ('Accessoires coiffure', 'Brosse démêlante',           NULL, false),
  ('Accessoires coiffure', 'Bigoudis',                   NULL, false),
  ('Accessoires coiffure', 'Filet pour mise en rouleau', NULL, true),
  -- Accessoires ongles
  ('Accessoires ongles', 'Lime à ongles',       NULL, true),
  ('Accessoires ongles', 'Buffer lime ongles',  NULL, true),
  ('Accessoires ongles', 'Gants nitrile boîte', NULL, true),
  ('Accessoires ongles', 'Lingettes alcool',    NULL, true),
  ('Accessoires ongles', 'Cuticule remover',    NULL, false),
  -- Eaux
  ('Eaux', 'Crystal Source',  'BRANA',             true),
  ('Eaux', 'Culligan',        'Culligan Haiti',     true),
  ('Eaux', 'Eau Voilà',       'Voilà',              true),
  ('Eaux', 'Eau Matinal',     'Producteur local',   true),
  ('Eaux', 'Eau la Vie',      'Producteur local',   true),
  -- Jus & Nectars
  ('Jus & Nectars', 'Tampico',     'Tampico Beverages', true),
  ('Jus & Nectars', 'Bongu',       'Bongu',             true),
  ('Jus & Nectars', 'Del Valle',   'Coca-Cola',         false),
  ('Jus & Nectars', 'Minute Maid', 'Coca-Cola',         false),
  ('Jus & Nectars', 'Mystic',      'Mystic',            true),
  ('Jus & Nectars', 'V8 Splash',   'Campbell''s',       false),
  -- Sodas & Boissons gazeuses
  ('Sodas & Boissons gazeuses', 'Cola Couronne',     NULL,        true),
  ('Sodas & Boissons gazeuses', 'Couronne Limonade', NULL,        true),
  ('Sodas & Boissons gazeuses', 'Diet Couronne',     NULL,        false),
  ('Sodas & Boissons gazeuses', 'Coca-Cola',         'Coca-Cola', true),
  ('Sodas & Boissons gazeuses', 'Sprite',            'Sprite',    true),
  ('Sodas & Boissons gazeuses', 'Fanta Orange',      'Fanta',     true),
  ('Sodas & Boissons gazeuses', 'Pepsi',             'Pepsi',     true),
  ('Sodas & Boissons gazeuses', '7UP',               '7UP',       true),
  ('Sodas & Boissons gazeuses', 'King Cola',         NULL,        true),
  -- Bières
  ('Bières', 'Prestige',    NULL,       true),
  ('Bières', 'Turbo King',  NULL,       true),
  ('Bières', 'Heineken',    'Heineken', true),
  ('Bières', 'Guinness',    'Guinness', false),
  -- Boissons énergisantes
  ('Boissons énergisantes', 'Toro',          'BRANA',               true),
  ('Boissons énergisantes', 'Ragaman',       'Marque locale',       true),
  ('Boissons énergisantes', 'Red Bull',      'Red Bull GmbH',       true),
  ('Boissons énergisantes', 'Monster Energy','Monster Beverage',    false),
  ('Boissons énergisantes', 'Power Horse',   'Power Horse',         false),
  -- Boissons maltées
  ('Boissons maltées', 'Malta H',       'BRANA',    true),
  ('Boissons maltées', 'Malta Guinness', 'Guinness', true),
  -- Cocktails & Alcools
  ('Cocktails & Alcools', 'Barbancourt 3 Étoiles',       NULL,                    false),
  ('Cocktails & Alcools', 'Barbancourt 5 Étoiles',       'Rhum Barbancourt',      false),
  ('Cocktails & Alcools', 'Barbancourt Réserve Spéciale','Rhum Barbancourt',      false),
  ('Cocktails & Alcools', 'Crémas',                      'Producteurs artisanaux',false),
  ('Cocktails & Alcools', 'Kleren',                      'Distilleries locales',  false),
  -- Divers
  ('Divers', 'Autre produit', NULL, false)
) AS item(sub_name, name, brand, fast) ON s.sub_name = item.sub_name;

-- ============================================================
-- SCRIPT COMPLET : Tous les services (Pédicure + Manicure + Coiffure)
-- Exécuter dans : Supabase Dashboard > SQL Editor > New Query
-- ============================================================

DO $$
DECLARE
  branch   RECORD;
  pedi_id  UUID;
  mani_id  UUID;
  coif_id  UUID;
BEGIN
  FOR branch IN SELECT id, name FROM business_branches LOOP
    RAISE NOTICE '▶ Branche: % (%)', branch.name, branch.id;

    -- ─────────────────────────────────────────
    -- 1. PÉDICURE
    -- ─────────────────────────────────────────
    SELECT id INTO pedi_id FROM salon_service_categories
    WHERE branch_id = branch.id AND lower(name) LIKE '%dicure%' LIMIT 1;

    IF pedi_id IS NULL THEN
      INSERT INTO salon_service_categories
        (branch_id, name, description, icon, color, sort_order, is_active, metadata)
      VALUES (branch.id, 'Pédicure', 'Prestations de pédicure', 'footprints', 'emerald', 1, true, '{"addon_options":[]}'::jsonb)
      RETURNING id INTO pedi_id;
    END IF;
    RAISE NOTICE '  Pédicure cat: %', pedi_id;

    INSERT INTO salon_services
      (branch_id, category_id, name, price_htg, price_currency, is_active, sort_order, duration_minutes, requires_employee, commission_percentage, metadata)
    SELECT branch.id, pedi_id, s.name, s.price, 'HTG', true, s.ord, 30, true, 0,
      '{"addon_options":[{"name":"Fleur","extra_cost":150,"enabled":true},{"name":"Charme","extra_cost":200,"enabled":true},{"name":"Breloque","extra_cost":100,"enabled":true}]}'::jsonb
    FROM (VALUES
      ('Simple',                500, 1),
      ('Vernis ordinaire',      700, 2),
      ('Vernis Gel',            900, 3),
      ('Pose pouce (SLM)',     1200, 4),
      ('Full pose Vernis Gel', 1500, 5),
      ('Acrylique toes',       1800, 6)
    ) AS s(name, price, ord)
    WHERE NOT EXISTS (
      SELECT 1 FROM salon_services x
      WHERE x.branch_id = branch.id AND x.category_id = pedi_id AND lower(x.name) = lower(s.name)
    );

    -- ─────────────────────────────────────────
    -- 2. MANICURE
    -- ─────────────────────────────────────────
    SELECT id INTO mani_id FROM salon_service_categories
    WHERE branch_id = branch.id AND lower(name) LIKE '%manicure%' LIMIT 1;

    IF mani_id IS NULL THEN
      INSERT INTO salon_service_categories
        (branch_id, name, description, icon, color, sort_order, is_active, metadata)
      VALUES (branch.id, 'Manicure', 'Prestations de manicure', 'hand', 'violet', 2, true, '{"addon_options":[]}'::jsonb)
      RETURNING id INTO mani_id;
    END IF;
    RAISE NOTICE '  Manicure cat: %', mani_id;

    INSERT INTO salon_services
      (branch_id, category_id, name, price_htg, price_currency, is_active, sort_order, duration_minutes, requires_employee, commission_percentage, metadata)
    SELECT branch.id, mani_id, s.name, s.price, 'HTG', true, s.ord, 30, true, 0, '{"addon_options":[]}'::jsonb
    FROM (VALUES
      ('Simple',                400,  1),
      ('Vernis Gel',            800,  2),
      ('Baby Boomers',         1000,  3),
      ('Pose ongle Almond',    1400,  4),
      ('Pose ongle carré',     1400,  5),
      ('Acrylique simple',     1600,  6),
      ('Avec design',          1800,  7),
      ('Pose Vernis Gel',       950,  8),
      ('Pose Vernis Ordinaire', 600,  9),
      ('Deep Powder',          1700, 10),
      ('Soak Off A',            500, 11),
      ('Soak Off Pose',         700, 12)
    ) AS s(name, price, ord)
    WHERE NOT EXISTS (
      SELECT 1 FROM salon_services x
      WHERE x.branch_id = branch.id AND x.category_id = mani_id AND lower(x.name) = lower(s.name)
    );

    -- ─────────────────────────────────────────
    -- 3. COIFFURE / BEAUTÉ
    -- ─────────────────────────────────────────
    SELECT id INTO coif_id FROM salon_service_categories
    WHERE branch_id = branch.id AND lower(name) LIKE '%coiffure%' LIMIT 1;

    IF coif_id IS NULL THEN
      INSERT INTO salon_service_categories
        (branch_id, name, description, icon, color, sort_order, is_active, metadata)
      VALUES (branch.id, 'Coiffure / Beauté', 'Prestations de coiffure et beauté', 'scissors', 'orange', 3, true, '{"addon_options":[]}'::jsonb)
      RETURNING id INTO coif_id;
    END IF;
    RAISE NOTICE '  Coiffure cat: %', coif_id;

    INSERT INTO salon_services
      (branch_id, category_id, name, price_htg, price_currency, is_active, sort_order, duration_minutes, requires_employee, commission_percentage, metadata)
    SELECT branch.id, coif_id, s.name, s.price, 'HTG', true, s.ord, 30, true, 0, '{"addon_options":[]}'::jsonb
    FROM (VALUES
      ('Lavage simple',                                     600,  1),
      ('Mise en rouleau',                                   800,  2),
      ('Lavage complet (Bain d''huile + Bain de crème)',   1200,  3),
      ('Lavage + Blow',                                    1400,  4),
      ('Brûlage',                                           500,  5),
      ('Bain de crème',                                     700,  6),
      ('Brushing (Blow)',                                  1000,  7),
      ('Défrisage à chaud cheveux naturels',               2000,  8),
      ('Application permanente cheveux naturels',          2500,  9),
      ('Application permanente + Blow',                    2800, 10),
      ('Application permanente',                           2200, 11),
      ('Application teinture',                             1800, 12),
      ('Application lace',                                 1500, 13),
      ('Coupe Tara + cheveux',                             1200, 14),
      ('Lavage perruque',                                   800, 15),
      ('Coupe de cheveux femme',                            900, 16),
      ('Tresse',                                           1600, 17),
      ('Réparation perruque',                              1000, 18),
      ('Make-up simple',                                   1500, 19),
      ('Tissage',                                          3000, 20),
      ('Mèches',                                           2000, 21),
      ('Chignon',                                          1200, 22)
    ) AS s(name, price, ord)
    WHERE NOT EXISTS (
      SELECT 1 FROM salon_services x
      WHERE x.branch_id = branch.id AND x.category_id = coif_id AND lower(x.name) = lower(s.name)
    );

  END LOOP;

  RAISE NOTICE '✅ Tous les services ont été insérés avec succès !';
END $$;

-- ============================================================
-- SCRIPT : Insertion des services Pédicure & Manicure
-- À exécuter dans : Supabase Dashboard > SQL Editor
-- ============================================================

DO $$
DECLARE
  branch RECORD;
  pedi_cat_id UUID;
  mani_cat_id UUID;
BEGIN
  FOR branch IN SELECT id, name FROM business_branches LOOP
    RAISE NOTICE 'Traitement branche: % (%)', branch.name, branch.id;

    -- ========================
    -- PÉDICURE
    -- ========================
    SELECT id INTO pedi_cat_id
    FROM salon_service_categories
    WHERE branch_id = branch.id AND lower(name) LIKE '%p%dicure%'
    LIMIT 1;

    IF pedi_cat_id IS NULL THEN
      INSERT INTO salon_service_categories (branch_id, name, description, icon, color, sort_order, is_active, metadata)
      VALUES (branch.id, 'Pédicure', 'Prestations de pédicure', 'footprints', 'emerald', 1, true, '{"addon_options": []}'::jsonb)
      RETURNING id INTO pedi_cat_id;
      RAISE NOTICE '  → Catégorie Pédicure créée: %', pedi_cat_id;
    ELSE
      RAISE NOTICE '  → Catégorie Pédicure existante: %', pedi_cat_id;
    END IF;

    -- Services Pédicure (avec options Fleur/Charme/Breloque dans metadata)
    INSERT INTO salon_services (branch_id, category_id, name, price_htg, price_currency, is_active, sort_order, duration_minutes, requires_employee, commission_percentage, metadata)
    SELECT
      branch.id, pedi_cat_id, svc.name, svc.price_htg, 'HTG', true, svc.sort_order, 30, true, 0,
      '{
        "addon_options": [
          {"name": "Fleur",    "extra_cost": 150, "enabled": true},
          {"name": "Charme",   "extra_cost": 200, "enabled": true},
          {"name": "Breloque", "extra_cost": 100, "enabled": true}
        ]
      }'::jsonb
    FROM (VALUES
      ('Simple',               500,  1),
      ('Vernis ordinaire',     700,  2),
      ('Vernis Gel',           900,  3),
      ('Pose pouce (SLM)',    1200,  4),
      ('Full pose Vernis Gel',1500,  5),
      ('Acrylique toes',      1800,  6)
    ) AS svc(name, price_htg, sort_order)
    WHERE NOT EXISTS (
      SELECT 1 FROM salon_services s2
      WHERE s2.branch_id = branch.id
        AND s2.category_id = pedi_cat_id
        AND lower(s2.name) = lower(svc.name)
    );

    RAISE NOTICE '  → Services Pédicure insérés.';

    -- ========================
    -- MANICURE
    -- ========================
    SELECT id INTO mani_cat_id
    FROM salon_service_categories
    WHERE branch_id = branch.id AND lower(name) LIKE '%manicure%'
    LIMIT 1;

    IF mani_cat_id IS NULL THEN
      INSERT INTO salon_service_categories (branch_id, name, description, icon, color, sort_order, is_active, metadata)
      VALUES (branch.id, 'Manicure', 'Prestations de manicure', 'handshake', 'violet', 2, true, '{"addon_options": []}'::jsonb)
      RETURNING id INTO mani_cat_id;
      RAISE NOTICE '  → Catégorie Manicure créée: %', mani_cat_id;
    ELSE
      RAISE NOTICE '  → Catégorie Manicure existante: %', mani_cat_id;
    END IF;

    -- Services Manicure
    INSERT INTO salon_services (branch_id, category_id, name, price_htg, price_currency, is_active, sort_order, duration_minutes, requires_employee, commission_percentage, metadata)
    SELECT
      branch.id, mani_cat_id, svc.name, svc.price_htg, 'HTG', true, svc.sort_order, 30, true, 0,
      '{"addon_options": []}'::jsonb
    FROM (VALUES
      ('Simple',               400,  1),
      ('Vernis Gel',           800,  2),
      ('Baby Boomers',        1000,  3),
      ('Pose ongle Almond',   1400,  4),
      ('Pose ongle carré',    1400,  5),
      ('Acrylique simple',    1600,  6),
      ('Avec design',         1800,  7),
      ('Pose Vernis Gel',      950,  8),
      ('Pose Vernis Ordinaire',600,  9),
      ('Deep Powder',         1700, 10),
      ('Soak Off A',           500, 11),
      ('Soak Off Pose',        700, 12)
    ) AS svc(name, price_htg, sort_order)
    WHERE NOT EXISTS (
      SELECT 1 FROM salon_services s2
      WHERE s2.branch_id = branch.id
        AND s2.category_id = mani_cat_id
        AND lower(s2.name) = lower(svc.name)
    );

    RAISE NOTICE '  → Services Manicure insérés.';

  END LOOP;

  RAISE NOTICE '✅ Seeding Pédicure & Manicure terminé !';
END $$;

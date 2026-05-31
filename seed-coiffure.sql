-- ============================================================
-- SCRIPT : Insertion des services Coiffure / Beauté
-- À exécuter dans : Supabase Dashboard > SQL Editor
-- ============================================================
-- Ce script :
-- 1. Trouve ou crée la catégorie "Coiffure / Beauté" pour chaque branche
-- 2. Insère les 22 services manquants (ignore ceux qui existent déjà)
-- ============================================================

DO $$
DECLARE
  branch RECORD;
  cat_id UUID;
BEGIN
  FOR branch IN SELECT id, name FROM business_branches LOOP
    RAISE NOTICE 'Traitement branche: % (%)', branch.name, branch.id;

    -- Trouver ou créer la catégorie Coiffure / Beauté
    SELECT id INTO cat_id
    FROM salon_service_categories
    WHERE branch_id = branch.id
      AND lower(name) LIKE '%coiffure%'
    LIMIT 1;

    IF cat_id IS NULL THEN
      INSERT INTO salon_service_categories (branch_id, name, description, icon, color, sort_order, is_active, metadata)
      VALUES (
        branch.id,
        'Coiffure / Beauté',
        'Prestations de coiffure et beauté',
        'scissors',
        'orange',
        3,
        true,
        '{"addon_options": []}'::jsonb
      )
      RETURNING id INTO cat_id;
      RAISE NOTICE '  → Catégorie créée: %', cat_id;
    ELSE
      RAISE NOTICE '  → Catégorie existante: %', cat_id;
    END IF;

    -- Insérer les services (uniquement ceux qui n'existent pas encore)
    INSERT INTO salon_services (branch_id, category_id, name, price_htg, price_currency, is_active, sort_order, duration_minutes, requires_employee, commission_percentage, metadata)
    SELECT
      branch.id,
      cat_id,
      svc.name,
      svc.price_htg,
      'HTG',
      true,
      svc.sort_order,
      30,
      true,
      0,
      '{"addon_options": []}'::jsonb
    FROM (VALUES
      ('Lavage simple',                                    600,   1),
      ('Mise en rouleau',                                  800,   2),
      ('Lavage complet (Bain d''huile + Bain de crème)',  1200,  3),
      ('Lavage + Blow',                                   1400,  4),
      ('Brûlage',                                          500,  5),
      ('Bain de crème',                                    700,  6),
      ('Brushing (Blow)',                                 1000,  7),
      ('Défrisage à chaud cheveux naturels',              2000,  8),
      ('Application permanente cheveux naturels',         2500,  9),
      ('Application permanente + Blow',                   2800, 10),
      ('Application permanente',                          2200, 11),
      ('Application teinture',                            1800, 12),
      ('Application lace',                                1500, 13),
      ('Coupe Tara + cheveux',                            1200, 14),
      ('Lavage perruque',                                  800, 15),
      ('Coupe de cheveux femme',                           900, 16),
      ('Tresse',                                          1600, 17),
      ('Réparation perruque',                             1000, 18),
      ('Make-up simple',                                  1500, 19),
      ('Tissage',                                         3000, 20),
      ('Mèches',                                          2000, 21),
      ('Chignon',                                         1200, 22)
    ) AS svc(name, price_htg, sort_order)
    WHERE NOT EXISTS (
      SELECT 1 FROM salon_services s2
      WHERE s2.branch_id = branch.id
        AND s2.category_id = cat_id
        AND lower(s2.name) = lower(svc.name)
    );

    RAISE NOTICE '  → Services insérés avec succès.';
  END LOOP;
END $$;

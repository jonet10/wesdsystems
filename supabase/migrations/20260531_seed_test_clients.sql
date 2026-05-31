-- ════════════════════════════════════════════════════════════════════════════
-- DIAGNOSTIC + SEED clients de test
-- Copiez et exécutez ce script dans Supabase SQL Editor
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Vérifier les branches disponibles
SELECT 'salon_branches' AS table_name, id, business_id, name FROM salon_branches
UNION ALL
SELECT 'business_branches', id, business_id, name FROM business_branches
ORDER BY table_name;

-- 2. Créer une branche si aucune n'existe
DO $$
DECLARE
  v_branch_id UUID;
  v_business_id UUID;
BEGIN
  -- Chercher la première branche existante
  SELECT id INTO v_branch_id FROM salon_branches LIMIT 1;

  IF v_branch_id IS NULL THEN
    -- Chercher un business_id depuis les profils
    SELECT business_id INTO v_business_id FROM profiles WHERE business_id IS NOT NULL LIMIT 1;

    IF v_business_id IS NOT NULL THEN
      -- Créer la branche par défaut
      INSERT INTO salon_branches (business_id, name, country, currency_code)
      VALUES (v_business_id, 'Studio Principal', 'Haiti', 'HTG')
      RETURNING id INTO v_branch_id;
      RAISE NOTICE 'Branche créée avec ID: %', v_branch_id;
    ELSE
      RAISE NOTICE 'Aucun business trouvé dans les profils.';
      RETURN;
    END IF;
  END IF;

  RAISE NOTICE 'Branch ID utilisé: %', v_branch_id;

  -- 3. Insérer les 3 clients de test
  INSERT INTO salon_customers (branch_id, first_name, last_name, email, phone, gender, notes, is_active)
  VALUES
    (v_branch_id, 'Marie',   'Dupont',   'marie.dupont@email.com',  '509-3700-0001', 'Femme', 'Cliente test 1', true),
    (v_branch_id, 'Jean',    'Pierre',   'jean.pierre@email.com',   '509-3700-0002', 'Homme', 'Client test 2',  true),
    (v_branch_id, 'Sophie',  'Martin',   'sophie.martin@email.com', '509-3700-0003', 'Femme', 'Cliente test 3', true)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Clients insérés avec succès !';
END $$;

-- 4. Afficher les clients créés
SELECT
  id,
  first_name || ' ' || last_name AS nom_complet,
  phone,
  email,
  branch_id,
  created_at::date AS date_creation
FROM salon_customers
WHERE is_active = true
ORDER BY created_at DESC;

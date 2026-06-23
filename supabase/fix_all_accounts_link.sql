-- ============================================================================
-- REPAIR: Restore profiles by dynamically matching email addresses in auth.users
-- ============================================================================

-- 1. Restaurer 'infolinkedupro@gmail.com' en tant que compte Pièces Auto distinct et rattacher ses données orphelines (192 produits, 74 catégories, etc.)
DO $$
DECLARE
  v_user_id UUID;
  v_meta_biz_id UUID;
  v_biz_exists BOOLEAN;
  v_new_biz_id UUID;
  v_plan_id UUID;
BEGIN
  -- Trouver l''ID de l''utilisateur et l''ID de l''établissement dans ses métadonnées
  SELECT id, (raw_user_meta_data->>'business_id')::UUID
    INTO v_user_id, v_meta_biz_id
  FROM auth.users
  WHERE email = 'infolinkedupro@gmail.com';

  IF v_user_id IS NOT NULL THEN
    -- Vérifier si l''établissement dans les métadonnées existe toujours
    SELECT EXISTS (SELECT 1 FROM public.businesses WHERE id = v_meta_biz_id) INTO v_biz_exists;

    IF v_biz_exists THEN
      v_new_biz_id := v_meta_biz_id;
    ELSE
      -- Sinon, essayer de voir si un profil existe déjà pour cet utilisateur avec un établissement valide
      SELECT business_id INTO v_new_biz_id 
      FROM public.profiles 
      WHERE id = v_user_id AND business_id IS NOT NULL;
      
      IF v_new_biz_id IS NULL THEN
        -- Si aucun n''existe, on en crée un nouveau sous le forfait Starter (ou le forfait actif le moins cher)
        SELECT id INTO v_plan_id FROM public.subscription_plans WHERE active = true ORDER BY monthly_price ASC LIMIT 1;
        
        -- Le trigger de la base de données crée automatiquement la branche par défaut lors de cet insert
        INSERT INTO public.businesses (name, business_type, type, plan_id)
        VALUES ('LinkEduPro Saas Educatif', 'auto_parts', 'auto_parts', v_plan_id)
        RETURNING id INTO v_new_biz_id;
      END IF;
    END IF;

    -- Créer ou restaurer le profil de l''utilisateur
    INSERT INTO public.profiles (id, full_name, business_name, business_type, role, role_normalized, business_id)
    VALUES (v_user_id, 'LinkEduPro Admin', 'LinkEduPro Saas Educatif', 'auto_parts', 'salon_admin', 'salon_admin', v_new_biz_id)
    ON CONFLICT (id) DO UPDATE SET
      business_name = 'LinkEduPro Saas Educatif',
      business_type = 'auto_parts',
      role = 'salon_admin',
      role_normalized = 'salon_admin',
      business_id = v_new_biz_id;

    -- RATTACEMENT DES DONNÉES HISTORIQUES ORPHELINES (BUSINESS_ID IS NULL) :
    -- On associe tous les produits, catégories, marques, modèles et fournisseurs orphelins à ce nouvel établissement
    UPDATE public.auto_parts_products SET business_id = v_new_biz_id WHERE business_id IS NULL;
    UPDATE public.auto_parts_categories SET business_id = v_new_biz_id WHERE business_id IS NULL;
    UPDATE public.auto_parts_brands SET business_id = v_new_biz_id WHERE business_id IS NULL;
    UPDATE public.auto_parts_models SET business_id = v_new_biz_id WHERE business_id IS NULL;
    UPDATE public.auto_parts_suppliers SET business_id = v_new_biz_id WHERE business_id IS NULL;

    RAISE NOTICE 'Restauration reussie pour infolinkedupro@gmail.com. ID Etablissement: %', v_new_biz_id;
  ELSE
    RAISE WARNING 'Utilisateur infolinkedupro@gmail.com non trouve.';
  END IF;
END;
$$;

-- 2. Lier 'originalautoparts796@gmail.com' à l'établissement historique Pièces Auto ("Original Auto Parts")
-- ID de l'établissement historique Pièces Auto : 519b32e7-4cc9-4bb8-9008-4f06447d29fb
INSERT INTO public.profiles (id, full_name, business_name, business_type, role, business_id)
SELECT id, 'Original Auto Parts Admin', 'Original Auto Parts', 'auto_parts', 'salon_admin', '519b32e7-4cc9-4bb8-9008-4f06447d29fb'
FROM auth.users
WHERE email = 'originalautoparts796@gmail.com'
ON CONFLICT (id) DO UPDATE SET
  business_name = 'Original Auto Parts',
  business_type = 'auto_parts',
  role = 'salon_admin',
  business_id = '519b32e7-4cc9-4bb8-9008-4f06447d29fb';

-- 3. Lier le compte École 'concrete.gerbil.jtzd@hidingmail.net' à l'établissement École ("EDSVP")
-- ID de l'établissement historique École : d612bbf1-0246-4cb4-b111-cd40168fd1a3
INSERT INTO public.profiles (id, full_name, business_name, business_type, role, business_id)
SELECT id, 'Directeur EDSVP (Gerbil)', 'EDSVP', 'school', 'school_admin', 'd612bbf1-0246-4cb4-b111-cd40168fd1a3'
FROM auth.users
WHERE email = 'concrete.gerbil.jtzd@hidingmail.net'
ON CONFLICT (id) DO UPDATE SET
  business_name = 'EDSVP',
  business_type = 'school',
  role = 'school_admin',
  business_id = 'd612bbf1-0246-4cb4-b111-cd40168fd1a3';

-- 4. Nettoyer l'établissement doublon vide "Original Auto Parts" (inutilisé)
DELETE FROM public.businesses
WHERE id = 'e062879c-ca06-4d5d-91a7-3af3fe46e973';

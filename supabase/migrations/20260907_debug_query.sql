-- ════════════════════════════════════════════════════════════════════════════
-- Migration 20260907: Diagnostics for Auto-Parts products and pricing issues
-- ════════════════════════════════════════════════════════════════════════════

-- Permettre temporairement la lecture publique des logs de debug pour l'audit
DROP POLICY IF EXISTS "public read debug log" ON public.subscription_debug_log;
CREATE POLICY "public read debug log" ON public.subscription_debug_log
  FOR SELECT TO public USING (true);

DO $$
DECLARE
  v_profile RECORD;
  v_user RECORD;
  v_prod_count INTEGER := 0;
  v_inv_count INTEGER := 0;
  v_details JSONB;
  v_uid UUID := 'b26d804b-d723-47ec-87b1-2233c042f5ef'::UUID;
  v_first_products JSONB := '[]'::jsonb;
  v_first_inv JSONB := '[]'::jsonb;
  v_profiles_count INTEGER := 0;
  v_users_count INTEGER := 0;
BEGIN
  -- 1. Compter le nombre de profils et d'users total pour comprendre si la DB est vide
  SELECT COUNT(*) INTO v_profiles_count FROM public.profiles;
  SELECT COUNT(*) INTO v_users_count FROM auth.users;

  -- 2. Resolve User from auth.users (to get authentic details)
  SELECT id, email, raw_user_meta_data INTO v_user 
  FROM auth.users 
  WHERE id = v_uid OR email = 'originalautoparts796@gmail.com'
  LIMIT 1;

  -- 3. Resolve Profile
  SELECT id, full_name, email, role, business_id, business_type INTO v_profile 
  FROM public.profiles 
  WHERE id = v_uid OR id = v_user.id OR email = 'originalautoparts796@gmail.com'
  LIMIT 1;

  -- 4. Audit counts
  IF v_profile.business_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_prod_count 
    FROM public.auto_parts_products 
    WHERE business_id = v_profile.business_id;

    SELECT COUNT(*) INTO v_inv_count 
    FROM public.auto_parts_product_inventory 
    WHERE business_id = v_profile.business_id;

    -- Grab first 10 products
    SELECT json_agg(t) INTO v_first_products FROM (
      SELECT id, name, sku, unit_price, cost_price, business_id 
      FROM public.auto_parts_products 
      WHERE business_id = v_profile.business_id 
      LIMIT 10
    ) t;

    -- Grab first 10 inventory items
    SELECT json_agg(t) INTO v_first_inv FROM (
      SELECT id, product_id, unit_price, cost_price, business_id, branch_id 
      FROM public.auto_parts_product_inventory 
      WHERE business_id = v_profile.business_id 
      LIMIT 10
    ) t;
  END IF;

  v_details := jsonb_build_object(
    'total_profiles_in_db', v_profiles_count,
    'total_users_in_auth', v_users_count,
    'user_in_auth', v_user.id IS NOT NULL,
    'user_id', v_user.id,
    'user_email', v_user.email,
    'user_meta', v_user.raw_user_meta_data,
    'profile_in_db', v_profile.id IS NOT NULL,
    'profile', to_jsonb(v_profile),
    'prod_count', v_prod_count,
    'inv_count', v_inv_count,
    'first_products', v_first_products,
    'first_inv', v_first_inv
  );

  INSERT INTO public.subscription_debug_log (event_type, details)
  VALUES ('AUDIT_CLIENT_PRODUCTS', v_details);
END $$;

-- ============================================================================
-- FIX: handle_new_user trigger function
-- Le search_path vide causait des conflits avec les fonctions dépendantes.
-- On passe à search_path = public pour garantir la résolution correcte.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id UUID;
  v_business_type TEXT;
  v_plan_key TEXT;
  v_plan_id UUID;
BEGIN
  v_business_type := NULLIF(BTRIM(COALESCE(NEW.raw_user_meta_data->>'business_type', '')), '');
  v_plan_key := COALESCE(
    NULLIF(BTRIM(NEW.raw_user_meta_data->>'plan', ''), ''),
    'pro'
  );

  -- Resolve plan from metadata (resolve_subscription_plan_id is also in public schema)
  v_plan_id := public.resolve_subscription_plan_id(v_plan_key);

  -- Create the business row
  INSERT INTO public.businesses (name, business_type, type, plan_id)
  VALUES (
    COALESCE(NULLIF(BTRIM(COALESCE(NEW.raw_user_meta_data->>'business_name', '')), ''), 'Mon entreprise'),
    COALESCE(v_business_type, 'salon'),
    COALESCE(v_business_type, 'salon'),
    v_plan_id
  )
  RETURNING id INTO v_business_id;

  -- Create the profile row
  INSERT INTO public.profiles (id, full_name, business_name, business_type, role, business_id)
  VALUES (
    NEW.id,
    NULLIF(BTRIM(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), ''),
    NULLIF(BTRIM(COALESCE(NEW.raw_user_meta_data->>'business_name', '')), ''),
    v_business_type,
    'salon_admin',
    v_business_id
  )
  ON CONFLICT (id) DO UPDATE SET
    business_id = EXCLUDED.business_id,
    business_type = COALESCE(EXCLUDED.business_type, profiles.business_type),
    role = 'salon_admin';

  -- Create a default branch
  INSERT INTO public.salon_branches (business_id, name, is_active)
  VALUES (v_business_id, 'Branche principale', true)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error without blocking signup
    RAISE WARNING '[handle_new_user] Erreur: % - SQLSTATE: %', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$;

-- S'assurer que le trigger existe bien sur auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

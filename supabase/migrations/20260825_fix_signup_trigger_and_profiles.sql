-- ────────────────────────────────────────────────────────────────────────────
-- Migration 20260825: Fix signup trigger bug and repair missing/unlinked profiles
-- ────────────────────────────────────────────────────────────────────────────

-- 1. Add INSERT RLS policy on public.businesses for super_admin
-- This enables super_admin to manually insert businesses if needed without RLS violations.
DROP POLICY IF EXISTS "businesses super_admin insert" ON public.businesses;
CREATE POLICY "businesses super_admin insert" ON public.businesses
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.current_user_role() = 'super_admin'
  );

-- 2. Redefine resolve_business_module_info to query businesses table directly
-- This avoids joining auth.users and public.profiles, which can fail due to permissions
-- or transaction visibility states during trigger execution on profiles.
CREATE OR REPLACE FUNCTION public.resolve_business_module_info(p_business_id UUID)
RETURNS TABLE(activity_type TEXT, module_label TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE COALESCE(lower(business_type), '')
      WHEN 'pharmacy' THEN 'pharmacy_joined'
      WHEN 'pharmacie' THEN 'pharmacy_joined'
      WHEN 'restaurant' THEN 'restaurant_joined'
      WHEN 'bar' THEN 'restaurant_joined'
      WHEN 'market' THEN 'market_joined'
      WHEN 'boutique' THEN 'boutique_joined'
      ELSE 'business_joined' -- Map auto_parts, school, etc. to 'business_joined' to satisfy check constraint
    END AS activity_type,
    CASE COALESCE(lower(business_type), '')
      WHEN 'pharmacy' THEN 'Pharmacie'
      WHEN 'pharmacie' THEN 'Pharmacie'
      WHEN 'restaurant' THEN 'Bar & resto'
      WHEN 'bar' THEN 'Bar & resto'
      WHEN 'market' THEN 'Market'
      WHEN 'boutique' THEN 'Boutique'
      WHEN 'auto_parts' THEN 'Pièces Auto'
      WHEN 'school' THEN 'Établissement Scolaire'
      ELSE 'Établissement'
    END AS module_label
  FROM public.businesses
  WHERE id = p_business_id
  LIMIT 1;
$$;

-- 3. Redefine log_profile_business_activity_feed to be defensive
-- Selecting into separate variables instead of a RECORD variable ensures no run-time
-- "record is not yet assigned" exceptions occur if the query returns 0 rows.
CREATE OR REPLACE FUNCTION public.log_profile_business_activity_feed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_name TEXT;
  v_business_created_at TIMESTAMPTZ;
  v_activity_type TEXT;
  v_module_label TEXT;
BEGIN
  IF NEW.business_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    COALESCE(NULLIF(BTRIM(COALESCE(b.name, '')), ''), 'Un établissement'),
    COALESCE(b.created_at, now())
  INTO v_business_name, v_business_created_at
  FROM public.businesses b
  WHERE b.id = NEW.business_id;

  SELECT activity_type, module_label
    INTO v_activity_type, v_module_label
  FROM public.resolve_business_module_info(NEW.business_id);

  PERFORM public.log_public_activity_feed(
    COALESCE(v_activity_type, 'business_joined'),
    format(
      '%s a rejoint la plateforme en tant que %s',
      COALESCE(v_business_name, 'Un établissement'),
      COALESCE(v_module_label, 'Établissement')
    ),
    'Haïti',
    COALESCE(v_business_created_at, now()),
    true,
    'business',
    NEW.business_id
  );

  RETURN NEW;
END;
$$;

-- 4. General Repair Block for all auth.users missing their profiles/businesses
-- Finds any user in auth.users that has no profiles row, auto-creates their business,
-- profile, and allows standard business triggers to generate their branch/subscription.
DO $$
DECLARE
  rec RECORD;
  v_business_id UUID;
  v_plan_id UUID;
BEGIN
  FOR rec IN
    SELECT u.id,
           COALESCE(NULLIF(BTRIM(u.raw_user_meta_data->>'full_name'), ''), 'Utilisateur') AS full_name,
           COALESCE(NULLIF(BTRIM(u.raw_user_meta_data->>'business_name'), ''), 'Mon entreprise') AS business_name,
           COALESCE(NULLIF(BTRIM(u.raw_user_meta_data->>'business_type'), ''), 'salon') AS business_type,
           COALESCE(NULLIF(BTRIM(u.raw_user_meta_data->>'plan'), ''), 'pro') AS plan_key,
           u.email
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE p.id IS NULL
  LOOP
    -- Resolve plan id
    v_plan_id := public.resolve_subscription_plan_id(rec.plan_key);

    -- Create business row
    INSERT INTO public.businesses (name, business_type, type, plan_id)
    VALUES (rec.business_name, rec.business_type, rec.business_type, v_plan_id)
    RETURNING id INTO v_business_id;

    -- Create profile row
    INSERT INTO public.profiles (id, full_name, business_name, business_type, role, business_id)
    VALUES (
      rec.id,
      rec.full_name,
      rec.business_name,
      rec.business_type,
      'salon_admin',
      v_business_id
    );

    RAISE NOTICE 'REPAIRED MISSING PROFILE & BUSINESS: user_id=%, email=%, business_id=%', 
      rec.id, rec.email, v_business_id;
  END LOOP;
END;
$$;

-- 5. General Repair Block for existing profiles with NULL business_id
-- Finds any profile that has no linked business, auto-creates their business,
-- links it, and allows business triggers to generate their default branch/subscription.
DO $$
DECLARE
  rec RECORD;
  v_business_id UUID;
  v_plan_id UUID;
BEGIN
  -- Resolve cheapest plan
  SELECT id INTO v_plan_id FROM public.subscription_plans WHERE active = true ORDER BY monthly_price ASC LIMIT 1;

  FOR rec IN
    SELECT p.id, p.full_name, p.business_name, COALESCE(p.business_type, 'salon') AS business_type
    FROM public.profiles p
    WHERE p.business_id IS NULL
  LOOP
    -- Create business row
    INSERT INTO public.businesses (name, business_type, type, plan_id)
    VALUES (COALESCE(rec.business_name, rec.full_name, 'Mon entreprise'), rec.business_type, rec.business_type, v_plan_id)
    RETURNING id INTO v_business_id;

    -- Update profile row with business_id
    UPDATE public.profiles
    SET business_id = v_business_id,
        business_type = rec.business_type
    WHERE id = rec.id;

    RAISE NOTICE 'REPAIRED EXISTING UNLINKED PROFILE: user_id=%, business_id=%', 
      rec.id, v_business_id;
  END LOOP;
END;
$$;

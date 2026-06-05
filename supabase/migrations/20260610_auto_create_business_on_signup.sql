-- ============================================================================
-- Auto-create business row + trial subscription on user signup
-- ============================================================================

-- 0. Add business_type column to businesses table (missing from original schema)
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS business_type TEXT;

-- 0b. Extend type check constraint to include auto_parts
ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_type_check;
ALTER TABLE public.businesses ADD CONSTRAINT businesses_type_check
  CHECK (type = ANY (ARRAY['salon'::text, 'pharmacie'::text, 'restaurant'::text, 'market'::text, 'boutique'::text, 'auto_parts'::text]));

-- 1. Function to create a business when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

  -- Resolve plan from metadata
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
END;
$$;

-- 2. Auto-create trial subscription on business insert
CREATE OR REPLACE FUNCTION public.auto_create_trial_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_trial_days INTEGER := 3;
  v_default_plan_id UUID;
BEGIN
  -- Use the business plan_id if set, otherwise find the "starter" plan
  v_default_plan_id := NEW.plan_id;
  IF v_default_plan_id IS NULL THEN
    SELECT id INTO v_default_plan_id
    FROM public.subscription_plans
    ORDER BY monthly_price ASC
    LIMIT 1;
  END IF;

  INSERT INTO public.business_subscriptions (
    business_id,
    plan_id,
    status,
    billing_cycle,
    price_snapshot,
    start_date,
    end_date
  ) VALUES (
    NEW.id,
    v_default_plan_id,
    'trialing',
    'monthly',
    COALESCE((SELECT monthly_price FROM public.subscription_plans WHERE id = v_default_plan_id), 0),
    NOW(),
    NOW() + (v_trial_days || ' days')::INTERVAL
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_trial_subscription ON public.businesses;
CREATE TRIGGER trg_auto_create_trial_subscription
  AFTER INSERT ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_trial_subscription();

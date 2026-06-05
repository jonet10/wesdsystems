-- ============================================================================
-- REPAIR: Find and fix existing accounts with missing business/subscription
-- ============================================================================

-- 0. Ensure business_type column exists on businesses
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS business_type TEXT;

-- 0b. Extend type check constraint to include auto_parts
ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_type_check;
ALTER TABLE public.businesses ADD CONSTRAINT businesses_type_check
  CHECK (type = ANY (ARRAY['salon'::text, 'pharmacie'::text, 'restaurant'::text, 'market'::text, 'boutique'::text, 'auto_parts'::text]));

-- 0c. Recreate auto_create_trial_subscription function with trial_end_date removed
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
  v_default_plan_id := NEW.plan_id;
  IF v_default_plan_id IS NULL THEN
    SELECT id INTO v_default_plan_id
    FROM public.subscription_plans
    ORDER BY monthly_price ASC
    LIMIT 1;
  END IF;
  INSERT INTO public.business_subscriptions (
    business_id, plan_id, status, billing_cycle, price_snapshot,
    start_date, end_date
  ) VALUES (
    NEW.id, v_default_plan_id, 'trialing', 'monthly',
    COALESCE((SELECT monthly_price FROM public.subscription_plans WHERE id = v_default_plan_id), 0),
    NOW(), NOW() + (v_trial_days || ' days')::INTERVAL
  );
  RETURN NEW;
END;
$$;

-- 1. Find auth users that have a profile but no business row
WITH users_without_business AS (
  SELECT
    p.id AS user_id,
    p.full_name,
    p.business_name,
    p.business_type,
    u.raw_user_meta_data->>'plan' AS plan_from_meta,
    u.email
  FROM auth.users u
  JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.businesses b ON b.id = p.business_id
  WHERE p.business_id IS NULL
    OR b.id IS NULL
)
SELECT * FROM users_without_business;

-- 2. Auto-create missing businesses for profiles without one
DO $$
DECLARE
  rec RECORD;
  v_business_id UUID;
  v_plan_id UUID;
BEGIN
  FOR rec IN
    SELECT p.id AS user_id, p.full_name, p.business_name, p.business_type, p.role,
           u.raw_user_meta_data->>'plan' AS plan_from_meta,
           u.email
    FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    LEFT JOIN public.businesses b ON b.id = p.business_id
    WHERE p.business_id IS NULL OR b.id IS NULL
  LOOP
    -- Resolve plan
    v_plan_id := public.resolve_subscription_plan_id(COALESCE(rec.plan_from_meta, 'pro'));

    -- Create business
    INSERT INTO public.businesses (name, business_type, type, plan_id)
    VALUES (
      COALESCE(rec.business_name, rec.full_name, rec.email, 'Mon entreprise'),
      COALESCE(rec.business_type, 'salon'),
      COALESCE(rec.business_type, 'salon'),
      v_plan_id
    )
    RETURNING id INTO v_business_id;

    -- Link profile to business
    UPDATE public.profiles
    SET business_id = v_business_id,
        role = COALESCE(role, 'salon_admin')
    WHERE id = rec.user_id;

    -- Create default branch
    INSERT INTO public.salon_branches (business_id, name, is_active, is_main_branch)
    VALUES (v_business_id, 'Branche principale', true, true)
    ON CONFLICT DO NOTHING;

    -- Create trial subscription
    INSERT INTO public.business_subscriptions (
      business_id, plan_id, status, billing_cycle, price_snapshot,
      start_date, end_date
    ) VALUES (
      v_business_id, v_plan_id, 'trialing', 'monthly',
      COALESCE((SELECT monthly_price FROM public.subscription_plans WHERE id = v_plan_id), 0),
      NOW(), NOW() + INTERVAL '3 days'
    ) ON CONFLICT DO NOTHING;

    RAISE NOTICE 'REPAIRED: user=% business=% plan=%', rec.email, v_business_id, v_plan_id;
  END LOOP;
END;
$$;

-- 3. Find businesses with missing subscriptions
SELECT b.id AS business_id, b.name, b.business_type, b.plan_id
FROM public.businesses b
LEFT JOIN public.business_subscriptions bs ON bs.business_id = b.id
WHERE bs.id IS NULL;

-- 4. Create missing subscriptions
INSERT INTO public.business_subscriptions (
  business_id, plan_id, status, billing_cycle, price_snapshot,
  start_date, end_date
)
SELECT
  b.id,
  COALESCE(b.plan_id, (SELECT id FROM public.subscription_plans ORDER BY monthly_price ASC LIMIT 1)),
  'trialing', 'monthly',
  COALESCE((SELECT monthly_price FROM public.subscription_plans sp WHERE sp.id = COALESCE(b.plan_id, (SELECT id FROM public.subscription_plans ORDER BY monthly_price ASC LIMIT 1))), 0),
  NOW(), NOW() + INTERVAL '3 days'
FROM public.businesses b
LEFT JOIN public.business_subscriptions bs ON bs.business_id = b.id
WHERE bs.id IS NULL
ON CONFLICT DO NOTHING;

-- 5. Verify the fix
SELECT
  p.id AS user_id,
  u.email,
  p.business_type,
  b.id AS business_id,
  b.name AS business_name,
  bs.id AS subscription_id,
  bs.status AS subscription_status,
  sp.name AS plan_name
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
JOIN public.businesses b ON b.id = p.business_id
LEFT JOIN public.business_subscriptions bs ON bs.business_id = b.id
LEFT JOIN public.subscription_plans sp ON sp.id = COALESCE(bs.plan_id, b.plan_id)
ORDER BY u.created_at DESC;

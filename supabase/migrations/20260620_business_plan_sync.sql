-- ============================================================================
-- Business plan synchronization and backfill
-- ============================================================================
-- Fixes businesses created without a persisted plan_id.
-- - Backfills from active subscriptions when available
-- - Backfills from auth.user metadata (plan/basic/pro/premium) when available
-- - Keeps public.businesses.plan_id synced from business_subscriptions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.normalize_plan_identifier(p_value TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(
      regexp_replace(lower(trim(p_value)), '[^a-z0-9]+', '', 'g'),
      ''
    ),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.resolve_subscription_plan_id(p_plan TEXT)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized TEXT := public.normalize_plan_identifier(p_plan);
  v_alias TEXT;
  v_plan_id UUID;
BEGIN
  IF v_normalized = '' THEN
    RETURN NULL;
  END IF;

  v_alias := CASE v_normalized
    WHEN 'basic' THEN 'starter'
    WHEN 'pro' THEN 'professional'
    WHEN 'premium' THEN 'enterprise'
    ELSE v_normalized
  END;

  SELECT sp.id
    INTO v_plan_id
  FROM public.subscription_plans sp
  WHERE public.normalize_plan_identifier(sp.id::text) = v_normalized
     OR public.normalize_plan_identifier(sp.name) = v_normalized
     OR public.normalize_plan_identifier(sp.id::text) = v_alias
     OR public.normalize_plan_identifier(sp.name) = v_alias
  ORDER BY sp.created_at ASC
  LIMIT 1;

  RETURN v_plan_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_business_plan_from_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.plan_id IS NOT NULL THEN
    UPDATE public.businesses
      SET plan_id = NEW.plan_id
    WHERE id = NEW.business_id
      AND (plan_id IS NULL OR plan_id <> NEW.plan_id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_business_plan_from_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id UUID;
  v_plan_id UUID;
  v_plan_key TEXT;
BEGIN
  SELECT p.business_id
    INTO v_business_id
  FROM public.profiles p
  WHERE p.id = NEW.id
  LIMIT 1;

  v_plan_key := COALESCE(
    NEW.raw_user_meta_data->>'plan',
    NEW.raw_user_meta_data->>'subscription_plan',
    NEW.raw_user_meta_data->>'plan_name',
    NEW.raw_user_meta_data->>'plan_code'
  );

  v_plan_id := public.resolve_subscription_plan_id(v_plan_key);

  IF v_business_id IS NOT NULL AND v_plan_id IS NOT NULL THEN
    UPDATE public.businesses
      SET plan_id = COALESCE(plan_id, v_plan_id)
    WHERE id = v_business_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_business_plan_from_subscription ON public.business_subscriptions;
CREATE TRIGGER trg_sync_business_plan_from_subscription
  AFTER INSERT OR UPDATE OF plan_id, status ON public.business_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_business_plan_from_subscription();

DROP TRIGGER IF EXISTS trg_sync_business_plan_from_auth_user ON auth.users;
CREATE TRIGGER trg_sync_business_plan_from_auth_user
  AFTER INSERT OR UPDATE OF raw_user_meta_data ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_business_plan_from_auth_user();

WITH active_subscription_plans AS (
  SELECT DISTINCT ON (bs.business_id)
    bs.business_id,
    bs.plan_id
  FROM public.business_subscriptions bs
  WHERE bs.plan_id IS NOT NULL
    AND bs.status = 'active'
  ORDER BY bs.business_id, bs.created_at DESC
)
UPDATE public.businesses b
SET plan_id = asp.plan_id
FROM active_subscription_plans asp
WHERE b.id = asp.business_id
  AND b.plan_id IS NULL;

WITH profile_meta_plans AS (
  SELECT DISTINCT ON (p.business_id)
    p.business_id,
    public.resolve_subscription_plan_id(
      COALESCE(
        u.raw_user_meta_data->>'plan',
        u.raw_user_meta_data->>'subscription_plan',
        u.raw_user_meta_data->>'plan_name',
        u.raw_user_meta_data->>'plan_code'
      )
    ) AS plan_id
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.business_id IS NOT NULL
  ORDER BY p.business_id, p.id ASC
)
UPDATE public.businesses b
SET plan_id = pmp.plan_id
FROM profile_meta_plans pmp
WHERE b.id = pmp.business_id
  AND b.plan_id IS NULL
  AND pmp.plan_id IS NOT NULL;


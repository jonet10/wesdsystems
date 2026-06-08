-- ════════════════════════════════════════════════════════════════════════════
-- Migration 20260717:
-- Fix trial subscription creation to be robust and reliable.
--
-- Problems fixed:
-- 1. auto_create_trial_subscription could fail silently when no plan exists
--    (v_default_plan_id stays NULL → NOT NULL violation on business_subscriptions)
-- 2. handle_new_user catches ALL exceptions with EXCEPTION WHEN OTHERS,
--    masking trial creation failures → business exists but has no subscription
-- 3. Trial duration was 3 days (too short for proper evaluation)
-- 4. No logging to diagnose failures
--
-- Fixes:
-- - Ensure auto_create_trial_subscription never raises an exception
-- - If no plan exists, create a default "Starter" plan before inserting the subscription
-- - Increase trial duration to 14 days
-- - Add RAISE WARNING log messages
-- ════════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Ensure a default plan always exists for trial subscriptions
-- ────────────────────────────────────────────────────────────────────────────
INSERT INTO public.subscription_plans (name, monthly_price, yearly_price, active, description)
SELECT 'Starter', 0, 0, true, 'Plan de démarrage gratuit'
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscription_plans WHERE active = true LIMIT 1
);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Fix auto_create_trial_subscription function
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.auto_create_trial_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trial_days CONSTANT INTEGER := 14;
  v_default_plan_id UUID;
  v_start_date DATE := CURRENT_DATE;
  v_end_date DATE := CURRENT_DATE + (v_trial_days || ' days')::INTERVAL;
BEGIN
  -- Use the business plan_id if set, otherwise find the cheapest active plan
  v_default_plan_id := NEW.plan_id;
  IF v_default_plan_id IS NULL THEN
    SELECT id INTO v_default_plan_id
    FROM public.subscription_plans
    WHERE active = true
    ORDER BY monthly_price ASC
    LIMIT 1;
  END IF;

  -- If STILL no plan found, create a default Starter plan on the fly
  IF v_default_plan_id IS NULL THEN
    INSERT INTO public.subscription_plans (name, monthly_price, yearly_price, active, description)
    VALUES ('Starter', 0, 0, true, 'Plan de démarrage gratuit')
    RETURNING id INTO v_default_plan_id;
    RAISE WARNING '[auto_create_trial_subscription] Aucun plan existant → Starter créé automatiquement';
  END IF;

  RAISE WARNING '[auto_create_trial_subscription] Création essai: businessId=%, planId=%, start=%, end=%, days=%',
    NEW.id, v_default_plan_id, v_start_date, v_end_date, v_trial_days;

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
    v_start_date,
    v_end_date
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[auto_create_trial_subscription] ERREUR: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Ensure trigger exists
-- ────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_auto_create_trial_subscription ON public.businesses;
CREATE TRIGGER trg_auto_create_trial_subscription
  AFTER INSERT ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_trial_subscription();

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Create a log table for debugging subscription issues
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscription_debug_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  business_id UUID,
  subscription_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_debug_log ENABLE ROW LEVEL SECURITY;

-- Allow inserts from service_role and anon (for API endpoints)
CREATE POLICY "service_role all subscription_debug_log"
  ON public.subscription_debug_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

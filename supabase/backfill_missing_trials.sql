-- ════════════════════════════════════════════════════════════════════════════
-- Backfill: create trial subscriptions for businesses that have none.
-- Run this AFTER migration 20260717 to fix existing accounts.
-- ════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_business RECORD;
  v_plan_id UUID;
  v_count INTEGER := 0;
BEGIN
  -- Find businesses with no subscription row at all
  FOR v_business IN
    SELECT b.id, b.plan_id, b.created_at, b.name
    FROM public.businesses b
    LEFT JOIN public.business_subscriptions bs ON bs.business_id = b.id
    WHERE bs.id IS NULL
  LOOP
    -- Determine plan: use business.plan_id, or cheapest active plan
    v_plan_id := v_business.plan_id;
    IF v_plan_id IS NULL THEN
      SELECT id INTO v_plan_id
      FROM public.subscription_plans
      WHERE active = true
      ORDER BY monthly_price ASC
      LIMIT 1;
    END IF;

    -- If STILL no plan, create one
    IF v_plan_id IS NULL THEN
      INSERT INTO public.subscription_plans (name, monthly_price, yearly_price, active, description)
      VALUES ('Starter', 0, 0, true, 'Plan de démarrage gratuit')
      RETURNING id INTO v_plan_id;
    END IF;

    INSERT INTO public.business_subscriptions (
      business_id, plan_id, status, billing_cycle, price_snapshot,
      start_date, end_date
    ) VALUES (
      v_business.id,
      v_plan_id,
      'trialing',
      'monthly',
      COALESCE((SELECT monthly_price FROM public.subscription_plans WHERE id = v_plan_id), 0),
      COALESCE(v_business.created_at::DATE, CURRENT_DATE),
      COALESCE(v_business.created_at::DATE, CURRENT_DATE) + INTERVAL '14 days'
    );

    v_count := v_count + 1;
    RAISE NOTICE '[backfill_missing_trials] Créé essai pour business=%, planId=%', v_business.id, v_plan_id;
  END LOOP;

  RAISE NOTICE '[backfill_missing_trials] Terminé: % abonnements créés', v_count;
END;
$$;

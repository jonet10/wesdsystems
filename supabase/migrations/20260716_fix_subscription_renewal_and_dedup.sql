-- ════════════════════════════════════════════════════════════════════════════
-- Migration 20260716:
-- 1. Partial unique index to enforce one active subscription per business
-- 2. RPC: extend_or_create_subscription — atomically extends or creates
--    a subscription, always computing end_date from the existing end_date
--    when the current subscription is active (never starts from today).
-- 3. Add 'suspended' status to business_subscriptions CHECK constraint
-- 4. Add duration_months to business_subscription_history
-- ════════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Deduplicate active subscriptions before adding the unique index.
--    Keep only the latest active subscription per business (by created_at),
--    expire the rest so the index can be created.
-- ────────────────────────────────────────────────────────────────────────────
WITH duplicates AS (
  SELECT id, business_id, created_at,
    ROW_NUMBER() OVER (
      PARTITION BY business_id
      ORDER BY created_at DESC
    ) AS rn
  FROM public.business_subscriptions
  WHERE status = 'active'
),
to_expire AS (
  SELECT id, business_id FROM duplicates WHERE rn > 1
),
expired AS (
  UPDATE public.business_subscriptions
  SET
    status = 'expired',
    notes = COALESCE(notes, '') || ' | Expiré par migration 20260716 (duplicata)',
    updated_at = now()
  WHERE id IN (SELECT id FROM to_expire)
  RETURNING id, business_id, plan_id
)
INSERT INTO public.business_subscription_history (business_id, plan_id, action, status_before, status_after, notes)
SELECT
  business_id,
  plan_id,
  'expired',
  'active',
  'expired',
  'Expiré par migration 20260716 (duplicata)'
FROM expired;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Unique index — only one active subscription per business at a time
-- ────────────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_sub_per_business
  ON public.business_subscriptions(business_id)
  WHERE status = 'active';

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Extend the status CHECK to include 'suspended'
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.business_subscriptions
  DROP CONSTRAINT IF EXISTS business_subscriptions_status_check;

ALTER TABLE public.business_subscriptions
  ADD CONSTRAINT business_subscriptions_status_check
  CHECK (status IN ('active', 'trialing', 'past_due', 'expired', 'cancelled', 'suspended'));

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Add duration_months column to business_subscription_history
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.business_subscription_history
  ADD COLUMN IF NOT EXISTS duration_months INTEGER;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. RPC: extend_or_create_subscription
--    Safely renews a subscription:
--    - If the business already has a subscription:
--        - If active and end_date > today: new_end = addMonths(end_date, p_duration_months)
--        - Otherwise (expired/cancelled/suspended): new_end = addMonths(today, p_duration_months)
--    - If no subscription exists: creates one from today
--    Returns JSONB { success: true, subscription_id: UUID } or error
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.extend_or_create_subscription(
  p_business_id UUID,
  p_plan_id UUID,
  p_duration_months INTEGER DEFAULT 1,
  p_amount NUMERIC DEFAULT 0,
  p_currency_code VARCHAR DEFAULT 'HTG',
  p_billing_cycle VARCHAR DEFAULT 'monthly',
  p_order_id TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription_id UUID;
  v_end_date DATE;
  v_today DATE := CURRENT_DATE;
  v_existing_status TEXT;
  v_existing_end_date DATE;
BEGIN
  -- Look for existing subscription for this business (latest by created_at)
  SELECT id, status, end_date
  INTO v_subscription_id, v_existing_status, v_existing_end_date
  FROM public.business_subscriptions
  WHERE business_id = p_business_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- Compute the new end_date
  IF v_subscription_id IS NOT NULL AND v_existing_status = 'active' AND v_existing_end_date IS NOT NULL AND v_existing_end_date >= v_today THEN
    -- Active subscription: extend from current end_date
    v_end_date := v_existing_end_date + (p_duration_months || ' months')::INTERVAL;
  ELSE
    -- Expired, cancelled, suspended, or no subscription: start from today
    v_end_date := v_today + (p_duration_months || ' months')::INTERVAL;
  END IF;

  -- Upsert: if we found an existing subscription, update it; otherwise insert
  IF v_subscription_id IS NOT NULL THEN
    UPDATE public.business_subscriptions
    SET
      plan_id = p_plan_id,
      start_date = v_today,
      end_date = v_end_date,
      status = 'active',
      billing_cycle = p_billing_cycle,
      auto_renew = true,
      price_snapshot = p_amount,
      currency_code = p_currency_code,
      notes = COALESCE(p_notes, notes),
      updated_at = now()
    WHERE id = v_subscription_id;
  ELSE
    INSERT INTO public.business_subscriptions (
      business_id, plan_id, start_date, end_date, status,
      billing_cycle, auto_renew, price_snapshot, currency_code, notes
    ) VALUES (
      p_business_id, p_plan_id, v_today, v_end_date, 'active',
      p_billing_cycle, true, p_amount, p_currency_code, p_notes
    )
    RETURNING id INTO v_subscription_id;
  END IF;

  -- Update business.plan_id and status
  UPDATE public.businesses
  SET plan_id = p_plan_id, status = 'active'
  WHERE id = p_business_id;

  RETURN jsonb_build_object('success', true, 'subscription_id', v_subscription_id, 'end_date', v_end_date::TEXT);
EXCEPTION
  WHEN unique_violation THEN
    -- This shouldn't happen with the upsert logic, but if it does, return a clear error
    RETURN jsonb_build_object('success', false, 'error', 'Un abonnement actif existe déjà pour cet établissement');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.extend_or_create_subscription TO anon, authenticated, service_role;

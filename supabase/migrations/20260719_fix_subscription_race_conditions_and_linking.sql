-- ════════════════════════════════════════════════════════════════════════════
-- Migration 20260719:
-- 1. extend_or_create_subscription: add FOR UPDATE row locking for atomicity
-- 2. subscription_payments: add subscription_id FK + updated_at trigger
-- 3. moncash_subscription_payments: add subscription_payment_id column
-- ════════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Fix extend_or_create_subscription — FOR UPDATE prevents race condition
--    where two simultaneous callbacks both read the same end_date and each
--    extends by N months instead of one extending from the other's result.
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
  -- Lock the existing subscription row (if any) so concurrent calls see
  -- the updated end_date after the first call commits.
  SELECT id, status, end_date
  INTO v_subscription_id, v_existing_status, v_existing_end_date
  FROM public.business_subscriptions
  WHERE business_id = p_business_id
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  -- Compute the new end_date
  IF v_subscription_id IS NOT NULL AND v_existing_status = 'active' AND v_existing_end_date IS NOT NULL AND v_existing_end_date >= v_today THEN
    v_end_date := v_existing_end_date + (p_duration_months || ' months')::INTERVAL;
  ELSE
    v_end_date := v_today + (p_duration_months || ' months')::INTERVAL;
  END IF;

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

  UPDATE public.businesses
  SET plan_id = p_plan_id, status = 'active'
  WHERE id = p_business_id;

  RETURN jsonb_build_object('success', true, 'subscription_id', v_subscription_id, 'end_date', v_end_date::TEXT);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un abonnement actif existe déjà pour cet établissement');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. subscription_payments: add subscription_id FK + updated_at column
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.subscription_payments
  ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES public.business_subscriptions(id) ON DELETE SET NULL;

ALTER TABLE public.subscription_payments
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Create or replace the existing trigger for updated_at
DROP TRIGGER IF EXISTS trg_subscription_payments_updated_at ON public.subscription_payments;
CREATE TRIGGER trg_subscription_payments_updated_at
  BEFORE UPDATE ON public.subscription_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────────────────────
-- 3. moncash_subscription_payments: add subscription_payment_id FK column
--    to link back to the originating subscription_payments record.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.moncash_subscription_payments
  ADD COLUMN IF NOT EXISTS subscription_payment_id UUID REFERENCES public.subscription_payments(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Update create_moncash_subscription_payment RPC to accept and store
--    p_subscription_payment_id (currently a dead parameter).
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_moncash_subscription_payment(
  p_business_id UUID,
  p_plan_id UUID,
  p_subscription_payment_id UUID DEFAULT NULL,
  p_billing_cycle VARCHAR DEFAULT 'monthly',
  p_duration_months INT DEFAULT 1,
  p_payment_provider VARCHAR DEFAULT 'moncash',
  p_amount NUMERIC DEFAULT 0,
  p_currency_code VARCHAR DEFAULT 'HTG',
  p_order_id TEXT DEFAULT '',
  p_status VARCHAR DEFAULT 'redirected',
  p_redirect_url TEXT DEFAULT NULL,
  p_gateway_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.moncash_subscription_payments (
    business_id,
    plan_id,
    subscription_payment_id,
    billing_cycle,
    duration_months,
    payment_provider,
    amount,
    currency_code,
    order_id,
    status,
    redirect_url,
    gateway_payload
  ) VALUES (
    p_business_id,
    p_plan_id,
    p_subscription_payment_id,
    p_billing_cycle,
    p_duration_months,
    p_payment_provider,
    p_amount,
    p_currency_code,
    p_order_id,
    p_status,
    p_redirect_url,
    p_gateway_payload
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.extend_or_create_subscription TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_moncash_subscription_payment TO anon, authenticated, service_role;

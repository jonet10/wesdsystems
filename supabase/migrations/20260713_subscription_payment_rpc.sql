-- ════════════════════════════════════════════════════════════════════════════
-- RPC: create_subscription_payment — inserts a payment record bypassing RLS
-- via SECURITY DEFINER.  Used by the public MonCash subscription endpoint.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_subscription_payment(
  p_business_id UUID,
  p_plan_id UUID,
  p_amount NUMERIC,
  p_currency_code VARCHAR DEFAULT 'HTG',
  p_payment_method VARCHAR DEFAULT 'moncash',
  p_transaction_reference TEXT DEFAULT '',
  p_status VARCHAR DEFAULT 'pending'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.subscription_payments (
    business_id,
    plan_id,
    amount,
    currency_code,
    payment_method,
    transaction_reference,
    status
  ) VALUES (
    p_business_id,
    p_plan_id,
    p_amount,
    p_currency_code,
    p_payment_method,
    p_transaction_reference,
    p_status
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- RPC: update_subscription_payment — updates a payment record bypassing RLS
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_subscription_payment(
  p_id UUID,
  p_transaction_reference TEXT DEFAULT NULL,
  p_status VARCHAR DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.subscription_payments
  SET
    transaction_reference = COALESCE(p_transaction_reference, transaction_reference),
    status = COALESCE(p_status, status),
    updated_at = now()
  WHERE id = p_id;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- RPC: create_moncash_subscription_payment — inserts moncash payment record
-- bypassing RLS via SECURITY DEFINER.
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

GRANT EXECUTE ON FUNCTION public.create_subscription_payment TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_subscription_payment TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_moncash_subscription_payment TO anon, authenticated, service_role;

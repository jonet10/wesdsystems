-- ============================================================================
-- MonCash subscription payment tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.moncash_subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.business_subscriptions(id) ON DELETE SET NULL,
  plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly', 'custom')),
  payment_provider TEXT NOT NULL DEFAULT 'moncash',
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency_code VARCHAR(8) NOT NULL DEFAULT 'HTG',
  order_id TEXT NOT NULL UNIQUE,
  transaction_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'redirected', 'successful', 'failed', 'cancelled')),
  redirect_url TEXT,
  gateway_payload JSONB DEFAULT '{}'::jsonb,
  callback_payload JSONB DEFAULT '{}'::jsonb,
  paid_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_moncash_subscription_payments_updated_at ON public.moncash_subscription_payments;
CREATE TRIGGER trg_moncash_subscription_payments_updated_at
  BEFORE UPDATE ON public.moncash_subscription_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.moncash_subscription_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "moncash subscription payments readable" ON public.moncash_subscription_payments;
CREATE POLICY "moncash subscription payments readable" ON public.moncash_subscription_payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role = 'super_admin'
          OR p.business_id = moncash_subscription_payments.business_id
        )
    )
  );

DROP POLICY IF EXISTS "moncash subscription payments manage" ON public.moncash_subscription_payments;
CREATE POLICY "moncash subscription payments manage" ON public.moncash_subscription_payments
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role = 'super_admin'
          OR p.business_id = moncash_subscription_payments.business_id
        )
    )
  );


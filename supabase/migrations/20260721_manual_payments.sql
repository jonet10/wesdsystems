CREATE TABLE IF NOT EXISTS public.manual_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.business_subscriptions(id) ON DELETE SET NULL,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('moncash', 'natcash')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency_code TEXT NOT NULL DEFAULT 'HTG',
  sender_number TEXT NOT NULL,
  transaction_reference TEXT NOT NULL,
  proof_image_url TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manual_payments_business ON public.manual_payments(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_manual_payments_status ON public.manual_payments(status);
CREATE INDEX IF NOT EXISTS idx_manual_payments_user ON public.manual_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_manual_payments_created_at ON public.manual_payments(created_at DESC);

DROP TRIGGER IF EXISTS trg_manual_payments_updated_at ON public.manual_payments;
CREATE TRIGGER trg_manual_payments_updated_at
  BEFORE UPDATE ON public.manual_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.manual_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manual_payments user select own" ON public.manual_payments;
CREATE POLICY "manual_payments user select own" ON public.manual_payments
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "manual_payments user insert" ON public.manual_payments;
CREATE POLICY "manual_payments user insert" ON public.manual_payments
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
  );

DROP POLICY IF EXISTS "manual_payments admin update" ON public.manual_payments;
CREATE POLICY "manual_payments admin update" ON public.manual_payments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

INSERT INTO public.app_config (key, value, description) VALUES
  ('manual_payment_moncash_name', 'Jonet Jean Francois', 'Nom du bénéficiaire pour paiement manuel MonCash'),
  ('manual_payment_moncash_number', '38073835', 'Numéro MonCash pour paiement manuel'),
  ('manual_payment_natcash_name', 'Jonet Jean Francois', 'Nom du bénéficiaire pour paiement manuel NatCash'),
  ('manual_payment_natcash_number', '40011619', 'Numéro NatCash pour paiement manuel')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.approve_manual_payment(
  p_payment_id UUID,
  p_approved_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment RECORD;
  v_subscription_id UUID;
BEGIN
  SELECT * INTO v_payment
  FROM public.manual_payments
  WHERE id = p_payment_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Paiement introuvable ou déjà traité');
  END IF;

  UPDATE public.manual_payments
  SET
    status = 'approved',
    approved_by = p_approved_by,
    approved_at = now(),
    updated_at = now()
  WHERE id = p_payment_id;

  SELECT jsonb_build_object('success', true, 'payment_id', p_payment_id)
  INTO v_subscription_id;

  RETURN jsonb_build_object('success', true, 'payment_id', p_payment_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_manual_payment(
  p_payment_id UUID,
  p_rejected_by UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment RECORD;
BEGIN
  SELECT * INTO v_payment
  FROM public.manual_payments
  WHERE id = p_payment_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Paiement introuvable ou déjà traité');
  END IF;

  UPDATE public.manual_payments
  SET
    status = 'rejected',
    rejected_by = p_rejected_by,
    rejected_at = now(),
    rejection_reason = p_reason,
    updated_at = now()
  WHERE id = p_payment_id;

  RETURN jsonb_build_object('success', true, 'payment_id', p_payment_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_manual_payment TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_manual_payment TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- SUBSCRIPTION PAYMENTS
-- Tracks manual payment submissions (MonCash, NatCash, etc.) with
-- admin verification workflow.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
  amount NUMERIC(12, 2) NOT NULL,
  currency_code TEXT NOT NULL DEFAULT 'HTG',
  payment_method TEXT NOT NULL,
  transaction_reference TEXT NOT NULL DEFAULT '',
  transaction_id TEXT,
  moncash_payment_id TEXT,
  phone_number TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'pending_verification', 'completed', 'approved', 'rejected', 'failed')),
  admin_id UUID REFERENCES public.profiles(id),
  admin_notes TEXT,
  approved_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sub_payments_business ON public.subscription_payments(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sub_payments_status ON public.subscription_payments(status);

-- ─── SEED DEFAULT SUBSCRIPTION PLANS ───
-- Only inserts if plans table is empty

DO $$
DECLARE
  plan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO plan_count FROM public.subscription_plans;
  IF plan_count = 0 THEN
    INSERT INTO public.subscription_plans (name, monthly_price, yearly_price, max_businesses, max_branches, max_staff, active, description) VALUES
      ('Starter', 1500, 15000, 1, 1, 3, true, 'Pour les petits salons — 3 employés, 1 succursale, rapports basiques'),
      ('Standard', 3000, 30000, 1, 2, 10, true, 'Pour les salons en croissance — 10 employés, 2 succursales, rapports avancés'),
      ('Premium', 5000, 50000, 1, 10, 50, true, 'Pour les grandes enseignes — employés et succursales illimités, toutes les fonctionnalités'),
      ('Enterprise', 10000, 100000, null, null, null, true, 'Solution sur mesure — support prioritaire, API, analytics multi-sites');
  END IF;
END $$;

-- ─── SEED DEFAULT PLAN FEATURES ───

DO $$
DECLARE
  plan_record RECORD;
  feature_exists INTEGER;
BEGIN
  FOR plan_record IN SELECT * FROM public.subscription_plans LOOP
    SELECT COUNT(*) INTO feature_exists
    FROM public.subscription_features
    WHERE plan_id = plan_record.id;

    IF feature_exists = 0 THEN
      IF plan_record.name = 'Starter' THEN
        INSERT INTO public.subscription_features (plan_id, feature_key, enabled, feature_label, sort_order) VALUES
          (plan_record.id, 'standard_pos', true, 'Point de vente standard', 1),
          (plan_record.id, 'basic_reports', true, 'Rapports basiques', 2);
      ELSIF plan_record.name = 'Standard' THEN
        INSERT INTO public.subscription_features (plan_id, feature_key, enabled, feature_label, sort_order) VALUES
          (plan_record.id, 'standard_pos', true, 'Point de vente standard', 1),
          (plan_record.id, 'basic_reports', true, 'Rapports basiques', 2),
          (plan_record.id, 'advanced_reports', true, 'Rapports avancés', 3),
          (plan_record.id, 'loyalty_program', true, 'Programme fidélité', 4),
          (plan_record.id, 'customer_credit', true, 'Crédit client', 5);
      ELSIF plan_record.name = 'Premium' THEN
        INSERT INTO public.subscription_features (plan_id, feature_key, enabled, feature_label, sort_order) VALUES
          (plan_record.id, 'standard_pos', true, 'Point de vente standard', 1),
          (plan_record.id, 'basic_reports', true, 'Rapports basiques', 2),
          (plan_record.id, 'advanced_reports', true, 'Rapports avancés', 3),
          (plan_record.id, 'advanced_analytics', true, 'Analytics avancés', 4),
          (plan_record.id, 'loyalty_program', true, 'Programme fidélité', 5),
          (plan_record.id, 'customer_credit', true, 'Crédit client', 6),
          (plan_record.id, 'all_features', true, 'Toutes les fonctionnalités', 7);
      ELSIF plan_record.name = 'Enterprise' THEN
        INSERT INTO public.subscription_features (plan_id, feature_key, enabled, feature_label, sort_order) VALUES
          (plan_record.id, 'standard_pos', true, 'Point de vente standard', 1),
          (plan_record.id, 'basic_reports', true, 'Rapports basiques', 2),
          (plan_record.id, 'advanced_reports', true, 'Rapports avancés', 3),
          (plan_record.id, 'advanced_analytics', true, 'Analytics avancés', 4),
          (plan_record.id, 'loyalty_program', true, 'Programme fidélité', 5),
          (plan_record.id, 'customer_credit', true, 'Crédit client', 6),
          (plan_record.id, 'all_features', true, 'Toutes les fonctionnalités', 7),
          (plan_record.id, 'multi_location_analytics', true, 'Analytics multi-sites', 8),
          (plan_record.id, 'api_access', true, 'Accès API', 9),
          (plan_record.id, 'priority_support', true, 'Support prioritaire', 10);
      END IF;
    END IF;
  END LOOP;
END $$;

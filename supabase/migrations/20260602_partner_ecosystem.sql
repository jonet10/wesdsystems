-- ============================================================================
-- Wesd Systems - Partner, Reseller & Ambassador ecosystem
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Partner tiers and partner profiles
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.partner_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  recurring_commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  one_time_commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  fixed_commission_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  partner_tier_id UUID REFERENCES public.partner_tiers(id) ON DELETE SET NULL,
  partner_level TEXT NOT NULL DEFAULT 'affiliate' CHECK (partner_level IN ('affiliate', 'reseller', 'agency')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'rejected')),
  display_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company_name TEXT,
  referral_code TEXT NOT NULL UNIQUE,
  referral_url TEXT,
  notes TEXT,
  suspended_reason TEXT,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS payout_method TEXT CHECK (payout_method IN ('moncash', 'natcash', 'bank_transfer', 'cash')),
  ADD COLUMN IF NOT EXISTS white_label_enabled BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.partner_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  referral_code TEXT NOT NULL,
  referral_url TEXT NOT NULL,
  source TEXT,
  utm_source TEXT,
  clicks INTEGER NOT NULL DEFAULT 0,
  signups INTEGER NOT NULL DEFAULT 0,
  converted_at TIMESTAMPTZ,
  first_clicked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_clicked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_referrals_unique
  ON public.partner_referrals (partner_id, referral_code, COALESCE(business_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE TABLE IF NOT EXISTS public.partner_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL UNIQUE REFERENCES public.partners(id) ON DELETE CASCADE,
  currency_code VARCHAR(8) NOT NULL DEFAULT 'HTG',
  available_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  pending_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  lifetime_earnings NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_payouts NUMERIC(14,2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.partner_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  wallet_id UUID REFERENCES public.partner_wallets(id) ON DELETE SET NULL,
  business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  business_subscription_id UUID REFERENCES public.business_subscriptions(id) ON DELETE SET NULL,
  commission_type TEXT NOT NULL CHECK (commission_type IN ('one_time', 'recurring', 'fixed', 'percentage')),
  source_event TEXT NOT NULL CHECK (source_event IN ('created', 'renewed', 'upgraded', 'downgraded', 'cancelled', 'manual', 'bonus')),
  rate_value NUMERIC(8,2) NOT NULL DEFAULT 0,
  base_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency_code VARCHAR(8) NOT NULL DEFAULT 'HTG',
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'pending', 'paid', 'reversed')),
  period_start DATE,
  period_end DATE,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.partner_payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  wallet_id UUID REFERENCES public.partner_wallets(id) ON DELETE SET NULL,
  requested_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  payout_method TEXT NOT NULL CHECK (payout_method IN ('moncash', 'natcash', 'bank_transfer', 'cash')),
  payout_details JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected', 'cancelled')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.partner_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  wallet_id UUID REFERENCES public.partner_wallets(id) ON DELETE SET NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('commission', 'payout', 'adjustment', 'bonus', 'reversal')),
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  balance_before NUMERIC(14,2) NOT NULL DEFAULT 0,
  balance_after NUMERIC(14,2) NOT NULL DEFAULT 0,
  reference_table TEXT,
  reference_id UUID,
  note TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hand-off fields on business + profile records.
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS referred_by_partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referred_by_partner_code TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS partner_referral_code TEXT;

-- ---------------------------------------------------------------------------
-- Timestamp trigger helper
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'partner_tiers') THEN
    DROP TRIGGER IF EXISTS trg_partner_tiers_updated_at ON public.partner_tiers;
    CREATE TRIGGER trg_partner_tiers_updated_at
      BEFORE UPDATE ON public.partner_tiers
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_partner_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_partners_updated_at ON public.partners;
CREATE TRIGGER trg_partners_updated_at
  BEFORE UPDATE ON public.partners
  FOR EACH ROW EXECUTE FUNCTION public.set_partner_updated_at();

DROP TRIGGER IF EXISTS trg_partner_referrals_updated_at ON public.partner_referrals;
CREATE TRIGGER trg_partner_referrals_updated_at
  BEFORE UPDATE ON public.partner_referrals
  FOR EACH ROW EXECUTE FUNCTION public.set_partner_updated_at();

DROP TRIGGER IF EXISTS trg_partner_wallets_updated_at ON public.partner_wallets;
CREATE TRIGGER trg_partner_wallets_updated_at
  BEFORE UPDATE ON public.partner_wallets
  FOR EACH ROW EXECUTE FUNCTION public.set_partner_updated_at();

DROP TRIGGER IF EXISTS trg_partner_commissions_updated_at ON public.partner_commissions;
CREATE TRIGGER trg_partner_commissions_updated_at
  BEFORE UPDATE ON public.partner_commissions
  FOR EACH ROW EXECUTE FUNCTION public.set_partner_updated_at();

DROP TRIGGER IF EXISTS trg_partner_payout_requests_updated_at ON public.partner_payout_requests;
CREATE TRIGGER trg_partner_payout_requests_updated_at
  BEFORE UPDATE ON public.partner_payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_partner_updated_at();

-- ---------------------------------------------------------------------------
-- Seed tiers
-- ---------------------------------------------------------------------------

INSERT INTO public.partner_tiers (name, slug, recurring_commission_rate, one_time_commission_rate, fixed_commission_amount, active, description)
VALUES
  ('Bronze', 'bronze', 10, 0, 0, true, 'Entry tier with 10% recurring commission'),
  ('Silver', 'silver', 15, 0, 0, true, 'Higher recurring rates for growing partners'),
  ('Gold', 'gold', 20, 0, 0, true, 'Premium recurring commission tier'),
  ('Platinum', 'platinum', 25, 0, 0, true, 'Top tier with the highest recurring rate')
ON CONFLICT (slug) DO UPDATE
SET recurring_commission_rate = EXCLUDED.recurring_commission_rate,
    one_time_commission_rate = EXCLUDED.one_time_commission_rate,
    fixed_commission_amount = EXCLUDED.fixed_commission_amount,
    description = EXCLUDED.description,
    active = EXCLUDED.active,
    updated_at = now();

-- ---------------------------------------------------------------------------
-- Partner wallet lifecycle
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_partner_wallet()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.partner_wallets (partner_id, currency_code, available_balance, pending_balance, lifetime_earnings, total_payouts)
  VALUES (NEW.id, 'HTG', 0, 0, 0, 0)
  ON CONFLICT (partner_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_partner_wallet ON public.partners;
CREATE TRIGGER trg_create_partner_wallet
  AFTER INSERT ON public.partners
  FOR EACH ROW EXECUTE FUNCTION public.create_partner_wallet();

-- ---------------------------------------------------------------------------
-- Referral resolution and click tracking
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.resolve_business_partner_referral()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  matched_partner_id UUID;
BEGIN
  IF NEW.referred_by_partner_id IS NULL AND NEW.referred_by_partner_code IS NOT NULL THEN
    SELECT id INTO matched_partner_id
    FROM public.partners
    WHERE referral_code = NEW.referred_by_partner_code
      AND status = 'active'
    LIMIT 1;

    IF matched_partner_id IS NOT NULL THEN
      NEW.referred_by_partner_id := matched_partner_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_business_partner_referral ON public.businesses;
CREATE TRIGGER trg_business_partner_referral
  BEFORE INSERT OR UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.resolve_business_partner_referral();

CREATE OR REPLACE FUNCTION public.sync_partner_referral_from_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.business_id IS NOT NULL AND NEW.partner_referral_code IS NOT NULL THEN
    UPDATE public.businesses b
      SET referred_by_partner_id = p.id
    FROM public.partners p
    WHERE b.id = NEW.business_id
      AND p.referral_code = NEW.partner_referral_code
      AND p.status = 'active'
      AND b.referred_by_partner_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_partner_referral ON public.profiles;
CREATE TRIGGER trg_profile_partner_referral
  AFTER INSERT OR UPDATE OF business_id, partner_referral_code ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_partner_referral_from_profile();

CREATE OR REPLACE FUNCTION public.track_partner_referral(
  p_referral_code TEXT,
  p_event TEXT DEFAULT 'click',
  p_business_id UUID DEFAULT NULL,
  p_source TEXT DEFAULT NULL,
  p_utm_source TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_partner_id UUID;
  v_referral_id UUID;
BEGIN
  SELECT id INTO v_partner_id
  FROM public.partners
  WHERE referral_code = p_referral_code
    AND status <> 'rejected'
  LIMIT 1;

  IF v_partner_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.partner_referrals (
    partner_id, business_id, referral_code, referral_url, source, utm_source,
    clicks, signups, converted_at, first_clicked_at, last_clicked_at
  )
  VALUES (
    v_partner_id,
    p_business_id,
    p_referral_code,
    'https://wesdsystems.store/register?ref=' || p_referral_code,
    p_source,
    p_utm_source,
    CASE WHEN p_event = 'click' THEN 1 ELSE 0 END,
    CASE WHEN p_event = 'signup' THEN 1 ELSE 0 END,
    CASE WHEN p_event = 'signup' THEN now() ELSE NULL END,
    now(),
    now()
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_referral_id;

  IF v_referral_id IS NULL THEN
    UPDATE public.partner_referrals
      SET clicks = clicks + CASE WHEN p_event = 'click' THEN 1 ELSE 0 END,
          signups = signups + CASE WHEN p_event = 'signup' THEN 1 ELSE 0 END,
          converted_at = CASE WHEN p_event = 'signup' THEN now() ELSE converted_at END,
          last_clicked_at = now(),
          updated_at = now()
    WHERE partner_id = v_partner_id
      AND referral_code = p_referral_code
    RETURNING id INTO v_referral_id;
  END IF;

  RETURN v_referral_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.track_partner_referral(TEXT, TEXT, UUID, TEXT, TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Commission engine
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_partner_commission_from_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_partner_id UUID;
  v_tier RECORD;
  v_business RECORD;
  v_amount NUMERIC(14,2);
  v_commission_type TEXT;
  v_source_event TEXT;
  v_wallet_id UUID;
BEGIN
  SELECT referred_by_partner_id, referred_by_partner_code INTO v_business
  FROM public.businesses
  WHERE id = NEW.business_id;

  v_partner_id := v_business.referred_by_partner_id;
  IF v_partner_id IS NULL AND v_business.referred_by_partner_code IS NOT NULL THEN
    SELECT id INTO v_partner_id
    FROM public.partners
    WHERE referral_code = v_business.referred_by_partner_code
      AND status = 'active'
    LIMIT 1;
  END IF;

  IF v_partner_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT pt.* INTO v_tier
  FROM public.partners p
  LEFT JOIN public.partner_tiers pt ON pt.id = p.partner_tier_id
  WHERE p.id = v_partner_id
  LIMIT 1;

  SELECT id INTO v_wallet_id
  FROM public.partner_wallets
  WHERE partner_id = v_partner_id
  LIMIT 1;

  IF v_wallet_id IS NULL THEN
    INSERT INTO public.partner_wallets (partner_id) VALUES (v_partner_id) RETURNING id INTO v_wallet_id;
  END IF;

  v_source_event := CASE
    WHEN TG_OP = 'INSERT' THEN 'created'
    WHEN NEW.plan_id IS DISTINCT FROM OLD.plan_id AND NEW.price_snapshot > COALESCE(OLD.price_snapshot, 0) THEN 'upgraded'
    WHEN NEW.plan_id IS DISTINCT FROM OLD.plan_id AND NEW.price_snapshot < COALESCE(OLD.price_snapshot, 0) THEN 'downgraded'
    WHEN NEW.status = 'cancelled' THEN 'cancelled'
    ELSE 'renewed'
  END;

  IF v_tier.fixed_commission_amount > 0 AND TG_OP = 'INSERT' THEN
    v_amount := v_tier.fixed_commission_amount;
    v_commission_type := 'fixed';
    INSERT INTO public.partner_commissions (
      partner_id, wallet_id, business_id, business_subscription_id, commission_type, source_event,
      rate_value, base_amount, amount, currency_code, status, period_start, period_end, notes
    )
    VALUES (
      v_partner_id, v_wallet_id, NEW.business_id, NEW.id, v_commission_type, v_source_event,
      0, COALESCE(NEW.price_snapshot, 0), v_amount, COALESCE(NEW.currency_code, 'HTG'), 'available', NEW.start_date, NEW.end_date,
      'Fixed commission from partner tier'
    );
  END IF;

  IF v_tier.one_time_commission_rate > 0 AND TG_OP = 'INSERT' THEN
    v_amount := COALESCE(NEW.price_snapshot, 0) * (v_tier.one_time_commission_rate / 100.0);
    INSERT INTO public.partner_commissions (
      partner_id, wallet_id, business_id, business_subscription_id, commission_type, source_event,
      rate_value, base_amount, amount, currency_code, status, period_start, period_end, notes
    )
    VALUES (
      v_partner_id, v_wallet_id, NEW.business_id, NEW.id, 'one_time', v_source_event,
      v_tier.one_time_commission_rate, COALESCE(NEW.price_snapshot, 0), ROUND(v_amount, 2), COALESCE(NEW.currency_code, 'HTG'), 'available', NEW.start_date, NEW.end_date,
      'One-time partner commission'
    );
  END IF;

  IF v_tier.recurring_commission_rate > 0 AND NEW.status = 'active' THEN
    v_amount := COALESCE(NEW.price_snapshot, 0) * (v_tier.recurring_commission_rate / 100.0);
    INSERT INTO public.partner_commissions (
      partner_id, wallet_id, business_id, business_subscription_id, commission_type, source_event,
      rate_value, base_amount, amount, currency_code, status, period_start, period_end, notes
    )
    VALUES (
      v_partner_id, v_wallet_id, NEW.business_id, NEW.id, 'recurring', v_source_event,
      v_tier.recurring_commission_rate, COALESCE(NEW.price_snapshot, 0), ROUND(v_amount, 2), COALESCE(NEW.currency_code, 'HTG'), 'available', NEW.start_date, NEW.end_date,
      'Recurring partner commission'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_partner_commission_from_subscription ON public.business_subscriptions;
CREATE TRIGGER trg_partner_commission_from_subscription
  AFTER INSERT OR UPDATE ON public.business_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.record_partner_commission_from_subscription();

CREATE OR REPLACE FUNCTION public.sync_partner_wallet_on_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_wallet_id UUID;
  v_before NUMERIC(14,2);
  v_after NUMERIC(14,2);
BEGIN
  SELECT id, available_balance INTO v_wallet_id, v_before
  FROM public.partner_wallets
  WHERE partner_id = NEW.partner_id
  LIMIT 1;

  IF v_wallet_id IS NULL THEN
    INSERT INTO public.partner_wallets (partner_id) VALUES (NEW.partner_id) RETURNING id, available_balance INTO v_wallet_id, v_before;
  END IF;

  IF NEW.status = 'available' THEN
    UPDATE public.partner_wallets
      SET available_balance = available_balance + NEW.amount,
          lifetime_earnings = lifetime_earnings + NEW.amount,
          updated_at = now()
    WHERE id = v_wallet_id
    RETURNING available_balance INTO v_after;

    INSERT INTO public.partner_transactions (
      partner_id, wallet_id, transaction_type, amount, balance_before, balance_after,
      reference_table, reference_id, note
    )
    VALUES (
      NEW.partner_id, v_wallet_id, 'commission', NEW.amount, v_before, v_after,
      'partner_commissions', NEW.id, NEW.notes
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_partner_wallet_on_commission ON public.partner_commissions;
CREATE TRIGGER trg_partner_wallet_on_commission
  AFTER INSERT ON public.partner_commissions
  FOR EACH ROW EXECUTE FUNCTION public.sync_partner_wallet_on_commission();

CREATE OR REPLACE FUNCTION public.sync_partner_wallet_on_payout_request()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_wallet_id UUID;
  v_before NUMERIC(14,2);
  v_after NUMERIC(14,2);
BEGIN
  SELECT id, available_balance INTO v_wallet_id, v_before
  FROM public.partner_wallets
  WHERE partner_id = NEW.partner_id
  LIMIT 1;

  IF v_wallet_id IS NULL THEN
    INSERT INTO public.partner_wallets (partner_id) VALUES (NEW.partner_id) RETURNING id, available_balance INTO v_wallet_id, v_before;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status <> NEW.status AND NEW.status = 'paid' THEN
    UPDATE public.partner_wallets
      SET available_balance = available_balance - NEW.requested_amount,
          total_payouts = total_payouts + NEW.requested_amount,
          updated_at = now()
    WHERE id = v_wallet_id
    RETURNING available_balance INTO v_after;

    INSERT INTO public.partner_transactions (
      partner_id, wallet_id, transaction_type, amount, balance_before, balance_after,
      reference_table, reference_id, note
    )
    VALUES (
      NEW.partner_id, v_wallet_id, 'payout', -NEW.requested_amount, v_before, v_after,
      'partner_payout_requests', NEW.id, NEW.note
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_partner_wallet_on_payout_request ON public.partner_payout_requests;
CREATE TRIGGER trg_partner_wallet_on_payout_request
  AFTER UPDATE ON public.partner_payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.sync_partner_wallet_on_payout_request();

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------

ALTER TABLE public.partner_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_subscription_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partner tiers readable" ON public.partner_tiers;
CREATE POLICY "partner tiers readable" ON public.partner_tiers
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "partner tiers manage" ON public.partner_tiers;
CREATE POLICY "partner tiers manage" ON public.partner_tiers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

DROP POLICY IF EXISTS "partners readable" ON public.partners;
CREATE POLICY "partners readable" ON public.partners
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.role = 'super_admin' OR partners.user_id = auth.uid() OR partners.id IN (
          SELECT b.referred_by_partner_id
          FROM public.businesses b
          JOIN public.profiles pr ON pr.id = auth.uid()
          WHERE pr.role = 'super_admin' OR pr.business_id = b.id
        ))
    )
  );

DROP POLICY IF EXISTS "partners manage" ON public.partners;
CREATE POLICY "partners manage" ON public.partners
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

DROP POLICY IF EXISTS "partner referrals readable" ON public.partner_referrals;
CREATE POLICY "partner referrals readable" ON public.partner_referrals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.partners p
      WHERE p.id = partner_referrals.partner_id
        AND (p.user_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.role = 'super_admin'
        ))
    )
  );

DROP POLICY IF EXISTS "partner referrals manage" ON public.partner_referrals;
CREATE POLICY "partner referrals manage" ON public.partner_referrals
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.partners p
      WHERE p.id = partner_referrals.partner_id
        AND (p.user_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.role = 'super_admin'
        ))
    )
  );

DROP POLICY IF EXISTS "partner wallets readable" ON public.partner_wallets;
CREATE POLICY "partner wallets readable" ON public.partner_wallets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.partners p
      WHERE p.id = partner_wallets.partner_id
        AND (p.user_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.role = 'super_admin'
        ))
    )
  );

DROP POLICY IF EXISTS "partner wallets manage" ON public.partner_wallets;
CREATE POLICY "partner wallets manage" ON public.partner_wallets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = auth.uid() AND pr.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "partner commissions readable" ON public.partner_commissions;
CREATE POLICY "partner commissions readable" ON public.partner_commissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.partners p
      WHERE p.id = partner_commissions.partner_id
        AND (p.user_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.role = 'super_admin'
        ))
    )
  );

DROP POLICY IF EXISTS "partner commissions manage" ON public.partner_commissions;
CREATE POLICY "partner commissions manage" ON public.partner_commissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "partner payouts readable" ON public.partner_payout_requests;
CREATE POLICY "partner payouts readable" ON public.partner_payout_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.partners p
      WHERE p.id = partner_payout_requests.partner_id
        AND (p.user_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.role = 'super_admin'
        ))
    )
  );

DROP POLICY IF EXISTS "partner payouts manage" ON public.partner_payout_requests;
CREATE POLICY "partner payouts manage" ON public.partner_payout_requests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.partners p
      WHERE p.id = partner_payout_requests.partner_id
        AND (p.user_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.role = 'super_admin'
        ))
    )
  );

DROP POLICY IF EXISTS "partner transactions readable" ON public.partner_transactions;
CREATE POLICY "partner transactions readable" ON public.partner_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.partners p
      WHERE p.id = partner_transactions.partner_id
        AND (p.user_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.role = 'super_admin'
        ))
    )
  );

DROP POLICY IF EXISTS "partner transactions manage" ON public.partner_transactions;
CREATE POLICY "partner transactions manage" ON public.partner_transactions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "businesses partner-aware read" ON public.businesses;
CREATE POLICY "businesses partner-aware read" ON public.businesses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = auth.uid()
        AND (
          pr.role = 'super_admin'
          OR pr.business_id = businesses.id
          OR businesses.referred_by_partner_id IN (
            SELECT p.id FROM public.partners p WHERE p.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "businesses partner-aware manage" ON public.businesses;
CREATE POLICY "businesses partner-aware manage" ON public.businesses
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = auth.uid()
        AND (pr.role = 'super_admin' OR pr.business_id = businesses.id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = auth.uid()
        AND (pr.role = 'super_admin' OR pr.business_id = businesses.id)
    )
  );

DROP POLICY IF EXISTS "business subscriptions partner read" ON public.business_subscriptions;
CREATE POLICY "business subscriptions partner read" ON public.business_subscriptions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles pr
      JOIN public.businesses b ON b.id = business_subscriptions.business_id
      WHERE pr.id = auth.uid()
        AND (
          pr.role = 'super_admin'
          OR pr.business_id = b.id
          OR b.referred_by_partner_id IN (SELECT p.id FROM public.partners p WHERE p.user_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "business subscriptions partner manage" ON public.business_subscriptions;
CREATE POLICY "business subscriptions partner manage" ON public.business_subscriptions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles pr
      JOIN public.businesses b ON b.id = business_subscriptions.business_id
      WHERE pr.id = auth.uid()
        AND (pr.role = 'super_admin' OR pr.business_id = b.id)
    )
  );

DROP POLICY IF EXISTS "business history partner read" ON public.business_subscription_history;
CREATE POLICY "business history partner read" ON public.business_subscription_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles pr
      JOIN public.businesses b ON b.id = business_subscription_history.business_id
      WHERE pr.id = auth.uid()
        AND (
          pr.role = 'super_admin'
          OR pr.business_id = b.id
          OR b.referred_by_partner_id IN (SELECT p.id FROM public.partners p WHERE p.user_id = auth.uid())
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Default referral helper data
-- ---------------------------------------------------------------------------

UPDATE public.partners
SET referral_url = 'https://wesdsystems.store/register?ref=' || referral_code
WHERE referral_url IS NULL OR referral_url = '';

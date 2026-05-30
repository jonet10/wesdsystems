-- ============================================================================
-- Wesd Systems - Platform-wide SaaS subscription, multi-branch, loyalty, debt
-- ============================================================================

-- Extensions commonly used by the existing migrations
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Subscription plans and features
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  monthly_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  yearly_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  max_businesses INTEGER NOT NULL DEFAULT 1,
  max_branches INTEGER NOT NULL DEFAULT 1,
  max_staff INTEGER,
  active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Support the older SaaS schema that already existed in this repository.
ALTER TABLE IF EXISTS public.subscription_plans
  ADD COLUMN IF NOT EXISTS yearly_price NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_businesses INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_branches INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_staff INTEGER,
  ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE IF EXISTS public.subscription_plans
  ALTER COLUMN monthly_price TYPE NUMERIC(12, 2) USING monthly_price::NUMERIC,
  ALTER COLUMN yearly_price TYPE NUMERIC(12, 2) USING COALESCE(yearly_price, 0)::NUMERIC;

UPDATE public.subscription_plans
SET
  yearly_price = COALESCE(yearly_price, monthly_price * 12),
  max_businesses = COALESCE(max_businesses, 1),
  max_branches = COALESCE(max_branches, max_salons, 1),
  max_staff = COALESCE(max_staff, max_employees),
  active = COALESCE(active, is_active, true),
  updated_at = now()
WHERE TRUE;

CREATE TABLE IF NOT EXISTS public.subscription_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  feature_label TEXT,
  feature_group TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, feature_key)
);

CREATE TABLE IF NOT EXISTS public.business_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trialing', 'past_due', 'expired', 'cancelled')),
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly', 'custom')),
  auto_renew BOOLEAN NOT NULL DEFAULT true,
  price_snapshot NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency_code VARCHAR(8) NOT NULL DEFAULT 'HTG',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.business_subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  previous_plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  action TEXT NOT NULL DEFAULT 'changed' CHECK (action IN ('created', 'renewed', 'changed', 'upgraded', 'downgraded', 'expired', 'cancelled')),
  status_before TEXT,
  status_after TEXT,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);

-- Keep the older business.plan_id column in sync for existing modules
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL;

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS active_branch_id UUID;

-- ---------------------------------------------------------------------------
-- Generic branch architecture
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.business_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  branch_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, name)
);

ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_active_branch_fk
  FOREIGN KEY (active_branch_id) REFERENCES public.business_branches(id) ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

-- ---------------------------------------------------------------------------
-- Loyalty and customer credit
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.loyalty_program_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL,
  points_per_currency NUMERIC(12, 4) NOT NULL DEFAULT 0.01,
  currency_spend_for_point NUMERIC(12, 2) NOT NULL DEFAULT 100,
  redemption_points_per_reward INTEGER NOT NULL DEFAULT 100,
  points_per_referral INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id)
);

CREATE TABLE IF NOT EXISTS public.customer_loyalty_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL,
  customer_id UUID,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  points_balance INTEGER NOT NULL DEFAULT 0,
  lifetime_points INTEGER NOT NULL DEFAULT 0,
  lifetime_spend NUMERIC(14, 2) NOT NULL DEFAULT 0,
  last_activity_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, customer_phone)
);

CREATE TABLE IF NOT EXISTS public.customer_loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL,
  customer_loyalty_account_id UUID NOT NULL REFERENCES public.customer_loyalty_accounts(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('earn', 'redeem', 'adjustment', 'expire', 'bonus')),
  points INTEGER NOT NULL DEFAULT 0,
  amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  reference_table TEXT,
  reference_id UUID,
  description TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.loyalty_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  points_cost INTEGER NOT NULL DEFAULT 0,
  reward_value NUMERIC(14, 2) NOT NULL DEFAULT 0,
  reward_type TEXT NOT NULL DEFAULT 'service' CHECK (reward_type IN ('service', 'discount', 'product', 'cashback', 'custom')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL,
  customer_id UUID,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  sale_reference TEXT,
  original_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  outstanding_balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
  due_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'partial', 'settled', 'written_off')),
  due_date DATE,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_debt_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id UUID NOT NULL REFERENCES public.customer_debts(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL,
  amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  note TEXT
);

-- Backfill branch support into the main operational tables used by the app.
ALTER TABLE IF EXISTS public.products ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.product_categories ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.stock_alerts ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.employees ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.customers ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.salon_products ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.salon_services ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.salon_beverages ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.salon_promotions ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.salon_expenses ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.salon_sales ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.salon_sale_items ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.salon_sale_payments ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.salon_appointments ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.salon_inventory_movements ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.salon_customers ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.salon_employees ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Updated_at helper
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscription_plans') THEN
    DROP TRIGGER IF EXISTS trg_subscription_plans_updated_at ON public.subscription_plans;
    CREATE TRIGGER trg_subscription_plans_updated_at
      BEFORE UPDATE ON public.subscription_plans
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscription_features') THEN
    DROP TRIGGER IF EXISTS trg_subscription_features_updated_at ON public.subscription_features;
    CREATE TRIGGER trg_subscription_features_updated_at
      BEFORE UPDATE ON public.subscription_features
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'business_subscriptions') THEN
    DROP TRIGGER IF EXISTS trg_business_subscriptions_updated_at ON public.business_subscriptions;
    CREATE TRIGGER trg_business_subscriptions_updated_at
      BEFORE UPDATE ON public.business_subscriptions
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'business_branches') THEN
    DROP TRIGGER IF EXISTS trg_business_branches_updated_at ON public.business_branches;
    CREATE TRIGGER trg_business_branches_updated_at
      BEFORE UPDATE ON public.business_branches
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customer_loyalty_accounts') THEN
    DROP TRIGGER IF EXISTS trg_customer_loyalty_accounts_updated_at ON public.customer_loyalty_accounts;
    CREATE TRIGGER trg_customer_loyalty_accounts_updated_at
      BEFORE UPDATE ON public.customer_loyalty_accounts
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'loyalty_rewards') THEN
    DROP TRIGGER IF EXISTS trg_loyalty_rewards_updated_at ON public.loyalty_rewards;
    CREATE TRIGGER trg_loyalty_rewards_updated_at
      BEFORE UPDATE ON public.loyalty_rewards
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customer_debts') THEN
    DROP TRIGGER IF EXISTS trg_customer_debts_updated_at ON public.customer_debts;
    CREATE TRIGGER trg_customer_debts_updated_at
      BEFORE UPDATE ON public.customer_debts
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Limit enforcement
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_effective_plan(p_business_id UUID)
RETURNS TABLE (
  plan_id UUID,
  plan_name TEXT,
  max_businesses INTEGER,
  max_branches INTEGER,
  max_staff INTEGER,
  active BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT sp.id, sp.name, sp.max_businesses, sp.max_branches, sp.max_staff, sp.active
  FROM public.business_subscriptions bs
  JOIN public.subscription_plans sp ON sp.id = bs.plan_id
  WHERE bs.business_id = p_business_id
    AND bs.status = 'active'
  ORDER BY bs.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT sp.id, sp.name, sp.max_businesses, sp.max_branches, sp.max_staff, sp.active
    FROM public.businesses b
    JOIN public.subscription_plans sp ON sp.id = b.plan_id
    WHERE b.id = p_business_id
    LIMIT 1;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_branch_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  limit_branches INTEGER;
  current_count INTEGER;
BEGIN
  SELECT COALESCE(plan.max_branches, 1)
    INTO limit_branches
  FROM public.get_effective_plan(NEW.business_id) AS plan
  LIMIT 1;

  IF limit_branches IS NULL OR limit_branches < 0 THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)
    INTO current_count
  FROM public.business_branches
  WHERE business_id = NEW.business_id
    AND active = true
    AND (TG_OP = 'INSERT' OR id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'));

  IF current_count >= limit_branches THEN
    RAISE EXCEPTION 'Your subscription only allows % branch(es).', limit_branches;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_staff_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  limit_staff INTEGER;
  current_count INTEGER;
BEGIN
  SELECT plan.max_staff
    INTO limit_staff
  FROM public.get_effective_plan(NEW.business_id) AS plan
  LIMIT 1;

  IF limit_staff IS NULL OR limit_staff <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)
    INTO current_count
  FROM public.employees
  WHERE business_id = NEW.business_id
    AND COALESCE(is_active, true) = true
    AND (TG_OP = 'INSERT' OR id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'));

  IF current_count >= limit_staff THEN
    RAISE EXCEPTION 'Your subscription only allows % staff member(s).', limit_staff;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_business_branch_limit ON public.business_branches;
CREATE TRIGGER trg_business_branch_limit
  BEFORE INSERT OR UPDATE ON public.business_branches
  FOR EACH ROW EXECUTE FUNCTION public.enforce_branch_limit();

DROP TRIGGER IF EXISTS trg_employee_limit ON public.employees;
CREATE TRIGGER trg_employee_limit
  BEFORE INSERT OR UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.enforce_staff_limit();

-- ---------------------------------------------------------------------------
-- RLS policies for the new SaaS tables
-- ---------------------------------------------------------------------------

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_subscription_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_program_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_loyalty_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_debt_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscription plans readable" ON public.subscription_plans;
CREATE POLICY "subscription plans readable" ON public.subscription_plans
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "subscription features readable" ON public.subscription_features;
CREATE POLICY "subscription features readable" ON public.subscription_features
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "business subscriptions owner read" ON public.business_subscriptions;
CREATE POLICY "business subscriptions owner read" ON public.business_subscriptions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.role = 'super_admin' OR p.business_id = business_subscriptions.business_id)
    )
  );

DROP POLICY IF EXISTS "business subscriptions owner manage" ON public.business_subscriptions;
CREATE POLICY "business subscriptions owner manage" ON public.business_subscriptions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "business subscription history read" ON public.business_subscription_history;
CREATE POLICY "business subscription history read" ON public.business_subscription_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.role = 'super_admin' OR p.business_id = business_subscription_history.business_id)
    )
  );

DROP POLICY IF EXISTS "business branches read" ON public.business_branches;
CREATE POLICY "business branches read" ON public.business_branches
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.role = 'super_admin' OR p.business_id = business_branches.business_id)
    )
  );

DROP POLICY IF EXISTS "business branches manage" ON public.business_branches;
CREATE POLICY "business branches manage" ON public.business_branches
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.role = 'super_admin' OR p.business_id = business_branches.business_id)
    )
  );

DROP POLICY IF EXISTS "loyalty settings manage" ON public.loyalty_program_settings;
CREATE POLICY "loyalty settings manage" ON public.loyalty_program_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.role = 'super_admin' OR p.business_id = loyalty_program_settings.business_id)
    )
  );

DROP POLICY IF EXISTS "loyalty accounts manage" ON public.customer_loyalty_accounts;
CREATE POLICY "loyalty accounts manage" ON public.customer_loyalty_accounts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.role = 'super_admin' OR p.business_id = customer_loyalty_accounts.business_id)
    )
  );

DROP POLICY IF EXISTS "loyalty transactions manage" ON public.customer_loyalty_transactions;
CREATE POLICY "loyalty transactions manage" ON public.customer_loyalty_transactions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.role = 'super_admin' OR p.business_id = customer_loyalty_transactions.business_id)
    )
  );

DROP POLICY IF EXISTS "loyalty rewards manage" ON public.loyalty_rewards;
CREATE POLICY "loyalty rewards manage" ON public.loyalty_rewards
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.role = 'super_admin' OR p.business_id = loyalty_rewards.business_id)
    )
  );

DROP POLICY IF EXISTS "customer debts manage" ON public.customer_debts;
CREATE POLICY "customer debts manage" ON public.customer_debts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.role = 'super_admin' OR p.business_id = customer_debts.business_id)
    )
  );

DROP POLICY IF EXISTS "customer debt payments manage" ON public.customer_debt_payments;
CREATE POLICY "customer debt payments manage" ON public.customer_debt_payments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.role = 'super_admin' OR p.business_id = customer_debt_payments.business_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Seed starter plans if they do not exist yet. These are editable in UI.
-- ---------------------------------------------------------------------------

INSERT INTO public.subscription_plans (
  name, monthly_price, yearly_price, max_businesses, max_branches, max_staff, active, description
)
SELECT 'Starter', 1000, 10800, 1, 1, 10, true, 'Basic POS, reports and single-branch operations'
WHERE NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE lower(name) = 'starter');

INSERT INTO public.subscription_plans (
  name, monthly_price, yearly_price, max_businesses, max_branches, max_staff, active, description
)
SELECT 'Professional', 2500, 27000, 1, 3, 15, true, 'Analytics, loyalty and customer credit'
WHERE NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE lower(name) = 'professional');

INSERT INTO public.subscription_plans (
  name, monthly_price, yearly_price, max_businesses, max_branches, max_staff, active, description
)
SELECT 'Enterprise', 0, 0, 1, NULL, NULL, true, 'Unlimited branches and staff with advanced access'
WHERE NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE lower(name) = 'enterprise');

-- Default feature matrix. Admin can edit these from the UI.
INSERT INTO public.subscription_features (plan_id, feature_key, enabled, feature_label, feature_group, sort_order)
SELECT sp.id, v.feature_key, v.enabled, v.feature_label, v.feature_group, v.sort_order
FROM public.subscription_plans sp
CROSS JOIN (
  VALUES
    ('starter', 'standard_pos', true, 'Standard POS', 'operations', 1),
    ('starter', 'basic_reports', true, 'Basic reports', 'analytics', 2),
    ('professional', 'advanced_analytics', true, 'Advanced analytics', 'analytics', 1),
    ('professional', 'loyalty_program', true, 'Loyalty program', 'customer', 2),
    ('professional', 'customer_credit', true, 'Customer credit', 'customer', 3),
    ('professional', 'advanced_reports', true, 'Advanced reports', 'analytics', 4),
    ('enterprise', 'all_features', true, 'All features', 'platform', 1),
    ('enterprise', 'multi_location_analytics', true, 'Multi-location analytics', 'analytics', 2),
    ('enterprise', 'api_access', true, 'API access', 'platform', 3),
    ('enterprise', 'priority_support', true, 'Priority support', 'support', 4)
) AS v(plan_key, feature_key, enabled, feature_label, feature_group, sort_order)
WHERE lower(sp.name) = v.plan_key
ON CONFLICT (plan_id, feature_key) DO UPDATE
SET enabled = EXCLUDED.enabled,
    feature_label = EXCLUDED.feature_label,
    feature_group = EXCLUDED.feature_group,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

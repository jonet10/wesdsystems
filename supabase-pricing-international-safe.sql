-- =================================================================================
-- WESD SYSTEMS - INTERNATIONAL PRICING (SAFE PRODUCTION MIGRATION)
-- Date: 2026-05-18
--
-- Objectif: pricing multi-pays/multi-devise sans casser l'existant.
-- Strategy:
-- 1) Create new canonical tables
-- 2) Backfill from existing tables (currencies, country_pricing, subscription_plans)
-- 3) Keep old table country_pricing untouched (backward compatibility)
-- =================================================================================

BEGIN;

-- 1) Currencies: enrich existing if needed
CREATE TABLE IF NOT EXISTS public.currencies (
  code varchar(3) PRIMARY KEY,
  symbol varchar(8) NOT NULL,
  name varchar(80) NOT NULL,
  locale varchar(12) NOT NULL DEFAULT 'en-US',
  exchange_rate numeric(12,6) DEFAULT 1,
  is_default boolean DEFAULT false,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 2) Countries
CREATE TABLE IF NOT EXISTS public.countries (
  country_code varchar(2) PRIMARY KEY,
  country_name text NOT NULL,
  currency_code varchar(3) NOT NULL REFERENCES public.currencies(code),
  timezone text,
  locale varchar(12),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3) Subscription plans: keep existing table and add "enabled" if missing
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true;

-- 4) New pricing table
CREATE TABLE IF NOT EXISTS public.subscription_plan_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  country_code varchar(2) NOT NULL REFERENCES public.countries(country_code) ON DELETE CASCADE,
  currency_code varchar(3) NOT NULL REFERENCES public.currencies(code),
  monthly_price numeric(12,2) NOT NULL CHECK (monthly_price >= 0),
  yearly_price numeric(12,2) NOT NULL CHECK (yearly_price >= 0),
  promotion_label text,
  promotion_percent numeric(5,2) CHECK (promotion_percent >= 0 AND promotion_percent <= 100),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (plan_id, country_code)
);

CREATE INDEX IF NOT EXISTS idx_subscription_plan_prices_country ON public.subscription_plan_prices(country_code);
CREATE INDEX IF NOT EXISTS idx_subscription_plan_prices_plan ON public.subscription_plan_prices(plan_id);

-- 5) Seed required currencies first (idempotent)
INSERT INTO public.currencies (code, symbol, name, locale, enabled, is_default) VALUES
('HTG', 'G', 'Gourde Haïtienne', 'fr-HT', true, false),
('DOP', 'RD$', 'Peso Dominicain', 'es-DO', true, false),
('EUR', '€', 'Euro', 'fr-FR', true, false),
('USD', '$', 'US Dollar', 'en-US', true, true),
('CAD', 'CA$', 'Dollar Canadien', 'en-CA', true, false)
ON CONFLICT (code) DO UPDATE
SET symbol = EXCLUDED.symbol,
    name = EXCLUDED.name,
    locale = EXCLUDED.locale,
    enabled = EXCLUDED.enabled;

-- 6) Seed countries (idempotent)
INSERT INTO public.countries(country_code, country_name, currency_code, timezone, locale, enabled) VALUES
('HT', 'Haïti', 'HTG', 'America/Port-au-Prince', 'fr-HT', true),
('DO', 'République Dominicaine', 'DOP', 'America/Santo_Domingo', 'es-DO', true),
('FR', 'France', 'EUR', 'Europe/Paris', 'fr-FR', true),
('US', 'États-Unis', 'USD', 'America/New_York', 'en-US', true),
('CA', 'Canada', 'CAD', 'America/Toronto', 'en-CA', true)
ON CONFLICT (country_code) DO UPDATE
SET country_name = EXCLUDED.country_name,
    currency_code = EXCLUDED.currency_code,
    timezone = EXCLUDED.timezone,
    locale = EXCLUDED.locale,
    enabled = EXCLUDED.enabled;

-- 7) Backfill pricing from legacy country_pricing if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'country_pricing'
  ) THEN
    INSERT INTO public.subscription_plan_prices (plan_id, country_code, currency_code, monthly_price, yearly_price, enabled)
    SELECT
      sp.id AS plan_id,
      cp.country_code,
      cp.currency_code,
      cp.monthly_price,
      cp.yearly_price,
      true
    FROM public.country_pricing cp
    JOIN public.subscription_plans sp
      ON lower(sp.name) = lower(cp.plan_name)
    ON CONFLICT (plan_id, country_code) DO UPDATE
    SET currency_code = EXCLUDED.currency_code,
        monthly_price = EXCLUDED.monthly_price,
        yearly_price = EXCLUDED.yearly_price;
  END IF;
END $$;

-- 8) RLS
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plan_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS countries_read_all ON public.countries;
CREATE POLICY countries_read_all ON public.countries
FOR SELECT USING (true);

DROP POLICY IF EXISTS countries_manage_super_admin ON public.countries;
CREATE POLICY countries_manage_super_admin ON public.countries
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (p.role = 'super_admin' OR p.role_normalized = 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (p.role = 'super_admin' OR p.role_normalized = 'super_admin')
  )
);

DROP POLICY IF EXISTS spp_read_all ON public.subscription_plan_prices;
CREATE POLICY spp_read_all ON public.subscription_plan_prices
FOR SELECT USING (true);

DROP POLICY IF EXISTS spp_manage_super_admin ON public.subscription_plan_prices;
CREATE POLICY spp_manage_super_admin ON public.subscription_plan_prices
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (p.role = 'super_admin' OR p.role_normalized = 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (p.role = 'super_admin' OR p.role_normalized = 'super_admin')
  )
);

COMMIT;

-- Rollback (manual)
-- DROP TABLE public.subscription_plan_prices;
-- DROP TABLE public.countries;
-- ALTER TABLE public.subscription_plans DROP COLUMN IF EXISTS enabled;

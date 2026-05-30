-- ═══════════════════════════════════════════════════════════
-- WESD SYSTEMS — Salon Enhancements 
-- Business Profiles, Commission System, Print Engine
-- ═══════════════════════════════════════════════════════════

-- ─── BUSINESS PROFILES ───

CREATE TABLE IF NOT EXISTS public.salon_business_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  slogan TEXT,
  whatsapp TEXT,
  tax_number TEXT,
  website TEXT,
  social_media_links JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(business_id)
);

CREATE INDEX IF NOT EXISTS idx_salon_business_profiles_business ON public.salon_business_profiles(business_id);

-- ─── BUSINESS HOURS ───

CREATE TABLE IF NOT EXISTS public.salon_business_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_open BOOLEAN DEFAULT true,
  open_time TIME DEFAULT '09:00',
  close_time TIME DEFAULT '18:00',
  UNIQUE(business_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_salon_business_hours_business ON public.salon_business_hours(business_id);

-- ─── EMPLOYEE COMMISSION CONFIG ───

ALTER TABLE IF EXISTS public.employees
  ADD COLUMN IF NOT EXISTS base_salary NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_type TEXT DEFAULT 'percentage',
  ADD COLUMN IF NOT EXISTS commission_percentage NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fixed_commission_amount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonuses JSONB DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.employee_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  base_salary NUMERIC(12,2) DEFAULT 0,
  commission_type TEXT DEFAULT 'percentage' CHECK (commission_type IN ('none', 'percentage', 'fixed_amount', 'hybrid', 'custom')),
  commission_percentage NUMERIC(5,2) DEFAULT 0 CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
  fixed_commission_amount NUMERIC(12,2) DEFAULT 0 CHECK (fixed_commission_amount >= 0),
  global_rate NUMERIC(5,2) DEFAULT 0 CHECK (global_rate >= 0 AND global_rate <= 100),
  bonuses JSONB DEFAULT '[]'::jsonb,
  period_start DATE,
  period_end DATE,
  gross_revenue NUMERIC(12,2) DEFAULT 0,
  commission_amount NUMERIC(12,2) DEFAULT 0,
  currency_code VARCHAR(3) DEFAULT 'HTG',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(business_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_commissions_business_employee
  ON public.employee_commissions(business_id, employee_id);

-- ─── COMMISSION RULES ───

CREATE TABLE IF NOT EXISTS public.commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.salon_services(id) ON DELETE CASCADE,
  rate_type TEXT NOT NULL CHECK (rate_type IN ('percentage', 'fixed_amount')),
  rate_value NUMERIC(10,2) NOT NULL CHECK (rate_value >= 0),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commission_rules_employee ON public.commission_rules(employee_id);
CREATE INDEX IF NOT EXISTS idx_commission_rules_service ON public.commission_rules(service_id);
CREATE INDEX IF NOT EXISTS idx_commission_rules_business ON public.commission_rules(business_id);

-- ─── COMMISSION TRANSACTIONS ───

CREATE TABLE IF NOT EXISTS public.commission_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES public.salon_sales(id) ON DELETE SET NULL,
  sale_item_id UUID REFERENCES public.salon_sale_items(id) ON DELETE SET NULL,
  service_id UUID REFERENCES public.salon_services(id) ON DELETE SET NULL,
  rate_type TEXT NOT NULL CHECK (rate_type IN ('percentage', 'fixed_amount')),
  rate_value NUMERIC(10,2) NOT NULL CHECK (rate_value >= 0),
  sale_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  commission_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency_code VARCHAR(3) DEFAULT 'HTG',
  calculated_at TIMESTAMPTZ DEFAULT now(),
  paid_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_commission_tx_employee ON public.commission_transactions(employee_id);
CREATE INDEX IF NOT EXISTS idx_commission_tx_sale ON public.commission_transactions(sale_id);
CREATE INDEX IF NOT EXISTS idx_commission_tx_status ON public.commission_transactions(status);
CREATE INDEX IF NOT EXISTS idx_commission_tx_business ON public.commission_transactions(business_id);
CREATE INDEX IF NOT EXISTS idx_commission_tx_calculated ON public.commission_transactions(calculated_at);

-- ─── COMMISSION REPORT SNAPSHOTS ───

CREATE TABLE IF NOT EXISTS public.commission_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_sales NUMERIC(12,2) DEFAULT 0,
  total_commission NUMERIC(12,2) DEFAULT 0,
  transaction_count INTEGER DEFAULT 0,
  currency_code VARCHAR(3) DEFAULT 'HTG',
  generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  generated_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(business_id, employee_id, period_type, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_commission_reports_business_period
  ON public.commission_reports(business_id, period_type, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_commission_reports_employee
  ON public.commission_reports(employee_id);

-- ─── PRINT TEMPLATES ───

CREATE TABLE IF NOT EXISTS public.print_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  template_type TEXT NOT NULL CHECK (template_type IN ('receipt', 'invoice', 'report', 'appointment')),
  header_text TEXT,
  footer_text TEXT,
  show_logo BOOLEAN DEFAULT true,
  show_address BOOLEAN DEFAULT true,
  show_phone BOOLEAN DEFAULT true,
  show_whatsapp BOOLEAN DEFAULT true,
  show_email BOOLEAN DEFAULT false,
  show_tax_number BOOLEAN DEFAULT false,
  paper_size TEXT DEFAULT 'thermal_80mm' CHECK (paper_size IN ('thermal_80mm', 'a4')),
  custom_css TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(business_id, template_type)
);

CREATE INDEX IF NOT EXISTS idx_print_templates_business ON public.print_templates(business_id);

-- ─── SALON SALES ADD EMPLOYEE SUPPORT ───

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'salon_sales' AND column_name = 'employee_id'
  ) THEN
    ALTER TABLE public.salon_sales ADD COLUMN employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'salon_sales' AND column_name = 'cashier_name'
  ) THEN
    ALTER TABLE public.salon_sales ADD COLUMN cashier_name TEXT;
  END IF;
END $$;

-- ─── RLS POLICIES ───

ALTER TABLE public.salon_business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salon_business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can read own business profile"
    ON public.salon_business_profiles FOR SELECT
    USING (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own business profile"
    ON public.salon_business_profiles FOR INSERT
    WITH CHECK (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own business profile"
    ON public.salon_business_profiles FOR UPDATE
    USING (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can read own business hours"
    ON public.salon_business_hours FOR SELECT
    USING (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can manage own business hours"
    ON public.salon_business_hours FOR INSERT
    WITH CHECK (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own business hours"
    ON public.salon_business_hours FOR UPDATE
    USING (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own business hours"
    ON public.salon_business_hours FOR DELETE
    USING (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can read employee commissions"
    ON public.employee_commissions FOR SELECT
    USING (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can manage employee commissions"
    ON public.employee_commissions FOR ALL
    USING (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()))
    WITH CHECK (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can read commission rules"
    ON public.commission_rules FOR SELECT
    USING (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can manage commission rules"
    ON public.commission_rules FOR INSERT
    WITH CHECK (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update commission rules"
    ON public.commission_rules FOR UPDATE
    USING (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete commission rules"
    ON public.commission_rules FOR DELETE
    USING (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can read commission transactions"
    ON public.commission_transactions FOR SELECT
    USING (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert commission transactions"
    ON public.commission_transactions FOR INSERT
    WITH CHECK (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update commission transactions"
    ON public.commission_transactions FOR UPDATE
    USING (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can read commission reports"
    ON public.commission_reports FOR SELECT
    USING (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can manage commission reports"
    ON public.commission_reports FOR ALL
    USING (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()))
    WITH CHECK (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can read print templates"
    ON public.print_templates FOR SELECT
    USING (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can manage print templates"
    ON public.print_templates FOR INSERT
    WITH CHECK (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update print templates"
    ON public.print_templates FOR UPDATE
    USING (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete print templates"
    ON public.print_templates FOR DELETE
    USING (business_id IN (SELECT business_id FROM public.profiles WHERE id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── HELPERS ───

CREATE OR REPLACE FUNCTION public.calculate_employee_commission_v2(
  p_employee_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
) RETURNS TABLE (
  total_sales NUMERIC,
  total_commission NUMERIC,
  transaction_count BIGINT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(ct.sale_amount), 0)::NUMERIC(12,2) as total_sales,
    COALESCE(SUM(ct.commission_amount), 0)::NUMERIC(12,2) as total_commission,
    COUNT(*)::BIGINT as transaction_count
  FROM public.commission_transactions ct
  WHERE ct.employee_id = p_employee_id
    AND ct.calculated_at >= p_start_date
    AND ct.calculated_at < p_end_date
    AND ct.status != 'cancelled';
END;
$$;

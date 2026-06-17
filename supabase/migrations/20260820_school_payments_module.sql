-- ════════════════════════════════════════════════════════════════════════════
-- WESD SCHOOL PAYMENTS MODULE
-- Core tables, RLS, and triggers for school administration
-- ════════════════════════════════════════════════════════════════════════════

-- ─── SETTINGS ───
CREATE TABLE IF NOT EXISTS public.school_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  logo_url TEXT,
  name TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  currency TEXT DEFAULT 'HTG',
  invoice_prefix TEXT DEFAULT 'FACT-',
  receipt_prefix TEXT DEFAULT 'REC-',
  terms TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(business_id)
);

-- ─── ACADEMIC YEARS ───
CREATE TABLE IF NOT EXISTS public.school_academic_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- ex: '2026-2027'
  start_date DATE,
  end_date DATE,
  active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── CLASSES ───
CREATE TABLE IF NOT EXISTS public.school_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- ex: '7ème AF'
  level TEXT, -- ex: 'Fondamentale', 'Secondaire'
  max_students INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── FEE CATEGORIES ───
CREATE TABLE IF NOT EXISTS public.school_fee_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- ex: 'Inscription', 'Écolage', 'Uniforme'
  description TEXT,
  is_mandatory BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── FEES ───
CREATE TABLE IF NOT EXISTS public.school_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.school_classes(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES public.school_academic_years(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.school_fee_categories(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── PAYMENT TEMPLATES ───
CREATE TABLE IF NOT EXISTS public.school_payment_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.school_classes(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES public.school_academic_years(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- ex: 'Modèle Écolage Standard'
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── PAYMENT TEMPLATE INSTALLMENTS ───
CREATE TABLE IF NOT EXISTS public.school_payment_template_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.school_payment_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL, -- ex: 'Versement 1'
  percentage_or_amount NUMERIC(12,2) NOT NULL,
  is_percentage BOOLEAN DEFAULT false,
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── PARENTS ───
CREATE TABLE IF NOT EXISTS public.school_parents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- for parent portal
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  profession TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── STUDENTS ───
CREATE TABLE IF NOT EXISTS public.school_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL,
  matricule TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  gender TEXT,
  dob DATE,
  address TEXT,
  phone TEXT,
  photo_url TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'graduated', 'transferred')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── STUDENT PARENTS (Join Table) ───
CREATE TABLE IF NOT EXISTS public.school_student_parents (
  student_id UUID NOT NULL REFERENCES public.school_students(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES public.school_parents(id) ON DELETE CASCADE,
  relationship TEXT DEFAULT 'Parent', -- Père, Mère, Tuteur
  is_primary BOOLEAN DEFAULT false,
  PRIMARY KEY (student_id, parent_id)
);

-- ─── ENROLLMENTS ───
CREATE TABLE IF NOT EXISTS public.school_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL,
  student_id UUID NOT NULL REFERENCES public.school_students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.school_classes(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES public.school_academic_years(id) ON DELETE CASCADE,
  enrollment_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'registered' CHECK (status IN ('registered', 'active', 'withdrawn')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── TEACHERS ───
CREATE TABLE IF NOT EXISTS public.school_teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- if they need access
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  subjects TEXT[],
  salary NUMERIC(12,2) DEFAULT 0,
  hire_date DATE,
  photo_url TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── INVOICES ───
CREATE TABLE IF NOT EXISTS public.school_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL,
  student_id UUID NOT NULL REFERENCES public.school_students(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES public.school_academic_years(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'partial', 'paid', 'overdue')),
  issue_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── INVOICE ITEMS ───
CREATE TABLE IF NOT EXISTS public.school_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.school_invoices(id) ON DELETE CASCADE,
  fee_id UUID REFERENCES public.school_fees(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE
);

-- ─── PAYMENT PLANS (CUSTOM INSTALLMENTS PER STUDENT) ───
CREATE TABLE IF NOT EXISTS public.school_payment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.school_invoices(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  title TEXT NOT NULL, -- ex: 'Versement 1'
  amount_due NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'overdue')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── PAYMENTS (RECEIPTS) ───
CREATE TABLE IF NOT EXISTS public.school_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL,
  invoice_id UUID NOT NULL REFERENCES public.school_invoices(id) ON DELETE CASCADE,
  payment_plan_id UUID REFERENCES public.school_payment_plans(id) ON DELETE SET NULL,
  receipt_number TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('Cash', 'MonCash', 'NatCash', 'Virement', 'Chèque', 'Carte bancaire', 'Autre')),
  payment_date TIMESTAMPTZ DEFAULT now(),
  motif TEXT,
  reference TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── EXPENSES ───
CREATE TABLE IF NOT EXISTS public.school_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL,
  category TEXT NOT NULL, -- Salaires, Eau, Électricité, etc.
  amount NUMERIC(12,2) NOT NULL,
  expense_date DATE DEFAULT CURRENT_DATE,
  description TEXT,
  proof_url TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── SEQUENCES FOR NUMBERS ───
CREATE SEQUENCE IF NOT EXISTS public.school_invoice_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.school_receipt_seq START 1;

-- ════════════════════════════════════════════════════════════════════════════
-- RLS (ROW LEVEL SECURITY)
-- ════════════════════════════════════════════════════════════════════════════

DO $$ DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'school_settings', 'school_academic_years', 'school_classes', 'school_fee_categories',
    'school_fees', 'school_payment_templates',
    'school_parents', 'school_students', 'school_enrollments', 'school_teachers',
    'school_invoices', 'school_invoice_items', 'school_payment_plans', 'school_payments',
    'school_expenses'
  ]) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
    
    -- Policy for Business Isolation
    EXECUTE format('
      DROP POLICY IF EXISTS %I ON public.%I;
      CREATE POLICY %I ON public.%I
        FOR ALL
        USING (public.is_super_admin() OR business_id = public.current_user_business_id())
        WITH CHECK (public.is_super_admin() OR business_id = public.current_user_business_id());
    ', format('%s_tenant_guard', tbl), tbl, format('%s_tenant_guard', tbl), tbl);
  END LOOP;
END $$;

-- school_student_parents doesn't have business_id directly, it inherits via student_id
ALTER TABLE public.school_student_parents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS school_student_parents_tenant_guard ON public.school_student_parents;
CREATE POLICY school_student_parents_tenant_guard ON public.school_student_parents
  FOR ALL
  USING (
    public.is_super_admin() OR 
    student_id IN (SELECT id FROM public.school_students WHERE business_id = public.current_user_business_id())
  )
  WITH CHECK (
    public.is_super_admin() OR 
    student_id IN (SELECT id FROM public.school_students WHERE business_id = public.current_user_business_id())
  );

-- school_payment_template_installments inherits via template_id
ALTER TABLE public.school_payment_template_installments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS school_payment_template_installments_tenant_guard ON public.school_payment_template_installments;
CREATE POLICY school_payment_template_installments_tenant_guard ON public.school_payment_template_installments
  FOR ALL
  USING (
    public.is_super_admin() OR 
    template_id IN (SELECT id FROM public.school_payment_templates WHERE business_id = public.current_user_business_id())
  )
  WITH CHECK (
    public.is_super_admin() OR 
    template_id IN (SELECT id FROM public.school_payment_templates WHERE business_id = public.current_user_business_id())
  );

-- ════════════════════════════════════════════════════════════════════════════
-- TRIGGERS & RPC
-- ════════════════════════════════════════════════════════════════════════════

-- Auto Update Updated_at
CREATE OR REPLACE FUNCTION public.update_school_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_school_settings_updated_at BEFORE UPDATE ON public.school_settings FOR EACH ROW EXECUTE FUNCTION update_school_updated_at();
CREATE TRIGGER update_school_invoices_updated_at BEFORE UPDATE ON public.school_invoices FOR EACH ROW EXECUTE FUNCTION update_school_updated_at();
CREATE TRIGGER update_school_payment_plans_updated_at BEFORE UPDATE ON public.school_payment_plans FOR EACH ROW EXECUTE FUNCTION update_school_updated_at();

-- Invoice & Receipt Generation
CREATE OR REPLACE FUNCTION public.generate_school_invoice_number(p_business_id UUID)
RETURNS TEXT LANGUAGE plpgsql
AS $$
DECLARE
  v_prefix TEXT;
  v_next_val BIGINT;
BEGIN
  SELECT invoice_prefix INTO v_prefix FROM public.school_settings WHERE business_id = p_business_id;
  IF v_prefix IS NULL THEN v_prefix := 'FACT-'; END IF;
  v_next_val := nextval('public.school_invoice_seq');
  RETURN v_prefix || LPAD(v_next_val::TEXT, 6, '0');
END $$;

CREATE OR REPLACE FUNCTION public.generate_school_receipt_number(p_business_id UUID)
RETURNS TEXT LANGUAGE plpgsql
AS $$
DECLARE
  v_prefix TEXT;
  v_next_val BIGINT;
BEGIN
  SELECT receipt_prefix INTO v_prefix FROM public.school_settings WHERE business_id = p_business_id;
  IF v_prefix IS NULL THEN v_prefix := 'REC-'; END IF;
  v_next_val := nextval('public.school_receipt_seq');
  RETURN v_prefix || LPAD(v_next_val::TEXT, 6, '0');
END $$;

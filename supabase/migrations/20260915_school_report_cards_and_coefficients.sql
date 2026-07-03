-- Migration 20260915: School report cards, coefficients, and subject domains

-- 1. Create school_subject_domains table
CREATE TABLE IF NOT EXISTS public.school_subject_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (business_id, name)
);

-- Enable RLS on school_subject_domains
ALTER TABLE public.school_subject_domains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_school_subject_domains ON public.school_subject_domains;
CREATE POLICY select_school_subject_domains ON public.school_subject_domains FOR SELECT
  USING (public.is_super_admin() OR business_id = public.current_user_business_id());

DROP POLICY IF EXISTS write_school_subject_domains ON public.school_subject_domains;
CREATE POLICY write_school_subject_domains ON public.school_subject_domains FOR ALL
  USING (
    public.is_super_admin() OR (
      business_id = public.current_user_business_id() AND
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('salon_admin', 'school_admin')
      )
    )
  );

-- 2. Create school_class_subject_coefficients table
CREATE TABLE IF NOT EXISTS public.school_class_subject_coefficients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.school_classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.school_subjects(id) ON DELETE CASCADE,
  coefficient NUMERIC NOT NULL DEFAULT 10,
  domain_id UUID REFERENCES public.school_subject_domains(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (class_id, subject_id)
);

-- Enable RLS on school_class_subject_coefficients
ALTER TABLE public.school_class_subject_coefficients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_school_class_subject_coefficients ON public.school_class_subject_coefficients;
CREATE POLICY select_school_class_subject_coefficients ON public.school_class_subject_coefficients FOR SELECT
  USING (public.is_super_admin() OR business_id = public.current_user_business_id());

DROP POLICY IF EXISTS write_school_class_subject_coefficients ON public.school_class_subject_coefficients;
CREATE POLICY write_school_class_subject_coefficients ON public.school_class_subject_coefficients FOR ALL
  USING (
    public.is_super_admin() OR (
      business_id = public.current_user_business_id() AND
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('salon_admin', 'school_admin')
      )
    )
  );

-- 3. Create school_report_cards table
CREATE TABLE IF NOT EXISTS public.school_report_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.school_students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.school_classes(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES public.school_academic_years(id) ON DELETE CASCADE,
  period_name TEXT NOT NULL, -- Ex: 'Etape 1', 'Etape 2', 'Etape 3', 'Etape 4', 'Annuel'
  total_points NUMERIC NOT NULL DEFAULT 0,
  total_coefficients NUMERIC NOT NULL DEFAULT 0,
  average NUMERIC NOT NULL DEFAULT 0,
  behavior_grade NUMERIC,
  absences_count INT DEFAULT 0,
  tardiness_count INT DEFAULT 0,
  mention TEXT,
  decision TEXT,
  rank INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (student_id, academic_year_id, period_name)
);

-- Enable RLS on school_report_cards
ALTER TABLE public.school_report_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_school_report_cards ON public.school_report_cards;
CREATE POLICY select_school_report_cards ON public.school_report_cards FOR SELECT
  USING (public.is_super_admin() OR business_id = public.current_user_business_id());

DROP POLICY IF EXISTS write_school_report_cards ON public.school_report_cards;
CREATE POLICY write_school_report_cards ON public.school_report_cards FOR ALL
  USING (
    public.is_super_admin() OR (
      business_id = public.current_user_business_id() AND
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('salon_admin', 'school_admin')
      )
    )
  );

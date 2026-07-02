-- ════════════════════════════════════════════════════════════════════════════
-- WESD SCHOOL ENGINE MULTI-TYPE ARCHITECTURE
-- Relation entities for Classic, Vocational, and University setups
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Table de configuration permanente du type d'école
CREATE TABLE IF NOT EXISTS public.school_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE UNIQUE,
  school_type TEXT NOT NULL CHECK (school_type IN ('CLASSIC', 'VOCATIONAL', 'UNIVERSITY')),
  configured_at TIMESTAMPTZ DEFAULT now(),
  configured_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_locked BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Entités de structures académiques relationnelles
CREATE TABLE IF NOT EXISTS public.school_faculties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(business_id, name)
);

CREATE TABLE IF NOT EXISTS public.school_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  faculty_id UUID NOT NULL REFERENCES public.school_faculties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(business_id, faculty_id, name)
);

CREATE TABLE IF NOT EXISTS public.school_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.school_departments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(business_id, name)
);

CREATE TABLE IF NOT EXISTS public.school_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.school_programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(business_id, program_id, name)
);

CREATE TABLE IF NOT EXISTS public.school_semesters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(business_id, name)
);

CREATE TABLE IF NOT EXISTS public.school_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(business_id, name)
);

-- 3. Extension de school_classes pour lier les programmes, semestres et cohortes
ALTER TABLE public.school_classes
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES public.school_programs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS option_id UUID REFERENCES public.school_options(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS semester_id UUID REFERENCES public.school_semesters(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS promotion_id UUID REFERENCES public.school_promotions(id) ON DELETE SET NULL;

-- 4. Extension de school_students avec colonnes relationnelles typées
ALTER TABLE public.school_students
  -- Université
  ADD COLUMN IF NOT EXISTS faculty_id UUID REFERENCES public.school_faculties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.school_departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES public.school_programs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS option_id UUID REFERENCES public.school_options(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS semester_id UUID REFERENCES public.school_semesters(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS promotion_id UUID REFERENCES public.school_promotions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admission_date DATE,
  ADD COLUMN IF NOT EXISTS admission_type TEXT,
  -- Professionnelle
  ADD COLUMN IF NOT EXISTS profession TEXT,
  ADD COLUMN IF NOT EXISTS previous_level TEXT,
  ADD COLUMN IF NOT EXISTS experience TEXT,
  ADD COLUMN IF NOT EXISTS provenance_center TEXT,
  ADD COLUMN IF NOT EXISTS professional_goal TEXT;

-- 5. RLS & Row Level Security policies
ALTER TABLE public.school_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_faculties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_promotions ENABLE ROW LEVEL SECURITY;

-- school_configurations policies
CREATE POLICY select_school_configurations ON public.school_configurations FOR SELECT
  USING (public.is_super_admin() OR business_id = public.current_user_business_id());

CREATE POLICY write_school_configurations ON public.school_configurations FOR ALL
  USING (
    public.is_super_admin() OR (
      business_id = public.current_user_business_id() AND
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('salon_admin', 'school_admin')
      )
    )
  );

-- school_faculties policies
CREATE POLICY select_school_faculties ON public.school_faculties FOR SELECT
  USING (public.is_super_admin() OR business_id = public.current_user_business_id());

CREATE POLICY write_school_faculties ON public.school_faculties FOR ALL
  USING (
    public.is_super_admin() OR (
      business_id = public.current_user_business_id() AND
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('salon_admin', 'school_admin')
      )
    )
  );

-- school_departments policies
CREATE POLICY select_school_departments ON public.school_departments FOR SELECT
  USING (public.is_super_admin() OR business_id = public.current_user_business_id());

CREATE POLICY write_school_departments ON public.school_departments FOR ALL
  USING (
    public.is_super_admin() OR (
      business_id = public.current_user_business_id() AND
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('salon_admin', 'school_admin')
      )
    )
  );

-- school_programs policies
CREATE POLICY select_school_programs ON public.school_programs FOR SELECT
  USING (public.is_super_admin() OR business_id = public.current_user_business_id());

CREATE POLICY write_school_programs ON public.school_programs FOR ALL
  USING (
    public.is_super_admin() OR (
      business_id = public.current_user_business_id() AND
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('salon_admin', 'school_admin')
      )
    )
  );

-- school_options policies
CREATE POLICY select_school_options ON public.school_options FOR SELECT
  USING (public.is_super_admin() OR business_id = public.current_user_business_id());

CREATE POLICY write_school_options ON public.school_options FOR ALL
  USING (
    public.is_super_admin() OR (
      business_id = public.current_user_business_id() AND
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('salon_admin', 'school_admin')
      )
    )
  );

-- school_semesters policies
CREATE POLICY select_school_semesters ON public.school_semesters FOR SELECT
  USING (public.is_super_admin() OR business_id = public.current_user_business_id());

CREATE POLICY write_school_semesters ON public.school_semesters FOR ALL
  USING (
    public.is_super_admin() OR (
      business_id = public.current_user_business_id() AND
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('salon_admin', 'school_admin')
      )
    )
  );

-- school_promotions policies
CREATE POLICY select_school_promotions ON public.school_promotions FOR SELECT
  USING (public.is_super_admin() OR business_id = public.current_user_business_id());

CREATE POLICY write_school_promotions ON public.school_promotions FOR ALL
  USING (
    public.is_super_admin() OR (
      business_id = public.current_user_business_id() AND
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('salon_admin', 'school_admin')
      )
    )
  );

-- 6. Trigger pour mettre à jour configured_at / updated_at
CREATE OR REPLACE FUNCTION public.update_school_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER update_school_configurations_updated_at
  BEFORE UPDATE ON public.school_configurations
  FOR EACH ROW EXECUTE FUNCTION public.update_school_config_updated_at();

-- 7. Migration rétrocompatible automatique pour tous les tenants d'école existants
INSERT INTO public.school_configurations (business_id, school_type, is_locked)
SELECT id, 'CLASSIC', true
FROM public.businesses
WHERE business_type = 'school' OR business_type = 'school_payments'
ON CONFLICT (business_id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- Migration 20260906: School Payroll, Teacher Assignments, Attendance & Subjects
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Create table school_subjects (Subjects Catalogue)
CREATE TABLE IF NOT EXISTS public.school_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (business_id, name)
);

-- 2. Add weeks_per_month config to school_settings
ALTER TABLE public.school_settings 
  ADD COLUMN IF NOT EXISTS weeks_per_month NUMERIC(5,2) DEFAULT 4.33;

-- 3. Create table school_teacher_assignments (Teacher Assignments)
CREATE TABLE IF NOT EXISTS public.school_teacher_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL,
  teacher_id UUID NOT NULL REFERENCES public.school_teachers(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.school_classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.school_subjects(id) ON DELETE CASCADE,
  pay_mode TEXT NOT NULL CHECK (pay_mode IN ('hourly', 'monthly')),
  hourly_rate NUMERIC(12,2) DEFAULT 0,
  hours_per_week NUMERIC(5,2) DEFAULT 0,
  monthly_salary NUMERIC(12,2) DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'HTG' CHECK (currency IN ('HTG', 'USD')),
  schedule JSONB DEFAULT NULL, -- Future schedule storage
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create table school_payroll (Monthly Payroll)
CREATE TABLE IF NOT EXISTS public.school_payroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  teacher_id UUID NOT NULL REFERENCES public.school_teachers(id) ON DELETE CASCADE,
  gross_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  absence_days NUMERIC(5,2) NOT NULL DEFAULT 0,
  deduction NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  paid_at TIMESTAMPTZ,
  pay_method TEXT CHECK (pay_method IN ('Cash', 'MonCash', 'NatCash', 'Virement', 'Chèque', 'Autre')),
  expense_id UUID REFERENCES public.school_expenses(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (branch_id, teacher_id, month, year)
);

-- 5. Create table school_attendance (Absences Register)
CREATE TABLE IF NOT EXISTS public.school_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL CHECK (type IN ('student', 'teacher')),
  person_id UUID NOT NULL, -- references school_students or school_teachers
  class_id UUID REFERENCES public.school_classes(id) ON DELETE CASCADE, -- nullable for teachers
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
  hours_missed NUMERIC(5,2) DEFAULT 0, -- relevant for teachers / specific student tracking
  note TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ════════════════════════════════════════════════════════════════════════════
-- RLS (ROW LEVEL SECURITY) AND POLICIES DEFINITIONS
-- ════════════════════════════════════════════════════════════════════════════

-- Enable RLS on all new tables
ALTER TABLE public.school_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_attendance ENABLE ROW LEVEL SECURITY;

-- ────────── 5.1 RLS POLICIES FOR school_subjects ──────────
DROP POLICY IF EXISTS select_school_subjects ON public.school_subjects;
CREATE POLICY select_school_subjects ON public.school_subjects FOR SELECT
  USING (public.is_super_admin() OR business_id = public.current_user_business_id());

DROP POLICY IF EXISTS insert_school_subjects ON public.school_subjects;
CREATE POLICY insert_school_subjects ON public.school_subjects FOR INSERT
  WITH CHECK (
    public.is_super_admin() OR (
      business_id = public.current_user_business_id() AND
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('salon_admin', 'school_admin', 'school_accountant', 'school_cashier')
      )
    )
  );

DROP POLICY IF EXISTS update_school_subjects ON public.school_subjects;
CREATE POLICY update_school_subjects ON public.school_subjects FOR UPDATE
  USING (
    public.is_super_admin() OR (
      business_id = public.current_user_business_id() AND
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('salon_admin', 'school_admin', 'school_accountant')
      )
    )
  )
  WITH CHECK (
    public.is_super_admin() OR (
      business_id = public.current_user_business_id() AND
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('salon_admin', 'school_admin', 'school_accountant')
      )
    )
  );

DROP POLICY IF EXISTS delete_school_subjects ON public.school_subjects;
CREATE POLICY delete_school_subjects ON public.school_subjects FOR DELETE
  USING (
    public.is_super_admin() OR (
      business_id = public.current_user_business_id() AND
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('salon_admin', 'school_admin')
      )
    )
  );


-- ────────── 5.2 RLS POLICIES FOR school_teacher_assignments ──────────
DROP POLICY IF EXISTS select_school_teacher_assignments ON public.school_teacher_assignments;
CREATE POLICY select_school_teacher_assignments ON public.school_teacher_assignments FOR SELECT
  USING (public.is_super_admin() OR business_id = public.current_user_business_id());

DROP POLICY IF EXISTS insert_school_teacher_assignments ON public.school_teacher_assignments;
CREATE POLICY insert_school_teacher_assignments ON public.school_teacher_assignments FOR INSERT
  WITH CHECK (
    public.is_super_admin() OR (
      business_id = public.current_user_business_id() AND
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('salon_admin', 'school_admin', 'school_accountant')
      )
    )
  );

DROP POLICY IF EXISTS update_school_teacher_assignments ON public.school_teacher_assignments;
CREATE POLICY update_school_teacher_assignments ON public.school_teacher_assignments FOR UPDATE
  USING (
    public.is_super_admin() OR (
      business_id = public.current_user_business_id() AND
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('salon_admin', 'school_admin', 'school_accountant')
      )
    )
  )
  WITH CHECK (
    public.is_super_admin() OR (
      business_id = public.current_user_business_id() AND
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('salon_admin', 'school_admin', 'school_accountant')
      )
    )
  );

DROP POLICY IF EXISTS delete_school_teacher_assignments ON public.school_teacher_assignments;
CREATE POLICY delete_school_teacher_assignments ON public.school_teacher_assignments FOR DELETE
  USING (
    public.is_super_admin() OR (
      business_id = public.current_user_business_id() AND
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('salon_admin', 'school_admin')
      )
    )
  );


-- ────────── 5.3 RLS POLICIES FOR school_payroll (RESTRICTED TO DIRECTOR / ACCOUNTANT) ──────────
DROP POLICY IF EXISTS select_school_payroll ON public.school_payroll;
CREATE POLICY select_school_payroll ON public.school_payroll FOR SELECT
  USING (
    public.is_super_admin() OR (
      business_id = public.current_user_business_id() AND
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('salon_admin', 'school_admin', 'school_accountant')
      )
    )
  );

DROP POLICY IF EXISTS insert_school_payroll ON public.school_payroll;
CREATE POLICY insert_school_payroll ON public.school_payroll FOR INSERT
  WITH CHECK (
    public.is_super_admin() OR (
      business_id = public.current_user_business_id() AND
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('salon_admin', 'school_admin', 'school_accountant')
      )
    )
  );

DROP POLICY IF EXISTS update_school_payroll ON public.school_payroll;
CREATE POLICY update_school_payroll ON public.school_payroll FOR UPDATE
  USING (
    public.is_super_admin() OR (
      business_id = public.current_user_business_id() AND
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('salon_admin', 'school_admin', 'school_accountant')
      )
    )
  )
  WITH CHECK (
    public.is_super_admin() OR (
      business_id = public.current_user_business_id() AND
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('salon_admin', 'school_admin', 'school_accountant')
      )
    )
  );

DROP POLICY IF EXISTS delete_school_payroll ON public.school_payroll;
CREATE POLICY delete_school_payroll ON public.school_payroll FOR DELETE
  USING (
    public.is_super_admin() OR (
      business_id = public.current_user_business_id() AND
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('salon_admin', 'school_admin')
      )
    )
  );


-- ────────── 5.4 RLS POLICIES FOR school_attendance ──────────
DROP POLICY IF EXISTS select_school_attendance ON public.school_attendance;
CREATE POLICY select_school_attendance ON public.school_attendance FOR SELECT
  USING (
    public.is_super_admin() OR 
    business_id = public.current_user_business_id()
  );

DROP POLICY IF EXISTS insert_school_attendance ON public.school_attendance;
CREATE POLICY insert_school_attendance ON public.school_attendance FOR INSERT
  WITH CHECK (
    public.is_super_admin() OR (
      business_id = public.current_user_business_id() AND
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('salon_admin', 'school_admin', 'school_accountant', 'school_cashier', 'school_teacher')
      )
    )
  );

DROP POLICY IF EXISTS update_school_attendance ON public.school_attendance;
CREATE POLICY update_school_attendance ON public.school_attendance FOR UPDATE
  USING (
    public.is_super_admin() OR (
      business_id = public.current_user_business_id() AND
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('salon_admin', 'school_admin', 'school_accountant', 'school_cashier', 'school_teacher')
      )
    )
  )
  WITH CHECK (
    public.is_super_admin() OR (
      business_id = public.current_user_business_id() AND
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('salon_admin', 'school_admin', 'school_accountant', 'school_cashier', 'school_teacher')
      )
    )
  );

DROP POLICY IF EXISTS delete_school_attendance ON public.school_attendance;
CREATE POLICY delete_school_attendance ON public.school_attendance FOR DELETE
  USING (
    public.is_super_admin() OR (
      business_id = public.current_user_business_id() AND
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('salon_admin', 'school_admin', 'school_accountant')
      )
    )
  );


-- ════════════════════════════════════════════════════════════════════════════
-- DATA SEEDING & MIGRATION OF EXISTING BUSINESSES
-- ════════════════════════════════════════════════════════════════════════════

-- Pre-populate school_subjects for all existing businesses using School module
DO $$
DECLARE
  v_biz RECORD;
  v_subject TEXT;
  v_subjects TEXT[] := ARRAY[
    'Mathématiques', 'Français', 'Créole', 'Sciences Naturelles', 
    'Histoire-Géographie', 'Anglais', 'Espagnol', 'Éducation Civique', 
    'Éducation Physique', 'Arts Plastiques', 'Informatique', 'Comptabilité'
  ];
BEGIN
  FOR v_biz IN 
    SELECT id FROM public.businesses 
    WHERE business_type = 'school' OR business_type = 'school_payments'
  LOOP
    FOREACH v_subject IN ARRAY v_subjects LOOP
      INSERT INTO public.school_subjects (business_id, name)
      VALUES (v_biz.id, v_subject)
      ON CONFLICT (business_id, name) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

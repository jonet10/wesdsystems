-- 1. Create table school_timetables
CREATE TABLE IF NOT EXISTS public.school_timetables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL,
  class_id UUID NOT NULL REFERENCES public.school_classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.school_subjects(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.school_teachers(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7), -- 1 = Lundi, 7 = Dimanche
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  classroom TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Prevent double booking:
  -- 1. A teacher cannot be in two places at the same time
  UNIQUE (teacher_id, day_of_week, start_time),
  -- 2. A class cannot have two courses at the same time
  UNIQUE (class_id, day_of_week, start_time),
  -- 3. A classroom cannot host two courses at the same time (if specified)
  UNIQUE (classroom, day_of_week, start_time)
);

-- 2. Create table school_exams
CREATE TABLE IF NOT EXISTS public.school_exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.business_branches(id) ON DELETE SET NULL,
  class_id UUID NOT NULL REFERENCES public.school_classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.school_subjects(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES public.school_academic_years(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- e.g. "Contrôle 1", "Examen 1er Trimestre"
  max_points NUMERIC(6,2) NOT NULL DEFAULT 100.00,
  coefficient NUMERIC(4,2) NOT NULL DEFAULT 1.00,
  exam_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create table school_grades
CREATE TABLE IF NOT EXISTS public.school_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  exam_id UUID NOT NULL REFERENCES public.school_exams(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.school_students(id) ON DELETE CASCADE,
  points_obtained NUMERIC(6,2) NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (exam_id, student_id)
);

-- 4. Create table school_sms_settings
CREATE TABLE IF NOT EXISTS public.school_sms_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL UNIQUE REFERENCES public.businesses(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'Mock' CHECK (provider IN ('Twilio', 'Mock')),
  api_key TEXT,
  sender_id TEXT,
  enable_attendance_alert BOOLEAN NOT NULL DEFAULT false,
  enable_payment_alert BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Create table school_sms_logs
CREATE TABLE IF NOT EXISTS public.school_sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  recipient TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ════════════════════════════════════════════════════════════════════════════
-- ENABLE RLS & DEFINE POLICIES
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.school_timetables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_sms_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_sms_logs ENABLE ROW LEVEL SECURITY;

-- General SELECT policy for timetables, exams, and grades (accessible to all school members)
CREATE POLICY select_school_timetables ON public.school_timetables FOR SELECT
  USING (public.is_super_admin() OR business_id = public.current_user_business_id());

CREATE POLICY select_school_exams ON public.school_exams FOR SELECT
  USING (public.is_super_admin() OR business_id = public.current_user_business_id());

CREATE POLICY select_school_grades ON public.school_grades FOR SELECT
  USING (public.is_super_admin() OR business_id = public.current_user_business_id());

-- Write policies for timetables, exams, and grades (accessible to teachers, admins, accountants)
CREATE POLICY write_school_timetables ON public.school_timetables FOR ALL
  USING (
    public.is_super_admin() OR (
      business_id = public.current_user_business_id() AND
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('salon_admin', 'school_admin', 'school_accountant', 'school_teacher')
      )
    )
  );

CREATE POLICY write_school_exams ON public.school_exams FOR ALL
  USING (
    public.is_super_admin() OR (
      business_id = public.current_user_business_id() AND
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('salon_admin', 'school_admin', 'school_accountant', 'school_teacher')
      )
    )
  );

CREATE POLICY write_school_grades ON public.school_grades FOR ALL
  USING (
    public.is_super_admin() OR (
      business_id = public.current_user_business_id() AND
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('salon_admin', 'school_admin', 'school_accountant', 'school_teacher')
      )
    )
  );

-- SMS Settings Policies (Restricted to admins)
CREATE POLICY select_school_sms_settings ON public.school_sms_settings FOR SELECT
  USING (
    public.is_super_admin() OR (
      business_id = public.current_user_business_id() AND
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('salon_admin', 'school_admin')
      )
    )
  );

CREATE POLICY write_school_sms_settings ON public.school_sms_settings FOR ALL
  USING (
    public.is_super_admin() OR (
      business_id = public.current_user_business_id() AND
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('salon_admin', 'school_admin')
      )
    )
  );

-- SMS Logs Policies (SELECT only, restricted to admins/accountants)
CREATE POLICY select_school_sms_logs ON public.school_sms_logs FOR SELECT
  USING (
    public.is_super_admin() OR (
      business_id = public.current_user_business_id() AND
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('salon_admin', 'school_admin', 'school_accountant')
      )
    )
  );

CREATE POLICY insert_school_sms_logs ON public.school_sms_logs FOR INSERT
  WITH CHECK (
    public.is_super_admin() OR business_id = public.current_user_business_id()
  );

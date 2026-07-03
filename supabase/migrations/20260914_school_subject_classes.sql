-- Migration 20260914: Create junction table school_subject_classes for many-to-many subjects to classes mapping
CREATE TABLE IF NOT EXISTS public.school_subject_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.school_subjects(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.school_classes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (subject_id, class_id)
);

-- Migrate any existing single class_id associations from school_subjects
INSERT INTO public.school_subject_classes (business_id, subject_id, class_id)
SELECT business_id, id, class_id
FROM public.school_subjects
WHERE class_id IS NOT NULL
ON CONFLICT (subject_id, class_id) DO NOTHING;

-- Enable Row Level Security (RLS)
ALTER TABLE public.school_subject_classes ENABLE ROW LEVEL SECURITY;

-- Policies for school_subject_classes
DROP POLICY IF EXISTS select_school_subject_classes ON public.school_subject_classes;
CREATE POLICY select_school_subject_classes ON public.school_subject_classes FOR SELECT
  USING (public.is_super_admin() OR business_id = public.current_user_business_id());

DROP POLICY IF EXISTS write_school_subject_classes ON public.school_subject_classes;
CREATE POLICY write_school_subject_classes ON public.school_subject_classes FOR ALL
  USING (
    public.is_super_admin() OR (
      business_id = public.current_user_business_id() AND
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('salon_admin', 'school_admin')
      )
    )
  );

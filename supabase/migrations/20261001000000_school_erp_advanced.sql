-- ════════════════════════════════════════════════════════════════════════════
-- Migration 20261001000000: ERP Scolaire Avancé - Workflow de notes & Assiduité
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Extension de la table school_attendance (Présences & Retards)
ALTER TABLE public.school_attendance
  ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES public.school_teachers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES public.school_subjects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS time TIME DEFAULT CURRENT_TIME,
  ADD COLUMN IF NOT EXISTS scheduled_time TIME,
  ADD COLUMN IF NOT EXISTS actual_time TIME,
  ADD COLUMN IF NOT EXISTS delay_minutes INTEGER;

-- 2. Extension de la table school_exams (Workflow de validation des notes)
ALTER TABLE public.school_exams
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'validated')),
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS validated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 3. Création des index de performance pour les grandes écoles
CREATE INDEX IF NOT EXISTS idx_school_attendance_student_search
  ON public.school_attendance (business_id, person_id, type, status);

CREATE INDEX IF NOT EXISTS idx_school_attendance_class_date
  ON public.school_attendance (business_id, class_id, date);

CREATE INDEX IF NOT EXISTS idx_school_exams_workflow
  ON public.school_exams (business_id, class_id, subject_id, status);

CREATE INDEX IF NOT EXISTS idx_school_grades_student
  ON public.school_grades (business_id, student_id);

-- 4. Recharger le cache du schéma de Supabase pour PostgREST
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Migration: Add scholarship fields to school_students
-- Date: 20260828
-- ============================================================================

ALTER TABLE public.school_students 
  ADD COLUMN IF NOT EXISTS scholarship_type TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS scholarship_percentage NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scholarship_note TEXT;

-- Validation pour s'assurer que scholarship_type est l'une des valeurs autorisées
ALTER TABLE public.school_students 
  ADD CONSTRAINT school_students_scholarship_type_check 
  CHECK (scholarship_type IN ('none', 'half', 'full'));

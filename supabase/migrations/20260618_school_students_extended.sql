-- ============================================================================
-- Extend school_students with detailed Haitian forms fields
-- ============================================================================

ALTER TABLE public.school_students
  ADD COLUMN IF NOT EXISTS birth_department TEXT,
  ADD COLUMN IF NOT EXISTS birth_commune TEXT,
  ADD COLUMN IF NOT EXISTS birth_place TEXT,
  ADD COLUMN IF NOT EXISTS is_handicapped BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS handicap_type TEXT,
  ADD COLUMN IF NOT EXISTS shift TEXT, -- Vacances (AM/PM)
  ADD COLUMN IF NOT EXISTS education_level TEXT, -- Niveau d'enseignement
  ADD COLUMN IF NOT EXISTS class_level TEXT, -- Niveau d'études
  ADD COLUMN IF NOT EXISTS address_department TEXT,
  ADD COLUMN IF NOT EXISTS address_commune TEXT,
  ADD COLUMN IF NOT EXISTS address_section TEXT,
  ADD COLUMN IF NOT EXISTS address_neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS mother_info JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS father_info JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS responsible_person_info JSONB DEFAULT '{}'::jsonb;

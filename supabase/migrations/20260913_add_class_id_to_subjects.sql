-- Migration 20260913: Add class_id to school_subjects to allow class-specific subjects
ALTER TABLE public.school_subjects 
  ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.school_classes(id) ON DELETE CASCADE;

-- Drop old unique constraint and add new one incorporating class_id
ALTER TABLE public.school_subjects DROP CONSTRAINT IF EXISTS school_subjects_business_id_name_key;

-- Since class_id can be null (for backward compatibility), the unique constraint handles business_id + class_id + name
-- Note: Postgres allows multiple NULL values in UNIQUE constraints, which is correct for global subjects.
ALTER TABLE public.school_subjects 
  ADD CONSTRAINT school_subjects_business_id_class_id_name_key UNIQUE (business_id, class_id, name);

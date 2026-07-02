-- Add job_title column to school_teachers to support all staff types
-- (Professeur, Secrétaire, Informaticien, Comptable, Directeur, etc.)
ALTER TABLE public.school_teachers 
  ADD COLUMN IF NOT EXISTS job_title TEXT DEFAULT 'Professeur';

COMMENT ON COLUMN public.school_teachers.job_title IS 
  'Fonction du membre du personnel : Professeur, Secrétaire, Informaticien, Comptable, Directeur, Bibliothécaire, Agent d''entretien, Surveillant, Autre';

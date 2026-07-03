-- Migration 20260916: Add evaluation_period_type to school_configurations and period_name to school_exams
ALTER TABLE public.school_configurations 
  ADD COLUMN IF NOT EXISTS evaluation_period_type TEXT NOT NULL DEFAULT 'steps' 
  CHECK (evaluation_period_type IN ('steps', 'trimestres'));

ALTER TABLE public.school_exams
  ADD COLUMN IF NOT EXISTS period_name TEXT NOT NULL DEFAULT 'Etape 1';

-- Reload Supabase schema cache
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Migration: Add fee_type to school_fee_categories
-- Date: 20260828
-- ============================================================================

ALTER TABLE public.school_fee_categories 
  ADD COLUMN IF NOT EXISTS fee_type TEXT DEFAULT 'tuition';

-- Update existing "Inscription" or similar categories to 'enrollment' if possible
UPDATE public.school_fee_categories 
SET fee_type = 'enrollment' 
WHERE name ILIKE '%inscription%' OR name ILIKE '%admission%';

-- Add a check constraint
ALTER TABLE public.school_fee_categories 
  ADD CONSTRAINT school_fee_categories_fee_type_check 
  CHECK (fee_type IN ('tuition', 'enrollment', 'other'));

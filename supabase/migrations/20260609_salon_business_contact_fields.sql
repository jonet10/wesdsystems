-- ============================================================================
-- Persist salon contact fields on salon_business_profiles instead of businesses
-- ============================================================================

ALTER TABLE public.salon_business_profiles
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT;

